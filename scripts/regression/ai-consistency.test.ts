import assert from 'node:assert/strict';
import { generateChart } from '../../lib/ziwei/algorithm';
import { annualRomanceStars, buildAgeFacts, buildAgeWhitelist, factAstrolabe, getMarriageCandidates, getHealthYears } from '../../lib/ziwei/facts';
import { chartToText } from '../../lib/ai/chart-to-text';
import { normalizeChart } from '../../lib/ai/input';
import { fillPlaceholders, createPlaceholderBuffer } from '../../lib/ai/postprocess';
import { NORMAL_CLOSING, HEALTH_CLOSING, validateAnswer, numericReferences } from '../../lib/ai/validate';
import { codeRepair, planRepairs, repairAnswer, REWRITE_RESERVE_MS } from '../../lib/ai/repair';
import { deepSeekRewriter } from '../../lib/ai/deepseek';
import { consistencyStream, BUFFER_HEARTBEAT_MS } from '../../lib/ai/consistency-stream';
import { encodeDelta, readSseData } from '../../lib/ai/sse';
import { consumeAiResponse } from '../../lib/ai/client';
import { UNKNOWN_TIME_OPENING } from '../../lib/ai/jargon';
import { GLOSSARY, GLOSSARY_SHORT, glossaryForChart } from '../../lib/glossary';
import { INTERPRET_SYSTEM, HEMING_SYSTEM } from '../../lib/ai/prompts';
import { handleAi } from '../../lib/ai/handler';

const chart = generateChart({ year: 1990, month: 5, day: 15, hour: 4, gender: 'male', birthTimeKnown: true,
  province: '河南', city: '郑州', longitude: 113.6,
  origInput: { year: 1990, month: 5, day: 15, clockHour: 8, clockMinute: 30 } });
const opts = { currentYear: 2026, currentDate: '2026-10-31', selectedYear: 2030 };
const facts = buildAgeFacts(chart, opts);
const encoder = new TextEncoder();
const wire = (s: string) => new Response(new ReadableStream<Uint8Array>({ start(c) { c.enqueue(encoder.encode(s)); c.close(); } }), { headers: { 'Content-Type': 'text/event-stream' } });
const input = (text: string, question = '什么时候能结婚') => ({ text, facts, mode: 'followup', question });
const types = (text: string, question?: string) => validateAnswer(input(text, question)).map(i => i.type);
const ending = (text: string) => `${text}\n\n${NORMAL_CLOSING}`;

