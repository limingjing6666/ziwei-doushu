/* Independent safety/theme review for PR #9 UI; production :3100, intercepted AI only. */
const { chromium } = require('/home/box/.npm/_npx/420ff84f11983ee5/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const OUT = process.env.REVIEW_OUT || '/tmp/zw-int-qa';
const BASE = process.env.REVIEW_BASE || 'http://localhost:3100';
const malicious = '<img src=x onerror="window.__xss=1">\n[x](javascript:alert(1))\n**第一行**\n**第二行**\n**外层 *嵌套* 未闭合\n' + '#'.repeat(12000) + '\n' + '长'.repeat(12000);
const sse = text => `data: ${JSON.stringify({ delta: { text } })}\n\ndata: [DONE]\n\n`;
async function overflow(page) { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
async function fill(page) {
  const f = page.locator('form').first();
  await f.getByLabel('年', { exact: true }).fill('1986');
  await f.getByLabel('月', { exact: true }).selectOption('7');
  await f.getByLabel('日', { exact: true }).selectOption('15');
  await f.getByLabel('时', { exact: true }).selectOption('7');
  await f.getByLabel('分', { exact: true }).selectOption('0');
  await f.locator('label').filter({ hasText: /^女$/ }).click();
  await f.getByLabel('省份 / 直辖市').selectOption('广东省');
  await f.getByLabel('城市', { exact: true }).selectOption('广州');
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] }); const results = [];
  try {
    for (const [prefix, width, height] of [['mobile', 390, 844], ['desktop', 1280, 800]]) {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage(), errors = [], calls = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.route('**/api/interpret', async route => { calls.push(route.request().postDataJSON()); await new Promise(r => setTimeout(r, 150)); await route.fulfill({ contentType: 'text/event-stream', body: sse(malicious) }); });
      await page.goto(BASE + '/chart'); await fill(page);
      await page.getByText(/时辰由辰时变为卯时/).waitFor();
      await page.getByRole('button', { name: '排盘', exact: true }).click();
      await page.getByRole('group', { name: '十二宫命盘' }).waitFor();
      await page.getByText(/按真太阳时校正后，出生时辰由「辰时」变为「卯时」/).first().waitFor();
      await page.getByRole('radio', { name: '大限', exact: true }).click();
      const badge = page.locator('[data-palace-branch] button[aria-label*="限化"]:visible').first();
      const palace = badge.locator('xpath=ancestor::*[@data-palace-branch]');
      await badge.click();
      assert.equal(await palace.locator('button[aria-pressed="true"]').count(), 1);
      await page.getByRole('button', { name: '让 AI 解读这一四化' }).waitFor();
      await page.getByRole('button', { name: '查看下一年流年' }).click();
      assert.equal(await page.getByRole('button', { name: '让 AI 解读这一四化' }).count(), 0);
      assert.equal(calls.length, 0);
      const trigger = page.locator('.term-trigger').filter({ hasText: /^四化/ }).first();
      await trigger.click(); const dialog = page.getByRole('dialog'); await dialog.waitFor();
      await page.keyboard.press('Tab');
      assert.equal(await dialog.getByRole('button', { name: '关闭解释' }).evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Escape');
      assert.equal(await dialog.count(), 0);
      assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
      await page.getByRole('button', { name: '事业', exact: true }).dblclick();
      await page.locator('.ai-markdown').filter({ hasText: '[x](javascript:alert(1))' }).waitFor();
      assert.equal(calls.length, 1);
      assert.equal(await page.locator('.ai-markdown img, .ai-markdown a, .ai-markdown script').count(), 0);
      assert.equal(await page.evaluate(() => window.__xss), undefined); await overflow(page);
      for (const theme of ['light', 'dark']) {
        if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: '切换亮色 / 暗色主题' }).click();
        await page.waitForTimeout(400);
        if (!(await page.locator('.ai-markdown').filter({ hasText: '[x](javascript:alert(1))' }).count())) {
          await page.getByRole('button', { name: '事业', exact: true }).click();
          await page.locator('.ai-markdown').filter({ hasText: '[x](javascript:alert(1))' }).waitFor();
        }
        assert.equal(await page.locator('.ai-markdown img, .ai-markdown a, .ai-markdown script').count(), 0);
        await overflow(page);
        await page.screenshot({ path: `${OUT}/${prefix}-safe-ai-${theme}.png`, fullPage: true });
        await page.goto(BASE + '/knowledge/taiyang/health'); await overflow(page);
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        const text = await page.locator('body').innerText(); assert.match(text, /健康状况/); assert.match(text, /头风/); assert.match(text, /脏腑/);
        assert.equal(await page.locator('footer').count(), 1);
        assert.ok(await page.locator('.term-trigger').count());
        await page.screenshot({ path: `${OUT}/${prefix}-knowledge-${theme}.png`, fullPage: true });
        await page.goto(BASE + '/library/quanji/0'); await overflow(page);
        await page.screenshot({ path: `${OUT}/${prefix}-library-${theme}.png`, fullPage: true });
        await page.goto(BASE + '/chart'); await fill(page); await page.getByRole('button', { name: '排盘', exact: true }).click();
        await page.getByRole('group', { name: '十二宫命盘' }).waitFor();
        assert.equal(await page.evaluate(() => scrollY), 0); await overflow(page);
        await page.screenshot({ path: `${OUT}/${prefix}-chart-${theme}-review.png`, fullPage: true });
      }
      const sitemap = await (await page.request.get(BASE + '/sitemap.xml')).text(); assert.ok(sitemap.includes('/glossary'));
      for (const path of ['/robots.txt', '/manifest.webmanifest', '/icon.svg', '/privacy', '/terms']) assert.equal((await page.request.get(BASE + path)).status(), 200);
      assert.equal((await page.request.get(BASE + '/preview')).status(), 404, 'preview stays archived');
      assert.deepEqual(errors, []); results.push({ viewport: `${width}x${height}`, errors, calls: calls.length }); await context.close();
    }
    fs.writeFileSync(`${OUT}/independent-results.json`, JSON.stringify(results, null, 2)); console.log(results);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
