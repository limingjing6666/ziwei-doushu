#!/usr/bin/env python3
"""Idempotent health-method removal, shared by build.py and the checked-in DB migration."""
import json
from pathlib import Path
import re

# Remove the whole method clause, including any trailing explanation, not the preceding quote.
SUMMARY = re.compile(r'[；;]哪个脏腑要留意，看全盘杀星最集中那一宫的地支[^。！？\n]*[。！？]?')
# Also covers the explicit branch examples found in the dataset and plausible wording variants.
METHOD = re.compile(r'杀星最集中|最集中那一宫|看全盘杀星|杀星集中|地支对应|按杀星所在|哪一宫的地支|地支配脏腑|杀星聚集|午宫对先天的心|戌宫心包|子胆、丑肝')


def clean_health(text):
    text = SUMMARY.sub('。', text)
    # Sentence-level removal retains following advice and markdown section boundaries.
    return re.sub(r'[^。！？\n]+[。！？]?',
                  lambda match: '' if METHOD.search(match[0]) else match[0], text)


def main():
    path = Path(__file__).resolve().parents[2] / 'lib/ziwei/star-db.generated.ts'
    source = path.read_text(encoding='utf-8')
    prefix, payload = source.split('export const GENERATED_STAR_DB: StarDatabase = ', 1)
    db = json.loads(payload.removesuffix(';\n'))
    changed = []
    for key, fields in db.items():
        for field, text in fields.items():
            cleaned = clean_health(text)
            if cleaned != text:
                fields[field] = cleaned
                changed.append(f'{key}/{field}')
    note = '// Health organ-mapping method removed; original attribution retained.\n'
    if note not in prefix:
        prefix = prefix.replace("import type", note + "import type", 1)
    path.write_text(prefix + 'export const GENERATED_STAR_DB: StarDatabase = ' +
                    json.dumps(db, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    print(f'Changed {len(changed)} entries: ' + ', '.join(changed))


if __name__ == '__main__':
    main()