async function main() {
  for (let i = 0; i < 12; i++) assert.deepEqual(annualRomanceStars(i), { hongluan: (15 - i) % 12, tianxi: (21 - i) % 12 });
  assert.throws(() => annualRomanceStars(12), RangeError);
  const c = getMarriageCandidates(chart, opts);
  assert.deepEqual(c, getMarriageCandidates(chart, opts));
  assert.deepEqual(c.years, [2030, 2032, 2043]);
  assert.equal(c.rangeText, '虚岁 41–54（公历 2030–2043）');
  assert.equal(c.candidates.length, 3);
  assert.deepEqual(c.candidates.map(c => c.score), [6, 6, 6]);
  assert.deepEqual(c.candidates[0].reasons, ['太阳流年化禄在本命夫妻，引动夫妻三方四正（+2）', '太阴流年化科在本命福德，引动夫妻三方四正（+2）', '流年夫妻与大限夫妻同宫或对宫（+2）']);
  assert.ok(c.candidates.every(c => c.nominalAge === c.year - 1990 + 1 && c.nominalAge >= 35 && c.nominalAge <= 55));
  const peach = { ...chart, palaces: chart.palaces.map(p => p.name === '夫妻' ? { ...p, stars: [...p.stars, { name: '天姚', type: 'minor' as const }, { name: '咸池', type: 'minor' as const }] } : p) };
  assert.deepEqual(getMarriageCandidates(peach, opts).candidates.map(c => [c.year, c.score]), [[2030, 7], [2032, 7], [2043, 7]]);
  assert.ok(getMarriageCandidates(peach, opts).candidates[0].reasons.includes('本命夫妻有天姚桃花辅助线索（+0.5）'));
  assert.equal(facts.currentAge, 37);
  assert.equal(facts.currentDecadal?.startAge, 36);
  assert.deepEqual(facts.discrepancies, []);
  const a = factAstrolabe(chart), h = a.horoscope('2026-10-31');
  assert.equal(h.age.nominalAge, 37);
  assert.equal(a.palaces[h.decadal.index].decadal.range[0], 36);
  const changed = { ...chart, daXians: chart.daXians.map(d => ({ ...d, startAge: d.startAge + 1, endAge: d.endAge + 1 })) };
  const changedFacts = buildAgeFacts(changed, opts);
  assert.ok(changedFacts.discrepancies.length);
  assert.equal(changedFacts.currentDecadal?.startAge, 37, 'page data wins');
  const unknown = { ...chart, birthInfo: { ...chart.birthInfo, birthTimeKnown: false } };
  assert.equal(getMarriageCandidates(unknown, opts).unavailable, true);
  assert.deepEqual(getHealthYears(unknown, opts).years, []);
  assert.ok(buildAgeWhitelist(chart, opts).years.includes(2030));
  assert.ok(getHealthYears(chart, opts).entries.every(e => e.nominalAge === e.year - 1990 + 1));
  // January births before 春节 use the lunar birth year, NOT Gregorian year subtraction.
  const january = generateChart({ year: 1990, month: 1, day: 1, hour: 0, gender: 'male' });
  assert.equal(buildAgeFacts(january, opts).selected?.nominalAge, 2030 - 1989 + 1);
  assert.equal(buildAgeFacts(chart, { ...opts, currentDate: '2026-1-1' }).currentAge, 36);
  // Nondefault leap policy survives untrusted JSON normalization and reconstructs as generateChart.
  const leap = generateChart({ year: 2020, month: 5, day: 24, hour: 4, gender: 'male' }, { leapMonth: 'next-month' });
  assert.equal(factAstrolabe(normalizeChart(leap)).earthlyBranchOfSoulPalace, factAstrolabe(leap).earthlyBranchOfSoulPalace);
  const text = chartToText(chart, { facts, question: '婚期' });
  assert.equal(text.split('当前虚岁').length - 1, 1);
  assert.equal(text.split('【年龄与运限事实').length - 1, 1);
  assert.match(text, /11｜夫妻｜虚岁 106–115｜公历 2095–2104/);
  assert.doesNotMatch(text.split('【大限一览表】')[0], /106–115/);
  assert.doesNotMatch(text.split('【事实使用边界】')[1], /106–115|大限虚岁/);
  assert.match(text, /流年十二宫/);
  assert.doesNotMatch(chartToText(chart, { facts, question: '事业' }), /MARRIAGE|婚期仅允许/);
  assert.doesNotMatch(chartToText(unknown, { facts: buildAgeFacts(unknown, opts), question: '婚期' }), /\{\{MARRIAGE/);
  let removed = 0;
  assert.equal(fillPlaceholders('A{{MARRIAGE_RANGE}}B{{MARRIAGE_YEARS}}{{UNKNOWN}}', facts, () => removed++), `A${c.rangeText}B2030、2032、2043 年`);
  assert.equal(removed, 1);
  for (const source of ['A{{MARRIAGE_RANGE}}B{{MARRIAGE_YEARS}}C', 'x{{HEALTH_YEARS}}y{{UNKNOWN}}']) {
    for (let split = 0; split <= source.length; split++) {
      const b = createPlaceholderBuffer(facts);
      assert.equal(b.push(source.slice(0, split)) + b.push(source.slice(split)) + b.finish(), fillPlaceholders(source, facts));
    }
    const b = createPlaceholderBuffer(facts);
    assert.equal([...source].map(ch => b.push(ch)).join('') + b.finish(), fillPlaceholders(source, facts));
  }
  const dangling = createPlaceholderBuffer(facts);
  assert.equal(dangling.push('你好{{MARR'), '你好'); assert.equal(dangling.finish(), '');
  const overlong = createPlaceholderBuffer(facts); assert.equal(overlong.push('{{' + 'x'.repeat(41)).length, 43);
  const valid = ending(`可以积极经营关系。\n\n候选范围是${c.rangeText}，重点是2030、2032、2043 年。`);
  assert.deepEqual(types(valid), []);
  for (const first of ['你是火六局，建议结婚。', '命宫化忌，需要等待。', '紫微在庙，适合。', '宫干丙，适合。', '机月同梁，适合。']) assert.ok(types(ending(first)).includes('first-sentence-jargon'));
  for (const first of ['子女宫相关问题可以慢慢沟通。', '命运由你自己把握。', '可以换，但别贸然辞职。', '先调整布局，别陷入焦虑。']) assert.ok(!types(ending(first), '事业').includes('first-sentence-jargon'));
  assert.ok(!validateAnswer({ ...input(`${UNKNOWN_TIME_OPENING}。`), facts: buildAgeFacts(unknown, opts) }).some(i => i.type === 'first-sentence-jargon'));
  for (const number of ['999岁', '虚岁 39–44', '106–115岁', '2095–2104年', '2027年', '虚岁 36–45', '虚岁 41–43', '2030–2032年']) assert.ok(types(ending(`可以主动争取。\n\n婚期${number}。`)).includes('age-not-in-facts'), number);
  assert.ok(types(ending('可以争取。')).includes('marriage-no-candidate'));
  assert.ok(types('可以争取。').includes('closing-line'));
  assert.ok(types(`${valid}\n${NORMAL_CLOSING}`).includes('closing-line'));
  assert.ok(types(`${NORMAL_CLOSING}\n${valid}`).includes('closing-line'));
  assert.ok(types(`${valid}\n后文。`).includes('closing-line'));
  assert.ok(types(ending('{{MARRIAGE_RANGE}}')).includes('placeholder-left'));
  assert.equal(numericReferences('一岁、万年、多年、去年、今年').length, 0);
  assert.deepEqual(types(ending('这几年可以多沟通。'), '事业'), []);
  const hf = facts.health.entries[0];
  if (hf) assert.deepEqual(types(`建议多留意身体。\n\n${hf.year}年（虚岁 ${hf.nominalAge}）多留意。\n\n${HEALTH_CLOSING}`, '健康'), []);
  const pure = codeRepair(input(`可以争取。\n\n婚期是106–115岁，或2095年。\n\n保留其它分析。{{WHAT}}\n${NORMAL_CLOSING}\n${NORMAL_CLOSING}`));
  assert.ok(pure.includes('保留其它分析。')); assert.deepEqual(types(pure), []);
  const before = ending(`火六局，机会较好。\n\n婚期106–115岁，依据需要核对，沟通和现实准备同样重要。\n\n这段无需修改。`);
  const targets = planRepairs(before, validateAnswer(input(before)));
  assert.equal(targets.length, 2); assert.ok(targets.every(t => !t.text.includes('这段无需修改')));
  assert.ok(REWRITE_RESERVE_MS === 15000 && BUFFER_HEARTBEAT_MS === 10000);
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  try {
    console.warn = (...args: unknown[]) => { warnings.push(args); };
    const cleaned = await repairAnswer(input(`可以争取。{{UNKNOWN}}{{DANGLING`), { deadline: 0, rewrite: async () => [] });
    assert.doesNotMatch(cleaned, /\{\{/);
    assert.ok(warnings.some(args => JSON.stringify(args) === '["[ai-consistency]",{"placeholder-left":2}]'));
    assert.ok(!JSON.stringify(warnings).includes('UNKNOWN'));
  } finally { console.warn = originalWarn; }
  const originalFetch = globalThis.fetch;
  // Dummy transport credential only; fetch always mocked before configuring it.
  try {
    let calls = 0;
    globalThis.fetch = async (_url, init) => {
      calls++;
      const payload = JSON.parse(init!.body as string);
      assert.equal(payload.stream, false);
      const data = JSON.parse(payload.messages[1].content);
      assert.equal(data.targets.length, 2);
      assert.ok(data.targets.every((t: { paragraph: string }) => !t.paragraph.includes('这段无需修改')));
      return Response.json({ choices: [{ message: { content: JSON.stringify(['可以积极争取。', '可留意{{MARRIAGE_YEARS}}。']) } }] });
    };
    process.env.DEEPSEEK_API_KEY = 'consistency-test-fixture';
    const repaired = await repairAnswer(input(before), { deadline: Date.now() + 20000, rewrite: deepSeekRewriter(new AbortController().signal) });
    assert.equal(calls, 1); assert.ok(repaired.includes('这段无需修改。')); assert.deepEqual(types(repaired), []);
    globalThis.fetch = async () => { calls++; return Response.json({ choices: [{ message: { content: JSON.stringify(['火六局。', '婚期999岁。']) } }] }); };
    const failed = await repairAnswer(input(before), { deadline: Date.now() + 20000, rewrite: deepSeekRewriter(new AbortController().signal) });
    assert.equal(calls, 2, 'at most one rewrite attempt, even if second answer fails');
    assert.ok(failed.includes('这段无需修改。')); assert.ok(failed.startsWith('火六局，机会较好。')); assert.ok(!types(failed).includes('age-not-in-facts')); assert.ok(types(failed).includes('first-sentence-jargon'));
    let skippedCalls = 0;
    const noBudget = await repairAnswer(input(before), { deadline: 14999, now: () => 0, rewrite: async () => { skippedCalls++; throw new Error('must not rewrite'); } });
    assert.equal(skippedCalls, 0); assert.ok(!types(noBudget).includes('age-not-in-facts'));
    // Actual handler non-sensitive request delivers a delta BEFORE upstream finishes.
    delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.AI_MINUTE_LIMIT = '100'; process.env.AI_DAILY_LIMIT = '100';
    let finish!: () => void;
    globalThis.fetch = async () => new Response(new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"可以先准备作品。"}}]}\n\n'));
      finish = () => { controller.enqueue(encoder.encode('data: [DONE]\n\n')); controller.close(); };
    } }));
    const request = (q: string) => new Request('http://localhost/api/interpret', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-real-ip': 'consistency-fixture' }, body: JSON.stringify({ chart, messages: [{ role: 'user', content: q }] }) });
    const response = await handleAi(request('适合什么职业'), 'interpret');
    const reader = response.body!.getReader();
    const chunk = await reader.read();
    assert.match(new TextDecoder().decode(chunk.value), /可以先准备作品/); finish();
    while (!(await reader.read()).done) { /* drain */ }
    // Real sensitive handler waits for completion; it does not leak raw deltas.
    globalThis.fetch = async () => new Response(new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `可以积极经营关系。\\n\\n候选{{MARRIAGE_RANGE}}。\\n\\n${NORMAL_CLOSING}` } }] })}\n\n`));
      finish = () => { controller.enqueue(encoder.encode('data: [DONE]\n\n')); controller.close(); };
    } }));
    const sensitive = await handleAi(request('什么时候能结婚'), 'interpret');
    const sensitiveReader = sensitive.body!.getReader();
    const firstRead = sensitiveReader.read();
    const state = await Promise.race([firstRead.then(() => 'early'), new Promise<string>(resolve => setTimeout(() => resolve('waiting'), 20))]);
    assert.equal(state, 'waiting'); finish();
    assert.match(new TextDecoder().decode((await firstRead).value), /可以积极经营关系/);
    while (!(await sensitiveReader.read()).done) { /* drain */ }
    // Buffered mode does not leak bad numbers; same public protocol and partial error behavior.
    let emitted = '';
    const wrapped = consistencyStream(wire(encodeDelta('可以争取。婚期999岁。') + 'data: [DONE]\n\n'), { facts, mode: 'followup', question: '婚期' }, { buffered: true, deadline: 0, rewrite: async () => { throw new Error('no budget'); } });
    await consumeAiResponse(wrapped, s => { emitted = s; }); assert.doesNotMatch(emitted, /999/); assert.ok(emitted.includes(c.rangeText));
    let streamText = '';
    const splitWire = consistencyStream(wire(encodeDelta('可考虑{') + encodeDelta('{MARRIAGE_') + encodeDelta('YEARS}}。') + 'data: [DONE]\n\n'), { facts, mode: 'followup', question: '事业' }, { buffered: false, deadline: 0, rewrite: async () => [] });
    await consumeAiResponse(splitWire, s => { streamText = s; }); assert.equal(streamText, '可考虑2030、2032、2043 年。');
    const partial = consistencyStream(wire(encodeDelta('保留部分。') + 'data: {"error":"解读暂时中断"}\n\ndata: [DONE]\n\n'), { facts, mode: 'followup', question: '健康' }, { buffered: true, deadline: 0, rewrite: async () => [] });
    await assert.rejects(consumeAiResponse(partial, s => { emitted = s; }), /中断/); assert.equal(emitted, '保留部分。');
    // Keep unknown/malformed upstream framing errors out of user content.
    const frames: string[] = [];
    for await (const f of readSseData(wire(': ping\n\n' + encodeDelta('正常') + 'data: [DONE]\n\n').body!)) frames.push(f);
    assert.equal(frames.length, 2);
  } finally { globalThis.fetch = originalFetch; delete process.env.DEEPSEEK_API_KEY; }
  for (const term of ['宫干', '庙旺利陷', '亮度', '五行局', '命主', '身主', '飞化', '自化', '三方四正', '会照', '借星']) {
    assert.ok(GLOSSARY[term]); assert.ok(GLOSSARY_SHORT[term].length <= 20);
  }
  // Annual 命/夫妻/福德 have the year's branch parity, whereas annual 红鸾/天喜
  // have the opposite parity. These exact requested conjunctions cannot trigger.
  for (let year = 2024; year <= 2035; year++) {
    const annual = a.horoscope(`${year}-7-1`), romance = annualRomanceStars((year - 4) % 12);
    for (const p of ['命宫', '夫妻', '福德']) {
      const branch = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'].indexOf(a.palaces[annual.yearly.palaceNames.indexOf(p as '命宫')].earthlyBranch);
      assert.ok(![romance.hongluan, romance.tianxi].includes(branch));
    }
  }
  const glossary = glossaryForChart('火六局 宫干 紫微（庙） 庙旺利陷 命主 身主 飞化');
  assert.ok(glossary.length <= 600); assert.match(glossary, /宫干（/); assert.match(glossary, /火六局（排盘分组与起限数字）/); assert.doesNotMatch(glossary, /化权（/);
  for (const prompt of [INTERPRET_SYSTEM, HEMING_SYSTEM]) {
    assert.match(prompt, /第一句不得出现任何命理术语/); assert.match(prompt, /所有年龄均为虚岁/);
    assert.match(prompt, /不得自行用出生年推算或换算年龄/); assert.match(prompt, /年份区间含首尾/);
  }
  console.log('✓ AI consistency: 12支公式、稳定候选/虚岁/页面优先、唯一事实、分片占位符、校验误报、局部mock修复/预算降级、真实handler即时流式、SSE兼容、术语');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
