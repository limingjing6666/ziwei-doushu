import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { PROVINCES } from '../../lib/ziwei/cities';
import { calcTrueSolarBranch } from '../../lib/ziwei/share';
import { solarToLunar } from '../../lib/ziwei/lunar-solar';
import type { CandidateBranch, ChartResult, FuzzyBirthInput, FuzzyCity, Segment } from '../../lib/ziwei/fuzzy-time';
import type { GregorianDate } from '../../lib/ziwei/true-solar-time';

// 冷进程先包装入口再加载批算模块，不给生产代码增加测试注入参数。
const algorithm: typeof import('../../lib/ziwei/algorithm') = require('../../lib/ziwei/algorithm');
const algorithmModule = require.cache[require.resolve('../../lib/ziwei/algorithm')]!;
const originalExports = algorithmModule.exports;
let failAt = -1, invalidAt = -1, callNumber = 0;
const generationFailure = new Error('候选排盘失败');
const generateSpy = mock.fn((...args: Parameters<typeof algorithm.generateChart>) => {
  callNumber++;
  if (callNumber === failAt) throw generationFailure;
  const chart = algorithm.generateChart(...args);
  if (callNumber === invalidAt) {
    for (const p of chart.palaces) for (const s of p.stars) delete s.siHua;
  }
  return chart;
});
algorithmModule.exports = { ...originalExports, generateChart: generateSpy };
const { SEGMENTS, enumerateCandidateBranches, buildCandidateResult }: typeof import('../../lib/ziwei/fuzzy-time')
  = require('../../lib/ziwei/fuzzy-time');

function city(province: string, name: string): FuzzyCity {
  const entry = PROVINCES.find(p => p.name === province)!.cities.find(c => c.name === name)!;
  return { province, city: entry.name, longitude: entry.longitude };
}
const beijing = city('北京市', '北京');
const zhengzhou = city('河南省', '郑州');
const urumqi = city('新疆维吾尔自治区', '乌鲁木齐');
const dateInfo = Object.freeze({ year: 1990, month: 5, day: 15 });
const evaluatedAt = new Date('2026-11-05T00:00:00+08:00');
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const branches = (items: readonly CandidateBranch[]) => items.map(c => c.branch);
function partition(items: readonly CandidateBranch[], start: number, end: number) {
  assert.ok(items.length === 3 || items.length === 4);
  assert.equal(new Set(items.map(c => c.id)).size, items.length, '按排盘日和地支去重');
  const ranges = items.flatMap(c => c.clockRanges);
  near(ranges[0][0], start);
  near(ranges[ranges.length - 1][1], end);
  near(ranges.reduce((sum, [lo, hi]) => sum + hi - lo, 0), 360);
  ranges.forEach(([lo, hi], index) => {
    assert.ok(lo < hi && lo >= start - 1e-8 && hi <= end + 1e-8);
    if (index) near(lo, ranges[index - 1][1]); // 时间有序，无空隙、无重叠
  });
  for (const c of items) {
    const d = c.chartDate;
    assert.equal(c.id, `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}|${c.branch}`);
  }
}
function at(items: readonly CandidateBranch[], minute: number) {
  return items.filter(c => c.clockRanges.some(([lo, hi]) => minute >= lo && minute < hi));
}

