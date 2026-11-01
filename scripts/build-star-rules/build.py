#!/usr/bin/env python3
"""Stream v4.0 CC BY 4.0 -> exact resident/borrowed natal rules; see README.md."""
import argparse
import collections
import functools
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import re
import unicodedata

# Reuse the original sentence boundaries and filters, including its OVERLAY rule.
_spec = importlib.util.spec_from_file_location('star_db_build', Path(__file__).parents[1] / 'build-star-db/build.py')
import sys
sys.path.insert(0, str(Path(__file__).parents[1] / 'build-star-db'))
_base = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_base)
STARS = _base.STARS
AUX = '左辅 右弼 文昌 文曲 天魁 天钺 禄存 天马'.split()
SUPPORT = AUX + '擎羊 陀罗 火星 铃星 地空 地劫'.split()
TOPICS = dict(overview='命宫', personality='命宫', love='夫妻', career='官禄', wealth='财帛', health='疾厄', family='兄弟', children='子女', move='迁移', friends='仆役', home='田宅', spirit='福德', parents='父母')
HEAD = re.compile(r'^\*\*【([^\n]+?)】\*\*\s*$|^## ([^\n]+)$', re.M)
PAL = re.compile(r'^▍\*\*[^\n]*? · ([^*]+)\*\*：')
AUX_LINE = re.compile(r'^✦ \*\*([^*]+)\*\*：(.+)')
HUA = re.compile(r'^.*?\*\*(' + '|'.join(STARS + AUX) + r')化([禄权科忌])\*\*（落([^·）]+)[^）]*）(?:→ (.*))?$')
PAIR = re.compile(r'^### [^「]*「([^+]+)\+([^」]+)」')
INTERNAL = re.compile(r'倪|天纪|★\s*校勘|待核|本平台|数据集|检索|你这盘|本盘|讲课|讲座|讲次|集数|时间码|断这类盘|传统断法|断法认为')
DANGER = re.compile(r'血光|见血|刑伤|刑克|克父母|克夫|克妻|官非|官司|牢狱|夭|早逝|死|癌|重病|灾|孤独终老|一生|一辈子|必然|必定|必有|必是|一定|注定|离婚|凶格|凶象|囚星|劫难|杀气|破财|暴富|暴亏|稳赚|财色两空|烂桃花|伤身|伤人|受伤|欺负|被劫|被烧|被冲|被压|背刺|暗算|卷款|诈骗|偷|淫|荡|大坎|意外打断|火烧|被骗|信错人|孤君|命运|暴起暴落|七秒决策法|先做了再说|孤注一掷')
DISEASE = re.compile(r'疾病|健康|病|器官|脏腑|眼疾|眼睛|痔|肾|肝|癌|血压|心脏|心血|胃|肠|肺|鼻炎|内分泌|月经|妇科|皮肤|过敏|失眠|睡眠|神经|免疫|血液|下腹|脾|胆|手术|医疗保险|良医')
# Extra conditions not represented by a precise same-palace star/mark/brightness predicate.
UNBOUND = re.compile(r'若|如果|如有|逢|加煞|会照|同会|来会|没有|不见|只有|独守|女命|男命|三方|对冲|对宫|相夹|羊陀|火铃|命宫又|最喜|极忌|再遇|同度|最集中|地支配|昌曲|铃贪格|火贪格|30\+|中年前|中年后')
BRIGHT = re.compile(r'不得地|庙旺|入庙|落陷|陷地|失陷|不亮|得地|庙|旺|陷|不|得|利|平|闲|地')
# Single-character everyday words (有利/平时/得到) are not assertions.
ASSERTION = re.compile(r'不得地|庙旺|入庙|落陷|陷地|失陷|不亮|得地|庙|陷|闲|明亮|偏亮|过亮|不仅亮|亮度|(?:亮度为|为|处于|处在|在|入)[「（\"“]?[旺利平不地]|[（(][旺得利平不地][）)]|(?:' + '|'.join(STARS + AUX) + r')(?:星)?(?:为|处于|在|入)?[旺得利平不地](?:[，。；：）]|$)')
BRIGHT_VALUES = {'庙旺': ['庙', '旺'], '入庙': ['庙'], '庙': ['庙'], '旺': ['旺'], '落陷': ['陷'], '陷地': ['陷'], '失陷': ['陷'], '陷': ['陷'], '得地': ['得'], '得': ['得'], '利': ['利'], '平': ['平'], '闲': ['闲'], '不': ['不'], '地': ['地']}
# Exact whole-sentence rewrites only. No keyword deletion, model rewriting, or diagnosis salvage.
REWRITES = {
    '左辅入命——稳重厚道，一生多助缘，贵人在侧。': '为人稳重厚道，可以通过协作积累支持。',
    '兄弟合伙稳赚，但规模有限。': '与手足合作可以偏重稳健经营，先明确分工与规模。',
    '天同 + 天魁，主温和命格得长辈疼爱——一辈子总有男性长辈疼你、保护你。': '待人温和，容易得到男性长辈的关照与建议。',
    '天府 + 右弼，主下属忠诚 + 财库稳——一辈子身边总有几位关键人物为你守护财源。': '可以通过可靠的团队协作，建立稳定的财务管理。',
    '天梁 + 天魁，男性长辈关照你的命——一辈子有男性贵人持续支持。': '容易从男性长辈处获得经验支持，可以主动请教。',
    '化忌，福德受损，感情多波折，生活中不顺心事增多，宜主动调整心态积极面对。': '情绪容易受牵动，可以为压力安排稳定的疏解方式。',
}


