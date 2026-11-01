#!/usr/bin/env python3
"""Build lib/ai/dataset/pilot-v4.json from the cleaned 紫微斗数开源解读数据集 v4.0 (year-YYYY.clean.jsonl.zst).

Only the overview (整盘) and love (感情) topics are used. The cleaned readings turn out to contain only ~100 distinct
extracts per topic, so we store (a) the distinct extracts once and (b) a compact per-chart index
(overview id, love id, 命宫主星 id) per year. Runtime needs no network and no external storage.

Usage: python3 scripts/dataset/build-pilot.py /path/to/dataset-dir   (needs `pip install zstandard`)
"""
import base64, gzip, io, json, re, sys, datetime
import zstandard as z

SRC = sys.argv[1]
OUT = 'lib/ai/dataset/pilot-v4.json'
SEC = re.compile(r'\*\*【([^】]+)】\*\*')

def secs(s):
    parts = SEC.split(s)
    return {parts[i]: parts[i + 1].strip() for i in range(1, len(parts), 2)}

def extract(s):
    sc = secs(s)
    summary = judgement = core = ''
    for k, v in sc.items():
        if k.endswith('总览'): summary = v
        elif k == '一句话定调': judgement = v
        elif k == '核心论断': core = v.split('\n\n')[0]
    return (summary, judgement, core)

texts = {'overview': {}, 'love': {}}
ms_ids = {}
years = {}
dec = z.ZstdDecompressor(max_window_size=2 ** 31)
total = 0
for y in range(1950, 2027):
    n_days = 366 if (y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)) else 365
    size = n_days * 24
    ov = bytearray([255]) * size; lv = bytearray([255]) * size; ms = bytearray([255]) * size
    with open(f'{SRC}/year-{y}.clean.jsonl.zst', 'rb') as f:
        for line in io.TextIOWrapper(dec.stream_reader(f), encoding='utf8'):
            o = json.loads(line)
            assert o['y'] == y
            doy = datetime.date(y, o['m'], o['d']).timetuple().tm_yday
            pos = ((doy - 1) * 12 + o['h']) * 2 + (1 if o['g'] == 'female' else 0)
            assert ov[pos] == 255, o['k']
            ov[pos] = texts['overview'].setdefault(extract(o['c']['overview']), len(texts['overview']))
            lv[pos] = texts['love'].setdefault(extract(o['c']['love']), len(texts['love']))
            ms[pos] = 254 if o['ms'] is None else ms_ids.setdefault(o['ms'], len(ms_ids))
            total += 1
    assert 255 not in ov and 255 not in lv and 255 not in ms, y
    years[str(y)] = base64.b64encode(gzip.compress(bytes(ov) + bytes(lv) + bytes(ms), 9, mtime=0)).decode()
assert len(texts['overview']) < 250 and len(texts['love']) < 250 and len(ms_ids) < 250
out = {
    'dataset': '紫微斗数开源解读数据集 v4.0', 'license': 'CC BY 4.0', 'charts': total,
    'layout': 'per year: gzip(overview ids | love ids | ms ids), each n_days*24 bytes; pos=((dayOfYear-1)*12+hourBranch)*2+(female?1:0); ms 254=空宫',
    'ms': [k for k, _ in sorted(ms_ids.items(), key=lambda kv: kv[1])],
    'texts': {t: [list(k) for k, _ in sorted(v.items(), key=lambda kv: kv[1])] for t, v in texts.items()},
    'years': years,
}
with open(OUT, 'w', encoding='utf8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print('charts', total, 'overview texts', len(texts['overview']), 'love texts', len(texts['love']), 'ms', len(ms_ids))
