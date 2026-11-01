import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).parent
spec = importlib.util.spec_from_file_location('star_rules_build', ROOT / 'build.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class RuleBuildTests(unittest.TestCase):
    def clean(self, text, kind='pair', star='天机', other='文昌', mark=''):
        return build.clean_candidate(kind, star, other, mark, text)

    def test_whole_unsafe_sentence_not_keyword_deletion(self):
        for text in ['必有血光，事业尚好。', '注定离婚。', '克父母，读书不错。', '官非牢狱。', '一生必然富贵。']:
            self.assertFalse(self.clean(text)[0], text)
        kept, dropped = self.clean('必有血光，事业尚好。可以每天记录工作计划。')
        self.assertEqual([s[0] for s in kept], ['可以每天记录工作计划。'])
        self.assertEqual(dropped['unsafe_fatalistic'], 1)

    def test_exact_auditable_rewrites(self):
        self.assertGreaterEqual(len(build.REWRITES), 5)
        for before, after in build.REWRITES.items():
            mark = '忌' if before.startswith('化忌') else ''
            kept, _ = self.clean(before, 'sihua' if mark else 'pair', mark=mark)
            self.assertEqual(kept[0][0], after)
            self.assertEqual(kept[0][3], before)
            self.assertFalse(build.DANGER.search(after))
        self.assertFalse(self.clean('兄弟合伙稳赚，但规模不大。')[0])  # not an approximate rewrite

    def test_disease_internal_and_unbound_conditions(self):
        for text in ['太阴眼疾需要留心。', '肾脏压力大但有才艺。', '本平台认为表达能力好。', '★校勘：文采出众。', '没有文曲时，读书认真。', '女命适合艺术工作。']:
            self.assertFalse(self.clean(text)[0], text)

    def test_ji_paragraph_no_salvage(self):
        self.assertFalse(self.clean('化忌：化忌，必有血光。可以留心压力。', 'sihua', mark='忌')[0])
        self.assertTrue(self.clean('化忌：压力容易累积，可以安排休息。', 'sihua', mark='忌')[0])
        self.assertFalse(self.clean('化权：专业能力值得发展。', 'sihua', mark='科')[0])

    def test_brightness_normalization_and_inherited_conditions(self):
        self.assertEqual(build.normalize_brightness('庙旺'), ['庙', '旺'])
        self.assertEqual(build.normalize_brightness('落陷'), ['陷'])
        self.assertEqual(build.normalize_brightness('得地'), ['得'])
        self.assertIsNone(build.normalize_brightness('不亮'))
        self.assertIsNone(build.normalize_brightness('不得地'))
        kept, _ = self.clean('天机庙旺，思考方式灵活。可以每天安排学习计划。')
        self.assertEqual(len(kept), 2)
        self.assertTrue(all(s[1] == [['天机', '庙旺', ['庙', '旺']]] for s in kept))
        self.assertFalse(self.clean('主星不亮，需要安排时间。')[0])
        self.assertFalse(self.clean('太阳 + 左辅，你不仅亮，还有人推你。', star='太阳', other='左辅')[0])
        self.assertTrue(self.clean('天机旺，学习方式灵活。')[0][0][1])
        self.assertFalse(self.clean('太阳 + 右弼，与左辅同主辅佐。', star='太阳', other='右弼')[0])
        self.assertFalse(self.clean('命宫此组合者中年前易遇大坎。')[0])

    def test_borrowed_pair_not_extracted(self):
        body = '### ✦ 「天机+文昌」\n\n可以发挥学习与研究能力。'
        self.assertEqual(build.extract_section('主辅煞组合精细', body, '命宫', False), ())
        self.assertEqual(len(build.extract_section('主辅煞组合精细', body, '命宫', True)), 1)

    def test_streaming_reproducible_frequency_and_lexical_ties(self):
        try:
            import zstandard
        except ImportError:
            self.skipTest('streaming integration requires zstandard; pure filter tests still run')
        def text(s):
            return '本宫主星：天机\n## 主辅煞组合精细\n### ✦ 「天机+文昌」\n\n' + s
        with tempfile.TemporaryDirectory(dir=ROOT) as directory:
            p = Path(directory)
            source = p / 'year-2000.clean.jsonl.zst'
            rows = [dict(c=dict(overview=text(s))) for s in ['可以每天记录学习计划。', '适合通过专业研究积累经验。', '适合通过专业研究积累经验。']]
            source.write_bytes(zstandard.ZstdCompressor().compress(('\n'.join(json.dumps(r, ensure_ascii=False) for r in rows)+'\n').encode()))
            for suffix in ['a', 'b']:
                build.build([str(source)], p / (suffix+'.json'), p / (suffix+'-stats.json'))
            self.assertEqual((p/'a.json').read_bytes(), (p/'b.json').read_bytes())
            self.assertEqual((p/'a-stats.json').read_bytes(), (p/'b-stats.json').read_bytes())
            data = json.loads((p/'a.json').read_text())
            self.assertEqual(data['texts'], ['适合通过专业研究积累经验。'])
            rows = [dict(c=dict(overview=text(s))) for s in ['适合通过专业研究积累经验。', '可以每天记录学习计划。']]
            source.write_bytes(zstandard.ZstdCompressor().compress(('\n'.join(json.dumps(r, ensure_ascii=False) for r in rows)+'\n').encode()))
            build.build([str(source)], p/'tie.json', p/'tie-stats.json')
            self.assertEqual(json.loads((p/'tie.json').read_text())['texts'], ['可以每天记录学习计划。'])


if __name__ == '__main__':
    unittest.main()
