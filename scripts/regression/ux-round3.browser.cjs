/* Production UI integration regression. No real AI calls; run server on :3100. */
const { chromium } = require('/home/box/.npm/_npx/420ff84f11983ee5/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const OUT = process.env.REVIEW_OUT || '/tmp/zw-int-qa';
const BASE = process.env.REVIEW_BASE || 'http://localhost:3100';
const sse = text => `data: ${JSON.stringify({ delta: { text } })}\n\ndata: [DONE]\n\n`;
async function fill(form, { unknown = false, year = '1990', month = '5', day = '15' } = {}) {
  await form.getByLabel('年', { exact: true }).fill(year);
  await form.getByLabel('月', { exact: true }).selectOption(month);
  await form.getByLabel('日', { exact: true }).selectOption(day);
  await form.getByRole('checkbox', { name: /不知道出生时间/ }).setChecked(unknown);
  if (!unknown) { await form.getByLabel('时', { exact: true }).selectOption('8'); await form.getByLabel('分', { exact: true }).selectOption('30'); }
  await form.locator('label').filter({ hasText: /^男$/ }).click();
  await form.getByLabel('省份 / 直辖市').selectOption('河南省');
  await form.getByLabel('城市', { exact: true }).selectOption('郑州');
}
async function overflow(page) { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal page overflow'); }
async function shot(page, name) { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); }
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const results = [];
  try {
    for (const [prefix, width, height] of [['mobile', 390, 844], ['desktop', 1280, 800]]) {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      const errors = [], requests = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
      let scenario = 'success';
      await page.route('**/api/interpret', async route => {
        requests.push(route.request().postDataJSON());
        if (scenario === '500') return route.fulfill({ status: 500, body: 'Bad Gateway' });
        if (scenario === '429') return route.fulfill({ status: 429, contentType: 'application/json', headers: { 'Retry-After': '2' }, body: JSON.stringify({ limitKind: 'minute' }) });
        if (scenario === 'daily') return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ limitKind: 'daily' }) });
        if (scenario === 'network') return route.abort('internetdisconnected');
        if (scenario === 'broken') return route.fulfill({ contentType: 'text/event-stream', body: 'data: {"delta":{"text":"保留下来的部分回答"}}\n\n' });
        if (scenario === 'length') return route.fulfill({ contentType: 'text/event-stream', body: 'data: {"delta":{"text":"已生成的正文"},"finish_reason":"length"}\n\n' });
        await new Promise(r => setTimeout(r, 200));
        return route.fulfill({ contentType: 'text/event-stream', body: sse('## 先说结论\n可以考虑换工作，但先找好下家。\n- 核对**预算**\n- 准备作品\n\n四化需要分层观察。') });
      });
      await page.goto(BASE + '/');
      await overflow(page);
      assert.equal(await page.locator('footer').count(), 1);
      assert.ok((await page.locator('body').innerText()).includes('示例盘 · 仅示意'));
      assert.ok(!(await page.locator('body').innerText()).includes('没有账号、会员与付费入口'));
      await shot(page, `${prefix}-home-light`);
      await page.goto(BASE + '/chart');
      const form = page.locator('form').first();
      assert.equal(await form.getByLabel('时', { exact: true }).inputValue(), '');
      assert.equal(await form.getByRole('radio', { name: '男', exact: true }).isChecked(), false);
      await form.getByRole('button', { name: '排盘', exact: true }).click();
      await page.getByText(/请填写出生年份/).waitFor();
      assert.equal(await form.getByLabel('年', { exact: true }).evaluate(el => el === document.activeElement), true);
      await fill(form);
      await page.getByText(/公历 1990-05-15 ＝ 农历庚午年/).waitFor();
      await form.getByRole('radio', { name: '农历', exact: true }).click();
      assert.equal(await form.getByLabel('月', { exact: true }).inputValue(), '4');
      assert.equal(await form.getByLabel('日', { exact: true }).inputValue(), '21');
      await shot(page, `${prefix}-form-lunar`);
      await form.getByRole('radio', { name: '公历', exact: true }).click();
      await fill(form, { year: '2020', month: '5', day: '23' });
      await form.getByRole('radio', { name: '农历', exact: true }).click();
      assert.equal(await form.getByRole('checkbox', { name: /闰月/ }).isChecked(), true);
      await form.getByLabel('日', { exact: true }).selectOption('30');
      await form.getByRole('button', { name: '排盘', exact: true }).click();
      await page.getByText('该农历日期不存在，请检查大小月与闰月', { exact: true }).waitFor();
      await form.getByLabel('日', { exact: true }).selectOption('1');
      await form.getByRole('radio', { name: '公历', exact: true }).click();
      await fill(form, { year: '1900', month: '1', day: '1' });
      await form.getByRole('radio', { name: '农历', exact: true }).click();
      assert.equal(await form.getByLabel('年', { exact: true }).inputValue(), '1899');
      await form.getByRole('radio', { name: '公历', exact: true }).click();
      await fill(form);
      await form.getByRole('button', { name: '这是夏令时读数，减 1 小时' }).click();
      assert.equal(await form.getByLabel('时', { exact: true }).inputValue(), '7');
      await form.getByRole('button', { name: '撤销减 1 小时' }).click();
      assert.equal(await form.getByLabel('时', { exact: true }).inputValue(), '8');
      await overflow(page);
      await form.getByRole('button', { name: '排盘', exact: true }).dblclick();
      await page.getByRole('group', { name: '十二宫命盘' }).waitFor();
      assert.equal(await page.locator('[data-palace-branch]').count(), 12);
      assert.equal(await page.evaluate(() => scrollY), 0, 'result starts at chart top, not AI');
      assert.equal(requests.length, 0, 'mount does not spend AI quota');
      await overflow(page); await shot(page, `${prefix}-chart-light`);
      await page.getByRole('button', { name: '选择命宫', exact: true }).click();
      await page.getByRole('button', { name: '选择命宫', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: '选择命宫', exact: true }).getAttribute('aria-pressed'), 'true');
      const star = page.locator('[data-palace-branch] button').filter({ hasText: /^(紫微|天机|太阳|武曲|天同|廉贞|天府|太阴|贪狼|巨门|天相|天梁|七杀|破军)$/ }).first();
      await star.click();
      await page.getByLabel('星曜本地简介', { exact: true }).waitFor();
      assert.equal(requests.length, 0);
      const term = page.locator('.term-trigger').filter({ hasText: /^四化/ }).first();
      await term.click(); await page.getByRole('dialog', { name: '四化简介' }).waitFor();
      const bounds = await page.getByRole('dialog').boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0 && bounds.y + bounds.height <= height);
      await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 0);
      await page.getByRole('button', { name: '查看下一年流年' }).click();
      await page.getByRole('button', { name: '事业', exact: true }).click();
      await page.getByRole('heading', { name: '先说结论' }).waitFor();
      assert.equal(requests.at(-1).view.type, 'yearly');
      assert.equal(requests.at(-1).view.year, new Date().getFullYear() + 1);
      const count = requests.length;
      await page.getByRole('button', { name: '事业', exact: true }).click();
      await page.waitForTimeout(100); assert.equal(requests.length, count, 'standalone topic caches by context');
      for (const value of ['500', '429', 'daily', 'network', 'broken', 'length']) {
        scenario = value;
        await page.getByRole('textbox', { name: '向 AI 提问' }).fill(`测试 ${value}`);
        await page.getByRole('button', { name: '追问', exact: true }).click();
        const alert = page.locator('.ux-notice[role="alert"]'); await alert.waitFor();
        if (value === 'broken') await page.getByText('保留下来的部分回答', { exact: true }).waitFor();
        if (value === '429') { assert.equal(await alert.getByRole('button').isDisabled(), true); await page.waitForTimeout(2200); }
        const same = requests.at(-1); scenario = 'success';
        await alert.getByRole('button', { name: '重试' }).click();
        await alert.waitFor({ state: 'detached' });
        await page.waitForTimeout(300); assert.deepEqual(requests.at(-1), same, 'retry repeats exact captured payload');
      }
      await overflow(page);
      await page.getByRole('button', { name: '重新起盘', exact: true }).click();
      assert.equal(await form.getByLabel('年', { exact: true }).inputValue(), '1990', 'editing preserves form');
      await form.getByRole('checkbox', { name: /不知道出生时间/ }).check();
      await form.getByRole('button', { name: '排盘', exact: true }).click();
      await page.getByRole('group', { name: '十二宫命盘' }).waitFor();
      await page.getByRole('button', { name: '健康', exact: true }).click(); await page.waitForTimeout(300);
      assert.equal(requests.at(-1).birthTimeKnown, false); assert.equal(requests.at(-1).mode, 'overview');
      await page.getByRole('button', { name: '切换亮色 / 暗色主题' }).click();
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
      await page.waitForTimeout(400);
      await overflow(page); await shot(page, `${prefix}-chart-dark`);
      await page.goto(BASE + '/heming');
      const calls = []; let failure = true;
      await page.route('**/api/heming', async route => {
        const body = route.request().postDataJSON(); calls.push(body);
        if (failure) return route.fulfill({ status: 500, body: 'Bad Gateway' });
        return route.fulfill({ contentType: 'text/event-stream', body: sse(body.mode === 'followup' ? '## 追问结论\n先约定一次交流。' : '## 原始合盘结论\n把分工说清楚更有帮助。\n四化需要分层观察。') });
      });
      await fill(page.locator('form').nth(0));
      await fill(page.locator('form').nth(1), { unknown: true });
      await page.locator('form').nth(1).getByRole('radio', { name: '农历', exact: true }).click();
      await overflow(page); await shot(page, `${prefix}-heming-form`);
      await page.getByRole('button', { name: '开始合盘', exact: true }).click();
      await page.locator('.ux-notice[role="alert"]').waitFor();
      const same = calls.at(-1); failure = false;
      await page.getByRole('button', { name: '重试', exact: true }).click();
      await page.getByRole('heading', { name: '原始合盘结论' }).waitFor(); assert.deepEqual(calls.at(-1), same);
      const original = await page.getByLabel('原始合盘报告', { exact: true }).innerText();
      await page.getByRole('button', { name: '感情匹配度如何？', exact: true }).click();
      await page.getByRole('heading', { name: '追问结论' }).waitFor();
      assert.equal(await page.getByLabel('原始合盘报告', { exact: true }).innerText(), original);
      assert.equal(calls.at(-1).mode, 'followup'); assert.ok(calls.at(-1).reportSummary);
      assert.equal(calls.at(-1).chartB.birthInfo.birthTimeKnown, false);
      await overflow(page); await shot(page, `${prefix}-heming-followup`);
      await page.goto(BASE + '/knowledge/taiyang/health'); await overflow(page);
      assert.equal(await page.locator('footer').count(), 1);
      await page.goto(BASE + '/library/search?q='); await page.waitForURL(BASE + '/library');
      await page.goto(BASE + '/this-page-does-not-exist'); await page.getByRole('heading', { name: '这一页不在命盘里' }).waitFor();
      assert.deepEqual(errors, []);
      results.push({ viewport: `${width}x${height}`, requests: requests.length, hemingRequests: calls.length, errors });
      await context.close();
    }
    fs.writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(results, null, 2)); console.log(results);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
