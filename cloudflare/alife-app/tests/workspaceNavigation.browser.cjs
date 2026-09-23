// Synthetic UI regression only; every API is intercepted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://127.0.0.1:5173';
const output = process.env.ALIFE_QA_OUTPUT || path.join(require('node:os').tmpdir(), 'alife-workspace-navigation');
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.ALIFE_BROWSER_EXECUTABLE ? { executablePath: process.env.ALIFE_BROWSER_EXECUTABLE } : {}) });
  try {
    for (const language of ['zh', 'en']) for (const width of [320, 1280]) {
      const zh = language === 'zh';
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      await context.addInitScript(lang => localStorage.setItem('alife.language', lang), language);
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await context.route('**/api/**', route => {
        const url = new URL(route.request().url());
        const data = url.pathname.endsWith('/capabilities') ? { passkeysEnabled: true, lineLegacyEnabled: false }
          : url.pathname === '/api/me' ? { id: 'fixture', isGuest: true, memberships: [], permissions: [] }
          : { intent: 'signIn', isPublicDevice: false, returnPath: '' };
        return route.fulfill({ json: data, headers: { 'cache-control': 'private, no-store' } });
      });
      await page.goto(base + '/tests/fixtures/workspaceNavigation.html');
      await page.getByRole('heading', { name: zh ? '示例工作页面' : 'Example workspace' }).waitFor();
      await page.getByRole('button', { name: 'Fixture actions', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Fixture action', exact: true }).click();
      assert.equal(await page.evaluate(() => document.body.dataset.fixtureAction), 'done');
      const back = page.getByRole('link', { name: zh ? '返回小组' : 'Back to group' });
      await back.focus(); assert.equal(await back.evaluate(el => el === document.activeElement), true);
      await back.click();
      await page.waitForFunction(() => document.querySelector('[aria-label="Fixture route"]')?.textContent === '/groups');
      if (width === 320) {
        const personal = page.getByRole('button', { name: zh ? '个人中心' : 'Personal Center', exact: true });
        await page.getByRole('button', { name: 'Enable guard' }).click();
        await personal.click(); assert.equal(await page.getByLabel('Fixture route').textContent(), '/groups');
        await page.getByRole('button', { name: 'Clear guard' }).click();
        await personal.click();
        await page.waitForFunction(() => document.querySelector('[aria-label="Fixture route"]')?.textContent === '/profile');
        assert.equal(await page.getByRole('dialog').count(), 0);
      } else {
        await page.getByRole('button', { name: zh ? '收起' : 'Collapse', exact: true }).click();
        await page.getByRole('button', { name: zh ? '展开' : 'Expand', exact: true }).waitFor();
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(output, 'workspace-' + language + '-' + width + '.png') });
      await page.goto(base + '/tests/fixtures/workspaceNavigation.html?mode=onboarding');
      await page.getByRole('heading', { name: zh ? '今天想从哪里开始？' : 'How can we help today?' }).waitFor();
      const enter = page.getByRole('button', { name: zh ? /进入我的 ALIFE/ : /Enter my ALIFE/ });
      await enter.click();
      await page.getByRole('button', { name: zh ? '使用 Passkey' : 'Use a passkey', exact: true }).waitFor();
      await page.getByRole('button', { name: zh ? '本地测试：跳过 Passkey' : 'Local testing: skip Passkey', exact: true }).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(output, 'onboarding-' + language + '-' + width + '.png') });
      assert.deepEqual(errors, []);
      console.log('PASS workspace/onboarding ' + language + '/' + width);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
