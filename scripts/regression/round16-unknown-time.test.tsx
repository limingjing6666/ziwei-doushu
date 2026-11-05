import React from 'react';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import BirthTimeFields from '../../components/birth/BirthTimeFields';

const props = {
  idPrefix: 'test',
  clockHour: '8',
  clockMinute: '30',
  branch: 4,
  city: '郑州',
  longitude: 113.6,
  onHourChange: () => {},
  onMinuteChange: () => {},
  onUnknownTimeChange: () => {},
};

function selectedOptions(html: string) {
  return Array.from(html.matchAll(/<option\b[^>]*\bselected=""[^>]*>([^<]*)<\/option>/g), (match) => match[1]);
}

const unknown = renderToStaticMarkup(<BirthTimeFields {...props} unknownTime />);
const unknownSelected = selectedOptions(unknown);
assert.deepEqual(unknownSelected, ['—', '—']);
assert.doesNotMatch(unknownSelected.join(' / '), /08 时|30 分/);
assert.match(unknown, /<fieldset\b[^>]*\bdisabled=""/);
assert.match(unknown, /出生时间不详，按子时占位；没有可校正的出生时刻。/);

const known = renderToStaticMarkup(<BirthTimeFields {...props} unknownTime={false} />);
assert.deepEqual(selectedOptions(known), ['08 时', '30 分']);
assert.doesNotMatch(known, /<option\b[^>]*>—<\/option>/);

const emptyUnknown = renderToStaticMarkup(<BirthTimeFields {...props} clockHour="" clockMinute="" unknownTime />);
assert.deepEqual(selectedOptions(emptyUnknown), ['—', '—']);

console.log('✓ Round16: 未知时辰显示「—」、禁用与说明保留、原时分恢复、空时间占位');
