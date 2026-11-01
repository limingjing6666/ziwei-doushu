import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';
import { astro } from 'iztro';
import { scheduleAutoOverview } from '../../lib/ai/auto-overview';
import { requestAi, AiClientError } from '../../lib/ai/client';
import { chartToText, ageFactsToText, viewToText } from '../../lib/ai/chart-to-text';
import { handleAi } from '../../lib/ai/handler';
import { INTERPRET_SYSTEM, HEMING_SYSTEM, systemForTime } from '../../lib/ai/prompts';
import { generateChart } from '../../lib/ziwei/algorithm';
import { buildAgeFacts, type AgeFacts } from '../../lib/ziwei/facts';
import { BRANCHES, STEMS } from '../../lib/ziwei/constants';
import { getSiHuaByStem } from '../../lib/ziwei/sihua';
// Reuse the existing prompt/length/first-sentence/forbidden-word contracts.
import './prompt-rules.test';

const internalTerm = ['事实', '区块'].join('');
const noInternalTerm = (text: string) => assert.ok(!text.includes(internalTerm));
const panel = readFileSync('components/InsightPanel.tsx', 'utf8');
const fixtures = [
  { year: 1975, month: 11, day: 25, hour: 4, gender: 'female' },
  { year: 1988, month: 10, day: 3, hour: 10, gender: 'male' },
  { year: 2001, month: 8, day: 12, hour: 8, gender: 'female' },
  { year: 1994, month: 6, day: 15, hour: 4, gender: 'male' },
] as const; // A/B/C reuse round9's already-corrected Shanghai inputs; D is 08:00.
const options = { currentYear: 2026, currentDate: '2026-11-01', selectedYear: 2032 };
const questions = ['整盘', '婚期', '健康', '婚期和健康'];
// Frozen chartToText lengths at 64e6775, same fixtures/options/questions; no old prompt copy.
const baselineChars = [[2239, 2536, 2303, 2600], [2269, 2692, 2358, 2781], [2225, 2602, 2289, 2666], [2286, 2637, 2450, 2801]];
const baselineBytes = [[5981, 6758, 6143, 6920], [6081, 7200, 6304, 7423], [5945, 6946, 6107, 7108], [6128, 7055, 6534, 7461]];

