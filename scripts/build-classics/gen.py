#!/usr/bin/env python3
"""Wikisource snapshots -> simplified JSON + statically bundled Book (requires opencc).
Only markup removal, t2s conversion and paragraph boundaries are changed.
Run: python3 scripts/build-classics/gen.py (paths are relative to this script).
"""
import hashlib
import json
from pathlib import Path
import random
import re
from opencc import OpenCC

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CC = OpenCC('t2s')
# No speculative corrections: this snapshot's term/ambiguity audit needs none.
# Add only demonstrated conversion corrections here, never source typo emendations.
CONVERSION_FIXES = {}
PLACEHOLDER = '【此处原书有表格或图表，暂未收录，请对照原书。】'
TERMS = '紫微 天機 太陽 武曲 天同 廉貞 天府 太陰 貪狼 巨門 天相 天梁 七殺 破軍 文昌 文曲 左輔 右弼 天魁 天鉞 天馬 祿存 擎羊 陀羅 化祿 化權 化科 化忌 命宮 福德 遷移 疾厄 官祿 田宅 彀 髓'.split()


def simplify(text):
    text = CC.convert(text)
    for before, after in CONVERSION_FIXES.items():
        text = text.replace(before, after)
    return text


def clean_line(line):
    line = re.sub(r'</?(?:poem|nowiki|onlyinclude)>', '', line)
    line = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', line)
    line = re.sub(r'\{\{YL\|([^{}]*)\}\}', r'\1', line)
    return line.replace("'''", '').strip()


def compact(text):
    return re.sub(r'\s+', '', text)


def paragraphs(lines):
    """4–8 short source lines per block; long prose split only at existing punctuation.
    Blank source lines remain soft boundaries, not one UI paragraph per short line.
    No text or punctuation is inserted/deleted, including mixed simplified source text.
    """
    result, buf = [], []
    size = 0

    def flush():
        nonlocal buf, size
        if buf:
            result.append('\n'.join(buf))
            buf, size = [], 0

    for line in lines:
        if line == PLACEHOLDER:
            flush()
            result.append(line)
            continue
        if not line:
            if size >= 180:
                flush()
            continue
        # Break long lines at existing sentence/clause punctuation, keeping every character.
        units, pending = [], ''
        for part in re.findall(r'[^。！？；，]+[。！？；，]?|[。！？；，]', line) if len(line) > 360 else [line]:
            if pending and len(pending) + len(part) > 360:
                units.append(pending)
                pending = ''
            pending += part
        if pending:
            units.append(pending)
        for unit in units:
            if buf and (size + len(unit) > 360 or len(buf) >= 8):
                flush()
            buf.append(unit)
            size += len(unit)
        if len(buf) >= 6 and size >= 80:
            flush()
    flush()
    return result


