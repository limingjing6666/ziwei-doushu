import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateChart } from '../../lib/ziwei/algorithm';
import { buildAgeFacts } from '../../lib/ziwei/facts';
import { getSiHuaByStem } from '../../lib/ziwei/sihua';
import { chartToText, crossTransformations, viewToText } from '../../lib/ai/chart-to-text';
import { retrieveKnowledge } from '../../lib/ai/knowledge';
import { validateBirthForm } from '../../lib/birth-form';
import type { BirthFormState } from '../../components/BirthForm';

async function main() {
  const chart = generateChart({ year: 1988, month: 2, day: 20, hour: 0, gender: 'female', birthTimeKnown: false });
  const known = generateChart({ year: 1990, month: 5, day: 15, hour: 4, gender: 'male', birthTimeKnown: true });
  const options = { currentYear: 2026, selectedYear: 2030 };
  const facts = buildAgeFacts(chart, options);
  const serialized = chartToText(chart, { facts, question: '婚期健康' });
  assert.doesNotMatch(serialized + viewToText({ type: 'decadal', year: 2030 }, chart), /命宫|身宫|财帛|夫妻|官禄|福德|五行局|命主|身主|落本命|婚期|健康/);
  for (const [mark, star] of Object.entries(getSiHuaByStem(chart.lunarInfo.yearStem))) assert.ok(serialized.includes(`${star}化${mark}`));
  assert.match(serialized, /2030年/);
  assert.equal(retrieveKnowledge(chart).trim(), '');
  assert.doesNotMatch(retrieveKnowledge(chart, known), /A(?:命中格局|命宫|夫妻|福德)/);
  assert.match(crossTransformations(chart, known), /A→B/);
  assert.doesNotMatch(crossTransformations(chart, known), /B→A/);
  assert.match(crossTransformations(known, chart), /B→A/);
  assert.doesNotMatch(crossTransformations(known, chart), /A→B/);
  assert.equal(crossTransformations(chart, chart), '');

  assert.match(readFileSync('lib/ai/handler.ts', 'utf8'), /scenario === 'overview' \? 2400/);
  for (const calendar of ['solar', 'lunar']) for (const year of ['1700', '2027', 'abc', '']) {
    const errors = validateBirthForm({ calendar, year, month: '2', day: '20', unknownTime: true, gender: 'female' } as BirthFormState, new Date(2026, 9, 31));
    assert.match(errors.year, /年份超出范围|请填写/);
    assert.doesNotMatch(Object.values(errors).join(''), /日期不存在/);
  }
  console.log('✓ Round5: 未知时辰数据隔离、单向互飞、年份越界');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
