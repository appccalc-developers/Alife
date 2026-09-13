// Isolated API fixtures: checks the actual overview and direct-entry UI without writes.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://localhost:5173';
const eventId = '11111111-1111-1111-1111-111111111111', groupId = '22222222-2222-2222-2222-222222222222';
const text = (en, zh) => ({ en, zh });
const items = [
  { surfaceKey: 'workspace.overview', presentation: 'tab', sectionKey: 'overview', label: text('Overview', '总览') },
  { surfaceKey: 'money.finance', moduleCode: 'MONEY.FINANCE', presentation: 'page', pathSegment: 'finance', label: text('Finance', '财务') },
  { surfaceKey: 'food.hospitality', moduleCode: 'FOOD.HOSPITALITY', presentation: 'tab', sectionKey: 'hospitality', label: text('Catering', '餐饮') },
  { surfaceKey: 'festival.operations', moduleCode: 'FESTIVAL.OPERATIONS', presentation: 'page', pathSegment: 'operations', label: text('Operations', '现场运营') },
  { surfaceKey: 'comms.followup', moduleCode: 'COMMS.FOLLOWUP', presentation: 'page', pathSegment: 'follow-up', label: text('Follow-up', '宣传与跟进') },
].map((item, order) => ({ ...item, order, readiness: 'ready', blockers: [] }));
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const language of ['zh', 'en']) for (const width of [320, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(value => localStorage.setItem('alife.language', value), language);
      const errors = [], mutations = [];
      await context.route('**/api/**', async route => {
        const request = route.request(), p = new URL(request.url()).pathname;
        if (!['GET', 'HEAD'].includes(request.method())) mutations.push(p);
        let data = [];
        if (p === '/api/me') data = { id: 'qa', displayName: 'Member', isRegistered: true, isGuest: false, memberships: [{ groupId, role: 'member', status: 'approved' }] };
        else if (p === '/api/groups/visible') data = [{ id: groupId, name: text('Group', '小组'), isChurch: true, accessType: 'public' }];
        else if (p.endsWith('/workspace')) data = { eventId, owningGroupId: groupId, title: text('Event', '活动'), canManage: false, sponsorshipStatus: 'none', readiness: { status: 'ready' }, nextSteps: [], items };
        // An empty catalogue must retain the known unavailable/partial fallback.
        await route.fulfill({ json: data });
      });
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      const workspace = `${base}/groups/${groupId}/events/${eventId}/workspace`;
      await page.goto(workspace, { waitUntil: 'domcontentloaded' });
      await page.locator('[data-capability-status="unavailable"]').nth(2).waitFor();
      assert.equal(await page.locator('[data-capability-status="unavailable"]').count(), 3);
      assert.equal(await page.locator('[data-capability-status="partial"]').count(), 1);
      for (const item of items.slice(1)) {
        await page.goto(`${workspace}${item.pathSegment ? `/${item.pathSegment}` : `?tab=${item.sectionKey}`}`, { waitUntil: 'domcontentloaded' });
        const partial = item.moduleCode === 'COMMS.FOLLOWUP';
        await page.locator(`[data-capability-status="${partial ? 'partial' : 'unavailable'}"]`).waitFor();
        assert.ok(!(await page.locator('body').innerText()).match(/目前没有阻塞项|No blockers currently/));
        if (partial) {
          assert.equal(await page.locator('a[href*="stage=poster"]').count(), 1);
          assert.equal(await page.locator('a[href*="stage=publish"]').count(), 1);
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
      }
      assert.deepEqual(mutations, []); assert.deepEqual(errors, []);
      console.log(`PASS availability ${language} ${width}: overview, four direct entries, empty-catalogue fallback, available communications links, no false completion or writes`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