# Auditable sentence exclusions: omit whole sentences, never soften by deleting words.
WEAK_EXCLUSIONS = [
    ('贬义或评判性人格标签', re.compile(r'拖延|懒|混日子|不成器|成少败多|没出息|一事无成|只会|聪明反被聪明误|多变难成|落地的极少|不沉淀|心存芥蒂|没人欣赏|再会说也没人听|讲话直接得罪人|被传话|被议论|决策能力被进一步削弱|主观固执|自我怀疑折磨|破旧不立新|再赚也存不下|慢半拍|慢了别人半拍|想变又难下决心|主长辈缘紧张|破坏力化为')),
    ('过度具体或跨话题的职业才艺清单', re.compile(r'音乐|舞蹈|绘画|学者、|学者命|大学教授|行业元老|宗教讲师|医疗、公益|艺术疗愈|儿童教育|私人银行家|投资顾问|金融分析师|投资银行家|税务/审计|CFO|CTO|CEO|董事会主席|协会会长|军师型高管|激励型高管|高管副手|外交、公关|公关、外交|艺术经纪|演讲、艺术、咨询|文教、出版、行政|演讲、表演、咨询|出差、物流、贸易|战略型创业|演讲型领袖|文学、艺术、心理|文学、设计、品牌|法律、行政、文官|演艺圈|KOL|家族企业管理、|销售总监|演讲家、培训师|记者、作家|主播、辩论|技术型创业、|艺术类专业、|应酬、公关、销售|检察、法务|财务规划、会计审计|布道者')),
    ('绝对化评价或财富地位许诺', re.compile(r'最好的状态|最好的格局|最理想|最强组合|稳健富格|顺风顺水|一次正确的人脉|改变财富层级|改变你财运轨迹|赚大钱|赚钱猛|衣食无忧|财运大旺|丰厚收益|福报源于厚德|孝顺听话|长大后反哺|家运渐兴|独立做事反而压抑命格|能成大器|桃花极重|多角恋|最终往往不了了之|大成也有大败|实质帮助有限|能力被埋没的可能性高|有名而无实利|财库隐患|投资踩雷|收不回|父母或长辈常不在身边|早早离家|不宜久居一地|最适合|最佳|最顺|最旺|天生聚才聚势|不必强势就能|第一贵人|夜晚贵人|白天贵人|学业顺遂|成功格局象征|极具话语权|极有话语权|社会地位与话语权显著提升|情感生活复杂')),
    ('过度具体的投资操作或生活指令', re.compile(r'定投|自动扣款|长期布局型投资|谨慎驾驶|年轻时尤其|需防桃花是非|强制落实|每天写下三个|先停三秒')),
]
# Borrowed stars must never be described as resident, even inside a surviving sentence.
BORROWED_RESIDENT = re.compile(r'坐|同宫|入命|入宫|守命|守宫|本宫|你的[^，。；：]{0,5}宫')


def weak_reason(text):
    return next((reason for reason, pattern in WEAK_EXCLUSIONS if pattern.search(text)), None)


def palace(s):
    s = s.strip().removesuffix('宫')
    return '命宫' if s == '命' else '仆役' if s in ('交友', '奴仆') else s


def normalize_brightness(raw):
    return BRIGHT_VALUES.get(raw)  # 不亮/不得地 are ambiguous: never infer a three-band equivalence.


def sections(text):
    marks = list(HEAD.finditer(text))
    for i, m in enumerate(marks):
        name = m[1] or m[2]
        if name == '三方四正联动' or name.startswith('四化路径') or '主辅煞组合精细' in name:
            yield name, text[m.end():marks[i+1].start() if i+1 < len(marks) else len(text)].strip()