async function autoOverview() {
  const originalFetch = globalThis.fetch;
  try {
    const sent = new WeakSet<object>(), chart = {}, otherChart = {};
    let calls = 0, attempts = 0;
    const current = { controller: null as AbortController | null };
    let finish = () => {};
    let pending = Promise.resolve();
    let answer = '';
    const errors: unknown[] = [];
    const signals: AbortSignal[] = [];
    globalThis.fetch = async (_url, init) => {
      calls++;
      const signal = init!.signal as AbortSignal;
      signals.push(signal);
      return new Response(new ReadableStream<Uint8Array>({ start(c) {
        const enc = new TextEncoder();
        c.enqueue(enc.encode('data: {"delta":{"text":"整盘正文"}}\n\n'));
        finish = () => { c.enqueue(enc.encode('data: [DONE]\n\n')); c.close(); };
        signal.addEventListener('abort', () => c.error(new DOMException('aborted', 'AbortError')), { once: true });
      } }), { headers: { 'Content-Type': 'text/event-stream' } });
    };
    const send = () => {
      attempts++;
      const controller = new AbortController(); current.controller = controller;
      pending = requestAi('/api/interpret', { question: `round10-auto-${attempts}` }, t => { answer = t; }, controller.signal)
        .catch(e => { errors.push(e); }).finally(() => { current.controller = null; });
    };
    const mount = (c: object) => scheduleAutoOverview(sent, c, send);
    const fakeMount = mount(chart);
    fakeMount(); current.controller?.abort(); // Same order as the existing unmount abort effect.
    assert.equal(calls, 0, 'StrictMode fake cleanup happens before any request/guard claim');
    mount(chart);
    await wait(10);
    assert.equal(calls, 1); assert.equal(attempts, 1);
    assert.equal(answer, '整盘正文'); assert.equal(signals[0].aborted, false);
    for (let i = 0; i < 4; i++) mount(chart); // Rerender/selection/view replay cannot resend.
    await wait(10);
    assert.equal(calls, 1); assert.equal(errors.length, 0);
    finish(); await pending;
    mount(otherChart); await wait(10);
    assert.equal(calls, 2, 'a new chart gets its own overview');
    current.controller!.abort(); await pending;
    assert.equal(signals[1].aborted, true, 'real unmount still aborts an in-flight request');
    mount(chart); await wait(10); assert.equal(attempts, 2, 'previous chart remains claimed');
    const neverMounted = mount({}); neverMounted(); await wait(10); assert.equal(attempts, 2);

    globalThis.fetch = async () => { calls++; return Response.json({ limitKind: 'minute', retryAfter: 1 }, { status: 429 }); };
    mount({}); await wait(10); await pending;
    const error = errors.at(-1);
    assert.ok(error instanceof AiClientError && error.kind === 'minute');
    await wait(10); assert.equal(calls, 3, 'failed auto overview never starts a retry loop');
    send(); await pending; assert.equal(calls, 4, 'explicit retry remains possible');
  } finally { globalThis.fetch = originalFetch; }
  assert.match(panel, /useEffect\(\(\) => scheduleAutoOverview\(overviewSent.current, chart, \(\) => \{\s*setActiveTopic\('overview'\);\s*send\(TOPICS\[0\]\[2\], 'overview', true, true\);[\s\S]*?\}\), \[chart\]\)/);
  const effect = panel.match(/useEffect\(\(\) => scheduleAutoOverview[\s\S]*?\}\), \[chart\]\)/)![0];
  assert.doesNotMatch(effect, /selectedPalace|selectedStar|selectedSiHua|\bview\b(?=\s*[,\]])/);
  assert.equal((panel.match(/useEffect\(/g) ?? []).length, 2, 'only abort cleanup and chart overview effects');
  assert.match(panel, /useEffect\(\(\) => \(\) => request.current\?\.abort\(\), \[\]\)/);
  assert.match(panel, /aria-pressed=\{activeTopic === key\}/);
  assert.match(panel, /last.current.payload, last.current.index/);
  assert.doesNotMatch(panel, /scrollIntoView|scrollTo|scrollTop/);
}

function assertYearLine(facts: AgeFacts, year: number) {
  const y = facts.years.find(y => y.year === year)!;
  const line = ageFactsToText(facts, '婚期和健康').split('\n').find(l => l.startsWith(`年份 ${year}：`))!;
  assert.ok(line); assert.ok(line.includes(`虚岁${y.nominalAge}；`));
  if (y.decadal) {
    const d = y.decadal;
    assert.ok(line.includes(`属第${d.index}大限（本命${d.palace.replace(/宫$/, '')}宫，虚岁${d.startAge}–${d.endAge}，公历${d.startYear}–${d.endYear}）`));
    assert.ok(line.includes(`大限四化(${d.stem})：${d.transformations.replaceAll('化', '')}`));
  } else assert.match(line, /童限\/未入大限；大限四化：未提供/);
  assert.ok(line.includes(`流年四化(${STEMS[(year - 4) % 10]})：${y.transformations.map(t => t.star + t.mark).join('、')}`));
}

