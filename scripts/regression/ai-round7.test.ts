import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AiProse } from '../../components/ui/AiProse';
import Markdown from '../../components/Markdown';
import { readFileSync } from 'node:fs';
import { generateChart } from '../../lib/ziwei/algorithm';
import { buildAgeFacts } from '../../lib/ziwei/facts';
import { ageFactsToText } from '../../lib/ai/chart-to-text';
import { handleAi } from '../../lib/ai/handler';
import { consumeAiResponse } from '../../lib/ai/client';
import { INTERPRET_SYSTEM, HEMING_SYSTEM, UNKNOWN_TIME_RULE } from '../../lib/ai/prompts';

async function main() {
  // tsx's preserve-JSX test runtime uses the classic factory; Next uses automatic JSX.
  Object.assign(globalThis, { React });
  const chart = generateChart({ year: 1990, month: 5, day: 15, hour: 4, gender: 'male' });
  const opts = { currentYear: 2026, currentDate: '2026-11-01', selectedYear: 2030 };
  const facts = buildAgeFacts(chart, opts);
  const text = ageFactsToText(facts, '婚期和健康');
  assert.ok(text.startsWith(`今天：2026-11-01（公历）；你现年虚岁${facts.currentAge}；所选流年：2030年`));
  assert.ok(facts.marriage.years.length && facts.health.years.length);
  for (const y of [...facts.marriage.years, ...facts.health.years]) assert.ok(y >= opts.currentYear);
  assert.deepEqual(facts.marriage.years, [...facts.marriage.years].sort((a, b) => a - b));
  assert.match(text, /^【生年四化】.+$/m);
  assert.match(text, /^【当前大限四化（大限宫干.）】.+$/m);
  assert.match(text, /^【所选流年四化（流年干.）】.+$/m);
  assert.match(text, /按时间先后列出线索年份，各年依据见下/);
  assert.doesNotMatch(text, /\{\{|最有力的年份/);
  for (const year of [2024, 2026, 2031, 2040]) {
    const f = buildAgeFacts(chart, { currentYear: year, currentDate: `${year}-11-01` });
    assert.ok([...f.marriage.years, ...f.health.years].every(y => y >= year));
  }
  for (const prompt of [INTERPRET_SYSTEM, HEMING_SYSTEM]) {
    assert.match(prompt, /第一句必须直接回答用户所问，不超过40字，大白话、无术语、不加粗不加标题/);
    assert.match(prompt, /小标题必须独占一行，写成 ## 标题 后换行再写正文/);
    assert.ok(prompt.includes(UNKNOWN_TIME_RULE));
    assert.match(prompt, /第二句固定为“因出生时辰未知，命宫\/身宫\/宫位排布不可靠，以下只讲生年四化与流年的大方向。”/);
    assert.match(prompt, /禁止给出具体职业、婚期年份、健康病症、财富结论/);
    assert.match(prompt, /年份\/年龄只可引用事实区块/);
    assert.match(prompt, /凡提到任何四化，必须同时说出它是生年四化\/大限四化\/流年四化/);
    assert.doesNotMatch(prompt, /\{\{|倪|时辰未知的固定首句声明优先/);
  }
  assert.match(HEMING_SYSTEM, /合盘总览第一句直接回答“两人合不合\/整体相处结论”/);
  assert.match(HEMING_SYSTEM, /甲方生年四化→乙方某宫/);
  const panel = readFileSync('components/InsightPanel.tsx', 'utf8');
  assert.match(panel, /hidden\?: boolean/);
  assert.match(panel, /m.role === 'user' && m.hidden \? null/);
  assert.match(panel, /send\(question, 'overview', true, true\)/);
  assert.match(panel, /send\(localQuestion, 'detail', true, true\)/);
  assert.match(panel, /map\(m => \(\{ role: m.role, content:/); // hidden is UI-only, cache payload stays stable
  assert.doesNotMatch(panel, /仅供参考|不构成/);

  for (const [source, expected] of [
    ['## 相处特点双方需要沟通。', '<h2>相处特点</h2><p>双方需要沟通。</p>'],
    ['##十年与2026年你更重视沟通。', '<h2>十年与2026年</h2><p>你更重视沟通。</p>'],
    ['**标题**正文保持原样。', '<h3>标题</h3><p>正文保持原样。</p>'],
    ['**【标题】**\n正文保持原样。', '<h3>【标题】</h3><p>正文保持原样。</p>'],
  ]) {
    assert.ok(renderToStaticMarkup(React.createElement(Markdown, { text: source })).includes(expected));
  }
  const prose = renderToStaticMarkup(React.createElement(AiProse, { text: '化禄，**化禄**。\n\n化禄，化忌（压力）及四化(解释)。' }));
  assert.equal((prose.match(/class="term-trigger"/g) ?? []).length, 2, 'two icons per term across all text nodes');
  assert.doesNotMatch(prose, / ⓘ/);
  assert.ok(prose.includes('化忌（压力）及四化(解释)'));
  const env = { ...process.env }, originalFetch = globalThis.fetch;
  try {
    process.env.DEEPSEEK_API_KEY = 'round7-mocked-fixture';
    process.env.AI_MINUTE_LIMIT = '1000'; process.env.AI_DAILY_LIMIT = '1000';
    delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const source = '能合得来，但要多沟通。\n## 相处特点\n加压天机化禄（思路顺畅），可能反复，或许需要慢慢磨合。\n**【双方依据】**正文也必须原样保留。{{原文}}仅供参考。';
    let calls = 0;
    for (const mode of ['interpret', 'heming'] as const) {
      for (const question of ['整盘', '什么时候结婚和健康年份']) {
        const chunks = [...source];
        globalThis.fetch = async () => {
          calls++;
          const wire = chunks.map(content => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`).join('') + 'data: [DONE]\n\n';
          return new Response(wire, { headers: { 'Content-Type': 'text/event-stream' } });
        };
        const response = await handleAi(new Request('http://localhost/api/' + mode, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-real-ip': 'round7-pass-through' },
          body: JSON.stringify({ chart, chartA: chart, chartB: chart, question, mode: 'overview' }),
        }), mode);
        assert.equal(response.status, 200);
        let actual = '';
        await consumeAiResponse(response, value => { actual = value; });
        assert.equal(actual, source, `${mode}/${question}: no filtering, replacement or rewrite`);
      }
    }
    assert.equal(calls, 4, 'exactly one provider request per answer');
    // A delta must arrive before the provider finishes (no buffered postprocessing).
    let finish!: () => void;
    globalThis.fetch = async () => new Response(new ReadableStream<Uint8Array>({ start(c) {
      const encoder = new TextEncoder();
      c.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"，可能"}}]}\n\n'));
      finish = () => { c.enqueue(encoder.encode('data: [DONE]\n\n')); c.close(); };
    } }));
    const response = await handleAi(new Request('http://localhost/api/interpret', { method: 'POST', body: JSON.stringify({ chart, question: '婚期' }) }), 'interpret');
    const reader = response.body!.getReader();
    try {
      const first = await Promise.race([reader.read(), new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new Error('buffered stream')), 1000); timer.unref(); })]);
      assert.match(new TextDecoder().decode(first.value), /，可能/);
    } finally { finish(); while (!(await reader.read()).done) { /* drain telemetry */ } }
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  }
  console.log('✓ Round7: literal streaming, no rewrite, future-only facts, labelled transformations, prompt and hidden contracts');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
