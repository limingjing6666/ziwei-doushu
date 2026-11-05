import React from 'react';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import BirthForm, { type BirthFormState } from '../../components/birth/BirthForm';
import BirthPage from '../../components/birth/BirthPage';
import BirthTimeFields from '../../components/birth/BirthTimeFields';
import HemingPage from '../../app/heming/page';
import { changeBirthDate, formSolarDate, formToFuzzyBirthInput, isFormReady, normalizeBirthTimeState, updateBirthForm, validateBirthForm } from '../../lib/birth-form';
import { restoreBirthSession, serializeBirthSession } from '../../lib/birth-session';
import { formToBirthInfo } from '../../lib/ziwei/share';
import { SEGMENTS } from '../../lib/ziwei/fuzzy-time';
import { solarToLunar } from '../../lib/ziwei/lunar-solar';
import type { ZiweiChart } from '../../lib/ziwei/types';

const form: BirthFormState = {
  name: '测试', year: '1988', month: '7', day: '1', calendar: 'solar',
  clockHour: '8', clockMinute: '30', unknownTime: false,
  province: '北京市', city: '北京', longitude: 116.4, gender: 'female', useTrueSolar: false,
};
const fuzzy = updateBirthForm(form, { timeMode: 'fuzzy', segment: '06-12', dstApplied: true });
const noop = () => {};
const fields = {
  idPrefix: 'test', clockHour: '8', clockMinute: '30', branch: 4,
  city: '北京', longitude: 116.4, onHourChange: noop, onMinuteChange: noop,
  onTimeModeChange: noop, onSegmentChange: noop,
};
function radios(html: string, suffix: string) {
  return Array.from(html.matchAll(/<input\b[^>]*type="radio"[^>]*>/g), match => match[0])
    .filter(input => input.includes(`name="test-${suffix}"`));
}
function checkedValues(inputs: string[]) {
  return inputs.filter(input => input.includes('checked=""'))
    .map(input => /value="([^"]*)"/.exec(input)![1]);
}

// 三档单选互斥；大概只显示四段，首次未选，未知仍显示「—」。
for (const timeMode of ['exact', 'fuzzy', 'unknown'] as const) {
  const html = renderToStaticMarkup(<BirthTimeFields {...fields} timeMode={timeMode} />);
  assert.equal(radios(html, 'time-mode').length, 3);
  assert.deepEqual(checkedValues(radios(html, 'time-mode')), [timeMode]);
  for (const label of ['精确到分钟', '大概时段', '完全不知道']) assert.ok(html.includes(label));
  if (timeMode === 'fuzzy') {
    assert.equal(radios(html, 'segment').length, 4);
    assert.deepEqual(checkedValues(radios(html, 'segment')), []);
    for (const item of SEGMENTS) assert.ok(html.includes(item.label));
    assert.doesNotMatch(html, /<select|clock-hour|clock-minute|子时占位/);
    assert.match(html, /不是在猜你的真时辰/);
  } else {
    assert.equal(radios(html, 'segment').length, 0);
    assert.equal((html.match(/<select/g) ?? []).length, 2);
    if (timeMode === 'unknown') assert.equal((html.match(/selected="">—/g) ?? []).length, 2);
  }
}
const firstFuzzy = updateBirthForm(form, { timeMode: 'fuzzy' });
assert.equal(firstFuzzy.segment, '');
assert.equal(validateBirthForm(firstFuzzy).segment, '请选择一个大概时段');
assert.throws(() => formToFuzzyBirthInput(firstFuzzy), /请检查大概时段/);
const segmentError = renderToStaticMarkup(<BirthTimeFields {...fields} timeMode="fuzzy" errors={validateBirthForm(firstFuzzy)} />);
assert.match(segmentError, /role="alert"[^>]*>请选择一个大概时段/);
assert.deepEqual(validateBirthForm({ ...fuzzy, clockHour: '', clockMinute: '' }), {});