async function main() {
  await autoOverview();
  let maxChars = -Infinity, maxBytes = -Infinity;
  for (const [fixtureIndex, birth] of fixtures.entries()) {
    const chart = generateChart(birth);
    // Independent iztro 2.6.3 API, not our getDaXianIndexForYear/buildAgeFacts implementation.
    const a = astro.bySolar(`${birth.year}-${birth.month}-${birth.day}`, birth.hour, birth.gender === 'female' ? '女' : '男', true, 'zh-CN');
    const ordered = [...a.palaces].sort((x, y) => x.decadal.range[0] - y.decadal.range[0]);
    const sample = new Set<number>([birth.year + 1, birth.year + 90, 2032]);
    for (let offset = 1; offset <= 90; offset += 9) sample.add(birth.year + offset);
    for (const p of a.palaces) for (const age of [p.decadal.range[0] - 1, ...p.decadal.range, p.decadal.range[1] + 1]) {
      const year = birth.year + age - 1;
      if (year >= birth.year + 1 && year <= birth.year + 90) sample.add(year);
    }
    for (const year of sample) {
      // A late current year avoids repeatedly scanning marriage candidates in boundary tests.
      const facts = buildAgeFacts(chart, { currentYear: birth.year + 90, currentDate: `${birth.year + 90}-11-01`, selectedYear: year });
      const nominalAge = a.horoscope(`${year}-7-1`).age.nominalAge;
      const expected = ordered.find(p => nominalAge >= p.decadal.range[0] && nominalAge <= p.decadal.range[1]);
      const actual = facts.years.find(y => y.year === year)!;
      assert.equal(actual.nominalAge, nominalAge);
      assert.equal(actual.decadal?.palace, expected?.name);
      if (expected) {
        assert.equal(actual.decadal!.index, ordered.indexOf(expected) + 1);
        assert.equal(actual.decadal!.branch, BRANCHES.indexOf(expected.earthlyBranch));
        assert.deepEqual([actual.decadal!.startAge, actual.decadal!.endAge], expected.decadal.range);
        assert.equal(actual.decadal!.startYear, birth.year + expected.decadal.range[0] - 1);
        assert.equal(actual.decadal!.endYear, birth.year + expected.decadal.range[1] - 1);
      }
      assertYearLine(facts, year);
    }
    const facts = buildAgeFacts(chart, options);
    const text = chartToText(chart, { facts, question: '婚期和健康' });
    const expectedYears = [...new Set([2026, 2032, ...facts.marriage.years, ...facts.health.years])].sort((a, b) => a - b);
    assert.deepEqual(facts.years.map(y => y.year), expectedYears);
    assert.deepEqual([...text.matchAll(/^年份 (\d+)：/gm)].map(m => Number(m[1])), expectedYears);
    for (const year of expectedYears) assertYearLine(facts, year);
    for (const c of facts.marriage.candidates) for (const reason of c.reasons) assert.ok(text.includes(reason));
    for (const h of facts.health.entries) for (const reason of h.reasons) assert.ok(text.includes(reason));
    const omitted = buildAgeFacts(chart, { ...options, selectedYear: 1901, omitSelected: true });
    assert.ok(!omitted.years.some(y => y.year === 1901));
    assert.doesNotMatch(ageFactsToText(omitted), /所选流年|年份 1901/);
    for (const p of chart.palaces) {
      const block = text.split(`【${p.name}】`)[1].split('\n【')[0];
      const line = block.split('\n').find(l => l.startsWith('对宫：'))!;
      const show = (offset: number) => {
        const q = chart.palaces.find(q => q.branch === (p.branch + offset) % 12)!;
        return `${q.name}（${q.stars.filter(s => s.type === 'major').map(s => s.name).join('、') || '空宫'}）`;
      };
      assert.equal(line, `对宫：${show(6)}；三合：${show(4)}、${show(8)}`);
      const independent = a.surroundedPalaces(a.palaces.findIndex(q => BRANCHES[p.branch] === q.earthlyBranch));
      assert.equal(chart.palaces.find(q => q.branch === (p.branch + 6) % 12)!.name, independent.opposite.name);
      assert.deepEqual([4, 8].map(o => chart.palaces.find(q => q.branch === (p.branch + o) % 12)!.name).sort(), [independent.wealth.name, independent.career.name].sort());
      // Compact missing-field notation must preserve every actual star/brightness/mark.
      for (const s of p.stars) assert.ok(block.includes(s.name));
      for (const s of p.selfSihua ?? []) assert.ok(block.includes(`${s.starName}自化${s.siHua}`));
    }
    for (const [index, question] of questions.entries()) {
      const output = chartToText(chart, { facts, question });
      noInternalTerm(output); noInternalTerm(ageFactsToText(facts, question));
      const chars = output.length / baselineChars[fixtureIndex][index] - 1;
      const bytes = Buffer.byteLength(output) / baselineBytes[fixtureIndex][index] - 1;
      maxChars = Math.max(maxChars, chars); maxBytes = Math.max(maxBytes, bytes);
      assert.ok(bytes <= 0.15, `${birth.year}/${question}: UTF-8 size proxy ${(bytes * 100).toFixed(1)}%`);
    }
    if (birth.year === 2001) {
      const y = facts.years.find(y => y.year === 2032)!;
      assert.equal(y.nominalAge, 32); assert.equal(y.decadal!.index, 3);
      assert.deepEqual([y.decadal!.startAge, y.decadal!.endAge], [23, 32]);
      assert.equal(y.decadal!.stem, '辛'); assert.equal(STEMS[(2032 - 4) % 10], '壬');
      const annual = a.horoscope('2032-7-1').yearly.mutagen;
      assert.deepEqual(y.transformations.map(t => t.star), annual);
      assert.equal(y.decadal!.transformations, Object.entries(getSiHuaByStem(STEMS.indexOf('辛'))).map(([h, s]) => `${s}化${h}`).join('、'));
      const surrounded = a.surroundedPalaces('子女');
      assert.equal(surrounded.opposite.name, '田宅');
      assert.deepEqual([surrounded.wealth.name, surrounded.career.name].sort(), ['仆役', '父母']);
    }
  }
  // A pre-Spring-Festival birth guards reuse of the existing lunar-year mapping.
  const january = generateChart({ year: 1990, month: 1, day: 1, hour: 0, gender: 'male' });
  const janFacts = buildAgeFacts(january, { ...options, selectedYear: 2024 });
  const janEngine = astro.bySolar('1990-1-1', 0, '男', true, 'zh-CN');
  const janAge = janEngine.horoscope('2024-7-1').age.nominalAge;
  assert.equal(janFacts.selected!.nominalAge, janAge);
  assert.deepEqual([janFacts.selected!.decadal!.startAge, janFacts.selected!.decadal!.endAge], janEngine.palaces.find(p => janAge >= p.decadal.range[0] && janAge <= p.decadal.range[1])!.decadal.range);
  for (const system of [INTERPRET_SYSTEM, HEMING_SYSTEM]) for (const unknown of [false, true]) {
    noInternalTerm(systemForTime(system, unknown));
    assert.match(systemForTime(system, unknown), /大限序号\/年龄\/所属大限、三方四正（对宫与三合宫）、星曜所在宫位只能原样引用/);
  }
  for (const path of ['lib/ai/handler.ts', 'lib/ai/prompts.ts', 'components/InsightPanel.tsx']) noInternalTerm(readFileSync(path, 'utf8'));
  const chart = generateChart(fixtures[2]);
  const originalFetch = globalThis.fetch;
  process.env.DEEPSEEK_API_KEY = 'round10-mock-only';
  process.env.AI_MINUTE_LIMIT = '1000'; process.env.AI_DAILY_LIMIT = '1000';
  delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    let calls = 0;
    globalThis.fetch = async (_url, init) => {
      calls++;
      const body = JSON.parse(init!.body as string);
      for (const m of body.messages) noInternalTerm(m.content); // Includes actual system/context/retrieval rules.
      assert.equal(body.max_tokens, 2400);
      return new Response('data: {"choices":[{"delta":{"content":"完成"}}]}\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
    };
    for (const mode of ['interpret', 'heming'] as const) for (const type of ['natal', 'decadal', 'yearly'] as const) for (const known of [true, false]) {
      const c = { ...chart, birthInfo: { ...chart.birthInfo, birthTimeKnown: known } };
      const view = { type, year: 2032, decadal: chart.daXians[2] };
      noInternalTerm(viewToText(view, c, 2026));
      const response = await handleAi(new Request(`http://localhost/api/${mode}`, { method: 'POST', headers: { 'x-real-ip': 'round10-mock' }, body: JSON.stringify({ chart: c, chartA: c, chartB: c, view, viewA: view, viewB: view, question: '婚期和健康', mode: 'overview' }) }), mode);
      assert.equal(response.status, 200); await response.text();
    }
    assert.equal(calls, 12);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.DEEPSEEK_API_KEY;
  }
  console.log(`✓ Round10: StrictMode single overview, iztro boundaries/triads, no internal wording, labelled stems; max size delta chars ${(maxChars * 100).toFixed(1)}%, UTF-8 proxy ${(maxBytes * 100).toFixed(1)}%`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
