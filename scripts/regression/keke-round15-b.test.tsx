import React from 'react';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { describeBirthTime } from '../../lib/birth-time';
import { calcTrueSolarBranch, formToBirthInfo } from '../../lib/ziwei/share';
import { generateChart } from '../../lib/ziwei/algorithm';
import { SHICHEN } from '../../lib/ziwei/constants';
import BirthTimeFields from '../../components/birth/BirthTimeFields';
import ChartMetaBar from '../../components/chart/ChartMetaBar';

const input = { clockHour: 7, clockMinute: 20, city: '郑州', longitude: 113.6, useTrueSolar: true, branch: 3 };
const result = describeBirthTime(input);
assert.equal(result.summary, '07:20 北京时间 → 校正后 06:54 → 卯时');
assert.equal(result.detail, '仅按出生城市经度校正，比北京时间慢约26分钟。');
assert.match(describeBirthTime({ ...input, useTrueSolar: false, branch: 4 }).summary, /07:20 北京时间 → 辰时（未作地点校正）/);
assert.match(describeBirthTime({ ...input, city: '', longitude: 120, branch: 4 }).summary, /未填写出生地，未作地点校正/);
assert.equal(describeBirthTime({ ...input, unknownTime: true }).summary, '出生时间不详，按子时占位；没有可校正的出生时刻。');
assert.equal(describeBirthTime({ ...input, useTrueSolar: undefined }).summary, '卯时（旧记录未保存校时方式）');
assert.match(describeBirthTime({ ...input, clockHour: 0, clockMinute: 10, branch: 0 }).detail!, /校正后落在前一个民用日；排盘日请看实际日期说明/);
assert.match(describeBirthTime({ ...input, clockHour: 23, clockMinute: 59, longitude: 130, branch: 0 }).detail!, /校正后落在后一个民用日/);
assert.match(describeBirthTime({ ...input, clockMinute: 0, longitude: 119.9999999 }).summary, /06:59 → 卯时/);
for (const longitude of [75, 113.6, 120, 130]) {
  for (let minute = 0; minute < 1440; minute++) {
    const clockHour = Math.floor(minute / 60), clockMinute = minute % 60;
    const branch = calcTrueSolarBranch(clockHour, clockMinute, longitude);
    const description = describeBirthTime({ ...input, clockHour, clockMinute, longitude, branch });
    assert.ok(description.summary.endsWith(`→ ${SHICHEN[branch].name}`));
    assert.doesNotMatch(description.summary + description.detail, /真太阳时/);
  }
}
const preview = renderToStaticMarkup(<BirthTimeFields idPrefix="test" clockHour="7" clockMinute="20" timeMode="exact" branch={3} city="郑州" longitude={113.6} onHourChange={() => {}} onMinuteChange={() => {}} onTimeModeChange={() => {}} />);
const chart = generateChart(formToBirthInfo({ name: '', year: '1990', month: '5', day: '15', clockHour: '7', clockMinute: '20', unknownTime: false, province: '河南省', city: '郑州', longitude: 113.6, gender: 'female' }));
const meta = renderToStaticMarkup(<ChartMetaBar chart={chart} useTrueSolar onReset={() => {}} />);
assert.ok(preview.includes(result.summary.replace(/>/g, '&gt;')) || preview.includes(result.summary));
assert.ok(meta.includes('校正后 06:54'));
assert.match(renderToStaticMarkup(<ChartMetaBar chart={chart} onReset={() => {}} />), /卯时（旧记录未保存校时方式）/);
assert.doesNotMatch(renderToStaticMarkup(<ChartMetaBar chart={{ ...chart, birthInfo: { ...chart.birthInfo, city: undefined } }} onReset={() => {}} />), /这张旧盘没有保存城市信息。如果要按出生地校时，请重新起盘并选择城市。/);
console.log('✓ Round15 B: 同源校时展示、去秒/时辰边界、跨午夜、钟表/无地点/未知/旧盘');
