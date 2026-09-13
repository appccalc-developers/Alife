// Fixture-only: no real identities, backend writes, approvals, or provider calls.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const path = require('node:path');
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://127.0.0.1:5173';
const output = process.env.ALIFE_BROWSER_OUTPUT || require('node:os').tmpdir();
const text = (en, zh) => ({ en, zh });
const eventId = '11111111-1111-1111-1111-111111111111';
const tasks = () => Array.from({ length: 25 }, (_, i) => ({ id: `task-${i}`, taskKey: `event:task-${i}:v1:qa`, sourceType: 'eventTask', sourceId: `task-${i}`, sourceVersion: 'v1', eventId, groupId: 'group', occurredUtc: '2026-09-01T00:00:00Z', dueUtc: i === 0 ? '2020-01-01T00:00:00Z' : '2030-01-01T00:00:00Z', category: 'urgent', completionMode: 'workflow', actionType: 'event.task.complete', actionLabel: text(`Complete duty ${i}`, `处理事务 ${i}`), actionUrl: `/events/${eventId}/duties/eventTask/task-${i}?taskKey=${encodeURIComponent(`event:task-${i}:v1:qa`)}`, actionDataJson: JSON.stringify({ title: text(`Duty ${i}: Gathering`, `事务 ${i}：聚会`), eventTitle: text('Gathering', '聚会'), body: text('Handle this task', '请处理这项任务') }) }));
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const language of ['zh', 'en']) for (const width of [320, 1280]) {
      const zh = language === 'zh', t = (en, cn) => zh ? cn : en;
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      await context.addInitScript(lang => localStorage.setItem('alife.language', lang), language);
      const page = await context.newPage(); page.setDefaultTimeout(20000);
      const errors = [], writes = []; let current = tasks(), reads = 0, fail = false, stale = false, acted = false;
      page.on('pageerror', error => errors.push(error.message));
      await context.route('**/api/**', async route => {
        const req = route.request(), p = new URL(req.url()).pathname; let data = [];
        if (req.method() !== 'GET') writes.push(p);
        if (p === '/api/me') data = { id: 'qa', displayName: 'QA', isRegistered: true, isGuest: false, memberships: [{ groupId: 'group', role: 'member', status: 'approved' }], permissions: [] };
        else if (p === '/api/notifications/current') { reads++; if (fail) return route.fulfill({ status: 503, json: { message: 'Fixture outage' } }); data = current; }
        else if (p.includes('/duties/eventTask/')) {
          const task = current.find(task => p.endsWith(`/${task.id}`));
          if (!task || stale) return route.fulfill({ status: 409, json: { message: 'This version is no longer actionable.' } });
          data = { task, surface: 'task' };
        } else if (p.includes('/tasks/task-') && p.endsWith('/submit-completion')) {
          assert.ok(req.headers()['if-match']); assert.ok(req.headers()['idempotency-key']);
          acted = true; current = current.filter(task => !p.includes(`/${task.id}/`));
          data = { task: { id: p.split('/').at(-2), title: text('Task', '任务'), description: text('Details', '详情'), status: 'inProgress', requiresApproval: true, approvalStatus: 'pendingReview', eTag: 'v2', assignedMemberId: 'qa', dependencies: [], blockers: [] }, history: [], canSubmit: false, canWithdraw: true, canReview: false, canManage: false };
        } else if (p.includes('/tasks/task-')) data = { task: { id: p.split('/').pop(), eventId, title: text('Task', '任务'), description: text('Details', '详情'), status: 'inProgress', requiresApproval: true, approvalStatus: acted ? 'pendingReview' : 'notSubmitted', eTag: acted ? 'v2' : 'v1', assignedMemberId: 'qa', reviewerMemberId: 'reviewer', dependencies: [], blockers: [] }, history: [], canSubmit: !acted, canWithdraw: acted, canReview: false, canManage: false };
        return route.fulfill({ status: 200, headers: { 'Cache-Control': 'private, no-store' }, json: data });
      });
      await page.goto(`${base}/profile`);
      await page.waitForFunction(() => document.querySelectorAll('section[aria-labelledby="personal-tasks-heading"] a[href*="/duties/"]').length === 3);
      await page.waitForLoadState('networkidle');
      await page.waitForFunction(() => document.querySelectorAll('section[aria-labelledby="personal-tasks-heading"] a[href*="/duties/"]').length === 3);
      assert.equal(await page.locator('section[aria-labelledby="personal-tasks-heading"] a[href*="/duties/"]').count(), 3, await page.locator('body').innerText());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.goto(`${base}/tasks?type=urgent&event=${eventId}`);
      await page.getByRole('heading', { name: t('Current tasks', '当前事务'), exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelectorAll('details').length >= 20);
      assert.equal(await page.locator('details').count(), 20); assert.equal(writes.length, 0);
      await page.getByText(t('Overdue', '已逾期'), { exact: false }).first().waitFor();
      const beforeLanguage = reads;
      await page.getByRole('button', { name: zh ? '选择语言，当前语言：中文' : 'Select language, current language: English', exact: true }).click();
      await page.getByRole('menuitemradio', { name: zh ? 'English' : '中文', exact: true }).click();
      await page.getByRole('heading', { name: zh ? 'Current tasks' : '当前事务', exact: true }).waitFor(); assert.equal(reads, beforeLanguage);
      await page.getByRole('button', { name: zh ? 'Select language, current language: English' : '选择语言，当前语言：中文', exact: true }).click();
      await page.getByRole('menuitemradio', { name: language === 'zh' ? '中文' : 'English', exact: true }).click();
      await page.getByRole('button', { name: t('Next', '下一页'), exact: true }).click();
      await page.waitForFunction(() => document.querySelectorAll('details').length === 5);
      assert.equal(await page.locator('details').count(), 5);
      await page.locator('details summary').first().click();
      await page.locator('details[open] button').click();
      await page.getByRole('button', { name: t('Submit completion for review', '提交完成并送审'), exact: true }).waitFor();
      assert.equal(writes.length, 0);
      await page.getByRole('button', { name: t('Submit completion for review', '提交完成并送审'), exact: true }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: t('Confirm', '确认'), exact: true }).click();
      await page.getByText(t('This responsibility has changed or no longer needs your action', '此项事务已更新或不再需要你处理'), { exact: true }).waitFor();
      assert.equal(writes.length, 1); assert.ok(reads > beforeLanguage);
      await page.getByRole('link', { name: t('Back to current tasks', '返回当前事务'), exact: true }).click();
      assert.equal(new URL(page.url()).searchParams.get('page'), '2'); assert.equal(new URL(page.url()).searchParams.get('event'), eventId);
      await page.waitForFunction(() => document.querySelectorAll('details').length === 4);
      assert.equal(await page.locator('details').count(), 4);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(output, `alife-event-duties-${language}-${width}.png`), fullPage: true });
      stale = true; await page.goto(`${base}${tasks()[0].actionUrl}`);
      await page.getByText(t('This responsibility has changed or no longer needs your action', '此项事务已更新或不再需要你处理'), { exact: true }).waitFor();
      assert.equal(writes.length, 1);
      current = []; await page.goto(`${base}/tasks`); await page.getByText(t('There are no duty-related tasks waiting for you.', '目前没有需要你处理的职能事务。'), { exact: true }).waitFor();
      fail = true; await page.reload(); await page.getByText(t('Current tasks could not be loaded. Check your connection and try again.', '暂时无法加载当前事务。请检查网络后重试。'), { exact: true }).waitFor();
      assert.deepEqual(errors, []);
      console.log(`PASS duties ${language} ${width}: three home cards, pagination, return filters, language without refetch, read-only opening, submission handoff, stale link, empty and failure states`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
