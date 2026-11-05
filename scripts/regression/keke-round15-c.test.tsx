import React from 'react';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import BirthDateFields from '../../components/birth/BirthDateFields';
import BirthForm from '../../components/birth/BirthForm';
import { changeBirthDate, februaryDays } from '../../lib/birth-form';
import { restoreBirthSession } from '../../lib/birth-session';
import type { BirthFormState } from '../../components/BirthForm';

const form: BirthFormState = { name: '', year: '2020', month: '2', day: '29', clockHour: '7', clockMinute: '20', unknownTime: false, province: '', city: '', longitude: 120, gender: 'female', calendar: 'solar' };
for (const [year, expected] of [['2021', 28], ['2020', 29], ['1900', 28], ['2000', 29], ['', 29], ['202', 29]] as const) {
  assert.equal(februaryDays(year), expected);
  const html = renderToStaticMarkup(<BirthDateFields idPrefix="test" year={year} month="2" day="" errors={{}} onChange={() => {}} />);
  const days = html.slice(html.indexOf('id="test-day"'));
  assert.equal(days.includes('value="29"'), expected === 29);
  assert.doesNotMatch(days, /value="30"|value="31"/);
  if (year.length < 4) assert.match(days, /请先填写年份，再选择2月的日期/);
}
const changed = changeBirthDate(form, { year: '2021' });
assert.equal(changed.form.day, '');
assert.equal(changed.dateNotice, '原来选择的日期在这个年月不存在，请重新选择“日”');
assert.equal(changeBirthDate({ ...form, month: '1', day: '31' }, { month: '2' }).form.day, '');
assert.equal(changeBirthDate(form, { year: '2000' }).form.day, '29');
assert.equal(changeBirthDate(form, { year: '' }).form.day, '29');
assert.equal(changeBirthDate({ ...form, month: '3', day: '31' }, { month: '4' }).form.day, '31', 'do not widen other months');
const lunar = { ...form, calendar: 'lunar' as const, month: '4', day: '1', leapMonth: true };
assert.equal(changeBirthDate(lunar, { year: '2012' }).form.leapMonth, true, 'both years have leap fourth month');
assert.equal(changeBirthDate(lunar, { month: '4' }).form.leapMonth, true);
for (const patch of [{ year: '2021' }, { month: '5' }, { year: '2021', month: '' }]) {
  const next = changeBirthDate(lunar, patch);
  assert.equal(next.form.leapMonth, false);
  assert.equal(next.leapNotice, '该年该月没有闰月，已取消“闰月”，请核对');
  assert.equal(next.form.day, '1');
}
const chart = { birthInfo: { name: 'preserve saved chart' } };
const saved = { form: { ...form, year: '2021' }, chart, useTrueSolar: false };
const restored = restoreBirthSession(JSON.stringify(saved));
assert.deepEqual(restored.form, { ...saved.form, day: '', timeMode: 'exact', segment: '', dstApplied: false });
assert.deepEqual(restored.chart, chart);
assert.equal(restored.useTrueSolar, false);
assert.equal(restored.dateNotice, '上次填写的日期无效，已清空“日”，请重新选择。');
assert.match(renderToStaticMarkup(<BirthForm initialData={restored.form} initialDateNotice={restored.dateNotice} onSubmit={() => {}} />), /上次填写的日期无效，已清空“日”，请重新选择。/);
assert.deepEqual(restoreBirthSession('{broken'), { chart: null });
for (const date of [form, { ...form, calendar: 'lunar', day: '30' }, { ...form, month: '4', day: '31' }]) {
  const session = { form: date, chart: null };
  assert.deepEqual(restoreBirthSession(JSON.stringify(session)), { ...session, form: { ...date, timeMode: 'exact', segment: '', dstApplied: false } });
}
console.log('✓ Round15 C/C+: 二月闰年/输入中联动、清日提示、坏JSON恢复、保留旧盘、闰月保留与取消提示');