def generate():
    chapters, tables, sample_pool, sources = [], [], {}, []
    all_content = []
    for volume in ('卷一', '卷二', '卷三'):
        path = HERE / 'wikisource' / f'q_{volume}.txt'
        raw = path.read_text(encoding='utf-8')
        sources.append({'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
        lines = raw.splitlines()
        current, parent, i = None, None, 0
        sample_pool[volume] = []
        while i < len(lines):
            line, number = lines[i], i + 1
            i += 1
            if re.match(r'\s*\{\{(?:Header2|footer)\b', line):
                continue
            heading = re.match(r'^(=+)\s*(.+?)\s*=+\s*$', line.strip())
            if heading:
                level, title = len(heading[1]), simplify(heading[2])
                if level == 2:
                    continue
                if level == 3:
                    parent = title
                elif level == 4:
                    title = f'{parent}·{title}'
                else:
                    raise ValueError(f'Unexpected heading: {line}')
                all_content.append(heading[2])
                current = {'volume': volume, 'title': title, 'lines': []}
                chapters.append(current)
                continue
            if current is None:
                assert not clean_line(line), f'Unassigned text: {path}:{number}'
                continue
            # Six nowiki blocks contain nine ASCII diagrams/tables; the last contains four.
            if '<nowiki>' in line or line.strip().startswith('{|'):
                block, start = [line], number
                end_tag = '</nowiki>' if '<nowiki>' in line else '|}'
                while end_tag not in block[-1]:
                    assert i < len(lines), f'Unclosed table: {path}:{start}'
                    block.append(lines[i])
                    i += 1
                pieces = re.split(r'\n\s*\n', '\n'.join(block))
                for piece in pieces:
                    if not piece.strip():
                        continue
                    offset = '\n'.join(block).index(piece)
                    first = start + '\n'.join(block)[:offset].count('\n')
                    last = first + piece.count('\n')
                    labels = [name for name in ('水二局', '木三局', '金四局', '土五局', '火六局', '安天府图', '殇使祸福紧慢图', '禄权科忌图') if name in piece]
                    label = labels[0] if labels else '诸星庙旺得地利益平和不得地落陷表'
                    tables.append({'volume': volume, 'chapter': current['title'], 'startLine': first, 'endLine': last, 'label': label})
                    current['lines'].append(PLACEHOLDER)
                continue
            cleaned = clean_line(line)
            assert not re.search(r'\{\{|\[\[|<[^>]+>|^[-|!]{2}', cleaned), f'Unremoved markup: {path}:{number}'
            text = simplify(cleaned)
            current['lines'].append(text)
            if cleaned:
                all_content.append(cleaned)
                if len(cleaned) >= 12:
                    sample_pool[volume].append({'source': f'{path.name}:{number}', 'original': cleaned, 'simplified': text})

    out = []
    for chapter in chapters:
        if not any(chapter['lines']):
            continue  # The parent heading 诸星问答论 is an empty container, not a chapter.
        final = paragraphs(chapter['lines'])
        original = ''.join(line for line in chapter['lines'] if line != PLACEHOLDER)
        rendered = ''.join(p for p in final if p != PLACEHOLDER)
        assert compact(original) == compact(rendered), f'Text changed: {chapter["title"]}'
        out.append({'volume': chapter['volume'], 'title': chapter['title'], 'paragraphs': final})

    count = sum(len(re.findall(r'[\u3400-\u4dbf\u4e00-\u9fff\U00020000-\U0002fa1f]', p))
                for ch in out for p in ch['paragraphs'] if p != PLACEHOLDER)
    book = {
        'title': '紫微斗数全书', 'slug': 'quanshu', 'dynasty': '明代',
        'author': '题陈抟撰，罗洪先序',
        'source': 'https://zh.wikisource.org/wiki/紫微斗數全書',
        'edition': '通行三卷本，底本未标明',
        'license': '维基文库整理，CC BY-SA 4.0；繁转简，未逐字校勘',
        'intro': '《紫微斗数全书》题陈抟撰、罗洪先序，明代已有刊本流传。本库据维基文库通行三卷本繁转简，底本未标明，未逐字校勘。内容含太微赋、星垣论、诸星问答论、斗数骨髓赋、十二宫诸星分论、论大小限及诸星同垣等。',
        'wordCount': count,
        'chapters': [{'title': f'{ch["volume"]}·{ch["title"]}',
                      'paragraphs': [{'id': f'qs-{ci + 1}-{pi + 1}', 'idx': pi + 1, 'text': p}
                                     for pi, p in enumerate(ch['paragraphs'])]}
                     for ci, ch in enumerate(out)],
    }
    dumps = lambda data: json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    (HERE / 'quanshu-simplified.json').write_text(dumps(out), encoding='utf-8')
    (ROOT / 'lib/classics/data/quanshu.ts').write_text(
        '// Generated by scripts/build-classics/gen.py，勿手改。\n'
        '// Source: https://zh.wikisource.org/wiki/紫微斗數全書 ; CC BY-SA 4.0\n'
        '// 通行三卷本，底本未标明；繁转简，未逐字校勘。\n'
        "import type { Book } from '../types';\n\nexport const ziWeiQuanShu: Book = " + dumps(book).rstrip() + ';\n', encoding='utf-8')
    rng = random.Random(20261031)
    content = '\n'.join(all_content)
    converted = simplify(content)
    term_audit = [{'original': term, 'simplified': simplify(term),
                   'originalCount': content.count(term),
                   'alreadySimplifiedCount': content.count(simplify(term)) if term != simplify(term) else 0,
                   'outputCount': converted.count(simplify(term))} for term in TERMS]
    assert all(t['outputCount'] == t['originalCount'] + t['alreadySimplifiedCount'] for t in term_audit)
    audit = {'sources': sources, 'chapters': len(out), 'paragraphs': sum(len(ch['paragraphs']) for ch in out),
             'wordCount': count, 'wordCountRule': 'CJK ideographs only; excludes headings, punctuation, whitespace and table placeholders',
             'conversionFixes': CONVERSION_FIXES, 'terms': term_audit,
             'ambiguities': [{'original': ch, 'simplified': simplify(ch), 'count': content.count(ch)}
                             for ch in '丑醜后後干乾幹历歷曆发發髮系係繫彀髓'],
             'tables': tables, 'samples': [s for vol in sample_pool for s in rng.sample(sample_pool[vol], 5)],
             'structure': [{'title': ch['title'], 'paragraphs': len(ch['paragraphs'])} for ch in book['chapters']]}
    (HERE / 'audit.json').write_text(dumps(audit), encoding='utf-8')
    print(f'{len(out)} chapters, {audit["paragraphs"]} paragraphs, {count} CJK characters, {len(tables)} table placeholders')


if __name__ == '__main__':
    generate()
