import React, { act } from 'react';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { JSDOM } from 'jsdom';
import type { Root } from 'react-dom/client';
import type { BirthFormState } from '../../components/birth/BirthForm';
import { formToBirthInfo } from '../../lib/ziwei/share';
import { generateChart } from '../../lib/ziwei/algorithm';

const form: BirthFormState = {
  name: '时段测试', year: '1990', month: '5', day: '15', calendar: 'solar',
  gender: 'male', province: '北京市', city: '北京', longitude: 116.4,
  clockHour: '8', clockMinute: '30', timeMode: 'fuzzy', unknownTime: false,
  segment: '06-12', dstApplied: false, useTrueSolar: false,
};

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
  const scrollTopSpy = mock.fn();
  dom.window.scrollTo = scrollTopSpy;
  const scrollSpy = mock.fn();
  dom.window.HTMLElement.prototype.scrollIntoView = scrollSpy;
  Object.defineProperty(dom.window, 'matchMedia', { value: (media: string) => ({ matches: false, media }) });
  const fetchSpy = mock.method(globalThis, 'fetch', async () => new Response(
    'data: {"delta":{"text":"mock 本地测试"}}\n\ndata: [DONE]\n\n',
    { headers: { 'Content-Type': 'text/event-stream' } },
  ));
  const clientId = require.resolve('../../lib/ai/client');
  const actual = require(clientId) as typeof import('../../lib/ai/client');
  const clientModule = require.cache[clientId]!;
  const originalExports = clientModule.exports;
  const requestAiSpy = mock.fn((...args: Parameters<typeof actual.requestAi>) => actual.requestAi(...args));
  clientModule.exports = { ...actual, requestAi: requestAiSpy };
  const ResultPage = (require('../../components/chart/ResultPage') as typeof import('../../components/chart/ResultPage')).default;
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
  const boardCount = () => container.querySelectorAll('[aria-label="十二宫命盘"]').length;
  const cleanText = () => assert.doesNotMatch(container.textContent!, /仅供|候选|不是在猜|历史会话|一致\/分歧|逐个查看/);
  const newRoot = async () => {
    await act(async () => root.unmount());
    root = createRoot(container);
  };
  const askAi = async () => {
    const entry = button('AI 解读 · 点这里直接问');
    assert.ok(entry?.classList.contains('lg:hidden'));
    const aside = container.querySelector('#chart-ai')!;
    assert.ok(aside.className.includes('scroll-mt-[calc(var(--header-h)_+_1rem)]'));
    const count = scrollSpy.mock.callCount();
    await click(entry);
    assert.equal(scrollSpy.mock.callCount(), count + 1);
    assert.equal(scrollSpy.mock.calls.at(-1)!.this, aside);
    assert.deepEqual(scrollSpy.mock.calls.at(-1)!.arguments, [{ behavior: 'smooth', block: 'start' }]);
    for (const topic of ['整盘', '感情', '事业', '财运', '健康', '性格']) assert.ok(button(topic));
    assert.ok(aside.querySelector('[aria-label="向 AI 提问"]'));
  };
  try {
    localStorage.clear(); sessionStorage.clear();
    // 旧版空盘会话恢复至原表单，直接提交即可出单盘。
    sessionStorage.setItem('tianjipan-chart', JSON.stringify({ form, chart: null, candidates: [], context: {} }));
    await act(async () => root.render(<ChartPage />));
    await flush();
    assert.equal(boardCount(), 0);
    assert.equal(requestAiSpy.mock.callCount(), 0);
    assert.equal((container.querySelector('input[value="06-12"]') as HTMLInputElement).checked, true);
    assert.equal(container.querySelector('[id$="clock-hour"]'), null);
    cleanText();
    await act(async () => {
      container.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
      await wait(45);
    });
    await flush();
    assert.equal(boardCount(), 1);
    assert.equal(requestAiSpy.mock.callCount(), 1, '大概盘自动解读整盘');
    assert.equal(fetchSpy.mock.callCount(), 1);
    assert.match(container.textContent!, /mock 本地测试/);
    assert.match(container.textContent!, /上午 · 09:00 → 辰时/);
    const notes = container.querySelectorAll('[role="note"]');
    assert.equal(notes.length, 1);
    assert.equal(notes[0].textContent, '你选了「上午」，按中间 09:00 排盘，出生地校正后为辰时。想更准，重新起盘填具体时间。');
    assert.equal(scrollSpy.mock.callCount(), 0, '出盘不自动滚到 AI');
    assert.deepEqual(scrollTopSpy.mock.calls[0].arguments, [{ top: 0, behavior: 'instant' }]);
    cleanText();
    await askAi();
    await click(container.querySelector('[aria-label="选择命宫"]'));
    const intro = container.querySelector('[aria-label="手机简介"]')!;
    assert.ok(intro);
    await click([...intro.querySelectorAll('button')].find(node => node.textContent === '问 AI')!);
    assert.equal(scrollSpy.mock.callCount(), 2);
    await click(button('感情'));
    assert.equal(requestAiSpy.mock.callCount(), 2);
    await act(async () => {
      const input = container.querySelector<HTMLInputElement>('[aria-label="向 AI 提问"]')!;
      const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, '接下来怎样沟通？');
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    await click(button('追问'));
    assert.equal(requestAiSpy.mock.callCount(), 3, '大概盘可追问');
    const single = generateChart(formToBirthInfo(form));
    const { timeBasis, ...birthInfo } = single.birthInfo;
    for (const call of requestAiSpy.mock.calls) {
      const payload = call.arguments[1];
      assert.deepEqual(Object.keys(payload).sort(), ['birthTimeKnown', 'chart', 'messages', 'mode', 'view']);
      assert.deepEqual(JSON.parse(JSON.stringify(payload.chart)), JSON.parse(JSON.stringify({ ...single, birthInfo })));
      assert.equal(JSON.stringify(payload).includes('timeBasis'), false);
    }
    assert.ok(timeBasis);
    for (const call of fetchSpy.mock.calls) assert.equal(String(call.arguments[1]?.body).includes('timeBasis'), false);
    const saved = sessionStorage.getItem('tianjipan-chart')!;
    assert.deepEqual(JSON.parse(saved).chart, JSON.parse(JSON.stringify(single)));
    assert.equal(JSON.parse(saved).useTrueSolar, true);
    assert.deepEqual(Object.keys(JSON.parse(saved)).sort(), ['chart', 'form', 'useTrueSolar']);

    await newRoot();
    const scrollCount = scrollSpy.mock.callCount();
    await act(async () => root.render(<ChartPage />));
    await flush();
    assert.equal(boardCount(), 1, '刷新后保留大概单盘');
    assert.equal(scrollSpy.mock.callCount(), scrollCount);
    cleanText();
    await click(button('重新起盘'));
    assert.equal((container.querySelector('input[value="06-12"]') as HTMLInputElement).checked, true);
    assert.equal(container.querySelector<HTMLInputElement>('[id$="name"]')!.value, '时段测试');
    assert.equal(container.querySelector<HTMLSelectElement>('[id$="city"]')!.value, '北京');

    for (const timeMode of ['exact', 'unknown'] as const) {
      await newRoot();
      localStorage.clear();
      const chart = generateChart(formToBirthInfo({ ...form, timeMode }));
      const count = scrollSpy.mock.callCount();
      const requests = requestAiSpy.mock.callCount();
      await act(async () => root.render(<ResultPage chart={chart} useTrueSolar={false} onReset={() => {}} />));
      await flush();
      assert.equal(boardCount(), 1);
      assert.ok(requestAiSpy.mock.callCount() > requests);
      assert.equal(scrollSpy.mock.callCount(), count);
      assert.equal(container.querySelectorAll('[role="note"]').length, 0);
      if (timeMode === 'unknown') assert.doesNotMatch(container.textContent!, /出生时辰未知|不可靠|只看生年四化和流年大方向/);
      cleanText();
      await askAi();
    }
    console.log('✓ Fuzzy UI: 旧空盘会话→同入口单盘→自动整盘/话题/追问、AI请求无新增字段、刷新保盘、三模式按钮与仅点击滚动（全 mock）');
  } finally {
    await act(async () => root.unmount());
    clientModule.exports = originalExports;
    fetchSpy.mock.restore();
    dom.window.close();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
