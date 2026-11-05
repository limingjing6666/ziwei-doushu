import React from 'react';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import BirthForm, { type BirthFormState } from '../../components/birth/BirthForm';
import BirthPage from '../../components/birth/BirthPage';
import BirthTimeFields from '../../components/birth/BirthTimeFields';
import HemingPage from '../../app/heming/page';
import { changeBirthDate, formSolarDate, isFormReady, normalizeBirthTimeState, updateBirthForm, validateBirthForm } from '../../lib/birth-form';
import { restoreBirthSession, serializeBirthSession } from '../../lib/birth-session';
import { formToBirthInfo } from '../../lib/ziwei/share';
import { SEGMENTS } from '../../lib/ziwei/fuzzy-time';
import { solarToLunar } from '../../lib/ziwei/lunar-solar';
import { generateChart } from '../../lib/ziwei/algorithm';
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
  onTimeModeChange: noop, onSegmentChange: noop, allowSegment: true,
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
    assert.match(html, /按北京时间选；系统取时段中间时刻，再按出生地校正后排盘。/);
  } else {
    assert.equal(radios(html, 'segment').length, 0);
    assert.equal((html.match(/<select/g) ?? []).length, 2);
    if (timeMode === 'unknown') assert.equal((html.match(/selected="">—/g) ?? []).length, 2);
  }
}
const firstFuzzy = updateBirthForm(form, { timeMode: 'fuzzy' });
assert.equal(firstFuzzy.segment, '');
assert.equal(validateBirthForm(firstFuzzy).segment, '请选择一个大概时段');
assert.throws(() => formToBirthInfo(firstFuzzy), /请检查出生信息/);
const segmentError = renderToStaticMarkup(<BirthTimeFields {...fields} timeMode="fuzzy" errors={validateBirthForm(firstFuzzy)} />);
assert.match(segmentError, /role="alert"[^>]*>请选择一个大概时段/);
assert.deepEqual(validateBirthForm({ ...fuzzy, clockHour: '', clockMinute: '' }), {});

