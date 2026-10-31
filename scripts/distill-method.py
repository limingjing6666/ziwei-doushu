"""Optional extraction, source read-only outside repo. No credentials or source text persisted.
Run: python3 scripts/distill-method.py --output /tmp/method-candidates.json
Two workers, bounded output; review candidates before publishing. IDs are original line numbers.
"""
import argparse
import collections
import concurrent.futures
import json
import os
from pathlib import Path
import re
import urllib.request

BOOKS = {'07-methodology', '01-stars', '02-palaces', '03-patterns', '04-sihua'}
EXCLUDE = re.compile('气色|相法|阳宅|看相|长相|五形|发旋|离日|旺夫|女身男命|诸术比较|何谓|告诫|因果观|君子事天|神 vs|改命观|命相同参')


def load(source):
    groups = collections.defaultdict(list)
    for i, line in enumerate(source.read_text().splitlines(), 1):
        e = json.loads(line)
        if e['book'] not in BOOKS or EXCLUDE.search(e['h2'] + e['h3']):
            continue
        groups[(e['book'], e['h2'])].append({'id': f'e{i:04}', **e})
    # Sort by book/h2/h3; balance adjacent short themes within each book.
    packets = []
    for book in sorted(BOOKS):
        entries = [e for (b, _), group in sorted(groups.items()) if b == book
                   for e in sorted(group, key=lambda e: e['h3'])]
        count = (len(entries) + 59) // 60
        for i in range(count):
            packets.append(entries[i * len(entries) // count:(i + 1) * len(entries) // count])
    assert all(20 <= len(p) <= 60 for p in packets)
    return packets


def extract(packet):
    instruction = ('只抽取紫微斗数的抽象判断方法，不处理相貌、住宅、疾病、灾难、性别优劣。'
                   '这是主题工具箱，不是人物模仿。彻底重新组织语言，不得引用或近似改写句子，'
                   '不输出任何原话、专有讲课比喻或人名。条件不齐或矛盾要明确保留限制。'
                   '输出JSON对象rules数组，每条含claim（独立白话规则）、condition（具体星宫四化触发条件）、'
                   'polarity（support/caution/neutral）、confidence（仅low，留给后续跨主题核验）、'
                   'source_ids（仅给定e开头id）。每包最多6条，不补造规则。')
    body = json.dumps({'model': 'deepseek-flash', 'messages': [
        {'role': 'system', 'content': instruction},
        {'role': 'user', 'content': json.dumps(packet, ensure_ascii=False)}],
        'response_format': {'type': 'json_object'}, 'thinking': {'type': 'disabled'}, 'max_tokens': 5000}, ensure_ascii=False).encode()
    req = urllib.request.Request('https://api.deepseek.com/chat/completions', body,
        {'Authorization': 'Bearer ' + os.environ['DEEPSEEK_API_KEY'], 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as res:
        result = json.load(res)
    if result['choices'][0].get('finish_reason') != 'stop':
        raise RuntimeError('Extraction incomplete')
    content = json.loads(result['choices'][0]['message']['content'])
    ids = {e['id'] for e in packet}
    for rule in content['rules']:
        assert set(rule['source_ids']) <= ids
    return {'source_ids': sorted(ids), 'rules': content['rules'], 'usage': result.get('usage')}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=Path('/tmp/zw/docs/tianji-ziwei/entries.jsonl'))
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    packets = load(args.source)
    print(f'{sum(map(len, packets))} entries / {len(packets)} packets; parallelism=2')
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for result in pool.map(extract, packets):
            results.append(result)
            args.output.write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print('Candidates saved outside source tree; human review required.')
