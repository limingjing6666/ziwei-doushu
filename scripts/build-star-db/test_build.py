"""Run with the extraction virtualenv: python -m unittest discover -s scripts/build-star-db."""
import unittest
from build import sentences, group_key


class ExtractionTests(unittest.TestCase):
    def test_quotes_survive_all_filtering(self):
        text = '古书说「原句一。原句二。」意思如此。下一句。'
        self.assertEqual(sentences(text), ['古书说「原句一。原句二。」意思如此。', '下一句。'])

    def test_attribution_is_same_unit(self):
        self.assertEqual(sentences('他说「引文。续句。」（天纪第5集53:06）。后文。'),
                         ['他说「引文。续句。」（天纪第5集53:06）。', '后文。'])

    def test_nested_parentheses(self):
        self.assertEqual(sentences('建议作息（注：「说明。续句。」）。下一句。'),
                         ['建议作息（注：「说明。续句。」）。', '下一句。'])

    def test_malformed_source_is_rejected(self):
        for text in ['孤立句。）', '」意思是后半句。', '引文「未闭合。', '注（未闭合。']:
            self.assertEqual(sentences(text), [])

    def test_exact_group_not_ming_star(self):
        self.assertEqual(group_key('本宫主星：紫微（庙旺）、贪狼化权\n'), '紫微+贪狼')
        self.assertEqual(group_key('本宫主星：（财帛空宫，借对宫紫微论事）紫微、贪狼\n'), '空宫借:紫微+贪狼')


if __name__ == '__main__':
    unittest.main()