// 大概必须有省、市；旧精确/未知地点全空仍可提交，只有省没市仍报错。
for (const location of [{ province: '', city: '' }, { province: '', city: '北京' }, { province: '北京市', city: '' }]) {
  const invalid = { ...fuzzy, ...location };
  assert.match(validateBirthForm(invalid).city, /必须选择出生省份和城市/);
  assert.throws(() => formToFuzzyBirthInput(invalid));
  const html = renderToStaticMarkup(<BirthForm initialData={invalid} onSubmit={noop} onFuzzySubmit={noop} />);
  assert.match(html, /role="alert"[^>]*>大概时段必须选择出生省份和城市/);
  assert.match(html, /type="submit"[^>]*disabled=""/);
}
for (const timeMode of ['exact', 'unknown'] as const) {
  const emptyLocation = updateBirthForm(form, { timeMode, province: '', city: '' });
  assert.deepEqual(validateBirthForm(emptyLocation), {});
  assert.ok(isFormReady(emptyLocation));
  assert.equal(formToBirthInfo(emptyLocation).birthTimeKnown, timeMode === 'exact');
  assert.ok(validateBirthForm({ ...emptyLocation, province: '北京市' }).city);
}
assert.ok(validateBirthForm({ ...fuzzy, longitude: NaN }).city);
const fuzzyHtml = renderToStaticMarkup(<BirthForm initialData={fuzzy} onSubmit={noop} onFuzzySubmit={noop} />);
assert.doesNotMatch(fuzzyHtml, /clock-hour|clock-minute|校时方式|改按钟表时间|shiftClock/);
assert.match(fuzzyHtml, /固定按出生地经度校正/);
assert.match(fuzzyHtml, /type="checkbox"[^>]*checked=""[^>]*\/?>按夏令时减一小时/);
assert.doesNotMatch(renderToStaticMarkup(<BirthForm initialData={{ ...fuzzy, month: '1', dstApplied: false }} onSubmit={noop} onFuzzySubmit={noop} />), /按夏令时减一小时/);
assert.match(renderToStaticMarkup(<BirthPage initialData={fuzzy} onStart={noop} onFuzzySubmit={noop} />), /大概时段必须选择出生省份和城市/);

// DST 三入口失效；切档/改城市保留草稿，不改原时分或原始 segment。
for (const patch of [{ year: '1989' }, { month: '8' }, { day: '2' }]) {
  assert.equal(changeBirthDate(fuzzy, patch).form.dstApplied, false);
}
for (const patch of [{ calendar: 'lunar' as const }, { calendar: 'solar' as const }, { leapMonth: true }, { leapMonth: false }]) {
  assert.equal(updateBirthForm(fuzzy, patch).dstApplied, false);
}
const unknown = updateBirthForm(fuzzy, { timeMode: 'unknown' });
assert.equal(unknown.unknownTime, true);
assert.equal(formToBirthInfo({ ...unknown, month: '1' }).hour, 0, '未知忽略大概 DST 与 segment');
assert.equal(formToBirthInfo(unknown).origInput, undefined);
for (const timeMode of ['exact', 'fuzzy', 'unknown'] as const) {
  const switched = updateBirthForm(unknown, { timeMode });
  assert.equal(switched.unknownTime, timeMode === 'unknown');
  for (const key of ['name', 'year', 'month', 'day', 'calendar', 'province', 'city', 'gender', 'clockHour', 'clockMinute', 'segment', 'dstApplied'] as const) {
    assert.equal(switched[key], fuzzy[key]);
  }
}
assert.equal(updateBirthForm(fuzzy, { city: '郑州', longitude: 113.6 }).dstApplied, true);
assert.equal(updateBirthForm(fuzzy, { dstApplied: false }).segment, '06-12');
assert.equal(normalizeBirthTimeState({ ...fuzzy, unknownTime: true }).unknownTime, false);
assert.ok(validateBirthForm({ ...fuzzy, month: '1' }).dstApplied);
assert.throws(() => formToFuzzyBirthInput({ ...fuzzy, month: '1' }));
const input = formToFuzzyBirthInput(fuzzy);
assert.deepEqual(input.dateInfo, { year: 1988, month: 7, day: 1 });
assert.equal(input.segment, '06-12');
assert.equal(input.dstApplied, true);
assert.equal(input.city.longitude, 116.4, '不受精确档 useTrueSolar=false 影响');
for (const key of ['clockHour', 'clockMinute', 'hour', 'origInput', 'useTrueSolar']) assert.equal(Object.hasOwn(input, key), false);
const lunar = solarToLunar(1988, 7, 1)!;
const lunarForm = { ...fuzzy, calendar: 'lunar' as const, year: String(lunar.year), month: String(lunar.month), day: String(lunar.day), leapMonth: lunar.leapMonth };
assert.deepEqual(formSolarDate(lunarForm), input.dateInfo);
assert.deepEqual(formToFuzzyBirthInput(lunarForm), input);