assert.deepEqual(SEGMENTS.map(s => s.label), [
  '凌晨（0 点–6 点）', '上午（6 点–12 点）', '下午（12 点–18 点）', '晚上（18 点–24 点）',
]);
let seed = 16;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
for (const place of [beijing, zhengzhou, urumqi]) {
  for (const segment of SEGMENTS) for (const dst of [false, true]) {
    const items = enumerateCandidateBranches(dateInfo, place, segment.value, dst);
    partition(items, segment.start, segment.end);
    for (let i = 0; i < 30; i++) {
      const point = segment.start + random() * 360;
      const matches = at(items, point);
      assert.equal(matches.length, 1);
      const standard = point - (dst ? 60 : 0);
      const hour = Math.floor(standard / 60);
      assert.equal(matches[0].branch, calcTrueSolarBranch(hour, standard - hour * 60, place.longitude));
    }
  }
}
assert.deepEqual(branches(enumerateCandidateBranches(dateInfo, beijing, '06-12', false)), [3, 4, 5, 6]);
assert.deepEqual(branches(enumerateCandidateBranches(dateInfo, zhengzhou, '06-12', false)), [3, 4, 5, 6]);
assert.deepEqual(branches(enumerateCandidateBranches(dateInfo, urumqi, '06-12', false)), [2, 3, 4, 5]);
assert.deepEqual(branches(enumerateCandidateBranches(dateInfo, beijing, '06-12', true)), [2, 3, 4, 5]);

const morning = enumerateCandidateBranches(dateInfo, beijing, '06-12', false);
const afternoon = enumerateCandidateBranches(dateInfo, beijing, '12-18', false);
assert.equal(at(morning, 359.999).length, 0, '上午不含 05:xx');
assert.equal(at(morning, 360).length, 1, '含 06:00 起点');
assert.equal(at(morning, 719.999).length, 1);
assert.equal(at(morning, 720).length, 0, '上午不含 12:00');
assert.equal(at(afternoon, 720).length, 1, '12:00 属于下午');
const aligned = enumerateCandidateBranches(dateInfo, { ...beijing, longitude: 105 }, '00-06', false);
assert.deepEqual(branches(aligned), [0, 1, 2], '恰好对齐半开端点时只收三格');
partition(aligned, 0, 360);
const fractional = enumerateCandidateBranches(dateInfo, { ...beijing, longitude: 105 - 1e-8 }, '00-06', false);
assert.equal(fractional.length, 4, '端点不得舍入后丢掉极短候选');
assert.ok(fractional[0].clockRanges[0][1] < 1e-6);
partition(fractional, 0, 360);

for (const [date, next] of [
  [{ year: 1990, month: 1, day: 31 }, { year: 1990, month: 2, day: 1 }],
  [{ year: 1990, month: 12, day: 31 }, { year: 1991, month: 1, day: 1 }],
  [{ year: 2024, month: 2, day: 29 }, { year: 2024, month: 3, day: 1 }],
  [{ year: 2026, month: 2, day: 16 }, { year: 2026, month: 2, day: 17 }],
]) {
  const evening = enumerateCandidateBranches(date, beijing, '18-24', false);
  assert.deepEqual(branches(evening), [9, 10, 11, 0]);
  assert.deepEqual(evening.slice(0, 3).map(c => c.chartDate), [date, date, date]);
  assert.deepEqual(evening[3].chartDate, next, '校正后 23:00 换排盘日，含跨月/跨年/春节');
  partition(evening, 1080, 1440);
}
for (const [date, previous] of [
  [{ year: 1990, month: 5, day: 1 }, { year: 1990, month: 4, day: 30 }],
  [{ year: 1990, month: 1, day: 1 }, { year: 1989, month: 12, day: 31 }],
  [{ year: 2026, month: 2, day: 17 }, { year: 2026, month: 2, day: 16 }],
]) {
  const early = enumerateCandidateBranches(date, urumqi, '00-06', false);
  assert.deepEqual(branches(early), [11, 0, 1, 2]);
  assert.deepEqual(early[0].chartDate, previous, '乌鲁木齐凌晨保留前一排盘日亥时');
  assert.deepEqual(early.slice(1).map(c => c.chartDate), [date, date, date]);
  partition(early, 0, 360);
}
const spring = enumerateCandidateBranches({ year: 2026, month: 2, day: 16 }, beijing, '18-24', false);
assert.deepEqual(spring.map(c => solarToLunar(c.chartDate.year, c.chartDate.month, c.chartDate.day)!.year), [2025, 2025, 2025, 2026]);
const earlyBeijing = enumerateCandidateBranches(dateInfo, beijing, '00-06', false);
assert.ok(earlyBeijing.every(c => JSON.stringify(c.chartDate) === JSON.stringify(dateInfo)), '前一民用日 23 点后仍是本排盘日子时');
const earlyDst = enumerateCandidateBranches(dateInfo, beijing, '00-06', true);
assert.deepEqual(earlyDst[0].chartDate, { year: 1990, month: 5, day: 14 });
assert.deepEqual(branches(earlyDst), [11, 0, 1, 2]);

