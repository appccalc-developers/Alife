// Synthetic UI regression: every API is intercepted; no real user data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://localhost:5173';
const output = process.env.ALIFE_QA_OUTPUT;
const pageId = '11111111-1111-1111-1111-111111111111', groupId = '22222222-2222-2222-2222-222222222222';
const pageData = { id: pageId, ownerGroupId: groupId, createdByMemberId: 'A', title: { en: 'Draft A', zh: 'A 草稿' }, description: {}, tags: [], visibility: 'draft', sections: [{ id: 'section', type: 'RichText', order: 1, contentJson: { text: { en: 'Secret A fixture', zh: 'A 私密测试' } }, styleJson: {} }] };
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.ALIFE_BROWSER_EXECUTABLE ? { executablePath: process.env.ALIFE_BROWSER_EXECUTABLE } : {}) });
  const results = [];
  try {
    for (const mode of ['view', 'review', 'tabs', 'editor']) {
      const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 375, height: 900 } });
      await context.addInitScript(() => localStorage.setItem('alife.language', 'en'));
      const page = await context.newPage();
      let viewer = 'A', reads = 0;
      await context.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        const headers = { 'cache-control': 'private, no-store' };
        if (url.pathname === '/api/me') return route.fulfill({ json: { id: viewer, isGuest: viewer === 'guest', isRegistered: viewer !== 'guest', platformRole: 'user', permissions: [], memberships: viewer === 'guest' ? [] : [{ groupId, role: viewer === 'A' ? 'leader' : 'member', status: 'approved' }] }, headers });
        if (url.pathname === '/api/auth/logout') { viewer = 'guest'; return route.fulfill({ json: { ok: true }, headers }); }
        if (url.pathname.endsWith('/working-copy') || url.pathname.endsWith('/publication-review/copy')) {
          reads++;
          return route.fulfill(viewer === 'A' ? { json: pageData, headers } : { status: 403, json: { message: 'Denied fixture' }, headers });
        }
        return route.fulfill({ json: [], headers });
      });
      await page.goto(`${base}/tests/fixtures/pageCache.html?mode=${mode}`);
      await page.waitForFunction(() => document.querySelector('[aria-label="Viewer"]')?.textContent === 'A');
      if (mode === 'editor') {
        await page.getByRole('button', { name: 'Page title and audience', exact: true }).click();
        await page.waitForFunction(() => [...document.querySelectorAll('input')].some(input => input.value === 'Draft A'));
        await page.locator('aside').getByRole('button', { name: 'Close', exact: true }).click();
      }
      else await page.getByText('Secret A fixture', { exact: true }).waitFor();
      const initialReads = reads;
      await page.getByRole('button', { name: 'Switch language', exact: true }).click();
      if (mode !== 'editor') await page.getByText('A 私密测试', { exact: true }).waitFor();
      else {
        await page.getByRole('button', { name: '页面标题与发布对象', exact: true }).click();
        await page.waitForFunction(() => [...document.querySelectorAll('input')].some(input => input.value === 'A 草稿'));
        await page.locator('aside').getByRole('button', { name: '关闭', exact: true }).click();
      }
      await page.waitForTimeout(250);
      assert.equal(reads, initialReads, `${mode}: language-only switch must not refetch`);
      viewer = 'B'; await page.getByRole('button', { name: 'Load account', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[aria-label="Viewer"]')?.textContent === 'B');
      await page.waitForFunction(() => !document.body.textContent.includes('Secret A fixture') && !document.body.textContent.includes('A 私密测试') && ![...document.querySelectorAll('input')].some(input => input.value === 'Draft A' || input.value === 'A 草稿'));
      assert.ok(reads > initialReads, `${mode}: B must make an authorized read instead of reusing A`);
      await page.getByRole('button', { name: 'Log out', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[aria-label="Viewer"]')?.textContent === 'guest');
      assert.equal(await page.getByText('Secret A fixture', { exact: true }).count(), 0);
      results.push({ mode, viewerIsolation: 'pass', languageSwitch: 'pass', logout: 'pass' });
      console.log(`${mode}: viewer isolation, language switch and logout passed`);
      await context.close();
    }
    const deletionContext = await browser.newContext({ serviceWorkers: 'block' });
    await deletionContext.addInitScript(() => localStorage.setItem('alife.language', 'en'));
    let denyDelete = true, deleted = false;
    await deletionContext.route('**/api/**', route => {
      const url = new URL(route.request().url());
      const headers = { 'cache-control': 'private, no-store' };
      if (url.pathname === '/api/me') return route.fulfill({ json: { id: 'A', isGuest: false, isRegistered: true, memberships: [], permissions: [] }, headers });
      if (route.request().method() === 'DELETE') {
        if (denyDelete) return route.fulfill({ status: 403, json: { message: 'Denied fixture' }, headers });
        deleted = true; return route.fulfill({ json: { ok: true }, headers });
      }
      if (url.pathname.endsWith('/working-copy')) return route.fulfill(deleted ? { status: 404, json: { message: 'Deleted fixture' }, headers } : { json: pageData, headers });
      return route.fulfill({ json: [], headers });
    });
    const deletionPage = await deletionContext.newPage();
    await deletionPage.goto(`${base}/tests/fixtures/pageCache.html?mode=view`);
    await deletionPage.getByText('Secret A fixture', { exact: true }).waitFor();
    await deletionPage.getByRole('button', { name: 'Delete fixture page', exact: true }).click();
    await deletionPage.getByLabel('Status').filter({ hasText: 'delete failed' }).waitFor();
    assert.equal(await deletionPage.getByText('Secret A fixture', { exact: true }).count(), 1);
    denyDelete = false;
    await deletionPage.getByRole('button', { name: 'Delete fixture page', exact: true }).click();
    await deletionPage.getByLabel('Status').filter({ hasText: 'deleted' }).waitFor();
    await deletionPage.getByText('Secret A fixture', { exact: true }).waitFor({ state: 'hidden' });
    await deletionPage.reload();
    await deletionPage.waitForFunction(() => document.querySelector('[aria-label="Viewer"]')?.textContent === 'A');
    await deletionPage.waitForFunction(() => document.querySelector('main')?.getAttribute('aria-busy') !== 'true' && document.querySelector('main')?.textContent.trim().length > 0);
    assert.equal(await deletionPage.getByText('Secret A fixture', { exact: true }).count(), 0);
    results.push({ mode: 'delete', failedDeletePreservesData: 'pass', successfulDeleteHidesData: 'pass', reloadAfterDeletion: 'pass' });
    await deletionContext.close();
    if (output) { fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, 'page-cache-browser.json'), JSON.stringify(results, null, 2)); }
    console.log(JSON.stringify(results));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
