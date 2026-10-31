/* Independent review: production server on :3100, no real AI calls. */
const { chromium } = require('/home/box/.npm/_npx/420ff84f11983ee5/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const OUT = '/workspace/tianjipan/round3/review';
const BASE = 'http://localhost:3100';
const malicious = '<img src=x onerror="window.__xss=1">\n[x](javascript:alert(1))\n**第一行**\n**第二行**\n**外层 *嵌套* 未闭合\n' + '#'.repeat(12000) + '\n' + '长'.repeat(12000);
const sse = text => `data: ${JSON.stringify({ delta: { text } })}\n\ndata: [DONE]\n\n`;
async function screenshot(page, name, fullPage = false) { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage }); }
async function overflow(page) { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
async function fill(page, { year = '1986', month = '7', day = '15', hour = '14', minute = '0', lunar = false, unknown = false } = {}) {
  const f = page.locator('form').first();
  if (lunar) await f.getByRole('button', { name: '农历', exact: true }).click();
  await f.locator('[name="year"]').fill(year);
  await f.locator('[name="month"]').selectOption(month);
  await f.locator('[name="day"]').selectOption(day);
  if (unknown) await f.getByRole('checkbox', { name: '不知道出生时辰' }).check();
  else { await f.locator('[name="clockHour"]').selectOption(hour); await f.locator('[name="clockMinute"]').selectOption(minute); }
  await f.getByRole('button', { name: '女', exact: true }).click();
  await f.getByLabel('省份', { exact: true }).selectOption('广东省');
  await f.getByLabel('城市', { exact: true }).selectOption('广州');
}
async function closePreview(page) { const b = page.getByRole('button', { name: '收起手机简介' }); if (await b.isVisible()) await b.click(); }
async function chart(page) { await page.getByRole('button', { name: '开始排盘', exact: true }).click(); await page.locator('.palace-cell').first().waitFor(); await page.waitForTimeout(1400); }
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const results = [];
  try {
    for (const [prefix, width, height] of [['mobile', 390, 844], ['desktop', 1280, 800]]) {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage(); const errors = [], requests = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error' || /hydration|unique.*key/i.test(m.text())) errors.push(m.text()); });
      page.on('request', r => { if (r.url().includes('/api/interpret')) requests.push(r.postDataJSON()); });
      await page.route('**/api/interpret', async route => { await new Promise(r => setTimeout(r, 150)); await route.fulfill({ contentType: 'text/event-stream', body: sse(malicious) }); });
      await page.goto(BASE); await page.waitForTimeout(1800); await screenshot(page, `${prefix}-home-dark`);
      await page.getByRole('button', { name: '立即起盘', exact: true }).first().click(); await page.waitForURL(BASE + '/chart');
      assert.equal(await page.locator('[name="year"]').getAttribute('inputmode'), 'numeric');
      await fill(page, { year: String(new Date().getFullYear() + 1) });
      await page.getByRole('button', { name: '开始排盘', exact: true }).click();
      await page.getByText('出生日期不能是未来日期', { exact: true }).waitFor();
      await fill(page); await page.getByText(/该时段中国实行过夏令时/).waitFor();
      await page.getByRole('button', { name: '这是夏令时读数，减 1 小时', exact: true }).click();
      assert.equal(await page.locator('[name="clockHour"]').inputValue(), '13');
      await page.getByRole('button', { name: '撤销减 1 小时', exact: true }).click();
      assert.equal(await page.locator('[name="clockHour"]').inputValue(), '14');
      await screenshot(page, `${prefix}-1986-dst-form`, true); await chart(page);
      const metrics = await page.evaluate(() => ({
        major: Math.min(...Array.from(document.querySelectorAll('.major-star')).map(e => parseFloat(getComputedStyle(e).fontSize))),
        minor: Math.min(...Array.from(document.querySelectorAll('.minor-star')).map(e => parseFloat(getComputedStyle(e).fontSize))),
        touch: Math.min(...Array.from(document.querySelectorAll('button')).filter(e => e.getBoundingClientRect().width && !e.disabled).map(e => e.getBoundingClientRect().height)),
      }));
      assert.ok(metrics.major >= 12 && metrics.minor >= 11 && metrics.touch >= 40, JSON.stringify(metrics));
      await page.getByRole('button', { name: '选择命宫', exact: true }).click(); await closePreview(page);
      await page.locator('.major-star').first().click(); await closePreview(page);
      await page.locator('.time-nav').getByRole('button', { name: /^大限 \d/ }).click();
      const badge = page.locator('.palace-cell button').filter({ hasText: /限化/ }).first();
      const palace = await badge.locator('xpath=ancestor::*[@data-palace]').getAttribute('data-palace');
      await badge.click(); await closePreview(page);
      assert.equal(await page.locator('.palace-cell.selected').getAttribute('data-palace'), palace);
      assert.ok((await page.getByLabel('本地静态信息').innerText()).includes(palace));
      assert.equal(requests.length, 0, 'palace/star/transformation/view actions must not request AI');
      await page.locator('.time-nav').getByRole('button', { name: '下一年' }).click();
      assert.equal(await page.getByRole('button', { name: '让 AI 解读这一四化' }).count(), 0, 'stale transformation clears on view/year changes');
      await page.locator('.time-nav').getByRole('button', { name: '本命', exact: true }).last().click();
      const trigger = page.locator('.palace-cell .term-trigger').first();
      await trigger.scrollIntoViewIfNeeded(); await page.waitForTimeout(100); await trigger.click();
      const dialog = page.getByRole('dialog'); await dialog.waitFor();
      const bounds = await dialog.boundingBox(); assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height);
      await screenshot(page, `${prefix}-portal-bounds`); await page.mouse.click(width - 2, 2); assert.equal(await dialog.count(), 0);
      await trigger.focus(); await dialog.waitFor(); await page.keyboard.press('Tab');
      assert.equal(await dialog.getByRole('button', { name: '关闭解释' }).evaluate(e => document.activeElement === e), true);
      await page.keyboard.press('Escape'); assert.equal(await trigger.evaluate(e => document.activeElement === e), true);
      assert.equal(await dialog.count(), 0);
      const topic = page.getByRole('button', { name: '事业', exact: true });
      await topic.dblclick(); await page.locator('.ai-markdown').filter({ hasText: '[x](javascript:alert(1))' }).first().waitFor();
      assert.equal(requests.length, 1, 'rapid clicks send once');
      assert.equal(await page.locator('.ai-markdown img, .ai-markdown a, .ai-markdown script').count(), 0);
      assert.equal(await page.evaluate(() => window.__xss), undefined); await overflow(page);
      await page.locator('.ai-panel').scrollIntoViewIfNeeded(); await screenshot(page, `${prefix}-malicious-markdown`);
      await topic.click(); await page.waitForTimeout(200); assert.equal(requests.length, 1, 'standalone topic is cached');
      await page.getByRole('button', { name: '补充信息 / 重新排盘', exact: true }).click();
      await page.locator('[name="clockHour"]').selectOption('7'); await page.locator('[name="clockMinute"]').selectOption('0');
      await page.getByText(/出生时辰由「辰时」变为「卯时」/).waitFor(); await chart(page);
      await page.getByText(/按真太阳时校正后，出生时辰由「辰时」变为「卯时」/).first().waitFor();
      await screenshot(page, `${prefix}-cross-branch`);
      await page.getByRole('button', { name: '改按钟表时间重新排盘', exact: true }).click();
      assert.equal(await page.getByRole('radio', { name: '按钟表时间', exact: true }).isChecked(), true); await chart(page);
      await page.getByText('排盘时辰：辰时', { exact: true }).waitFor();
      await page.goto(BASE + '/chart'); await fill(page, { year: '1992', hour: '23', minute: '30' });
      await page.getByText(/23 点至 24 点按本日排盘/).waitFor(); await screenshot(page, `${prefix}-late-zi-form`, true); await chart(page);
      await page.getByText(/原始输入为晚子时/).waitFor();
      await page.goto(BASE + '/chart'); await fill(page, { year: '2020', month: '4', day: '1', lunar: true });
      await page.getByRole('checkbox', { name: /闰月/ }).check();
      await page.locator('[name="day"]').selectOption('30');
      await page.getByText('该农历日期不存在，请检查大小月与闰月', { exact: true }).waitFor();
      await page.locator('[name="day"]').selectOption('1');
      await page.getByText(/公历 2020-05-23.*闰四月初一/).waitFor();
      assert.ok(!(await page.locator('.calendar-conversion').innerText()).includes('闰闰'));
      await screenshot(page, `${prefix}-leap-lunar`, true); await chart(page);
      await page.goto(BASE + '/chart'); await fill(page, { year: '1990', month: '4', day: '21', lunar: true, unknown: true });
      await page.getByText(/公历 1990-05-15.*四月廿一/).waitFor(); await chart(page);
      await page.getByRole('button', { name: '性格', exact: true }).click(); await page.waitForTimeout(350);
      assert.equal(requests.at(-1).birthTimeKnown, false); await overflow(page);
      await page.goto(BASE); await page.getByRole('button', { name: '切换亮色主题', exact: true }).click();
      await page.waitForTimeout(1800); await screenshot(page, `${prefix}-home-light`);
      await page.goto(BASE + '/chart'); await fill(page); await chart(page); await screenshot(page, `${prefix}-1986-light`);
      await page.goto(BASE + '/glossary');
      await page.getByRole('link', { name: '了解更多 →', exact: true }).first().click();
      await page.waitForURL(BASE + '/knowledge');
      await page.goto(BASE + '/knowledge/taiyang/health');
      assert.doesNotMatch(await page.locator('body').innerText(), /头风|脏腑|心脏/);
      await screenshot(page, `${prefix}-knowledge-light`, true); await overflow(page);
      assert.equal(await page.locator('footer').count(), 1, 'one shared attribution/disclaimer footer');
      await page.goto(BASE); await page.getByRole('button', { name: '切换暗色主题', exact: true }).click();
      await page.goto(BASE + '/knowledge/taiyang/health');
      await screenshot(page, `${prefix}-knowledge-dark`, true); await overflow(page);
      assert.equal((await page.request.get(BASE + '/sitemap.xml')).status(), 200);
      assert.ok((await (await page.request.get(BASE + '/sitemap.xml')).text()).includes('/glossary'));
      for (const path of ['/robots.txt', '/manifest.webmanifest', '/icon.svg', '/preview', '/privacy', '/terms']) assert.equal((await page.request.get(BASE + path)).status(), 200, path);
      assert.deepEqual(errors, []);
      results.push({ viewport: `${width}x${height}`, metrics, requests: requests.length, errors }); await context.close();
    }
    fs.writeFileSync(`${OUT}/independent-results.json`, JSON.stringify(results, null, 2)); console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
