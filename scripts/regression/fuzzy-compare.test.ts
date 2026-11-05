import assert from 'node:assert/strict';
import { astro } from 'iztro';
import { generateChart } from '../../lib/ziwei/algorithm';
import { buildCandidateResult, type Candidate, type FuzzyBirthInput } from '../../lib/ziwei/fuzzy-time';
import { compareCandidates, extractComparableFields } from '../../lib/ziwei/compare-candidates';
import type { Star, ZiweiChart } from '../../lib/ziwei/types';

const input: FuzzyBirthInput = {
  dateInfo: { year: 1990, month: 5, day: 15 },
  city: { province: '北京市', city: '北京', longitude: 116.4 },
  segment: '06-12', dstApplied: false, gender: 'male',
};
const evaluatedAt = new Date('2026-11-05T00:00:00+08:00');
const { candidates } = buildCandidateResult(input, evaluatedAt);
const before = JSON.stringify(candidates);
const fields = candidates.map(c => extractComparableFields(c.chart));
const comparison = compareCandidates(candidates);
assert.deepEqual(candidates.map(c => c.branch), [3, 4, 5, 6]);
assert.deepEqual(fields[0].natal.map(({ star, mark }) => ({ star, mark })), [
  { star: '太阳', mark: '禄' }, { star: '武曲', mark: '权' },
  { star: '太阴', mark: '科' }, { star: '天同', mark: '忌' },
]);
for (const [index, natal] of comparison.natal.entries()) {
  assert.equal(natal.identity.status, 'all-same');
  assert.deepEqual(natal.identity.groups, [{
    value: { star: fields[0].natal[index].star, mark: natal.mark },
    candidateIds: candidates.map(c => c.id),
  }]);
  assert.equal(natal.palace.status, 'all-different');
  assert.equal(natal.consistentPalace, null, '变化的四化落宫不能附在一致项中');
  assert.deepEqual(natal.palace.groups.map(g => g.candidateIds), candidates.map(c => [c.id]));
}
assert.deepEqual(fields.map(f => f.ming), [
  { name: '命宫', branch: 2 }, { name: '命宫', branch: 1 },
  { name: '命宫', branch: 0 }, { name: '命宫', branch: 11 },
]);
assert.deepEqual(fields.map(f => f.shen), [
  { name: '迁移', branch: 8 }, { name: '财帛', branch: 9 },
  { name: '夫妻', branch: 10 }, { name: '命宫', branch: 11 },
]);
assert.equal(comparison.ming.status, 'all-different', '宫名都叫命宫，支不同仍不一致');
assert.equal(comparison.shen.status, 'all-different');
assert.deepEqual(fields.map(f => f.currentDaXian), [
  { palace: { name: '田宅', branch: 5 }, startAge: 35 },
  { palace: { name: '田宅', branch: 4 }, startAge: 36 },
  { palace: { name: '田宅', branch: 3 }, startAge: 36 },
  { palace: { name: '田宅', branch: 2 }, startAge: 35 },
]);
assert.equal(comparison.currentDaXian.status, 'all-different', '不能仅凭大限宫名相同判一致');
assert.deepEqual(fields[0].natal[0].palace, { name: '仆役', branch: 7 });
assert.deepEqual(fields[3].natal[0].palace, { name: '财帛', branch: 7 });
assert.equal(compareCandidates([candidates[0], candidates[3]]).natal[0].palace.status, 'all-different', '同支不同宫名也不同');
assert.deepEqual(Object.keys(comparison).sort(), ['currentDaXian', 'ming', 'natal', 'shen'], '默认比较不扩到局数、命主、亮度、流年');

const copies = (charts: readonly ZiweiChart[]): readonly Candidate[] => charts.map((chart, index) => ({
  ...candidates[0], id: `fixture-${index}`, chart,
}));
const allSame = compareCandidates(copies([candidates[0].chart, structuredClone(candidates[0].chart)]));
assert.equal(allSame.ming.status, 'all-same', '比较值而非引用');
assert.equal(allSame.shen.status, 'all-same');
assert.equal(allSame.currentDaXian.status, 'all-same');
assert.deepEqual(allSame.natal[0].consistentPalace, fields[0].natal[0].palace);
const partial = compareCandidates(copies([candidates[0].chart, candidates[1].chart, candidates[0].chart]));
assert.equal(partial.ming.status, 'partly-different');
assert.equal(partial.currentDaXian.status, 'partly-different');
assert.deepEqual(partial.ming.groups.map(g => g.candidateIds), [['fixture-0', 'fixture-2'], ['fixture-1']]);

