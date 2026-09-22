const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = process.env.ALIFE_QA_OUTPUT || 'C:/Data/Alife/Temp/event-translation-permissions-20260922';
  fs.mkdirSync(root, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.ALIFE_BROWSER_EXECUTABLE, headless: true });
  try {
    for (const language of ['zh', 'en']) for (const width of [320, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${process.env.ALIFE_BROWSER_BASE_URL || 'http://localhost:5175'}/tests/fixtures/eventPermissionGuide.html?lang=${language}`);
      await page.locator('summary').focus(); await page.keyboard.press('Enter');
      await page.locator('dl').waitFor();
      assert.equal(await page.locator('dt').count(), 5);
      await page.getByRole('button', { name: language === 'zh' ? '筛选活动权限' : 'Filter event permissions' }).click();
      assert.equal(await page.getByLabel('Permission filter').innerText(), 'admin.events.');
      assert.equal(await page.locator('a').getAttribute('href'), '/event-work');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(root, `permission-guide-${language}-${width}.png`), fullPage: true });
      assert.deepEqual(errors, []); await page.close();
      console.log(`PASS event permission guide ${language}/${width}`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
