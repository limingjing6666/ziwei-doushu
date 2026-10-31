#!/usr/bin/env python3
"""Streaming CC BY dataset -> compact, deterministic TS database. See README.md."""
import argparse, collections, hashlib, io, json, pathlib, re
import zstandard

STARS = '紫微 天机 太阳 武曲 天同 廉贞 天府 太阴 贪狼 巨门 天相 天梁 七杀 破军'.split()
FIELDS = dict(overview='mingGong', personality='personality', love='fuQi', career='guanLu', wealth='caiBo', health='jiE', family='xiongDi', children='ziNv', move='qianYi', friends='jiaoYou', home='tianZhai', spirit='fuDe', parents='fuMu')
# Never split inside quotes/parentheses: dropping half an attributed sentence leaves orphan text.
RESTRICTED = re.compile(r'天纪|倪师|倪海厦|倪先生|B\s*站|bilibili|BV[\w]+|第\s*\d+\s*[集讲]|[pP]\d{2}|\d{1,2}[:：]\d{2}|同集|上集|下集', re.I)
UNSAFE = re.compile(r'死别|死期|夭|埋尸|坟|冢|自杀|残疾|大灾|必离|离婚|克[夫妻三]|淫|荡|刑克|重大灾|治不好的病')
# Dataset-specific overlays must not become unconditional generic star knowledge.
OVERLAY = re.compile(r'化[禄权科忌]|本盘|你这盘|当前大限')
MARKER = re.compile(r'\*\*【([^】]+)】\*\*')

def core_sections(text):
    out = []
    marks = list(MARKER.finditer(text))
    for i, m in enumerate(marks):
        if m[1] not in ('一句话定调', '核心论断'):
            continue
        part = text[m.end():marks[i+1].start() if i+1 < len(marks) else len(text)]
        part = part.split('**关键推导**')[0]
        out.append((m[1], part))
    return out

def group_key(text):
    m = re.search(r'本宫主星[：:]([^\n]+)', text)
    if not m:
        return None
    line = m[1]
    stars = [s for s in STARS if s in line]
    if not stars:
        return None
    # Keep borrowed combinations separate so an empty palace is never assigned a resident star.
    return ('空宫借:' if '空宫' in line else '') + '+'.join(stars)

def sentences(text):
    """Keep quoted/parenthesized spans intact for EVERY filtering pass, not just citations."""
    pairs = {'「': '」', '『': '』', '“': '”', '（': '）', '(': ')', '"': '"'}
    stack, result, current = [], [], []
    for char in text:
        current.append(char)
        if stack and char == stack[-1]:
            stack.pop()
        elif char in pairs:
            stack.append(pairs[char])
        elif char in '」』”）)':
            return []  # Malformed source paragraph: do not turn it into plausible-looking fragments.
        if char in '。！？' and not stack:
            result.append(''.join(current))
            current = []
    if stack:
        return []
    if current:
        result.append(''.join(current))
    return result

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inputs', nargs='+', help='year-*.jsonl.zst')
    ap.add_argument('--output', default='lib/ziwei/star-db.generated.ts')
    ap.add_argument('--stats', default='scripts/build-star-db/stats.json')
    args = ap.parse_args()
    counts = collections.defaultdict(collections.Counter)
    removed = collections.Counter()
    removed_unique = set()
    removed_sentences = set()
    records = 0
    sources = []
    for name in sorted(args.inputs):
        p = pathlib.Path(name)
        sources.append(dict(file=p.name, sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
        with p.open('rb') as f, zstandard.ZstdDecompressor(max_window_size=2**27).stream_reader(f) as reader:
            for line in io.TextIOWrapper(reader, encoding='utf-8'):
                row = json.loads(line)
                records += 1
                for topic, text in row['c'].items():
                    if topic not in FIELDS:
                        continue
                    key = group_key(text)
                    if not key:
                        continue
                    for title, section in core_sections(text):
                        for para in re.split(r'\n\s*\n', section.strip()):
                            para = para.strip()
                            if not para:
                                continue
                            units = sentences(para)
                            if not units:
                                removed['malformed_paragraph_occurrences'] += 1
                                continue
                            restricted = bool(RESTRICTED.search(para))
                            if restricted:
                                removed['restricted_paragraph_occurrences'] += 1
                                removed_unique.add(para)
                            kept = []
                            for sentence in units:
                                if RESTRICTED.search(sentence) or (restricted and re.search(r'这句|上述|这番|这一说法|他也讲|他又说|他不走', sentence)):
                                    removed['restricted_sentence_occurrences'] += 1
                                    removed_sentences.add(sentence.strip())
                                elif UNSAFE.search(sentence) or OVERLAY.search(sentence):
                                    removed['unsafe_or_overlay_sentence_occurrences'] += 1
                                else:
                                    kept.append(sentence)
                            para = re.sub(r'\s+', ' ', ''.join(kept))
                            if 12 <= len(para) <= 800 and not re.match(r'^(这说|那说|他|她|书上还有)', para):
                                counts[(key, FIELDS[topic], title)][para] += 1
        print(f'processed {p.name}: {records} charts', flush=True)
    db = collections.defaultdict(dict)
    for key, field, title in sorted(counts):
        # Most frequent exact paragraph first, lexical tie break: deterministic, 1 tuning + 2 core max.
        limit = 1 if title == '一句话定调' else 2
        selected = []
        for candidate in sorted(counts[(key, field, title)], key=lambda s: (-counts[(key, field, title)][s], s)):
            if any(candidate in chosen or chosen in candidate for chosen in selected):
                continue  # Avoid selecting a short paragraph and an almost identical expanded variant.
            selected.append(candidate)
            if len(selected) == limit:
                break
        content = f'**【{title}】**\n\n' + '\n\n'.join(selected)
        db[key][field] = db[key].get(field, '') + ('\n\n' if field in db[key] else '') + content
    # Physical palace x exact combination. Single stars are never populated from mixed-star text.
    required_fields = ['mingGong', 'fuQi', 'caiBo', 'guanLu']
    missing = [f'{s}/{f}' for s in STARS for f in required_fields if not db.get(s, {}).get(f)]
    stats = dict(records=records, sources=sources, star_keys=len(db), topic_combinations=sum(map(len, db.values())), core_palace_combinations=sum(sum(f in v for f in required_fields) for v in db.values()), single_star_core_coverage=56-len(missing), missing=missing, restricted_unique_paragraphs=len(removed_unique), restricted_unique_sentences=len(removed_sentences), **removed)
    pathlib.Path(args.output).write_text('// Generated by scripts/build-star-db/build.py. Do not edit.\n// CC BY 4.0: 紫微斗数开源解读数据集 v4.0, 王多鱼AI\n// https://github.com/Renhuai123/ziwei-doushu ; modified: extracted, filtered, frequency-ranked.\nimport type { StarDatabase } from \'./db-analysis\';\n\nexport const GENERATED_STAR_DB: StarDatabase = ' + json.dumps(dict(db), ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    pathlib.Path(args.stats).write_text(json.dumps(stats, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(stats, ensure_ascii=False, indent=2))
    if missing:
        raise SystemExit('Missing required coverage')

if __name__ == '__main__':
    main()