const marked = (chart: ZiweiChart): Star => chart.palaces.flatMap(p => p.stars).find(s => s.siHua === '禄')!;
const differentIdentity = structuredClone(candidates[0].chart);
marked(differentIdentity).name = '天机';
const identityOnly = compareCandidates(copies([candidates[0].chart, differentIdentity])).natal[0];
assert.equal(identityOnly.identity.status, 'all-different');
assert.equal(identityOnly.palace.status, 'all-same');
assert.equal(identityOnly.consistentPalace, null, '身份不同，即使落宫全同也不能附入一致');
assert.equal(JSON.stringify(candidates), before, '提取和比较不修改候选盘');

const corruptions: ((chart: ZiweiChart) => void)[] = [
  c => { delete marked(c).siHua; },
  c => { c.palaces[0].stars.push({ ...marked(c) }); },
  c => { marked(c).name = ''; },
  c => { c.palaces.pop(); },
  c => { c.palaces[0].branch = c.palaces[1].branch; },
  c => { c.palaces[0].name = c.palaces[1].name; },
  c => { delete (c as Partial<ZiweiChart>).mingGongBranch; },
  c => { c.palaces.forEach(p => { p.isShenGong = false; }); },
  c => { c.currentAge = NaN; },
  c => { delete (c as Partial<ZiweiChart>).currentDaXianIndex; },
  c => { c.currentDaXianIndex = 99; },
  c => { c.currentDaXianIndex = -1; },
  c => { c.daXians = []; },
  c => { delete (c.daXians[c.currentDaXianIndex] as Partial<ZiweiChart['daXians'][number]>).startAge; },
  c => { c.daXians[c.currentDaXianIndex].palaceName = '缺失宫位'; },
  c => { c.daXians.splice(1, 0, { ...c.daXians[0] }); },
];
for (const corrupt of corruptions) {
  const chart = structuredClone(candidates[0].chart);
  corrupt(chart);
  assert.throws(() => extractComparableFields(chart));
  assert.throws(() => compareCandidates(copies([chart, chart])), '缺失值不能靠 undefined===undefined 判一致');
}
assert.throws(() => compareCandidates([]), /不能为空/);
assert.throws(() => compareCandidates([candidates[0], candidates[0]]), /重复/);

const differentStart = structuredClone(candidates[0].chart);
differentStart.daXians[differentStart.currentDaXianIndex].startAge++;
assert.equal(compareCandidates(copies([candidates[0].chart, differentStart])).currentDaXian.status,
  'all-different', '同宫名同支但起限岁不同，完整大限仍不同');

// 与 iztro 同一本地日期口径核验，覆盖春节换岁、大限临界、未入/超范围。
for (const at of [
  new Date(1990, 4, 15, 12),
  new Date(2024, 1, 9, 12), new Date(2024, 1, 10, 12),
  new Date(2026, 1, 16, 12), new Date(2026, 1, 17, 12),
  new Date(2120, 0, 1, 12),
]) {
  const batch = buildCandidateResult(input, at);
  for (const candidate of batch.candidates) {
    const single = generateChart(candidate.chart.birthInfo, { evaluatedAt: at });
    const expectedAge = astro.bySolar('1990-5-15', candidate.branch, '男', true, 'zh-CN')
      .horoscope(at).age.nominalAge;
    assert.equal(candidate.chart.currentAge, expectedAge, '使用指定时刻的引擎虚岁，不是公历年差');
    assert.deepEqual(extractComparableFields(candidate.chart), extractComparableFields(single));
    assert.deepEqual(candidate.chart.palaces.map(p => p.isCurrentDaXian), single.palaces.map(p => p.isCurrentDaXian));
    if (at.getFullYear() === 1990 || at.getFullYear() === 2120) {
      assert.equal(candidate.chart.currentDaXianIndex, -1);
      assert.equal(extractComparableFields(candidate.chart).currentDaXian, null, '无实际大限不伪造宫位');
    }
  }
}
const beforeSpring = generateChart(candidates[0].chart.birthInfo, { evaluatedAt: new Date(2024, 1, 9, 12) });
const afterSpring = generateChart(candidates[0].chart.birthInfo, { evaluatedAt: new Date(2024, 1, 10, 12) });
assert.deepEqual([beforeSpring.currentAge, afterSpring.currentAge], [34, 35]);
assert.notEqual(beforeSpring.currentDaXianIndex, afterSpring.currentDaXianIndex, '春节的临界岁切换大限');
console.log('fuzzy candidate field comparison regression passed');
