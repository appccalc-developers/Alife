// Synthetic UI regression: no live accounts, data or writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://127.0.0.1:5173';
const output = process.env.ALIFE_QA_OUTPUT;
const menus = Array.from({ length: 10 }, (_, index) => ({
  id: `menu-${index + 1}`, name: { en: `Example ministry ${index + 1}`, zh: `示例事工 ${index + 1}` },
  sortOrder: index, approvedPageCount: 0, homePlacement: null,
}));

(async () => {
  if (output) fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ignoreDefaultArgs: ['--hide-scrollbars'], ...(process.env.ALIFE_BROWSER_EXECUTABLE ? { executablePath: process.env.ALIFE_BROWSER_EXECUTABLE } : {}) });
  try {
    for (const language of ['zh', 'en']) for (const viewport of [{ width: 1280, height: 800 }, { width: 1280, height: 300 }, { width: 320, height: 640 }]) {
      const zh = language === 'zh', mobile = viewport.width < 1024;
      const context = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce' });
      await context.addInitScript(lang => localStorage.setItem('alife.language', lang), language);
      const page = await context.newPage(), errors = [], writes = [];
      page.on('pageerror', error => errors.push(error.message));
      await context.route('**/api/**', route => {
        const request = route.request(), url = new URL(request.url());
        if (request.method() !== 'GET') writes.push({ path: url.pathname, body: request.postDataJSON() });
        const data = url.pathname === '/api/me' ? { id: 'fixture-reviewer', isGuest: false, isRegistered: true, platformRole: 'page_reviewer', memberships: [], permissions: [] }
          : url.pathname.endsWith('/page-primary-menus') ? menus : [];
        return route.fulfill({ json: data, headers: { 'cache-control': 'private, no-store' } });
      });
      await page.goto(base + '/tests/fixtures/scrollableMenus.html');
      const trigger = page.getByRole('button', { name: zh ? '小组生活' : 'Groups', exact: true });
      if (mobile) {
        await page.getByRole('button', { name: 'Menu', exact: true }).click();
        await trigger.click();
      } else await trigger.hover();
      const scroll = mobile ? page.locator('header > .alife-scrollbar') : page.locator('header nav .alife-scrollbar');
      await scroll.waitFor({ state: 'visible' });
      const box = await scroll.boundingBox();
      assert.ok(box && box.y >= 0 && box.y + box.height <= viewport.height + 1, 'menu stays inside the viewport');
      assert.equal(await scroll.evaluate(el => el.scrollHeight > el.clientHeight), true);
      assert.equal(await scroll.evaluate(el => el.offsetWidth - el.clientWidth), 8, 'vertical scrollbar is visible and compact');
      await scroll.hover(); await page.mouse.wheel(0, 650);
      await page.waitForFunction(el => el.scrollTop > 0, await scroll.elementHandle());
      if (!mobile) {
        await trigger.focus();
        for (let index = 0; index < 30; index++) await page.keyboard.press('Tab');
      }
      const last = page.getByRole('link', { name: zh ? '示例小组 30' : 'Example group 30', exact: true });
      if (mobile) await last.focus();
      assert.equal(await last.evaluate(el => el === document.activeElement), true);
      assert.ok(await last.evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
      if (output) await page.screenshot({ path: path.join(output, `menu-${language}-${viewport.width}x${viewport.height}.png`) });
      await last.click();
      await page.waitForFunction(() => document.querySelector('[aria-label="Fixture route"]')?.textContent === '/fixture/page-30');
      assert.equal(await page.getByLabel('Fixture route').textContent(), '/fixture/page-30');
      if (mobile) assert.equal(await page.getByRole('button', { name: 'Menu', exact: true }).getAttribute('aria-expanded'), 'false');

      if (viewport.height > 300) {
        await page.goto(base + '/tests/fixtures/scrollableMenus.html?mode=review');
        const tabs = page.getByRole('tablist', { name: zh ? '一级菜单' : 'Primary menu', exact: true });
        await tabs.waitFor();
        assert.equal(await tabs.evaluate(el => el.scrollWidth > el.clientWidth), true);
        assert.ok(await tabs.evaluate(el => { const style = getComputedStyle(el, '::-webkit-scrollbar'); return parseFloat(style.height) <= 8; }));
        assert.equal(await tabs.evaluate(el => el.offsetHeight - el.clientHeight - parseFloat(getComputedStyle(el).borderBottomWidth)), 8, 'horizontal scrollbar is visible and compact');
        const lastTab = tabs.getByRole('tab').last();
        await lastTab.focus(); await lastTab.click();
        assert.equal(await lastTab.getAttribute('aria-selected'), 'true');
        assert.ok(await tabs.evaluate(el => el.scrollLeft > 0));
        await tabs.getByRole('button', { name: zh ? /^修改一级菜单:/ : /^Edit primary menu:/ }).last().click();
        await page.locator('#primary-menu-name-en').waitFor();
        if (!mobile) {
          await tabs.evaluate(el => { el.scrollLeft = 0; });
          const handles = tabs.locator('[draggable="true"]');
          await handles.first().dragTo(handles.nth(1));
          await page.waitForFunction(() => document.querySelector('[role="tablist"].alife-scrollbar [role="tab"]')?.textContent.includes('2'));
          const layout = writes.find(write => write.path.endsWith('/page-primary-menus/layout'));
          assert.ok(layout, 'dragging still saves menu order');
          assert.equal(layout.body.menus[0].primaryMenuId, 'menu-2');
          assert.equal(layout.body.menus[1].primaryMenuId, 'menu-1');
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        if (output) await page.screenshot({ path: path.join(output, `review-${language}-${viewport.width}.png`) });
      }
      assert.deepEqual(errors, []);
      console.log(`PASS long menus/review ${language} ${viewport.width}x${viewport.height}`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