// 大概必须有省、市；旧精确/未知地点全空仍可提交，只有省没市仍报错。
for (const location of [{ province: '', city: '' }, { province: '', city: '北京' }, { province: '北京市', city: '' }]) {
  const invalid = { ...fuzzy, ...location };
  assert.match(validateBirthForm(invalid).city, /必须选择出生省份和城市/);
  assert.throws(() => formToBirthInfo(invalid));
  const html = renderToStaticMarkup(<BirthForm initialData={invalid} onSubmit={noop} allowSegment />);
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
const fuzzyHtml = renderToStaticMarkup(<BirthForm initialData={fuzzy} onSubmit={noop} allowSegment />);
assert.doesNotMatch(fuzzyHtml, /clock-hour|clock-minute|校时方式|改按钟表时间|shiftClock/);
assert.match(fuzzyHtml, /按北京时间选；系统取时段中间时刻，再按出生地校正后排盘。/);
assert.match(fuzzyHtml, /type="checkbox"[^>]*checked=""[^>]*\/?>按夏令时减一小时/);
assert.doesNotMatch(renderToStaticMarkup(<BirthForm initialData={{ ...fuzzy, month: '1', dstApplied: false }} onSubmit={noop} allowSegment />), /按夏令时减一小时/);

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
const unknownLate = formToBirthInfo({ ...unknown, clockHour: '23', clockMinute: '30' });
assert.deepEqual([unknownLate.year, unknownLate.month, unknownLate.day, unknownLate.hour, unknownLate.birthTimeKnown], [1988, 7, 1, 0, false]);
const exactAfterDst = updateBirthForm(fuzzy, { timeMode: 'exact', clockHour: '23', clockMinute: '30' });
assert.deepEqual(formToBirthInfo(exactAfterDst), formToBirthInfo({ ...exactAfterDst, dstApplied: false }), '精确使用当前时分，不重复减大概档 DST');
assert.doesNotMatch(renderToStaticMarkup(<BirthForm initialData={{ ...unknown, clockHour: '23' }} onSubmit={noop} />), /排盘日界现已统一|本次排盘日|晚子时/);
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
assert.throws(() => formToBirthInfo({ ...fuzzy, month: '1' }));
const input = formToBirthInfo(fuzzy);
assert.deepEqual(input.origInput, { year: 1988, month: 7, day: 1, clockHour: 8, clockMinute: 0 });
assert.deepEqual(input.timeBasis, { segmentLabel: '上午', clock: '08:00' });
assert.equal(input.hour, 4, '不受精确档 useTrueSolar=false 影响');
const lunar = solarToLunar(1988, 7, 1)!;
const lunarForm = { ...fuzzy, calendar: 'lunar' as const, year: String(lunar.year), month: String(lunar.month), day: String(lunar.day), leapMonth: lunar.leapMonth };
assert.deepEqual(formSolarDate(lunarForm), { year: 1988, month: 7, day: 1 });
assert.deepEqual(formToBirthInfo(lunarForm), input);

// 旧精确/未知单盘保留；新大概单盘可刷新恢复，旧大概输入退回表单。
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
const single = generateChart(input);
const saved = JSON.parse(serializeBirthSession({ form: fuzzy, chart: single, useTrueSolar: true }));
assert.deepEqual(saved.chart, JSON.parse(JSON.stringify(single)));
assert.deepEqual(Object.keys(saved).sort(), ['chart', 'form', 'useTrueSolar']);
assert.deepEqual(saved.form, fuzzy);
assert.deepEqual(restoreBirthSession(JSON.stringify(saved)).chart, saved.chart);
for (const oldChart of [null, chart]) {
  const restored = restoreBirthSession(JSON.stringify({ form: fuzzy, chart: oldChart, candidates: [], context: {} }));
  assert.equal(restored.chart, null);
  assert.deepEqual(restored.form, fuzzy);
  assert.equal(restored.dateNotice, undefined);
  const html = renderToStaticMarkup(<BirthPage initialData={restored.form} initialDateNotice={restored.dateNotice} onStart={noop} allowSegment />);
  assert.match(html, /排盘/);
  assert.doesNotMatch(html, /仅供|候选|不是在猜|历史会话/);
  assert.deepEqual(Object.keys(JSON.parse(serializeBirthSession(restored))).sort(), ['chart', 'form']);
}
for (const patch of [{ month: '1' }, { segment: 'bad' }, { dstApplied: 'true' }]) {
  const restored = restoreBirthSession(JSON.stringify({ form: { ...fuzzy, ...patch }, chart: null }));
  assert.equal(restored.chart, null);
  assert.ok(Object.keys(validateBirthForm(restored.form!)).length);
}
assert.throws(() => restoreBirthSession(JSON.stringify({ form: { ...form, timeMode: 'bad' }, chart })), /出生时间模式无效/);
assert.deepEqual(restoreBirthSession('{broken'), { chart: null });

// 合盘不提供大概选项且就绪/分析入口仍拦截；起盘页同一提交入口。
assert.doesNotMatch(renderToStaticMarkup(<HemingPage />), /大概时段/);
assert.doesNotMatch(renderToStaticMarkup(<BirthPage onStart={noop} />), /大概时段/);
assert.equal(isFormReady(fuzzy), false);
assert.equal(isFormReady(null), false);
assert.ok(formToBirthInfo(fuzzy).timeBasis);
const hemingSource = readFileSync('app/heming/page.tsx', 'utf8');
const analysisSource = hemingSource.slice(hemingSource.indexOf('const runAnalysis ='));
assert.ok(analysisSource.indexOf("form?.timeMode === 'fuzzy'") < analysisSource.indexOf('if (q?.trim() && charts)'));
assert.doesNotMatch(hemingSource, /allowSegment|lateZishiRule/);
assert.match(hemingSource, /chartA: buildChart\(formToBirthInfo\(formA!\)\), chartB: buildChart\(formToBirthInfo\(formB!\)\)/);
assert.match(hemingSource, /原填写公历日：\{formatBirthDate\(c.birthInfo.origInput\)\}；本张排盘日：\{formatBirthDate\(c.birthInfo\)\}/);
assert.match(readFileSync('app/chart/page.tsx', 'utf8'), /allowSegment/);
const formSource = readFileSync('components/birth/BirthForm.tsx', 'utf8');
assert.match(formSource, /setForm\(\(prev\) => updateBirthForm\(prev, patch\)\)/);
assert.match(formSource, /onChange=\{switchCalendar\}/);
assert.match(formSource, /onChange=\{e => updateForm\(\{ leapMonth: e.target.checked \}\)\}/);
assert.match(formSource, /onSubmit\(formToBirthInfo\(form\)\)/);
assert.doesNotMatch(formSource, /lateZishiRule/);
for (const initialData of [form, fuzzy, unknown]) {
  for (const element of [<BirthForm initialData={initialData} onSubmit={noop} allowSegment />, <BirthPage initialData={initialData} onStart={noop} allowSegment />]) {
    assert.doesNotMatch(renderToStaticMarkup(element), /仅供|候选|不是在猜|历史会话/);
  }
}
assert.ok(validateBirthForm({ ...form, name: '字'.repeat(21) }).name);
assert.equal(validateBirthForm({ ...form, name: '字'.repeat(20) }).name, undefined);
console.log('✓ Fuzzy form/session: 三档四段、必选城市、DST 失效、双历、单盘刷新与旧输入恢复、合盘挡板、表单精简文案');
