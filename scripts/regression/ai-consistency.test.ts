import assert from 'node:assert/strict';
import { generateChart } from '../../lib/ziwei/algorithm';
import { annualRomanceStars, buildAgeFacts, buildAgeWhitelist, factAstrolabe, getMarriageCandidates, getHealthYears } from '../../lib/ziwei/facts';
import { chartToText, isNumericSensitive } from '../../lib/ai/chart-to-text';
import { compatibilityFacts } from '../../lib/ai/facts';
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

async function fixRegressions() {
  // R1: preserve identities for basic ages, selected ages, birth years and health placeholders.
  const chartB = generateChart({ year: 2000, month: 5, day: 15, hour: 4, gender: 'female', birthTimeKnown: true });
  const factsB = buildAgeFacts(chartB, { ...opts, selectedYear: 2033 });
  const pair = compatibilityFacts(facts, factsB);
  assert.equal(factsB.currentAge, 27);
  const pairInput = (text: string, question = '感情匹配度如何') => ({ text: ending(text), question, facts: pair, mode: 'followup' });
  const basics = `甲方当前虚岁 37，所选年龄 ${facts.selected!.nominalAge}岁，出生于1990年。乙方当前虚岁 27，所选年龄 ${factsB.selected!.nominalAge}岁，出生于2000年。`;
  for (const question of ['感情匹配度如何', '什么时候结婚', '健康与大限']) {
    const answer = pairInput(basics, question);
    assert.ok(!validateAnswer(answer).some(i => i.type === 'age-not-in-facts'), question);
    const repaired = codeRepair(answer);
    assert.ok(repaired.includes(basics));
  }
  assert.ok(!validateAnswer(pairInput('乙方27岁。', '婚期')).some(i => i.type === 'age-not-in-facts'));
  for (const text of ['乙方当前虚岁 37。', `乙方所选年龄 ${facts.selected!.nominalAge}岁。`, '乙方出生于1990年。', '甲方当前虚岁 27。', 'B方当前虚岁 37。']) {
    const value = pairInput(text);
    assert.ok(validateAnswer(value).some(i => i.type === 'age-not-in-facts'), text);
    const repaired = codeRepair(value);
    assert.match(repaired, /这一点目前无法确定/);
    assert.ok(!repaired.includes(pair.marriage.rangeText), 'never substitute a marriage range for an age');
    assert.ok(!validateAnswer({ ...value, text: repaired }).some(i => i.type === 'age-not-in-facts'));
  }
  const scopedHealth = fillPlaceholders('乙方：{{HEALTH_YEARS}}', pair);
  assert.equal(scopedHealth, `乙方：${factsB.health.entries.map(e => `${e.year}年（虚岁 ${e.nominalAge}）`).join('、') || '目前无法确定'}`);
  assert.match(fillPlaceholders('{{HEALTH_YEARS}}', pair), /甲方：.*乙方：/);
  assert.match(fillPlaceholders('{{HEALTH_YEARS_B}}', pair), /^乙方：/);
  assert.ok(validateAnswer(pairInput('乙方当前虚岁 27岁适合结婚。', '婚期')).some(i => i.type === 'age-not-in-facts'));
  assert.match(codeRepair(pairInput('甲方当前虚岁37。乙方当前虚岁999。当前虚岁27。')), /乙方：这一点目前无法确定。当前虚岁27/);
  for (let split = 0; split <= '乙方：{{HEALTH_YEARS}}'.length; split++) {
    const buffer = createPlaceholderBuffer(pair);
    const source = '乙方：{{HEALTH_YEARS}}';
    assert.equal(buffer.push(source.slice(0, split)) + buffer.push(source.slice(split)) + buffer.finish(), scopedHealth);
  }
  let rewriteFacts = '';
  await repairAnswer(pairInput('乙方当前虚岁999。'), { deadline: Date.now() + 20000, rewrite: async (_targets, f) => { rewriteFacts = f; return []; } });
  assert.match(rewriteFacts, /甲方 A/); assert.match(rewriteFacts, /乙方 B/);
  assert.match(rewriteFacts, /出生公历年：2000/); assert.match(rewriteFacts, /当前虚岁：27/);
  assert.match(rewriteFacts, new RegExp(`所选流年：2033年；虚岁 ${factsB.selected!.nominalAge}`));

  // R2: mentioning 大限 in the question cannot whitelist health predictions in its interior.
  const question = '请结合所选大限流年讲健康';
  const decade = facts.decadals.find(d => d.startYear <= 2099 && d.endYear >= 2099)!;
  const decadeText = `大限范围是虚岁 ${decade.startAge}–${decade.endAge}（公历 ${decade.startYear}–${decade.endYear}）。`;
  const healthInput = (text: string) => ({ ...input(text, question), text: `可以多留意。${text}\n\n${HEALTH_CLOSING}` });
  assert.ok(!validateAnswer(healthInput(decadeText)).some(i => i.type === 'age-not-in-facts'));
  assert.ok(!validateAnswer(healthInput(`大限开始于${decade.startYear}年。`)).some(i => i.type === 'age-not-in-facts'));
  for (const text of ['2099年需要关注身体。', '大限中2099年需要关注身体。', `${decadeText}2099年需要关注身体。`, '大限开始于2095年需要关注身体。', '大限2095–2104年是健康关键年份。']) {
    const value = healthInput(text);
    assert.ok(validateAnswer(value).some(i => i.type === 'age-not-in-facts'));
    assert.doesNotMatch(codeRepair(value), /2099|2095年需要|2095–2104年是健康/);
  }
  const notHealth = Array.from({ length: 15 }, (_, i) => 2024 + i).find(y => !facts.health.years.includes(y))!;
  assert.ok(validateAnswer(healthInput(`所选流年${notHealth}年需要关注身体。`)).some(i => i.type === 'age-not-in-facts'));
  const selectedHealth = factsB.health.entries.find(e => !facts.health.years.includes(e.year));
  if (selectedHealth) {
    assert.ok(!validateAnswer(pairInput(`乙方${selectedHealth.year}年需要关注身体。`, '健康')).some(i => i.type === 'age-not-in-facts'));
    assert.ok(validateAnswer(pairInput(`甲方${selectedHealth.year}年需要关注身体。`, '健康')).some(i => i.type === 'age-not-in-facts'));
  }

  // R3: every buffered exit, including no DONE and failed reads, is deterministic and safe.
  let rewriteCalls = 0;
  const noRewrite = async () => { rewriteCalls++; throw new Error('must not call a model'); };
  const bad = '可以争取。婚期999岁。保留其它分析。';
  for (const [suffix, error] of [
    ['data: {"finish_reason":"length"}\n\ndata: [DONE]\n\n', /截断/],
    ['data: {"error":"原有中断通知"}\n\ndata: [DONE]\n\n', /中断/],
    ['', /中断/],
    ['data: {"finish_reason":"length"}\n\n', /截断/],
    ['data: {"error":"原有中断通知"}\n\n', /中断/],
  ] as const) {
    let visible = '';
    const response = consistencyStream(wire(encodeDelta(bad) + suffix), input('', '婚期'), { buffered: true, deadline: Date.now() + 30000, rewrite: noRewrite });
    const raw = await response.clone().text();
    if (suffix.includes('原有中断通知')) assert.match(raw, /原有中断通知/);
    if (suffix.includes('length')) assert.match(raw, /"finish_reason":"length"/);
    await assert.rejects(consumeAiResponse(response, text => { visible = text; }), error);
    assert.doesNotMatch(visible, /999/); assert.match(visible, /保留其它分析/);
    assert.ok(!validateAnswer(input(visible, '婚期')).some(i => i.type === 'age-not-in-facts'));
  }
  let reads = 0, visible = '';
  const broken = new Response(new ReadableStream<Uint8Array>({ pull(c) {
    if (reads++ === 0) c.enqueue(encoder.encode(encodeDelta('保留分析。2099年需要关注身体。')));
    else c.error(new Error('private read failure'));
  } }, { highWaterMark: 0 }), { headers: { 'Content-Type': 'text/event-stream' } });
  await assert.rejects(consumeAiResponse(consistencyStream(broken, input('', question), { buffered: true, deadline: Date.now() + 30000, rewrite: noRewrite }), text => { visible = text; }), /中断/);
  assert.match(visible, /保留分析/); assert.doesNotMatch(visible, /2099|private/);
  const expired = consistencyStream(wire(encodeDelta(bad) + 'data: [DONE]\n\n'), input('', '婚期'), { buffered: true, deadline: 0, rewrite: noRewrite });
  await consumeAiResponse(expired, text => { visible = text; }); assert.doesNotMatch(visible, /999/);
  assert.equal(rewriteCalls, 0);

  // R4: handler-level buffering of real numeric questions; ordinary questions stream before DONE.
  const sensitiveQuestions = ['我当前走哪个大限？', '我走哪个大运？', '我现在多少岁？', '几岁适合创业？', '当前年龄？', '哪几年适合创业？', '哪一年适合创业？', '何时适合创业？', '什么时候创业？', '明年事业如何？', '今年事业如何？', '2030年事业如何？', '何时结婚？', '婚期如何？', '健康如何？', '身体如何？', '疾病风险？'];
  const ordinaryQuestions = ['换工作', '伴侣', '总览'];
  const request = (q: string, mode = 'followup') => new Request('http://localhost/api/interpret', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-real-ip': 'fix-regressions' }, body: JSON.stringify({ chart, mode, messages: [{ role: 'user', content: q }] }) });
  for (const q of [...sensitiveQuestions, ...ordinaryQuestions]) {
    const sensitive = sensitiveQuestions.includes(q);
    assert.equal(isNumericSensitive(q), sensitive, q);
    let finish!: () => void;
    globalThis.fetch = async (_url, init) => {
      assert.equal(JSON.parse(init!.body as string).stream, true, 'valid answers need no rewrite');
      return new Response(new ReadableStream<Uint8Array>({ start(c) {
        c.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: sensitive ? '可以先做准备。999岁。' : '可以先做准备。2030年供参考。' } }] })}\n\n`));
        finish = () => { c.enqueue(encoder.encode((sensitive ? 'data: {"choices":[{"finish_reason":"length"}]}\n\n' : '') + 'data: [DONE]\n\n')); c.close(); };
      } }));
    };
    // Use a terminal length frame for sensitive tests: it also proves handler failure paths are safe, with no rewrite fetch.
    const response = await handleAi(request(q, q === '总览' ? 'overview' : q === '伴侣' ? 'detail' : 'followup'), 'interpret');
    const reader = response.body!.getReader();
    const first = reader.read();
    const state = await Promise.race([first.then(() => 'early'), new Promise<string>(resolve => setTimeout(() => resolve('waiting'), 10))]);
    assert.equal(state, sensitive ? 'waiting' : 'early', q);
    finish();
    let output = new TextDecoder().decode((await first).value);
    assert.match(output, /可以先做准备/);
    for (;;) { const chunk = await reader.read(); if (chunk.done) break; output += new TextDecoder().decode(chunk.value); }
    assert.doesNotMatch(output, /999/);
  }

  // Compatibility facts must reach the real handler's validator too (fetch remains mocked).
  const today = new Date();
  const liveB = buildAgeFacts(chartB, { currentYear: today.getFullYear(), currentDate: `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`, selectedYear: 2033 });
  globalThis.fetch = async (_url, init) => {
    assert.equal(JSON.parse(init!.body as string).stream, true, 'correct B facts must not trigger a rewrite');
    return wire(`data: ${JSON.stringify({ choices: [{ delta: { content: `乙方当前虚岁 ${liveB.currentAge}，所选年龄 ${liveB.selected!.nominalAge}岁，出生于2000年。候选{{MARRIAGE_YEARS}}。` } }] })}\n\ndata: [DONE]\n\n`);
  };
  const pairResponse = await handleAi(new Request('http://localhost/api/heming', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-real-ip': 'fix-pair' }, body: JSON.stringify({ chartA: chart, chartB, viewA: { year: 2030 }, viewB: { year: 2033 }, question: '婚期', mode: 'followup' }) }), 'heming');
  let pairOutput = '';
  await consumeAiResponse(pairResponse, text => { pairOutput = text; });
  assert.match(pairOutput, new RegExp(`乙方当前虚岁 ${liveB.currentAge}，所选年龄 ${liveB.selected!.nominalAge}岁，出生于2000年`));

  // R5: cancel after upstream DONE aborts the active second fetch, without aborting the Request.
  const requestAbort = new AbortController();
  let markStarted!: () => void;
  const started = new Promise<void>(resolve => { markStarted = resolve; });
  let rewriteSignal: AbortSignal | undefined, calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    if (JSON.parse(init!.body as string).stream) return wire(`data: ${JSON.stringify({ choices: [{ delta: { content: bad } }] })}\n\ndata: [DONE]\n\n`);
    rewriteSignal = init!.signal as AbortSignal;
    markStarted();
    return new Promise<Response>((_resolve, reject) => {
      rewriteSignal!.addEventListener('abort', () => reject(new Error('cancelled rewrite')), { once: true });
    });
  };
  const response = await handleAi(new Request(request('婚期'), { signal: requestAbort.signal }), 'interpret');
  await Promise.race([started, new Promise((_, reject) => setTimeout(() => reject(new Error('rewrite never started')), 1000))]);
  assert.equal(calls, 2); assert.equal(rewriteSignal!.aborted, false);
  await response.body!.cancel();
  assert.equal(rewriteSignal!.aborted, true); assert.equal(requestAbort.signal.aborted, false);
  const alreadyCancelled = new AbortController(); alreadyCancelled.abort();
  let afterCancelCalls = 0;
  await repairAnswer(input(bad), { deadline: Date.now() + 20000, signal: alreadyCancelled.signal, rewrite: async () => { afterCancelCalls++; return []; } });
  assert.equal(afterCancelCalls, 0);
  await assert.rejects(deepSeekRewriter(alreadyCancelled.signal)([], '', 20000));
  assert.equal(calls, 2, 'transport checks cancellation before fetch');
}

async function main() {
  for (let i = 0; i < 12; i++) assert.deepEqual(annualRomanceStars(i), { hongluan: (15 - i) % 12, tianxi: (21 - i) % 12 });
  assert.throws(() => annualRomanceStars(12), RangeError);
  const c = getMarriageCandidates(chart, opts);
  assert.deepEqual(c, getMarriageCandidates(chart, opts));
  assert.deepEqual(c.years, [2030, 2042, 2028]);
  assert.equal(c.rangeText, '虚岁 39–53（公历 2028–2042）');
  assert.equal(c.candidates.length, 3);
  assert.deepEqual(c.candidates.map(c => c.score), [10, 8, 6]);
  assert.deepEqual(c.candidates[0].reasons, ['流年天喜入本命夫妻宫（+4）', '太阳流年化禄在本命夫妻，引动夫妻三方四正（+2）', '太阴流年化科在本命福德，引动夫妻三方四正（+2）', '流年夫妻与大限夫妻同宫或对宫（+2）']);
  assert.ok(c.candidates.every(c => c.nominalAge === c.year - 1990 + 1 && c.nominalAge >= 35 && c.nominalAge <= 55));
  const peach = { ...chart, palaces: chart.palaces.map(p => p.name === '夫妻' ? { ...p, stars: [...p.stars, { name: '天姚', type: 'minor' as const }, { name: '咸池', type: 'minor' as const }] } : p) };
  assert.deepEqual(getMarriageCandidates(peach, opts).candidates.map(c => [c.year, c.score]), [[2030, 11], [2042, 9], [2028, 7]]);
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
  assert.equal(fillPlaceholders('A{{MARRIAGE_RANGE}}B{{MARRIAGE_YEARS}}{{UNKNOWN}}', facts, () => removed++), `A${c.rangeText}B${c.years.join('、')} 年`);
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
  const valid = ending(`可以积极经营关系。\n\n候选范围是${c.rangeText}，重点是${c.years.join('、')} 年。`);
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
    await consumeAiResponse(splitWire, s => { streamText = s; }); assert.equal(streamText, `可考虑${c.years.join('、')} 年。`);
    const partial = consistencyStream(wire(encodeDelta('保留部分。') + 'data: {"error":"解读暂时中断"}\n\ndata: [DONE]\n\n'), { facts, mode: 'followup', question: '健康' }, { buffered: true, deadline: 0, rewrite: async () => [] });
    await assert.rejects(consumeAiResponse(partial, s => { emitted = s; }), /中断/); assert.equal(emitted, `保留部分。\n\n${HEALTH_CLOSING}`);
    await fixRegressions();
    // Keep unknown/malformed upstream framing errors out of user content.
    const frames: string[] = [];
    for await (const f of readSseData(wire(': ping\n\n' + encodeDelta('正常') + 'data: [DONE]\n\n').body!)) frames.push(f);
    assert.equal(frames.length, 2);
  } finally { globalThis.fetch = originalFetch; delete process.env.DEEPSEEK_API_KEY; }
  for (const term of ['宫干', '庙旺利陷', '亮度', '五行局', '命主', '身主', '飞化', '自化', '三方四正', '会照', '借星']) {
    assert.ok(GLOSSARY[term]); assert.ok(GLOSSARY_SHORT[term].length <= 20);
  }
  // Annual romance stars activate natal palaces, not parity-incompatible annual palaces.
  const spouseBranch = chart.palaces.find(p => p.name === '夫妻')!.branch;
  const cycle = Array.from({ length: 12 }, (_, i) => annualRomanceStars(i));
  assert.equal(cycle.filter(s => s.hongluan === spouseBranch).length, 1);
  assert.equal(cycle.filter(s => s.tianxi === spouseBranch).length, 1);
  const glossary = glossaryForChart('火六局 宫干 紫微（庙） 庙旺利陷 命主 身主 飞化');
  assert.ok(glossary.length <= 600); assert.match(glossary, /宫干（/); assert.match(glossary, /火六局（排盘分组与起限数字）/); assert.doesNotMatch(glossary, /化权（/);
  for (const prompt of [INTERPRET_SYSTEM, HEMING_SYSTEM]) {
    assert.match(prompt, /第一句不得出现任何命理术语/); assert.match(prompt, /所有年龄均为虚岁/);
    assert.match(prompt, /不得自行用出生年推算或换算年龄/); assert.match(prompt, /年份区间含首尾/);
  }
  console.log('✓ AI consistency: 12支公式、稳定候选/虚岁/页面优先、唯一事实、分片占位符、校验误报、局部mock修复/预算降级、真实handler即时流式、SSE兼容、术语');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
