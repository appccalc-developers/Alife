// Local UI regression: all API calls are mocked; no real group is deleted.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 320, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const id = 'e1111111-1111-1111-1111-111111111111';
  const parent = 'e2222222-2222-2222-2222-222222222222';
  const group = { id, name: { en: 'Empty group', zh: '空小组' }, description: { en: '', zh: '' }, parentGroupId: parent,
    groupType: 'fellowship', isChurch: false, isClosed: false, accessType: 'protected', createdUtc: '2026-01-01', updatedUtc: '2026-01-01' };
  let role = 'leader', removed = false, failCheck = true, failDelete = false, blockers = [], delay = 0, posts = 0, checks = 0;
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await context.addInitScript(() => { if (!localStorage.getItem('alife.language')) localStorage.setItem('alife.language', 'zh'); });
  await context.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    let data = [];
    if (pathname === '/api/me') data = { id: 'qa', displayName: 'QA Leader', isRegistered: true, isGuest: false, isAdmin: true,
      platformRole: 'superadmin', memberships: removed ? [] : [{ groupId: id, status: 'approved', role }] };
    else if (pathname === `/api/groups/${id}`) data = group;
    else if (pathname === '/api/groups/visible') data = removed ? [] : [group];
    else if (pathname === '/api/groups/church') data = { ...group, id: parent, isChurch: true };
    else if (pathname.endsWith('/memberships')) data = [{ memberId: 'qa', displayName: 'QA Leader', role, status: 'approved' }];
    else if (pathname.endsWith('/dissolution')) {
      checks++;
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      if (failCheck) return route.fulfill({ status: 503, json: { message: 'Unavailable' } });
      data = { canDissolve: blockers.length === 0, blockers };
    } else if (pathname.endsWith('/dissolve')) {
      posts++;
      await new Promise(resolve => setTimeout(resolve, 200));
      if (failDelete) return route.fulfill({ status: 409, json: { message: 'Group changed' } });
      removed = true;
      data = { ok: true, groupId: id, parentGroupId: parent };
    }
    await route.fulfill({ status: 200, json: data });
  });
  const target = `http://localhost:5173/groups/${id}?section=group`;
  try {
    await page.goto(target);
    const panel = page.getByRole('region', { name: '解散小组', exact: true });
    await panel.getByRole('alert').waitFor();
    assert.equal(await panel.getByRole('button', { name: '解散小组', exact: true }).isEnabled(), false);
    failCheck = false; delay = 500;
    await panel.getByRole('button', { name: '重新检查' }).click();
    await panel.getByRole('status').waitFor();
    await page.waitForFunction(() => !document.body.textContent.includes('正在检查解散条件'));
    delay = 0;
    for (const lang of ['zh', 'en']) {
      await page.evaluate(value => localStorage.setItem('alife.language', value), lang);
      for (const width of [320, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 }); await page.reload();
        const action = page.getByRole('region', { name: lang === 'zh' ? '解散小组' : 'Dissolve group', exact: true });
        const button = action.getByRole('button', { name: lang === 'zh' ? '解散小组' : 'Dissolve group', exact: true });
        await button.waitFor(); await page.waitForFunction(() => !document.body.textContent.includes('Checking dissolution requirements') && !document.body.textContent.includes('正在检查解散条件'));
        assert.equal(await button.isEnabled(), true);
        await button.focus(); await page.keyboard.press('Enter');
        const dialog = page.getByRole('alertdialog'); await dialog.waitFor();
        await page.waitForFunction(() => document.querySelector('[role=alertdialog]')?.contains(document.activeElement));
        await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
        assert.equal(posts, 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        await action.screenshot({ path: path.join(os.tmpdir(), `alife-dissolution-${lang}-${width}.png`) });
      }
    }
    await page.evaluate(() => localStorage.setItem('alife.language', 'zh')); await page.reload();
    blockers = ['members', 'subgroups', 'pages', 'events', 'albums', 'announcements', 'relatedRecords'];
    await panel.getByRole('button', { name: '重新检查' }).click();
    await panel.getByText('还有页面（包括草稿）。', { exact: true }).waitFor();
    assert.equal(await panel.getByRole('button', { name: '解散小组', exact: true }).isEnabled(), false);
    blockers = []; await panel.getByRole('button', { name: '重新检查' }).click();
    await page.waitForFunction(() => !document.body.textContent.includes('正在检查解散条件'));
    failDelete = true;
    await panel.getByRole('button', { name: '解散小组', exact: true }).click();
    await page.getByRole('button', { name: '确认解散小组', exact: true }).click();
    await panel.getByRole('alert').waitFor(); assert.equal(posts, 1);
    assert.equal(await panel.getByRole('button', { name: '解散小组', exact: true }).isEnabled(), false);
    failDelete = false; await panel.getByRole('button', { name: '重新检查' }).click();
    await page.waitForFunction(() => !document.body.textContent.includes('正在检查解散条件'));
    await panel.getByRole('button', { name: '解散小组', exact: true }).click();
    await page.getByRole('button', { name: '确认解散小组', exact: true }).click();
    await page.waitForURL('http://localhost:5173/groups'); assert.equal(posts, 2);
    removed = false; role = 'coLeader'; const previousChecks = checks;
    await page.goto(target); await page.getByRole('heading', { name: '空小组', exact: true }).waitFor();
    assert.equal(await page.getByRole('region', { name: '解散小组', exact: true }).count(), 0);
    assert.equal(checks, previousChecks);
    assert.deepEqual(errors, []);
    console.log('Passed: bilingual 320/768/1280 layouts, loading/retry, blockers, modal keyboard/cancel, final conflict, explicit submission, navigation and non-leader visibility. All APIs mocked.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
