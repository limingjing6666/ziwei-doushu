import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateChart } from '../../lib/ziwei/algorithm';
import { buildAgeFacts } from '../../lib/ziwei/facts';
import { getSiHuaByStem } from '../../lib/ziwei/sihua';
import { chartToText, crossTransformations, viewToText } from '../../lib/ai/chart-to-text';
import { retrieveKnowledge } from '../../lib/ai/knowledge';
import { codeRepair } from '../../lib/ai/repair';
import { consistencyStream } from '../../lib/ai/consistency-stream';
import { encodeDelta, readSseData } from '../../lib/ai/sse';
import { UNKNOWN_TIME_OPENING } from '../../lib/ai/jargon';
import { INTERPRET_SYSTEM, HEMING_SYSTEM } from '../../lib/ai/prompts';
import { compatibilityFacts } from '../../lib/ai/facts';
import { validateBirthForm } from '../../lib/birth-form';
import type { BirthFormState } from '../../components/BirthForm';

async function main() {
  const chart = generateChart({ year: 1988, month: 2, day: 20, hour: 0, gender: 'female', birthTimeKnown: false });
  const known = generateChart({ year: 1990, month: 5, day: 15, hour: 4, gender: 'male', birthTimeKnown: true });
  const options = { currentYear: 2026, selectedYear: 2030 };
  const facts = buildAgeFacts(chart, options);
  const serialized = chartToText(chart, { facts, question: '婚期健康' });
  assert.doesNotMatch(serialized + viewToText({ type: 'decadal', year: 2030 }, chart), /命宫|身宫|财帛|夫妻|官禄|福德|大限|五行局|命主|身主|落本命|婚期|健康/);
  for (const [mark, star] of Object.entries(getSiHuaByStem(chart.lunarInfo.yearStem))) assert.ok(serialized.includes(`${star}化${mark}`));
  assert.match(serialized, /2030年/);
  assert.equal(retrieveKnowledge(chart).trim(), '');
  assert.doesNotMatch(retrieveKnowledge(chart, known), /A(?:命中格局|命宫|夫妻|福德)/);
  assert.match(crossTransformations(chart, known), /A→B/);
  assert.doesNotMatch(crossTransformations(chart, known), /B→A/);
  assert.match(crossTransformations(known, chart), /B→A/);
  assert.doesNotMatch(crossTransformations(known, chart), /A→B/);
  assert.equal(crossTransformations(chart, chart), '');

  const source = `${UNKNOWN_TIME_OPENING}。夫妻宫太阳落陷，感情费心。机月同梁利事业。当前大限利财。财宫有助力。命/财联参。天同化禄，日常重舒适。事业要落实计划。关系要多沟通。`;
  const input = { facts, mode: 'overview', question: '整盘' };
  const clean = codeRepair({ ...input, text: source });
  assert.equal(clean, `${UNKNOWN_TIME_OPENING}。天同化禄，日常重舒适。事业要落实计划。关系要多沟通。`);
  for (const bad of ['交友有天机。', '父母坐太阳。', '兄弟宫有武曲。', '化禄入财主进益。', '命财官联参。', '昌曲同会利读书。']) {
    assert.equal(codeRepair({ ...input, text: `${UNKNOWN_TIME_OPENING}。${bad}事业要落实计划。` }), `${UNKNOWN_TIME_OPENING}。事业要落实计划。`);
  }
  assert.equal(codeRepair({ ...input, text: source, facts: buildAgeFacts(known, options) }), source);
  const pair = compatibilityFacts(facts, buildAgeFacts(known, options));
  const pairClean = codeRepair({ ...input, facts: pair, text: `${UNKNOWN_TIME_OPENING}。甲方夫妻宫太阳落陷。乙方夫妻宫重交流。` });
  assert.ok(pairClean.includes('乙方夫妻宫重交流'));
  assert.ok(!pairClean.includes('甲方夫妻宫'));
  // Exceed the streaming tail so tests exercise early emission as well as final drain.
  const longSource = source + '把任务分解再逐项完成。'.repeat(16) + '福德宫巨门多思。';
  const longClean = clean + '把任务分解再逐项完成。'.repeat(16);
  // Both real SSE paths, at every split including inside opening and forbidden words.
  for (const buffered of [false, true]) for (let split = 0; split <= longSource.length; split++) {
    const encoder = new TextEncoder();
    const wire = encodeDelta(longSource.slice(0, split)) + encodeDelta(longSource.slice(split)) + 'data: [DONE]\n\n';
    const upstream = new Response(new ReadableStream<Uint8Array>({ start(c) { c.enqueue(encoder.encode(wire)); c.close(); } }));
    const response = consistencyStream(upstream, input, { buffered, deadline: Date.now() + 1000, rewrite: async () => { throw new Error('unexpected rewrite'); } });
    let output = '';
    for await (const frame of readSseData(response.body!)) if (frame !== '[DONE]') output += JSON.parse(frame).delta?.text ?? '';
    assert.equal(output, longClean, `${buffered}/${split}`);
  }

  const length = '全文（含小标题与括号解释）700–900汉字，硬上限1000字，小节不超过5个且每节不超过170字，建议每条不超过60字';
  for (const text of [INTERPRET_SYSTEM, HEMING_SYSTEM, readFileSync('lib/ai/handler.ts', 'utf8')]) {
    assert.ok(text.includes(length));
    assert.doesNotMatch(text, /700–1000|1200字/);
    assert.match(text, /12字/);
  }
  assert.match(readFileSync('lib/ai/handler.ts', 'utf8'), /scenario === 'overview' \? 2400/);
  for (const calendar of ['solar', 'lunar']) for (const year of ['1700', '2027', 'abc', '']) {
    const errors = validateBirthForm({ calendar, year, month: '2', day: '20', unknownTime: true, gender: 'female' } as BirthFormState, new Date(2026, 9, 31));
    assert.match(errors.year, /年份超出范围|请填写/);
    assert.doesNotMatch(Object.values(errors).join(''), /日期不存在/);
  }
  console.log('✓ Round5: 未知时辰数据隔离、单向互飞、句级过滤与双路径分片、篇幅、年份越界');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
