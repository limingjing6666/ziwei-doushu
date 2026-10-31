"""Run with the extraction virtualenv: python -m unittest discover -s scripts/build-star-db."""
import unittest
from build import sentences, group_key
from clean_health import clean_health


class ExtractionTests(unittest.TestCase):
    def test_quotes_survive_all_filtering(self):
        text = '古书说「原句一。原句二。」意思如此。下一句。'
        self.assertEqual(sentences(text), ['古书说「原句一。原句二。」意思如此。', '下一句。'])

    def test_attribution_is_same_unit(self):
        self.assertEqual(sentences('他说「引文。续句。」（\u5929\u7eaa第5集53:06）。后文。'),
                         ['他说「引文。续句。」（\u5929\u7eaa第5集53:06）。', '后文。'])

    def test_nested_parentheses(self):
        self.assertEqual(sentences('建议作息（注：「说明。续句。」）。下一句。'),
                         ['建议作息（注：「说明。续句。」）。', '下一句。'])

    def test_malformed_source_is_rejected(self):
        for text in ['孤立句。）', '」意思是后半句。', '引文「未闭合。', '注（未闭合。']:
            self.assertEqual(sentences(text), [])

    def test_health_filter_is_idempotent(self):
        text = '古书说入庙灾少；哪个脏腑要留意，看全盘杀星最集中那一宫的地支，不看太阳属火。\n\n**【核心论断】**\n\n午宫对先天的心，戌宫心包对后天的心脏毛病；午宫或戌宫杀星聚集，就按时做心脏方面的检查。定期体检、遵医嘱。'
        expected = '古书说入庙灾少。\n\n**【核心论断】**\n\n定期体检、遵医嘱。'
        self.assertEqual(clean_health(text), expected)
        self.assertEqual(clean_health(expected), expected)
        neutral = '没有把天同配到哪个脏腑。'
        self.assertEqual(clean_health(neutral), neutral)
        self.assertEqual(clean_health('哪个脏腑要多留意，全盘哪一宫杀星最集中、最差，就按那一宫的地支配脏腑（子胆、丑肝），两宫都差就两处都看。还要连着命宫一起看。'), '还要连着命宫一起看。')

    def test_exact_group_not_ming_star(self):
        self.assertEqual(group_key('本宫主星：紫微（庙旺）、贪狼化权\n'), '紫微+贪狼')
        self.assertEqual(group_key('本宫主星：（财帛空宫，借对宫紫微论事）紫微、贪狼\n'), '空宫借:紫微+贪狼')


if __name__ == '__main__':
    unittest.main()