@functools.lru_cache(maxsize=512)
def extract_section(name, body, p, resident, borrowed=False):
    out = []
    lines = body.splitlines()
    if name == '三方四正联动':
        ctx = None
        for line in lines:
            line = line.strip()
            m = PAL.match(line)
            if m:
                ctx = palace(m[1])
            a = AUX_LINE.match(line)
            if a and ctx and a[1] in AUX:
                out.append(('aux', ctx, a[1], '', '', a[2]))
    elif name.startswith('四化路径'):
        for i, line in enumerate(lines):
            m = HUA.match(line.strip())
            if not m:
                continue
            star, mark, pal, text = m.groups()
            if not text and i+1 < len(lines) and lines[i+1].startswith('   '):
                text = lines[i+1].strip()
            if text:
                out.append(('sihua', palace(pal), star, '', mark, text))
    elif resident or borrowed:
        for i, line in enumerate(lines):
            m = PAIR.match(line)
            if not m or m[1] not in STARS or m[2] not in SUPPORT:
                continue
            para = []
            for other in lines[i+1:]:
                if other.startswith('###'):
                    break
                if other.strip():
                    para.append(other.strip())
            if para:
                out.append(('pair' if resident else 'bpair', p, m[1], m[2], '', ' '.join(para)))
    return tuple(out)


def clean_candidate(kind, star, other, mark, body, excluded=None):
    """Return [(text, brightness predicates, extra natal marks, rewrite source)], reasons."""
    reasons = collections.Counter()
    # Normalize an explicit prefix, never lose its natal mark.
    prefix = re.match(r'^化([禄权科忌])：', body)
    if prefix:
        if mark and mark != prefix[1]:
            return [], collections.Counter(mark_conflict=1)
        mark = prefix[1]
        body = body[prefix.end():]
    units = _base.sentences(body)
    if not units:
        return [], collections.Counter(malformed=1)
    # 忌 only accepts an audited mild paragraph; no salvaging a second sentence from a threat.
    if mark == '忌' and body not in REWRITES and (DANGER.search(body) or DISEASE.search(body) or not re.search(r'压力|牵挂|留心|调整心态', body)):
        return [], collections.Counter(ji_not_mild=1)
    out = []
    for original in units:
        original = original.strip()
        if INTERNAL.search(original) or _base.RESTRICTED.search(original):
            reasons['restricted_internal'] += 1
            continue
        if DISEASE.search(original):
            reasons['disease_organ'] += 1
            continue
        rewrite = original if original in REWRITES else ''
        text = REWRITES.get(original, original)
        if DANGER.search(text) or _base.UNSAFE.search(text):
            reasons['unsafe_fatalistic'] += 1
            continue
        reason = weak_reason(text)
        if reason:
            reasons['weak_excluded'] += 1
            if excluded is not None:
                excluded.append((original, reason))
            continue
        if kind == 'bpair' and BORROWED_RESIDENT.search(text):
            reasons['borrowed_resident_wording'] += 1
            continue
        if UNBOUND.search(text) or any(s in text for s in set(STARS + AUX + SUPPORT) - {star, other}):
            reasons['unbound_condition'] += 1
            continue
        brightness = []
        if ASSERTION.search(body):
            # Conditions apply to the whole source paragraph, including neutral continuation
            # sentences. Never detach a consequent from an earlier brightness premise.
            claims = re.finditer(r'(庙旺|入庙|落陷|陷地|失陷|得地|庙|陷|闲)|(?:亮度为|为|处于|处在|在|入|' + '|'.join(STARS + AUX) + r')([旺得利平不地])(?:[，。；：）]|$)|[（(]([旺得利平不地])[）)]', body)
            assertions = [next(g for g in m.groups() if g) for m in claims]
            if len(assertions) != 1 or re.search(r'不亮|不得地|明亮|偏亮|过亮|不仅亮|并非|不是|不在|未入', body):
                reasons['ambiguous_brightness'] += 1
                continue
            raw = assertions[0]
            subject = [s for s in STARS + AUX + SUPPORT if s in body]
            if len(set(subject)) != 1 or subject[0] not in (star, other):
                reasons['ambiguous_brightness'] += 1
                continue
            brightness = [[subject[0], raw, normalize_brightness(raw)]]
        extra_marks = []
        marks = re.findall(r'化([禄权科忌])', text)
        if marks:
            if kind != 'sihua' or any(h != mark for h in marks):
                reasons['unbound_sihua'] += 1
                continue
            text = re.sub(r'^化[禄权科忌][，：]?', '', text)
        if _base.OVERLAY.search(text):
            reasons['overlay'] += 1
            continue
        text = re.sub(r'\*|^>', '', text).strip()
        if not 8 <= len(text) <= 150:
            reasons['length'] += 1
            continue
        out.append((text, brightness, extra_marks, rewrite))
    return out, reasons


def sha256(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024*1024), b''):
            h.update(chunk)
    return h.hexdigest()


