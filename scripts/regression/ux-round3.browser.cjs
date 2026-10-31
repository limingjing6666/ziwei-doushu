/* Run against: env -u DEEPSEEK_API_KEY npm run start -- -p 3100 */
const { chromium } = require('/home/box/.npm/_npx/420ff84f11983ee5/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const OUT = '/workspace/tianjipan/round3';
const BASE = 'http://localhost:3100';
async function fill(form, { unknown = false, year = '1990', month = '5', day = '15' } = {}) {
  await form.locator('[name="year"]').fill(year);
  await form.locator('[name="month"]').selectOption(month);
  await form.locator('[name="day"]').selectOption(day);
  if (unknown) await form.getByText('不知道出生时辰', { exact: true }).click();
  else { await form.locator('[name="clockHour"]').selectOption('8'); await form.locator('[name="clockMinute"]').selectOption('30'); }
  await form.getByRole('button', { name: '男', exact: true }).click();
}
const SSE = text => 'data: ' + JSON.stringify({ delta: { text } }) + '\n\ndata: [DONE]\n\n';
async function shot(page, name) { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); }
async function noOverflow(page, label) {
  const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(sizes.scroll <= sizes.viewport, `${label}: ${JSON.stringify(sizes)}`);
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const results = [];
  try {
    for (const [prefix, width, height] of [['mobile', 390, 844], ['desktop', 1280, 800]]) {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      const requests = []; page.on('request', r => { if (r.url().includes('/api/interpret')) requests.push(r.postDataJSON()); });
      let response = 'success';
      await page.route('**/api/interpret', async route => {
        if (response === '500') return route.fulfill({ status: 500, body: 'Bad Gateway' });
        if (response === '429') return route.fulfill({ status: 429, contentType: 'application/json', headers: { 'Retry-After': '2' }, body: JSON.stringify({ error: 'limit', limitKind: 'minute' }) });
        if (response === 'daily') return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ limitKind: 'daily' }) });
        if (response === 'network') return route.abort('internetdisconnected');
        if (response === 'broken') return route.fulfill({ contentType: 'text/event-stream', body: 'data: {"delta":{"text":"保留下来的部分回答"}}\n\n' });
        if (response === 'length') return route.fulfill({ contentType: 'text/event-stream', body: 'data: {"delta":{"text":"已生成的正文"}}\n\ndata: {"finish_reason":"length"}\n\ndata: [DONE]\n\n' });
        if (response === 'slow') await new Promise(r => setTimeout(r, 1300));
        return route.fulfill({ contentType: 'text/event-stream', body: SSE('## 先说结论\n可以考虑换工作，但先找好下家。\n- 核对**预算**\n- 准备作品\n\n四化（资源与压力的变化标记）需分层观察。') });
      });
      await page.goto(BASE + '/chart');
      await page.getByRole('button', { name: '开始排盘', exact: true }).click();
      await page.getByText(/请填写出生年份/).waitFor();
      assert.equal(await page.locator('[name="year"]').evaluate(el => el === document.activeElement), true);
      await shot(page, `${prefix}-form-validation`);
      await fill(page.locator('form'));
      await page.getByText(/公历 1990-05-15 ＝ 农历庚午年/).waitFor();
      await page.getByRole('button', { name: '农历', exact: true }).click();
      assert.equal(await page.locator('[name="month"]').inputValue(), '4');
      assert.equal(await page.locator('[name="day"]').inputValue(), '21');
      await shot(page, `${prefix}-form-lunar`);
      await page.getByRole('button', { name: '公历', exact: true }).click();
      await page.locator('[name="year"]').fill('2020');
      await page.locator('[name="month"]').selectOption('5'); await page.locator('[name="day"]').selectOption('23');
      await page.getByRole('button', { name: '农历', exact: true }).click();
      assert.equal(await page.getByRole('checkbox', { name: /闰月/ }).isChecked(), true);
      await page.getByRole('button', { name: '公历', exact: true }).click();
      await fill(page.locator('form'));
      await page.getByRole('button', { name: '这是夏令时读数，减 1 小时', exact: true }).click();
      assert.equal(await page.locator('[name="clockHour"]').inputValue(), '7');
      await page.getByRole('button', { name: '撤销减 1 小时', exact: true }).click();
      assert.equal(await page.locator('[name="clockHour"]').inputValue(), '8');
      await page.locator('[name="month"]').selectOption('2'); await page.locator('[name="day"]').selectOption('30');
      await page.getByRole('button', { name: '开始排盘', exact: true }).click();
      assert.ok((await page.locator('body').innerText()).includes('该公历日期不存在'));
      await page.locator('[name="year"]').fill('1900'); await page.locator('[name="month"]').selectOption('1'); await page.locator('[name="day"]').selectOption('1');
      await page.getByRole('button', { name: '农历', exact: true }).click();
      assert.equal(await page.locator('[name="year"]').inputValue(), '1899');
      await page.getByRole('button', { name: '公历', exact: true }).click();
      assert.equal(await page.locator('[name="year"]').inputValue(), '1900');
      await fill(page.locator('form'));
      await noOverflow(page, prefix + ' form');
      await page.evaluate(() => {
        document.querySelector('form').addEventListener('submit', () => {
          const start = performance.now();
          const button = document.querySelector('button[type="submit"]');
          const observer = new MutationObserver(() => { if (button.textContent.includes('正在排盘')) { window.__round3LoadingMs = performance.now() - start; observer.disconnect(); } });
          observer.observe(button, { childList: true, subtree: true, characterData: true });
        }, { once: true, capture: true });
      });
      const start = Date.now();
      await page.getByRole('button', { name: '开始排盘', exact: true }).click();
      await page.locator('.palace-slot').first().waitFor();
      const chartMs = Date.now() - start;
      assert.equal(await page.locator('.palace-slot').count(), 12);
      assert.equal(requests.length, 0, 'mount must not auto-spend AI quota');
      const loadingMs = await page.evaluate(() => window.__round3LoadingMs);
      assert.ok(loadingMs < 100, `loading feedback ${loadingMs}ms`);
      await page.mouse.move(0, 0); await page.waitForTimeout(800); await page.keyboard.press('Escape');
      await noOverflow(page, prefix + ' result');
      await shot(page, `${prefix}-chart-result`);
      await page.getByRole('button', { name: '选择命宫', exact: true }).click();
      await page.locator('.major-star').first().click();
      assert.equal(requests.length, 0, 'palace/star click is local only');
      assert.equal(await page.locator('.palace-cell.selected').count(), 1);
      if (prefix === 'mobile') { await page.getByLabel('手机本地简介').waitFor(); await shot(page, 'mobile-local-selection'); await page.getByRole('button', { name: '收起手机简介', exact: true }).click(); }
      const term = page.locator('.time-nav').getByRole('button', { name: /四化/ }).first();
      await term.scrollIntoViewIfNeeded(); await page.waitForTimeout(250);
      await term.hover(); await term.click();
      await page.getByRole('dialog', { name: '四化简介' }).waitFor();
      await shot(page, `${prefix}-term-popover`);
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('dialog').count(), 0);
      await page.locator('.time-nav').getByRole('button', { name: '下一年' }).click();
      response = 'slow';
      await page.getByRole('button', { name: '事业', exact: true }).click();
      await page.getByText(/正在读取命盘/).waitFor();
      await shot(page, `${prefix}-ai-waiting`);
      await page.getByText('可以考虑换工作，但先找好下家。', { exact: true }).waitFor();
      assert.equal(requests.at(-1).view.type, 'yearly');
      assert.equal(requests.at(-1).view.year, new Date().getFullYear() + 1);
      assert.ok(requests.at(-1).view.transformations.yearly);
      const count = requests.length;
      await page.getByRole('button', { name: '事业', exact: true }).click();
      await page.waitForTimeout(100); assert.equal(requests.length, count, 'same question and view uses memory cache');
      await noOverflow(page, prefix + ' AI');
      for (const scenario of ['500', '429', 'daily', 'network', 'broken', 'length']) {
        response = scenario;
        await page.getByRole('textbox', { name: '向 AI 提问' }).fill(`测试 ${scenario}`);
        await page.getByRole('button', { name: '提问', exact: true }).click();
        const alert = page.locator('.ux-notice[role="alert"]');
        await alert.waitFor();
        await shot(page, `${prefix}-error-${scenario}`);
        assert.ok(await alert.getByRole('button', { name: '重试', exact: true }).count());
        if (scenario === 'broken') await page.getByText('保留下来的部分回答', { exact: true }).waitFor();
        if (scenario === '429') { assert.ok(await alert.getByRole('button').isDisabled()); await page.waitForTimeout(2200); }
        response = 'success';
        const same = requests.at(-1);
        await alert.getByRole('button', { name: '重试', exact: true }).click();
        await alert.waitFor({ state: 'detached' });
        await page.waitForTimeout(100);
        assert.deepEqual(requests.at(-1), same, 'retry repeats exact captured payload');
      }
      await page.getByRole('button', { name: '关闭引导', exact: true }).click();
      await page.getByRole('button', { name: '补充信息 / 重新排盘', exact: true }).click();
      await page.getByText('不知道出生时辰', { exact: true }).click();
      await page.getByRole('button', { name: '开始排盘', exact: true }).click();
      await page.getByRole('button', { name: '补充时辰重新排盘', exact: true }).waitFor();
      assert.equal(await page.getByLabel('首次阅读引导').count(), 0);
      await page.getByRole('button', { name: '性格', exact: true }).click();
      await page.waitForTimeout(100); assert.equal(requests.at(-1).birthTimeKnown, false);
      await shot(page, `${prefix}-unknown-time`);
      assert.deepEqual(errors, []);
      results.push({ viewport: `${width}x${height}`, chartMs, loadingMs, interpretRequests: requests.length, runtimeErrors: errors });

      await page.goto(BASE + '/heming');
      const calls = []; let followCount = 0; let hemingFailure = '500';
      await page.route('**/api/heming', async route => {
        const body = route.request().postDataJSON(); calls.push(body);
        if (hemingFailure === '500') return route.fulfill({ status: 500, body: 'Bad Gateway' });
        if (hemingFailure === 'broken') return route.fulfill({ contentType: 'text/event-stream', body: 'data: {"delta":{"text":"合盘追问部分回答"}}\n\n' });
        if (body.mode === 'followup') { followCount++; await new Promise(r => setTimeout(r, 250)); }
        await route.fulfill({ contentType: 'text/event-stream', body: SSE(body.mode === 'followup' ? `## 追问结论${followCount}\n先约定一次不被打断的交流。` : '## 原始合盘结论\n把分工说清楚，比急着下结论更有帮助。\n- 留出休息时间') });
      });
      const forms = page.locator('form');
      await fill(forms.nth(0)); await fill(forms.nth(1), { unknown: true });
      await noOverflow(page, prefix + ' heming form'); await shot(page, `${prefix}-heming-form`);
      await page.getByRole('button', { name: '开始合盘分析', exact: true }).click();
      await page.locator('.ux-notice[role="alert"]').waitFor(); await shot(page, `${prefix}-heming-error500`);
      hemingFailure = ''; await page.getByRole('button', { name: '重试', exact: true }).click();
      await page.getByRole('heading', { name: '原始合盘结论' }).waitFor();
      const original = await page.getByLabel('原始合盘报告').innerText();
      hemingFailure = 'broken';
      await page.getByRole('button', { name: '我们怎样沟通更舒服？', exact: true }).click();
      await page.locator('.ux-notice[role="alert"]').waitFor();
      await page.getByText('合盘追问部分回答', { exact: true }).waitFor();
      await shot(page, `${prefix}-heming-followup-interrupted`);
      assert.equal(await page.getByLabel('原始合盘报告').innerText(), original);
      hemingFailure = ''; await page.getByRole('button', { name: '重试', exact: true }).click();
      await page.getByRole('heading', { name: '追问结论1' }).waitFor();
      assert.equal(await page.getByLabel('原始合盘报告').innerText(), original);
      await page.getByRole('textbox', { name: '合盘追问', exact: true }).fill('如何明确分工？');
      await page.getByRole('button', { name: '追问', exact: true }).click();
      await page.getByRole('heading', { name: '追问结论2' }).waitFor();
      assert.equal(await page.getByRole('heading', { name: '追问结论1' }).count(), 1);
      assert.equal(await page.getByLabel('原始合盘报告').innerText(), original);
      assert.equal(calls.at(-1).mode, 'followup'); assert.ok(calls.at(-1).reportSummary);
      assert.equal(calls.at(-1).chartB.birthInfo.birthTimeKnown, false);
      await noOverflow(page, prefix + ' heming result'); await shot(page, `${prefix}-heming-followups`);
      assert.deepEqual(errors, []);
      await page.goto(BASE + '/library/search?q='); await page.waitForURL(BASE + '/library');
      await page.goto(BASE + '/this-page-does-not-exist'); await page.getByRole('heading', { name: '这一页暂时找不到' }).waitFor();
      await noOverflow(page, prefix + ' 404'); await shot(page, `${prefix}-404`);
      await page.goto(BASE + '/'); await noOverflow(page, prefix + ' home');
      await page.getByRole('button', { name: '切换亮色主题', exact: true }).click();
      await page.getByRole('button', { name: '切换暗色主题', exact: true }).waitFor();
      await page.goto(BASE + '/chart');
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
      await fill(page.locator('form')); await page.getByRole('button', { name: '开始排盘', exact: true }).click();
      await page.locator('.palace-slot').first().waitFor();
      await page.mouse.move(0, 0); await page.waitForTimeout(800); await page.keyboard.press('Escape');
      await noOverflow(page, prefix + ' light result'); await shot(page, `${prefix}-chart-light`);
      assert.deepEqual(errors, []);
      await context.close();
    }
    fs.writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
