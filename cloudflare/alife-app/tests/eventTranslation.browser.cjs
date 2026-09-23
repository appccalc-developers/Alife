const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const { checkEventTranslation } = require('./helpers/eventTranslation.cjs');
const { expandTranslation } = require('./helpers/eventDetailsWorkspace.cjs');

(async () => {
  const root = process.env.ALIFE_QA_OUTPUT || 'C:/Data/Alife/Temp/event-translation-pr-20260922/browser';
  fs.mkdirSync(root, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.ALIFE_BROWSER_EXECUTABLE, headless: true });
  try {
    for (const language of ['zh', 'en']) for (const width of [320, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [], writes = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(language => localStorage.setItem('alife.language', language), language);
      await page.route('**/api/**', async route => {
        if (route.request().method() !== 'GET') writes.push(route.request().url());
        await route.fulfill({ json: new URL(route.request().url()).pathname === '/api/me'
          ? { id: 'qa', displayName: 'Fixture owner', isGuest: false, isRegistered: true, platformRole: 'user', permissions: [], memberships: [] } : [] });
      });
      await page.goto((process.env.ALIFE_BROWSER_BASE_URL || 'http://localhost:5176') + '/tests/fixtures/eventTranslation.html');
      const group = page.getByRole('group', { name: language === 'zh' ? '活动名称' : 'Event title', exact: true });
      await group.waitFor(); await expandTranslation(group);
      await checkEventTranslation({ page, group, language, width, root, detailSaves: writes });
      await page.getByRole('button', { name: 'Toggle read-only fixture' }).click();
      assert.equal(await group.getByRole('button').count(), 0);
      assert.ok(await group.getByLabel('English', { exact: true }).isDisabled());
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []); assert.deepEqual(writes, []);
      await page.close(); console.log('PASS isolated event translation ' + language + '/' + width);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
