"""Run: python3 -m unittest discover -s scripts/build-classics."""
import json
from pathlib import Path
import re
import unittest
from gen import clean_line, compact, paragraphs, PLACEHOLDER, simplify

HERE = Path(__file__).resolve().parent


class ConversionTests(unittest.TestCase):
    def test_markup_is_removed_not_text(self):
        self.assertEqual(clean_line('時{{YL|嘉靖庚戌}}春三月'), '時嘉靖庚戌春三月')
        self.assertEqual(clean_line("'''[[紫微斗數全書|全書]]'''"), '全書')

    def test_ambiguities_and_terms(self):
        self.assertEqual(simplify('斗數 彀 髓 祿存 丑醜 后後 干乾幹 历歷曆 发發髮 系係繫'),
                         '斗数 彀 髓 禄存 丑丑 后后 干干干 历历历 发发发 系系系')

    def test_paragraphs_preserve_every_nonspace_character(self):
        lines = ['原句，' * 190, '', PLACEHOLDER] + ['一二三四，五六七八。'] * 17
        actual = paragraphs(lines)
        self.assertEqual(compact(''.join(p for p in actual if p != PLACEHOLDER)),
                         compact(''.join(p for p in lines if p != PLACEHOLDER)))
        self.assertTrue(all(len(p) <= 370 for p in actual))
        verse = paragraphs(['一二三四，五六七八。'] * 17)
        self.assertEqual([p.count('\n') + 1 for p in verse], [8, 8, 1])

    def test_audit_samples_reach_generated_text(self):
        audit = json.loads((HERE / 'audit.json').read_text())
        chapters = json.loads((HERE / 'quanshu-simplified.json').read_text())
        text = compact(''.join(p for c in chapters for p in c['paragraphs']))
        self.assertEqual(audit['chapters'], 89)
        self.assertEqual(len(audit['tables']), 9)
        self.assertEqual(len(audit['samples']), 15)
        for sample in audit['samples']:
            filename, number = sample['source'].split(':')
            line = (HERE / 'wikisource' / filename).read_text().splitlines()[int(number) - 1]
            self.assertEqual(clean_line(line), sample['original'])
            self.assertIn(compact(sample['simplified']), text)
        self.assertFalse(re.search(r'\{\{|\[\[|</?(?:poem|nowiki)>|[-+]{5}', text))


if __name__ == '__main__':
    unittest.main()
