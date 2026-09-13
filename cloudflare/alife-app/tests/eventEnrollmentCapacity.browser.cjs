// Real bilingual enrollment UI, fixture APIs only; no real registrations or external requests.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://localhost:5173';
const eventId = '11111111-1111-1111-1111-111111111111', groupId = '22222222-2222-2222-2222-222222222222';
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const language of ['zh', 'en']) for (const width of [320, 1280]) {
      const zh = language === 'zh'; const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(l => localStorage.setItem('alife.language', l), language);
      const errors = []; let commits = 0, groupReads = 0;
      await context.route('**/api/**', async route => {
        const request = route.request(), p = new URL(request.url()).pathname; let data = [];
        if (p === '/api/me') data = { id: 'qa', displayName: 'Volunteer', isRegistered: true, isGuest: false, memberships: [{ groupId, role: 'member', status: 'approved' }] };
        else if (p === `/api/groups/${groupId}/events`) { groupReads++; data = [{ id: eventId, groupId, titleEn: 'Full gathering', titleZh: '满额聚会', startDate: '2030-01-01T02:00:00Z', endDate: '2030-01-01T04:00:00Z', ramRequired: false, ramStatus: 'draft', registrationStatus: 'open', eventDataJson: JSON.stringify({ maxCapacity: 1, registrationDeadline: '2029-12-31T00:00:00Z' }) }]; }
        else if (p.endsWith('/enrollments/capacity')) data = { capacity: 1, confirmed: 1, waitlisted: 2, isOpen: true, overCapacity: false, canManage: false };
        else if (p.endsWith('/enrollments') && request.method() === 'POST') {
          assert.equal(request.headers()['x-enrollment-waitlist'], '1'); commits++;
          const payload = request.postDataJSON(); assert.equal(payload.status, undefined);
          data = { id: payload.id, eventId, groupId, memberId: 'qa', enrollmentJson: JSON.stringify(payload), status: 'waitlisted', waitlistPosition: 3, createdUtc: new Date().toISOString() };
        }
        return route.fulfill({ status: 200, headers: { 'Cache-Control': 'private, no-store' }, json: data });
      });
      const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
      await page.goto(`${base}/groups/${groupId}/events/${eventId}/enroll`, { waitUntil: 'domcontentloaded' });
      await page.locator('#enrollment-applicant-name').fill('Manually edited');
      await page.locator('input[type=radio][value=granted]').check(); await page.locator('input[type=checkbox]').check();
      const before = groupReads;
      await page.getByRole('button', { name: zh ? '选择语言，当前语言：中文' : 'Select language, current language: English', exact: true }).click();
      await page.getByRole('menuitemradio', { name: zh ? 'English' : '中文', exact: true }).click();
      assert.equal(await page.locator('#enrollment-applicant-name').inputValue(), 'Manually edited');
      assert.equal(await page.locator('input[type=checkbox]').isChecked(), true); assert.equal(groupReads, before);
      await page.locator('button[type=submit]').click();
      await page.getByText(zh ? /Joined the waitlist at position 3; a place is not yet confirmed/ : /已加入候补，第 3 位；尚未获得正式名额/).waitFor();
      assert.equal(commits, 1); assert.equal(await page.getByText(/Registered successfully|报名成功/, { exact: true }).count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false); assert.deepEqual(errors, []);
      console.log(`PASS enrollment ${language} ${width}: full capacity, explicit waitlist opt-in, retained language-switch draft, real status and no false success`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
