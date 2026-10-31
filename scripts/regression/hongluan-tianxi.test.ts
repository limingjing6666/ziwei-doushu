/** Regression coverage for Hongluan/Tianxi placement and palace labels. */
import assert from 'node:assert/strict';
import { generateChart } from '../../lib/ziwei/algorithm';
import { BRANCHES, STEMS } from '../../lib/ziwei/constants';
import { annualRomanceStars, getMarriageCandidates } from '../../lib/ziwei/facts';

function placementsFor(year: number, month = 5, day = 15) {
  const chart = generateChart({ year, month, day, hour: 11, gender: 'male', longitude: 120 });
  return chart.palaces.flatMap((palace) =>
    palace.stars
      .filter((star) => star.name === '红鸾' || star.name === '天喜')
      .map((star) => ({
        name: star.name,
        branch: BRANCHES[palace.branch],
        palaceLabel: `${STEMS[palace.stem]}${BRANCHES[palace.branch]}`,
      })),
  );
}

const placements = placementsFor(1974, 1, 28);

assert.deepEqual(
  placements.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
  [
    { name: '天喜', branch: '未', palaceLabel: '辛未' },
    { name: '红鸾', branch: '丑', palaceLabel: '丁丑' },
  ].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
  '甲寅年应按卯起子年逆数得到红鸾丑、天喜未；丁丑/辛未是所在宫完整干支',
);

const representativeYears = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2016, 2017, 2018, 2019];
for (let yearBranch = 0; yearBranch < 12; yearBranch += 1) {
  const year = representativeYears[yearBranch];
  const yearPlacements = placementsFor(year);
  const hongluan = yearPlacements.filter((item) => item.name === '红鸾');
  const tianxi = yearPlacements.filter((item) => item.name === '天喜');
  const expectedHongluan = (3 - yearBranch + 12) % 12;
  const expectedTianxi = (expectedHongluan + 6) % 12;

  assert.equal(hongluan.length, 1, `${BRANCHES[yearBranch]}年应且仅应有一颗红鸾`);
  assert.equal(tianxi.length, 1, `${BRANCHES[yearBranch]}年应且仅应有一颗天喜`);
  assert.equal(hongluan[0].branch, BRANCHES[expectedHongluan], `${BRANCHES[yearBranch]}年红鸾宫位错误`);
  assert.equal(tianxi[0].branch, BRANCHES[expectedTianxi], `${BRANCHES[yearBranch]}年天喜宫位错误`);
  assert.equal(
    (BRANCHES.indexOf(tianxi[0].branch) - BRANCHES.indexOf(hongluan[0].branch) + 12) % 12,
    6,
    `${BRANCHES[yearBranch]}年红鸾与天喜必须互为对宫`,
  );
}

// Every natal branch is activated once by each annual romance star in a full cycle.
for (let natalBranch = 0; natalBranch < 12; natalBranch++) {
  const cycle = representativeYears.map(year => annualRomanceStars((year - 4) % 12));
  assert.equal(cycle.filter(s => s.hongluan === natalBranch).length, 1);
  assert.equal(cycle.filter(s => s.tianxi === natalBranch).length, 1);
  for (let yearBranch = 0; yearBranch < 12; yearBranch++) {
    const stars = annualRomanceStars(yearBranch);
    assert.equal(stars.hongluan, (15 - yearBranch) % 12);
    assert.equal(stars.tianxi, (21 - yearBranch) % 12);
  }
}
const fixed = generateChart({ year: 1990, month: 5, day: 15, hour: 4, gender: 'male', birthTimeKnown: true,
  province: '河南', city: '郑州', longitude: 113.6,
  origInput: { year: 1990, month: 5, day: 15, clockHour: 8, clockMinute: 30 } });
const candidates = getMarriageCandidates(fixed, { currentYear: 2026, currentDate: '2026-10-31', selectedYear: 2030 });
assert.deepEqual(candidates.years, [2030, 2042, 2028]);
assert.deepEqual(candidates.candidates.map(c => [c.score, c.reasons]), [
  [10, ['流年天喜入本命夫妻宫（+4）', '太阳流年化禄在本命夫妻，引动夫妻三方四正（+2）', '太阴流年化科在本命福德，引动夫妻三方四正（+2）', '流年夫妻与大限夫妻同宫或对宫（+2）']],
  [8, ['流年天喜入本命夫妻宫（+4）', '天梁流年化禄在本命迁移，引动夫妻三方四正（+2）', '左辅流年化科在本命迁移，引动夫妻三方四正（+2）']],
  [6, ['流年天喜入本命命宫（+2）', '太阴流年化权在本命福德，引动夫妻三方四正（+2）', '右弼流年化科在本命迁移，引动夫妻三方四正（+2）']],
]);
console.log('✓ 甲寅与十二年支红鸾天喜映射、本命引动覆盖、固定盘候选及得分明细');
