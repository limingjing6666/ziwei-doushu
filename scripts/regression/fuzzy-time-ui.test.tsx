import React, { act } from 'react';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { JSDOM } from 'jsdom';
import type { Root } from 'react-dom/client';
import type { CandidateResultPageProps } from '../../components/chart/CandidateResultPage';
import type { BirthFormState } from '../../components/birth/BirthForm';
import { buildCandidateResult } from '../../lib/ziwei/fuzzy-time';

const evaluatedAt = new Date('2026-11-05T04:00:00Z');
const result = buildCandidateResult({
  dateInfo: { year: 1990, month: 5, day: 15 },
  city: { province: '北京市', city: '北京', longitude: 116.4 },
  segment: '06-12', dstApplied: false, gender: 'male',
}, evaluatedAt);
function typeContract(props: CandidateResultPageProps) {
  // @ts-expect-error 候选组件不接受单张命盘。
  const invalid: CandidateResultPageProps = { chart: result.candidates[0].chart, context: result.context, onReset() {} };
  // @ts-expect-error 候选数组只读，不得补盘或添加代表盘。
  props.candidates.push(result.candidates[0]);
  return invalid;
}
void typeContract;

async function main() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/chart' });
  const globals: Record<string, unknown> = {
    window: dom.window, self: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage,
    HTMLElement: dom.window.HTMLElement, Node: dom.window.Node,
    Event: dom.window.Event, MouseEvent: dom.window.MouseEvent,
    ResizeObserver: class { observe() {} disconnect() {} unobserve() {} },
    requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0),
    cancelAnimationFrame: clearTimeout, IS_REACT_ACT_ENVIRONMENT: true,
  };
  const descriptors = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  dom.window.scrollTo = mock.fn();
  Object.defineProperty(dom.window, 'matchMedia', { value: (media: string) => ({ matches: false, media }) });
  const fetchSpy = mock.method(globalThis, 'fetch', async () => new Response(
    'data: {"delta":{"text":"mock 本地测试"}}\n\ndata: [DONE]\n\n',
    { headers: { 'Content-Type': 'text/event-stream' } },
  ));
  // 必须先替换真实 client 的缓存导出，再加载页面；包装实际请求函数，fetch 始终为 mock。
  const clientId = require.resolve('../../lib/ai/client');
  const actual = require(clientId) as typeof import('../../lib/ai/client');
  const clientModule = require.cache[clientId]!;
  const originalExports = clientModule.exports;
  const requestAiSpy = mock.fn((...args: Parameters<typeof actual.requestAi>) => actual.requestAi(...args));
  clientModule.exports = { ...actual, requestAi: requestAiSpy };
  const CandidateResultPage = (require('../../components/chart/CandidateResultPage') as typeof import('../../components/chart/CandidateResultPage')).default;
  const ResultPage = (require('../../components/chart/ResultPage') as typeof import('../../components/chart/ResultPage')).default;
  const fuzzyId = require.resolve('../../lib/ziwei/fuzzy-time');
  const fuzzyModule = require.cache[fuzzyId]!;
  const fuzzyExports = fuzzyModule.exports as typeof import('../../lib/ziwei/fuzzy-time');
  let failBatch = false;
  const buildSpy = mock.fn((...args: Parameters<typeof buildCandidateResult>) => {
    if (failBatch) throw new Error('模拟整批生成失败');
    return fuzzyExports.buildCandidateResult(...args);
  });
  fuzzyModule.exports = { ...fuzzyExports, buildCandidateResult: buildSpy };
  const ChartPage = (require('../../app/chart/page') as typeof import('../../app/chart/page')).default;
  const { createRoot } = require('react-dom/client') as typeof import('react-dom/client');
  const container = document.getElementById('root')!;
  let root: Root = createRoot(container);
  const wait = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
  const flush = () => act(async () => { await wait(); await wait(); });
  const click = async (element: Element | null) => {
    assert.ok(element, '必须找到待点击的控件');
    await act(async () => { element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
    await flush();
  };
  const button = (text: string) => [...container.querySelectorAll('button')].find(node => node.textContent === text) ?? null;
  const noAi = () => {
    assert.equal(requestAiSpy.mock.callCount(), 0);
    assert.equal(fetchSpy.mock.callCount(), 0);
    assert.doesNotMatch(container.textContent!, /AI 解读|让 AI 解读|向 AI 提问/);
    assert.equal(container.querySelector('[aria-label="向 AI 提问"]'), null);
  };
  const boardCount = () => container.querySelectorAll('[aria-label="十二宫命盘"]').length;
  const newRoot = async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
  };
  try {
    localStorage.clear(); sessionStorage.clear();
    await act(async () => root.render(<CandidateResultPage candidates={result.candidates} context={result.context} onReset={() => {}} />));
    await flush();
    noAi();
    assert.equal(boardCount(), 0, '初始只有摘要，没有默认整盘');
    const disclosures = container.querySelectorAll('details');
    assert.equal(disclosures[0].open, true);
    assert.equal(disclosures[1].open, false);
    assert.match(container.textContent!, /不是在猜你的真时辰/);
    assert.match(container.textContent!, /仅在所选时段的候选里一致/);
    assert.match(disclosures[1].textContent!, /当前大限 · 4 盘 4 个不同值/);
    assert.match(disclosures[0].textContent!, /太阳化禄/);
    assert.doesNotMatch(disclosures[0].textContent!, /仆役|夫妻|兄弟|财帛/);
    for (const candidate of result.candidates) {
      const index = result.candidates.indexOf(candidate);
      const buttons = container.querySelectorAll('[aria-label="候选列表"] button');
      assert.equal(buttons.length, result.candidates.length);
      assert.match(buttons[index].textContent!, /1990-05-15/);
      await click(buttons[index]);
      assert.equal(boardCount(), 1);
      assert.match(container.querySelector('h1')!.textContent!, /1990-05-15/);
      assert.match(container.textContent!, new RegExp(`虚岁 ${candidate.chart.currentAge}`));
      const dx = candidate.chart.daXians[candidate.chart.currentDaXianIndex];
      assert.match(container.textContent!, new RegExp(`${dx.startAge}–${dx.endAge} 岁 · ${dx.palaceName}`));
      noAi();
      await click(container.querySelector('[aria-label="选择命宫"]'));
      assert.match(container.querySelector('[aria-label="本地星宫简介"]')!.textContent!, /主星/);
      const palace = candidate.chart.palaces.find(item => item.stars.some(star => star.type === 'major'))!;
      const star = palace.stars.find(item => item.type === 'major')!;
      await click([...container.querySelectorAll(`[data-palace-branch="${palace.branch}"] button`)].find(node => node.textContent === star.name) ?? null);
      assert.match(container.querySelector('[aria-label="星曜简介"]')!.textContent!, new RegExp(star.name));
      for (const view of ['大限', '流年', '本命']) {
        await click([...container.querySelectorAll('[aria-label="运限视图"] button')].find(node => node.textContent!.startsWith(view)) ?? null);
        if (view !== '本命') {
          await click(container.querySelector('[data-palace-branch] button[aria-label*="化"]'));
          assert.match(container.querySelector('[aria-label="本地星宫简介"]')!.textContent!, /化/);
        }
        noAi();
      }
      assert.match(container.textContent!, /2026/);
      await click(container.querySelector('[aria-label="查看下一年流年"]'));
      assert.match(container.textContent!, /2027/);
      noAi();
      await click(button('返回对照'));
      assert.equal(boardCount(), 0);
      noAi();
    }
    const crossDay = buildCandidateResult({ ...result.context,
      city: { province: '新疆维吾尔自治区', city: '乌鲁木齐', longitude: 87.6 }, segment: '00-06',
    }, evaluatedAt);
    await newRoot();
    await act(async () => root.render(<CandidateResultPage {...crossDay} onReset={() => {}} />));
    assert.match(container.textContent!, /1990-05-14 · 前一日 亥/);
    assert.match(container.textContent!, /1990-05-15 · 本日 子/);
    assert.equal(boardCount(), 0);
    noAi();

    // 真正挂载 /chart：恢复只到表单、生成后不存候选、重填保留草稿、刷新不自动排盘。
    const form: BirthFormState = {
      name: '候选测试', year: '1990', month: '5', day: '15', calendar: 'solar',
      gender: 'male', province: '北京市', city: '北京', longitude: 116.4,
      clockHour: '8', clockMinute: '30', timeMode: 'fuzzy', unknownTime: false,
      segment: '06-12', dstApplied: false, useTrueSolar: false,
    };
    sessionStorage.setItem('tianjipan-chart', JSON.stringify({ form, chart: result.candidates[0].chart, useTrueSolar: false }));
    await newRoot();
    await act(async () => root.render(<ChartPage />));
    await flush();
    assert.match(container.textContent!, /大概时段输入已恢复，请重新生成候选/);
    assert.equal(boardCount(), 0);
    assert.equal(buildSpy.mock.callCount(), 0);
    assert.equal((container.querySelector('input[value="06-12"]') as HTMLInputElement).checked, true);
    assert.equal(container.querySelector('[id$="clock-hour"]'), null);
    noAi();
    const submit = async () => {
      await act(async () => {
        container.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
        await wait(45);
      });
      await flush();
    };
    await submit();
    assert.match(container.querySelector('h1')!.textContent!, /候选对照/);
    assert.equal(buildSpy.mock.callCount(), 1);
    assert.ok(buildSpy.mock.calls[0].arguments[1] instanceof Date);
    assert.equal(boardCount(), 0);
    let saved = JSON.parse(sessionStorage.getItem('tianjipan-chart')!);
    assert.equal(saved.chart, null);
    assert.equal(saved.form.segment, '06-12');
    assert.deepEqual(Object.keys(saved).sort(), ['chart', 'form', 'useTrueSolar']);
    noAi();
    await click(button('重新填表'));
    assert.equal((container.querySelector('input[value="06-12"]') as HTMLInputElement).checked, true);
    assert.equal((container.querySelector('[id$="city"]') as HTMLSelectElement).value, '北京');
    assert.equal((container.querySelector('[id$="name"]') as HTMLInputElement).value, '候选测试');
    failBatch = true;
    await submit();
    assert.match(container.querySelector('[role="alert"]')!.textContent!, /未能完整生成候选，请检查日期、城市和时段/);
    assert.ok(container.querySelector('form'), '错误时保留原表单');
    assert.equal(boardCount(), 0);
    noAi();
    failBatch = false;
    await submit();
    saved = JSON.parse(sessionStorage.getItem('tianjipan-chart')!);
    assert.equal(saved.chart, null);
    const count = buildSpy.mock.callCount();
    await newRoot();
    await act(async () => root.render(<ChartPage />));
    await flush();
    assert.match(container.textContent!, /大概时段输入已恢复，请重新生成候选/);
    assert.equal(buildSpy.mock.callCount(), count);
    assert.equal(boardCount(), 0);
    noAi();

    // 阳性对照必须挂原始单盘 ResultPage，证明 effect/timer 及两层 spy 确实抓得到请求。
    await newRoot();
    localStorage.clear(); sessionStorage.clear();
    await act(async () => root.render(<ResultPage chart={result.candidates[0].chart} onReset={() => {}} />));
    await flush();
    assert.equal(boardCount(), 1);
    assert.ok(requestAiSpy.mock.callCount() > 0, '原单盘自动调用 requestAi');
    assert.ok(fetchSpy.mock.callCount() > 0, '实际 requestAi 已调用 mock fetch');
    assert.match(container.textContent!, /mock 本地测试/);
    console.log('✓ Fuzzy UI: 真挂载摘要/逐候选星宫与运限/返回/会话/错误态均零 AI；原单盘阳性对照捕获请求（全 mock）');
  } finally {
    await act(async () => root.unmount());
    clientModule.exports = originalExports;
    fuzzyModule.exports = fuzzyExports;
    fetchSpy.mock.restore();
    dom.window.close();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
