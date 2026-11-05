import assert from 'node:assert/strict';
import type { BirthFormState } from '../../components/birth/BirthForm';
import { representativeClock, SEGMENTS } from '../../lib/ziwei/fuzzy-time';
import { calcTrueSolarBranch, formToBirthInfo } from '../../lib/ziwei/share';
import { generateChart } from '../../lib/ziwei/algorithm';
import { normalizeChart } from '../../lib/ai/input';

const form: BirthFormState = {
  name: '时段测试', year: '1990', month: '5', day: '15', calendar: 'solar',
  clockHour: '', clockMinute: '', unknownTime: false, timeMode: 'fuzzy',
  province: '北京市', city: '北京', longitude: 116.4, gender: 'male', useTrueSolar: false,
};
const evaluatedAt = new Date('2026-11-05T04:00:00Z');
for (const [index, segment] of SEGMENTS.entries()) {
  for (const dstApplied of [false, true]) {
    const hour = index * 6 + 3 - (dstApplied ? 1 : 0);
    assert.deepEqual(representativeClock(segment.value, dstApplied), {
      clockHour: hour, clockMinute: 0, label: ['凌晨', '上午', '下午', '晚上'][index],
    });
    const fuzzy = formToBirthInfo({ ...form, year: dstApplied ? '1988' : '1990', month: '7', day: '1', segment: segment.value, dstApplied });
    assert.equal(fuzzy.origInput?.clockHour, hour);
    assert.equal(fuzzy.timeBasis?.clock, `${String(hour).padStart(2, '0')}:00`);
  }
}
assert.throws(() => representativeClock('bad' as never, false), /有效的大概时段/);
const beijing = formToBirthInfo({ ...form, segment: '06-12' });
assert.equal(beijing.timeBasis?.clock, '09:00');
assert.equal(calcTrueSolarBranch(9, 0, 120), 5, '09:00 钟表时间为巳时');
assert.equal(beijing.hour, 4, '北京 116.4° 校正后为 08:45:36，沿用精确盘的辰时');
const chengdu = formToBirthInfo({ ...form, segment: '06-12', province: '四川省', city: '成都', longitude: 104.06 });
assert.equal(chengdu.hour, 4);

// 代表时刻只补齐时分，校时、民用跨日与排盘日沿用精确入口。
for (const location of [
  { province: '北京市', city: '北京', longitude: 116.4 },
  { province: '四川省', city: '成都', longitude: 104.06 },
  { province: '新疆维吾尔自治区', city: '乌鲁木齐', longitude: 87.6 },
  { province: '新疆维吾尔自治区', city: '喀什', longitude: 75.99 },
]) for (const segment of SEGMENTS) for (const dstApplied of [false, true]) {
  const input = { ...form, ...location, segment: segment.value, dstApplied,
    year: dstApplied ? '1988' : '1990', month: '7', day: '1' };
  const clock = representativeClock(segment.value, dstApplied);
  const { timeBasis, ...fuzzy } = formToBirthInfo(input);
  const exact = formToBirthInfo({ ...input, timeMode: 'exact', useTrueSolar: true,
    clockHour: String(clock.clockHour), clockMinute: String(clock.clockMinute) });
  assert.deepEqual(fuzzy, exact, `${location.city} ${segment.value} DST=${dstApplied} BirthInfo 逐字段相同`);
  const fuzzyChart = generateChart({ ...fuzzy, timeBasis }, { evaluatedAt });
  const exactChart = generateChart(exact, { evaluatedAt });
  const { timeBasis: displayOnly, ...birthInfo } = fuzzyChart.birthInfo;
  assert.deepEqual({ ...fuzzyChart, birthInfo }, exactChart, '整张命盘逐字段相同（仅排除 timeBasis）');
  assert.deepEqual(normalizeChart(fuzzyChart), normalizeChart(exactChart));
  assert.equal(Object.hasOwn(normalizeChart(fuzzyChart).birthInfo, 'timeBasis'), false);
  assert.doesNotMatch(fuzzy.timeCorrectionNotice ?? '', /你填写|原填写/);
  assert.ok(displayOnly);
}
const westDawn = formToBirthInfo({ ...form, year: '1988', month: '7', day: '1',
  province: '新疆维吾尔自治区', city: '喀什', longitude: 75.99, segment: '00-06', dstApplied: true });
assert.ok(2 * 60 + (75.99 - 120) * 4 < 0, '夏令时凌晨代表点校正到前一民用日');
assert.deepEqual([westDawn.year, westDawn.month, westDawn.day, westDawn.hour], [1988, 7, 1, 0], '23:00 日界使其仍属填写日的子时');
console.log('✓ Representative clock: 四段与夏令时减60分钟、09:00 钟表巳/北京及成都校正辰、32组单盘及 AI 白名单等价（含西部跨民用日）');
