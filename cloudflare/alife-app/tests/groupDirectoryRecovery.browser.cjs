// Local regression only: every API is mocked, no production mutations.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ALIFE_TEST_ORIGIN || 'http://127.0.0.1:4179';
const missing = '41693332-fb4e-4226-8a33-62c96506c082';
const live = '22222222-2222-2222-2222-222222222222';
const church = '11111111-1111-1111-1111-111111111111';
const group = { id: live, name: { en: 'Media Ministry', zh: '媒体事工' }, isChurch: false, isClosed: false, groupType: 'ministry', accessType: 'protected', parentGroupId: church };
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [status, selected] of [[404, missing], [404, live], [403, missing], [500, missing], [0, missing]]) {
      const context = await browser.newContext({ viewport: { width: 320, height: 800 }, serviceWorkers: 'block' });
      const page = await context.newPage();
      await page.clock.install();
      let directory = [group];
      const calls = []; const errors = [];
      let notifyProfileRefresh;
      const profileRefreshed = new Promise(resolve => { notifyProfileRefresh = resolve; });
      page.on('pageerror', error => errors.push(error.message));
      await context.addInitScript(({ selected }) => {
        localStorage.setItem('alife.language', 'zh');
        localStorage.setItem('alife-active-group-id:qa', selected);
        localStorage.setItem('alife-active-page-id:qa', 'old-page');
        localStorage.setItem('alife-active-event-id:qa', 'old-event');
      }, { selected });
      await context.route('**/api/**', async route => {
        const request = route.request(); const path = new URL(request.url()).pathname;
        calls.push({ path, etag: request.headers()['if-none-match'] });
        if (path === '/api/me' && calls.filter(c => c.path === '/api/me').length >= 2) notifyProfileRefresh();
        if (path === `/api/groups/${missing}`) {
          if (!status) return route.abort('failed');
          return route.fulfill({ status, json: { message: 'Unavailable' } });
        }
        let data = [];
        if (path === '/api/me') data = { id: 'qa', displayName: 'QA', isGuest: false, isRegistered: true, memberships: [{ groupId: missing, status: 'approved', role: 'member' }, { groupId: live, status: 'approved', role: 'member' }] };
        if (path === '/api/groups/visible') data = directory;
        if (path === '/api/groups/church') data = { ...group, id: church, isChurch: true };
        if (path === `/api/groups/${live}`) data = group;
        await route.fulfill({ status: 200, json: data, headers: { ETag: 'W/"fresh"' } });
      });
      // Seed the old persistent directory before mounting the application.
      await context.route('**/__cache-seed', route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
      await page.goto(`${base}/__cache-seed`);
      await page.evaluate(async ({ missing }) => {
        await new Promise((resolve, reject) => {
          const request = indexedDB.open('alife-cache-db');
          request.onupgradeneeded = () => request.result.createObjectStore('http-cache');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result, tx = db.transaction('http-cache', 'readwrite');
            for (const key of [['visibleGroups'], ['visibleGroups', 'viewer', 'qa']]) tx.objectStore('http-cache').put({ etag: 'W/"old"', data: [{ id: missing }], storedAt: Date.now() }, JSON.stringify(key));
            tx.oncomplete = () => { db.close(); resolve(); };
          };
        });
      }, { missing });
      await page.goto(`${base}/groups/${missing}?view=overview`);
      await page.getByText(status === 404 ? '小组不存在或已解散' : '无法加载小组', { exact: true }).waitFor();
      const detailCalls = calls.filter(c => c.path === `/api/groups/${missing}`).length;
      if (status === 404) {
        assert.equal(detailCalls, 1, 'concurrent consumers must share a single missing-group read');
        assert.equal(await page.evaluate(() => localStorage.getItem('alife-active-group-id:qa')), selected === missing ? null : selected);
        assert.equal(await page.evaluate(() => localStorage.getItem('alife-active-page-id:qa')), selected === missing ? null : 'old-page');
        assert.equal(await page.evaluate(() => localStorage.getItem('alife-active-event-id:qa')), selected === missing ? null : 'old-event');
        await Promise.race([profileRefreshed, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Profile refresh missing: ' + JSON.stringify(calls))), 5000); timer.unref(); })]);
        assert.ok(calls.filter(c => c.path === '/api/me').length >= 2, 'refresh memberships');
        await page.setViewportSize({ width: 320, height: 800 });
        await page.waitForFunction(() => document.documentElement.scrollWidth <= window.innerWidth);
        await page.screenshot({ path: require('node:path').join(require('node:os').tmpdir(), 'alife-missing-group.png') });
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.getByRole('button', { name: '返回小组生活', exact: true }).click();
        await page.getByRole('tab', { name: '事工组', exact: true }).click();
        await page.getByRole('button', { name: /媒体事工/ }).waitFor();
        const readsBeforeLanguage = calls.filter(c => c.path === '/api/groups/visible').length;
        await page.getByRole('button', { name: /选择语言，当前语言/ }).click();
        await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
        await page.getByRole('tab', { name: 'Ministries', exact: true }).waitFor();
        assert.equal(calls.filter(c => c.path === '/api/groups/visible').length, readsBeforeLanguage, 'language switch must not refetch directory');
        await page.screenshot({ path: require('node:path').join(require('node:os').tmpdir(), 'alife-directory-recovery.png') });
        assert.ok(calls.filter(c => c.path === '/api/groups/visible').every(c => c.etag !== 'W/"old"'));
        const oldKeys = await page.evaluate(async () => new Promise(resolve => {
          const r = indexedDB.open('alife-cache-db'); r.onsuccess = () => {
            const db = r.result, tx = db.transaction('http-cache'); const q = tx.objectStore('http-cache').getAllKeys();
            q.onsuccess = () => { resolve(q.result); db.close(); };
          };
        }));
        assert.ok(!oldKeys.includes(JSON.stringify(['visibleGroups', 'viewer', 'qa'])));
        assert.ok(!oldKeys.includes(JSON.stringify(['visibleGroups'])));
        directory = [];
        await page.clock.fastForward(31_000);
        await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
        await page.getByText('No matching groups', { exact: true }).waitFor();
        assert.equal(await page.getByRole('link', { name: 'Media Ministry', exact: true }).count(), 0, 'sidebar follows the refreshed directory');
        directory = [group];
        await page.clock.fastForward(31_000);
        await page.evaluate(() => { window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('online')); });
        await page.getByRole('button', { name: /Media Ministry/ }).waitFor();
      } else {
        assert.equal(await page.evaluate(() => localStorage.getItem('alife-active-group-id:qa')), missing, 'non-404 errors retain selection');
      }
      assert.equal(calls.filter(c => c.path.startsWith(`/api/groups/${missing}/`)).length, 0, 'do not fetch missing or unverified group subresources');
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS directory recovery HTTP ${status || 'offline'}, selected ${selected === missing ? 'missing' : 'other group'}`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