// 旧会话迁移但保留单盘；大概只写/恢复表单，不恢复残留单盘。
const chart = { birthInfo: { name: '保留旧单盘' } } as ZiweiChart;
for (const unknownTime of [false, true]) {
  const restored = restoreBirthSession(JSON.stringify({ form: { ...form, unknownTime }, chart, useTrueSolar: false }));
  assert.deepEqual(restored.chart, chart);
  assert.equal(restored.form?.timeMode, unknownTime ? 'unknown' : 'exact');
  assert.equal(restored.form?.unknownTime, unknownTime);
  assert.equal(restored.form?.segment, '');
  assert.equal(restored.form?.dstApplied, false);
  assert.equal(restored.useTrueSolar, false);
}
const saved = JSON.parse(serializeBirthSession({ form: fuzzy, chart, useTrueSolar: false }));
assert.equal(saved.chart, null);
assert.deepEqual(Object.keys(saved).sort(), ['chart', 'form', 'useTrueSolar']);
assert.deepEqual(saved.form, fuzzy);
const restored = restoreBirthSession(JSON.stringify({ ...saved, chart }));
assert.equal(restored.chart, null);
assert.deepEqual(restored.form, fuzzy);
assert.equal(restored.dateNotice, '大概时段输入已恢复，请重新生成候选');
assert.match(renderToStaticMarkup(<BirthPage initialData={restored.form} initialDateNotice={restored.dateNotice} onStart={noop} onFuzzySubmit={noop} />), /大概时段输入已恢复，请重新生成候选/);
assert.match(restoreBirthSession(JSON.stringify({ form: { ...fuzzy, month: '1' }, chart })).dateNotice!, /该日期不在夏令时表内/);
assert.match(restoreBirthSession(JSON.stringify({ form: { ...fuzzy, segment: 'bad' }, chart })).dateNotice!, /请选择一个大概时段/);
assert.match(restoreBirthSession(JSON.stringify({ form: { ...fuzzy, dstApplied: 'true' }, chart })).dateNotice!, /夏令时选择无效/);
assert.throws(() => restoreBirthSession(JSON.stringify({ form: { ...form, timeMode: 'bad' }, chart })), /出生时间模式无效/);
assert.deepEqual(restoreBirthSession('{broken'), { chart: null });

// 合盘不提供大概能力，/chart 接通；校验、转换、分析入口三重挡板。
assert.doesNotMatch(renderToStaticMarkup(<HemingPage />), /大概时段/);
assert.doesNotMatch(renderToStaticMarkup(<BirthPage onStart={noop} />), /大概时段/);
assert.equal(isFormReady(fuzzy), false);
assert.equal(isFormReady(null), false);
assert.throws(() => formToBirthInfo(fuzzy), /大概时段不能转换为单张命盘/);
assert.throws(() => formToFuzzyBirthInput(form), /请检查大概时段/);
const hemingSource = readFileSync('app/heming/page.tsx', 'utf8');
const analysisSource = hemingSource.slice(hemingSource.indexOf('const runAnalysis ='));
assert.ok(analysisSource.indexOf("form?.timeMode === 'fuzzy'") < analysisSource.indexOf('if (q?.trim() && charts)'));
assert.doesNotMatch(hemingSource, /onFuzzySubmit=/);
assert.match(readFileSync('app/chart/page.tsx', 'utf8'), /onFuzzySubmit=/);
const formSource = readFileSync('components/birth/BirthForm.tsx', 'utf8');
assert.match(formSource, /setForm\(\(prev\) => updateBirthForm\(prev, patch\)\)/);
assert.match(formSource, /onChange=\{switchCalendar\}/);
assert.match(formSource, /onChange=\{e => updateForm\(\{ leapMonth: e.target.checked \}\)\}/);
assert.match(formSource, /onFuzzySubmit\(formToFuzzyBirthInput\(form\)\)/);
assert.match(formSource, /else onSubmit\(formToBirthInfo\(form, lateZishiRule\)\)/);
console.log('✓ Fuzzy form/session: 三档与四段互斥、城市分档校验、DST 三入口失效、草稿/旧会话兼容、合盘挡板');
