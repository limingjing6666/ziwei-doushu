import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TimeNav from '../../components/TimeNav';
import { generateChart } from '../../lib/ziwei/algorithm';
import { buildAgeFacts } from '../../lib/ziwei/facts';
import { ageFactsToText, chartToText, viewToText } from '../../lib/ai/chart-to-text';
import { handleAi } from '../../lib/ai/handler';

async function main() {
  Object.assign(globalThis, { React });
  const chart = generateChart({ year: 1990, month: 5, day: 15, hour: 4, gender: 'male' });
  const opts = { currentYear: 2026, currentDate: '2026-11-01', selectedYear: 2022 };
  const defaultFacts = buildAgeFacts(chart, opts);
  assert.equal(defaultFacts.selected?.year, 2022);
  const facts = buildAgeFacts(chart, { ...opts, omitSelected: true });
  assert.equal(facts.selected, undefined);
  assert.equal(facts.selectedOmitted, true);
  assert.ok(!facts.whitelist.years.includes(2022));
  assert.ok(facts.whitelist.years.includes(2026));
  assert.deepEqual(facts.whitelist.ages, [facts.currentAge, ...facts.marriage.candidates.map(c => c.nominalAge), ...facts.health.entries.map(c => c.nominalAge)]);
  assert.deepEqual(facts.marriage, defaultFacts.marriage);
  assert.deepEqual(facts.health, defaultFacts.health);
  for (const type of ['natal', 'decadal'] as const) {
    const text = chartToText(chart, { facts }) + '\n' + viewToText({ type, year: 2022 }, chart, 2026);
    assert.doesNotMatch(text, /所选流年/);
    assert.match(text, /今天：2026-11-01/);
    assert.match(text, /“今年”“最近”均指今天所在的年份（2026年）/);
    assert.match(text, /当前大限：/);
    assert.match(text, /【当前大限四化/);
    assert.doesNotMatch(text, /流年十二宫/);
  }
  const yearly = buildAgeFacts(chart, { ...opts, selectedYear: 2028 });
  const yearlyText = ageFactsToText(yearly) + '\n' + viewToText({ type: 'yearly', year: 2028 }, chart, 2026);
  assert.match(yearlyText, /所选流年：2028年/);
  assert.match(yearlyText, /【所选流年四化/);
  assert.match(yearlyText, /流年十二宫/);
  assert.match(yearlyText, /“今年”“最近”均指所选流年/);
  const unknown = { ...chart, birthInfo: { ...chart.birthInfo, birthTimeKnown: false } };
  assert.doesNotMatch(chartToText(unknown, { facts: buildAgeFacts(unknown, { ...opts, omitSelected: true }) }) + viewToText({ type: 'natal', year: 2022 }, unknown), /所选流年/);

  const panel = readFileSync('components/InsightPanel.tsx', 'utf8');
  const heming = readFileSync('app/heming/page.tsx', 'utf8');
  assert.match(panel, /loading && !messages\[last.current\?\.index \?\? -1\]\?\.content && <AiLoading/);
  assert.match(heming, /analyzing && \(last.current\?\.index === -1 \? !analysis : !turns\[last.current\?\.index \?\? -1\]\?\.answer\) && <AiLoading/);
  for (const source of [panel, heming]) assert.match(source, /<AiErrorNotice error=\{error\}/);
  const center = readFileSync('components/chart/CenterTile.tsx', 'utf8');
  assert.match(center, /紫微斗数/); assert.doesNotMatch(center, /本命盘/);
  assert.doesNotMatch(readFileSync('components/chart/ResultPage.tsx', 'utf8'), /lg:sticky|max-h-\[calc\(100vh/);
  const nav = readFileSync('components/TimeNav.tsx', 'utf8');
  assert.match(nav, /大限 \$\{currentDx.startAge\}–\$\{currentDx.endAge\}/);
  const renderNav = (c: typeof chart) => renderToStaticMarkup(React.createElement(TimeNav, { chart: c, view: 'mingpan', liunianYear: 2022, onViewChange() {}, onYearChange() {} }));
  assert.match(renderNav({ ...chart, currentDaXianIndex: 0, daXians: [{ ...chart.daXians[0], startAge: 26, endAge: 35 }] }), /大限 26–35/);
  assert.match(renderNav({ ...chart, currentDaXianIndex: -1 }), />大限<\/button>/);
  assert.doesNotMatch(readFileSync('components/birth/BirthPage.tsx', 'utf8'), /在本机完成排盘|不会发送给 AI/);

  const env = { ...process.env }, originalFetch = globalThis.fetch;
  try {
    process.env.DEEPSEEK_API_KEY = 'round8-mock-only';
    process.env.AI_MINUTE_LIMIT = '1000'; process.env.AI_DAILY_LIMIT = '1000';
    delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const captured: { messages: { content: string }[] }[] = [];
    globalThis.fetch = async (_url, init) => {
      captured.push(JSON.parse(init!.body as string));
      return new Response('data: {"choices":[{"delta":{"content":"完成"}}]}\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
    };
    for (const mode of ['interpret', 'heming'] as const) {
      for (const type of ['natal', 'decadal', 'yearly', undefined] as const) {
        for (const timeKnown of [true, false]) {
          const c = timeKnown ? chart : unknown;
          const view = type ? { type, year: type === 'yearly' ? 2028 : 2022 } : undefined;
          captured.length = 0;
          const response = await handleAi(new Request('http://localhost/api/' + mode, { method: 'POST', headers: { 'x-real-ip': 'round8-fixture' }, body: JSON.stringify({ chart: c, chartA: c, chartB: c, view, viewA: view, viewB: view, question: '整盘', mode: 'overview' }) }), mode);
          assert.equal(response.status, 200); await response.text();
          assert.equal(captured.length, 1);
          const sent = captured[0];
          assert.ok(sent);
          const context = JSON.parse(sent.messages[1].content.split('\n')[1]);
          for (const [text, viewText] of mode === 'interpret' ? [[context.chart, context.selectedView]] : [[context.chartA, context.selectedViewA], [context.chartB, context.selectedViewB]]) {
            if (type === 'natal' || type === 'decadal') {
              assert.doesNotMatch(text + viewText, /所选流年/);
              assert.match(text, /“今年”“最近”均指今天所在的年份/);
              const todayYear = text.match(/今天：(\d{4})-/)![1];
              assert.ok(text.includes(`年份（${todayYear}年）`));
              if (timeKnown) { assert.match(text, /当前大限：/); assert.match(text, /【当前大限四化/); }
            } else {
              assert.match(text, new RegExp(`所选流年：${type ? 2028 : new Date().getFullYear()}年`));
              assert.match(text, /【所选流年四化/);
              assert.match(text, /“今年”“最近”均指所选流年/);
              if (timeKnown) assert.match(text, /流年十二宫/);
            }
          }
          assert.match(sent.messages[0].content, /“今年”“最近”的所指以事实区块的声明为准/);
        }
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  }
  console.log('✓ Round8: UI contracts, age-range rendering, omitted selected facts, yearly/default compatibility, unknown time and both API modes (fetch mocked)');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