for (const badDate of [null, { year: 1990, month: 2, day: 29 }, { year: 2000, month: 2, day: 30 },
  { year: 1990, month: 0, day: 1 }, { year: 1990, month: 4, day: 31 }, { year: NaN, month: 5, day: 15 },
  { year: 1990, month: 5, day: 1.5 }]) {
  assert.throws(() => enumerateCandidateBranches(badDate as GregorianDate, beijing, '06-12', false));
}
for (const badCity of [null, { ...beijing, province: '' }, { ...beijing, city: '' },
  { ...beijing, longitude: NaN }, { ...beijing, longitude: Infinity }, { ...beijing, longitude: -Infinity }]) {
  assert.throws(() => enumerateCandidateBranches(dateInfo, badCity as FuzzyCity, '06-12', false));
}
assert.throws(() => enumerateCandidateBranches(dateInfo, beijing, 'morning' as Segment, false));
assert.throws(() => enumerateCandidateBranches({ year: 1990, month: 1, day: 1 }, beijing, '06-12', true), /夏令时/);
assert.throws(() => enumerateCandidateBranches(dateInfo, beijing, '06-12', undefined as unknown as boolean));

const input: FuzzyBirthInput = { dateInfo, city: beijing, segment: '06-12', dstApplied: false, gender: 'male' };
try {
  const before = JSON.stringify(input);
  const result = buildCandidateResult(input, evaluatedAt);
  assert.equal(result.kind, 'candidates');
  for (const key of ['chart', 'representative', 'representativeChart', 'defaultChart']) {
    assert.equal(Object.hasOwn(result, key), false, '候选结果顶层不存在单盘/代表盘');
  }
  assert.equal(generateSpy.mock.callCount(), morning.length, '每个枚举候选恰好排一次盘');
  assert.deepEqual(result.candidates.map(({ chart, ...branch }) => branch), morning);
  generateSpy.mock.calls.forEach((call, index) => {
    const [info, options] = call.arguments;
    assert.equal(options!.evaluatedAt, evaluatedAt, '整批共享同一个评估时刻对象');
    assert.deepEqual([info.year, info.month, info.day, info.hour], [1990, 5, 15, morning[index].branch]);
    assert.equal(Object.hasOwn(info, 'origInput'), false, '不得伪造用户时分');
    assert.equal(result.candidates[index].chart.birthInfo.birthTimeKnown, true);
  });
  assert.equal(result.context.evaluatedAt, evaluatedAt.toISOString());
  assert.equal(JSON.stringify(input), before, '计算不修改原始 segment/DST/日期');
  if (false) {
    // @ts-expect-error 候选数组不可增删
    result.candidates.push(result.candidates[0]);
    // @ts-expect-error single/candidates 不可混装
    const mixed: ChartResult = { ...result, chart: result.candidates[0].chart };
    void mixed;
  }
  assert.throws(() => buildCandidateResult(input, new Date(NaN)), /评估时刻/);
  failAt = callNumber + 2;
  assert.throws(() => buildCandidateResult(input, evaluatedAt), error => error === generationFailure);
  failAt = -1;
  invalidAt = callNumber + 2;
  const callsBefore = generateSpy.mock.callCount();
  assert.throws(() => buildCandidateResult(input, evaluatedAt), /缺失或重复/, '任一盘缺字段时整批失败');
  assert.equal(generateSpy.mock.callCount() - callsBefore, morning.length, '全部生成后才整批校验，不过滤坏盘');
} finally {
  algorithmModule.exports = originalExports;
}
console.log('fuzzy time enumeration and batch regression passed');