def build(inputs, output, stats_path):
    import zstandard
    raw = collections.Counter()
    records = 0
    sources, growth = [], []
    for name in sorted(inputs):
        path = Path(name)
        before = len(raw)
        sources.append(dict(file=path.name, sha256=sha256(path)))
        with path.open('rb') as f, zstandard.ZstdDecompressor(max_window_size=2**31).stream_reader(f) as reader:
            for line in io.TextIOWrapper(reader, encoding='utf-8'):
                row = json.loads(line)
                records += 1
                for topic, text in row['c'].items():
                    if topic not in TOPICS:
                        continue
                    main = re.search(r'本宫主星[：:]([^\n]+)', text)
                    resident = bool(main and '空宫' not in main[1])
                    borrowed = bool(main and '空宫' in main[1])
                    for title, body in sections(text):
                        raw.update(extract_section(title, body, TOPICS[topic], resident, borrowed))
        growth.append(dict(file=path.name, new_candidates=len(raw)-before, cumulative_candidates=len(raw)))
        print(f'{path.name}: {records} records; {len(raw)} candidates (+{len(raw)-before})', flush=True)
    counts = collections.defaultdict(collections.Counter)
    dropped, rewrite_hits = collections.Counter(), collections.Counter()
    rewritten = {}
    weak_audit = collections.Counter()
    for (kind, p, star, other, mark, body), frequency in sorted(raw.items()):
        excluded = []
        kept, reasons = clean_candidate(kind, star, other, mark, body, excluded)
        for sentence, reason in excluded:
            weak_audit[(sentence, reason)] += frequency
        for reason, n in reasons.items():
            dropped[reason] += n * frequency
        for text, brightness, extra_marks, rewrite in kept:
            key = '|'.join([kind, p, star, other, mark])
            condition = json.dumps([brightness, extra_marks], ensure_ascii=False, separators=(',', ':'))
            counts[(key, condition)][text] += frequency
            if rewrite:
                rewrite_hits[rewrite] += frequency
                rewritten[rewrite] = text
    selected = []
    for (key, condition), texts in sorted(counts.items()):
        text = min(texts, key=lambda t: (-texts[t], t))
        selected.append((key, text, *json.loads(condition)))
    texts = sorted({s[1] for s in selected})
    text_ids = {t: i for i, t in enumerate(texts)}
    rules, index = [], collections.defaultdict(list)
    for key, text, brightness, extra_marks in selected:
        index[key].append(len(rules))
        rules.append([text_ids[text], brightness, extra_marks])
    meta = dict(source='紫微斗数开源解读数据集 v4.0', author='王多鱼AI', license='CC BY 4.0', url='https://github.com/Renhuai123/ziwei-doushu', modified='抽取/过滤/明确映射改写/去重', version=2, relation='pair:resident-same-palace; bpair:opposite-major+resident-support; aux:resident-support; sihua:resident-major-required', sihuaSource='natal-star.siHua', keySchema='kind|palace|star|other|natalMark', ruleSchema='[textId,[[star,brightnessRaw,allowedRawValues]],[[star,natalMark]]]', selection='frequency descending, text ascending after condition split')
    data = dict(meta=meta, texts=texts, rules=rules, index=dict(index))
    encoded = json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n'
    Path(output).write_text(encoded, encoding='utf-8')
    tables = {}
    for kind in ['aux', 'sihua', 'pair', 'bpair']:
        keys = [k for k in index if k.startswith(kind+'|')]
        ids = [i for k in keys for i in index[k]]
        tables[kind] = dict(keys=len(keys), rules=len(ids), texts=len({rules[i][0] for i in ids}))
    stats = dict(records=records, sources=sources, input_policy='all supplied years, sorted; no sampling', growth=growth, tables=tables, text_count=len(texts), text_chars=sum(map(len, texts)), output_bytes=len(encoded.encode()), candidate_occurrences=sum(raw.values()), unique_candidates=len(raw), kept_sentence_occurrences=sum(sum(c.values()) for c in counts.values()), dropped_occurrences=dict(sorted(dropped.items())), weak_excluded=[dict(sentence=s, reason=r, occurrences=n) for (s, r), n in sorted(weak_audit.items())], rewrites=[dict(before=s, after=rewritten[s], occurrences=rewrite_hits[s]) for s in sorted(rewrite_hits)], artifact_sha256=hashlib.sha256(encoded.encode()).hexdigest())
    Path(stats_path).write_text(json.dumps(stats, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({k:v for k,v in stats.items() if k not in ('sources','growth','rewrites','weak_excluded')}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('inputs', nargs='+')
    ap.add_argument('--output', default='lib/ziwei/star-rules.generated.json')
    ap.add_argument('--stats', default='scripts/build-star-rules/stats.json')
    args = ap.parse_args()
    build(args.inputs, args.output, args.stats)
