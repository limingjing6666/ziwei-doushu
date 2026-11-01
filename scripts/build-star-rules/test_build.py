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

    def test_borrowed_pair_extracted_only_for_explicit_empty_palace(self):
        body = '### ✦ 「天机+文昌」\n\n可以发挥学习与研究能力。\n### ✦ 「天机+太阴」\n不能抽双主星。'
        self.assertEqual(build.extract_section('主辅煞组合精细', body, '命宫', False), ())
        resident = build.extract_section('主辅煞组合精细', body, '命宫', True)
        borrowed = build.extract_section('主辅煞组合精细', body, '命宫', False, True)
        self.assertEqual(len(resident), 1)
        self.assertEqual(resident[0][0], 'pair')
        self.assertEqual(borrowed, (('bpair', *resident[0][1:]),))
        for sentence in ['你的夫妻宫坐天机，表达思路清楚。', '天机入命，表达方式灵活。', '天机与文昌同宫，表达思路清楚。', '本宫坐天机，表达方式灵活。']:
            kept, dropped = self.clean(sentence, kind='bpair')
            self.assertFalse(kept)
            self.assertEqual(dropped['borrowed_resident_wording'], 1)
        self.assertTrue(self.clean('天机 + 文昌，表达思路清楚。', kind='bpair')[0])
        for sentence in ['天机庙旺，文昌表达思路清楚。', '如果遇到文昌，表达思路清楚。', '必有血光，事业尚好。', '本平台认为表达能力好。', '文昌眼睛容易疲劳。']:
            self.assertFalse(self.clean(sentence, kind='bpair')[0], sentence)

    def test_auditable_weak_sentence_exclusions(self):
        for sentence, star, other in [
            ('天同 + 陀罗，主天生爱拖延 + 加重——做决定能拖一年是一年。', '天同', '陀罗'),
            ('天同 + 文曲，主才艺与温和并存——音乐、舞蹈、写作、绘画类艺术工作最自然。', '天同', '文曲'),
            ('天机 + 地空，主聪明落空——好主意都在脑子里，落地的极少。', '天机', '地空'),
            ('最适合金融分析师、投资银行家、税务/审计专家。', '武曲', '文昌'),
        ]:
            for kind in ['pair', 'bpair']:
                audit = []
                kept, dropped = build.clean_candidate(kind, star, other, '', sentence, audit)
                self.assertFalse(kept)
                self.assertEqual(dropped['weak_excluded'], 1)
                self.assertEqual(audit[0][0], sentence)
                self.assertTrue(audit[0][1])
        kept, _ = self.clean('天机天生爱拖延。可以每天记录工作计划。')
        self.assertEqual([s[0] for s in kept], ['可以每天记录工作计划。'])

    def test_streaming_borrowed_metadata_and_missing_main(self):
        import zstandard
        with tempfile.TemporaryDirectory(dir=ROOT) as directory:
            p = Path(directory)
            source = p / 'year-2000.clean.jsonl.zst'
            section = '\n## 主辅煞组合精细\n### ✦ 「紫微+文昌」\n紫微 + 文昌，表达思路清楚。'
            rows = [dict(c=dict(love=main + section)) for main in [
                '本宫主星：（夫妻空宫，借对宫紫微论事）紫微（庙旺）、贪狼（庙旺）',
                '本宫主星：紫微（庙旺）', '',
            ]]
            source.write_bytes(zstandard.ZstdCompressor().compress(('\n'.join(json.dumps(r, ensure_ascii=False) for r in rows)+'\n').encode()))
            build.build([str(source)], p/'data.json', p/'stats.json')
            data = json.loads((p/'data.json').read_text())
            stats = json.loads((p/'stats.json').read_text())
            self.assertEqual(set(data['index']), {'bpair|夫妻|紫微|文昌|', 'pair|夫妻|紫微|文昌|'})
            self.assertEqual(stats['candidate_occurrences'], 2)
            self.assertEqual(stats['tables']['bpair']['keys'], 1)
            self.assertEqual(data['meta']['version'], 2)
            self.assertIn('opposite-major+resident-support', data['meta']['relation'])

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
