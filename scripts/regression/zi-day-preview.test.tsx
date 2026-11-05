import React, { act } from 'react';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import BirthForm, { type BirthFormState } from '../../components/birth/BirthForm';
import { validateBirthForm } from '../../lib/birth-form';
import { formToBirthInfo } from '../../lib/ziwei/share';

const input: BirthFormState = {
  name: '边界测试', year: '1900', month: '1', day: '1', calendar: 'solar',
  clockHour: '0', clockMinute: '30', unknownTime: false, timeMode: 'exact',
  province: '新疆维吾尔自治区', city: '乌鲁木齐', longitude: 87.6,
  gender: 'male', useTrueSolar: true,
};
const previewError = /校正后的排盘日期超出支持范围.*请核对出生日期、时间及校时方式/;
assert.deepEqual(validateBirthForm(input), {});
assert.throws(() => formToBirthInfo(input), { name: 'RangeError', message: '排盘日期超出支持范围' });
for (const variant of ['full', 'compact'] as const) {
  const html = renderToStaticMarkup(<BirthForm initialData={input} variant={variant} onSubmit={() => {}} />);
  assert.match(html, previewError);
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /本次排盘日：/);
}

async function main() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/chart' });
  const globals: Record<string, unknown> = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true,
  };
  const descriptors = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  const { createRoot } = require('react-dom/client') as typeof import('react-dom/client');
  const container = document.getElementById('root')!;
  const root = createRoot(container);
  const wait = () => new Promise(resolve => setTimeout(resolve, 50));
  try {
    for (const variant of ['full', 'compact'] as const) {
      const submitted: ReturnType<typeof formToBirthInfo>[] = [];
      await act(async () => root.render(<BirthForm key={variant} initialData={input} variant={variant} hideSubmit={variant === 'compact'} onSubmit={info => { submitted.push(info); }} />));
      const form = container.querySelector('form')!;
      assert.ok(form);
      const retained = (clockHour = '0') => {
        for (const [field, value] of Object.entries({
          name: '边界测试', year: '1900', month: '1', day: '1',
          'clock-hour': clockHour, 'clock-minute': '30', province: input.province, city: input.city,
        })) {
          assert.equal(container.querySelector<HTMLInputElement | HTMLSelectElement>(`[id$="-${field}"]`)!.value, value);
        }
        assert.ok(container.querySelector<HTMLInputElement>('input[value="male"]')!.checked);
        assert.equal(container.querySelector('form'), form, '错误或修改后保留原表单');
      };
      retained();
      assert.match(container.querySelector('[role="alert"]')!.textContent!, previewError);
      assert.doesNotMatch(container.textContent!, /本次排盘日：/);
      assert.equal(submitted.length, 0);
      const submit = () => act(async () => {
        form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
        await wait();
      });
      await submit();
      retained();
      assert.equal(submitted.length, 0, '越界转换仍明确失败，不向父级提交替代日期');
      assert.ok([...container.querySelectorAll('[role="alert"]')].some(node => /排盘未完成，请检查出生信息后重试/.test(node.textContent!)));
      assert.equal(form.getAttribute('aria-busy'), null, '失败后解除忙碌状态');

      // 原地修改时间后恢复预览与提交，不重置其它输入。
      await act(async () => {
        const hour = container.querySelector<HTMLSelectElement>('[id$="-clock-hour"]')!;
        hour.value = '3';
        hour.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      });
      retained('3');
      assert.equal(container.querySelector('[role="alert"]'), null);
      assert.doesNotMatch(container.textContent!, /排盘日是/);
      await submit();
      assert.equal(submitted.length, 1);
      assert.deepEqual([submitted[0].year, submitted[0].month, submitted[0].day, submitted[0].hour], [1900, 1, 1, 1]);
      retained('3');
    }
    console.log('✓ Zi day B1: 乌鲁木齐 1900-01-01 00:30 校验通过；双版预览不抛且提示越界、提交失败保留输入、修改后可重试');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
