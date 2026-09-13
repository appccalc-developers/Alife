// Two isolated browser actors exercise the real UI against shared in-memory API fixtures.
// No real member notifications, database writes or provider requests are made.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const path = require('node:path');
const os = require('node:os');
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://localhost:5173';
const eventId = '11111111-1111-1111-1111-111111111111', groupId = '22222222-2222-2222-2222-222222222222';
const owner = '33333333-3333-3333-3333-333333333333', member = '44444444-4444-4444-4444-444444444444';
const text = (en, zh) => ({ en, zh });
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const language of ['zh', 'en']) for (const width of [320, 1280]) {
      const zh = language === 'zh', t = (en, cn) => zh ? cn : en;
      const errors = [], notices = [], batches = [], reads = [];
      let conflict = true, groupVersion = 1;
      const occurrences = Array.from({ length: 6 }, (_, i) => {
        const start = new Date(); start.setUTCDate(start.getUTCDate() + 2 + i * 7); start.setUTCHours(2, 0, 0, 0);
        return { id: `date-${i}`, eventId, startUtc: start.toISOString(), endUtc: new Date(+start + 3600000).toISOString(), localDate: start.toISOString().slice(0, 10), status: 'planned', version: 1, assignments: [] };
      });
      const workspacePath = `/groups/${groupId}/events/${eventId}/workspace`;
      const roster = (date, actor) => ({ eventId, occurrenceId: date.id, eTag: `date-v${date.version}`, canManage: actor === owner, canConfigure: false, readinessBlockers: [], slots: [{
        id: `slot-${date.id}`, occurrenceId: date.id, roleCode: 'welcome', roleLabel: text('Welcome', '接待'), moduleCode: 'SERVICE.ROSTER', requiredCount: 1,
        startUtc: date.startUtc, endUtc: date.endUtc, eligibilityCode: 'approvedGroupMember', confirmedCount: date.assignments.filter(x => x.status === 'confirmed').length,
        candidateMemberIds: actor === owner ? [member] : [], assignments: actor === owner ? date.assignments : date.assignments.filter(x => x.memberId === actor), isRosterCandidate: actor === member, canAssign: true,
      }] });
      const actorContext = async actor => {
        const context = await browser.newContext({ viewport: { width, height: 950 } });
        await context.addInitScript(language => localStorage.setItem('alife.language', language), language);
        await context.route('**/api/**', async route => {
          const request = route.request(), url = new URL(request.url()), p = url.pathname;
          reads.push(`${actor}:${p}`); let data = [];
          if (p === '/api/me') data = { id: actor, displayName: actor === owner ? 'Coordinator' : 'Volunteer', isRegistered: true, isGuest: false, memberships: [{ groupId, role: actor === owner ? 'leader' : 'member', status: 'approved' }] };
          else if (p === '/api/groups/visible') data = [{ id: groupId, name: text('Test group', '测试小组'), isChurch: true, accessType: 'public' }];
          else if (p.endsWith('/workspace')) data = { eventId, owningGroupId: groupId, title: text('Weekly gathering', '每周聚会'), canManage: false, sponsorshipStatus: 'none', eTag: 'plan', readiness: { status: 'notReady' }, nextSteps: [], items: [{ surfaceKey: 'workspace.overview', presentation: 'tab', sectionKey: 'overview', label: text('Overview', '总览'), order: 0, blockers: [] }, { surfaceKey: 'service.roster', presentation: 'page', pathSegment: 'roster', moduleCode: 'SERVICE.ROSTER', label: text('Service roster', '服事排班'), order: 1, readiness: 'notReady', blockers: [] }] };
          else if (p.endsWith('/roster/page')) {
            const page = Number(url.searchParams.get('page') || 1);
            data = { page, pageSize: 4, total: 6, timeZone: 'Australia/Perth', canManage: actor === owner, canConfigure: false, isRecurring: true, defaultsVersion: 1, defaultsETag: 'defaults-1',
              groups: actor === owner ? [{ roleCode: 'welcome', moduleCode: 'SERVICE.ROSTER', memberIds: [member], eTag: `group-${groupVersion}` }] : [],
              people: [{ id: member, displayName: 'Volunteer' }], occurrences: occurrences.slice((page - 1) * 4, page * 4).map(date => ({ ...date, roster: roster(date, actor) })) };
          }
          else if (p.endsWith('/roster/batch')) {
            assert.equal(actor, owner); const body = request.postDataJSON(); assert.ok(request.headers()['idempotency-key']); batches.push(body);
            if (conflict) { conflict = false; groupVersion++; return route.fulfill({ status: 412, json: { message: 'Candidate group changed. No assignments saved.' } }); }
            assert.ok(body.changes.length >= 2);
            for (const change of body.changes) {
              assert.equal(change.candidateGroupETag, `group-${groupVersion}`); assert.equal(change.memberId, member);
              const date = occurrences.find(x => x.id === change.occurrenceId); assert.equal(change.occurrenceETag, `date-v${date.version}`);
              date.assignments.push({ id: `assignment-${date.id}`, serviceSlotId: change.slotId, memberId: member, status: 'invited' }); date.version++;
              notices.push({ id: `invite-${date.id}`, recipient: member, actionType: 'event.roster.invited', title: text('Roster invitation', '排班邀请'), actionUrl: `${workspacePath}/roster?occurrenceId=${date.id}`, body: text('Please confirm your position.', '请确认你的岗位。') });
            }
            data = body.changes.map(change => roster(occurrences.find(x => x.id === change.occurrenceId), actor));
          }
          else if (/\/roster\/assignments\/.+\/(confirm|decline)$/.test(p)) {
            assert.equal(actor, member); const id = p.split('/').at(-2), accept = p.endsWith('/confirm');
            const date = occurrences.find(x => x.assignments.some(a => a.id === id)); const assignment = date.assignments.find(x => x.id === id);
            assert.equal(assignment.status, 'invited'); assignment.status = accept ? 'confirmed' : 'declined'; date.version++;
            notices.push({ id: `result-${id}`, recipient: owner, actionType: `event.roster.${assignment.status}`, title: text('Roster response', '排班回应'), body: text(accept ? 'Accepted' : 'Declined', accept ? '已接受' : '已拒绝'), actionUrl: `${workspacePath}/roster` });
            data = roster(date, actor);
          }
          else if (p.endsWith('/occurrences')) data = occurrences;
          else if (/\/occurrences\/[^/]+\/roster$/.test(p)) data = roster(occurrences.find(x => x.id === p.split('/').at(-2)), actor);
          else if (p.endsWith('/roster/groups')) data = [{ roleCode: 'welcome', moduleCode: 'SERVICE.ROSTER', memberIds: [member], eTag: `group-${groupVersion}` }];
          else if (p.endsWith('/team')) data = { eventId, members: [], roleRequirements: [], roleAssignments: [], tasks: [], canManage: false };
          else if (p.endsWith('/programme')) data = { sessions: [] };
          else if (p === '/api/notifications/current') data = notices.filter(x => x.recipient === actor).map(x => ({ ...x, category: 'general', completionMode: 'read', occurredUtc: new Date().toISOString() }));
          await route.fulfill({ status: 200, headers: { 'Cache-Control': 'private, no-store' }, json: data });
        });
        const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
        return { context, page };
      };
      const leader = await actorContext(owner), volunteer = await actorContext(member);
      const page = leader.page;
      await page.goto(`${base}${workspacePath}/roster`, { waitUntil: 'domcontentloaded' });
      const candidates = () => page.locator('select:visible').filter({ has: page.locator(`option[value="${member}"]`) });
      await candidates().first().waitFor(); assert.equal(await candidates().count(), 4);
      await candidates().nth(0).selectOption(member); await candidates().nth(1).selectOption(member);
      assert.equal(batches.length, 0); assert.equal(notices.length, 0);
      const pageReads = reads.filter(x => x.endsWith('/roster/page')).length;
      await page.getByRole('button', { name: t('Select language, current language: English', '选择语言，当前语言：中文'), exact: true }).click();
      await page.getByRole('menuitemradio', { name: zh ? 'English' : '中文', exact: true }).click();
      await page.getByRole('button', { name: zh ? 'Select language, current language: English' : '选择语言，当前语言：中文', exact: true }).click();
      await page.getByRole('menuitemradio', { name: zh ? '中文' : 'English', exact: true }).click();
      assert.equal(reads.filter(x => x.endsWith('/roster/page')).length, pageReads); assert.equal(await candidates().first().inputValue(), member);
      const send = async () => { await page.getByRole('button', { name: t('Send roster invitations', '发出排班邀请'), exact: true }).click(); await page.getByRole('alertdialog').getByRole('button', { name: t('Confirm and send', '确认并发出'), exact: true }).click(); };
      await send(); await page.getByRole('alert').filter({ hasText: 'Candidate group changed' }).waitFor();
      assert.equal(notices.length, 0); assert.equal(await candidates().first().inputValue(), member);
      await page.getByRole('button', { name: t('Refresh state', '刷新状态'), exact: true }).click();
      await candidates().first().waitFor();
      // A deliberate re-selection is required to review and use the new candidate-group version.
      for (const i of [0, 1]) { await candidates().nth(i).selectOption(''); await candidates().nth(i).selectOption(member); }
      await send(); await page.getByText(t('Assignments saved and in-app notifications sent.', '排班已保存，站内通知已发出。'), { exact: true }).waitFor();
      assert.equal(notices.filter(x => x.recipient === member).length, 2);
      await volunteer.page.goto(`${base}/profile`, { waitUntil: 'domcontentloaded' });
      const invitation = volunteer.page.getByRole('link').filter({ hasText: t('Roster invitation', '排班邀请') }).first();
      await invitation.waitFor(); await invitation.click();
      if (new URL(volunteer.page.url()).pathname === '/tasks') {
        const notice = volunteer.page.locator('details').filter({ hasText: t('Roster invitation', '排班邀请') }).first();
        await notice.locator('summary').click(); await notice.getByRole('button').click();
      }
      try { await volunteer.page.getByRole('button', { name: t('Accept', '接受排班'), exact: true }).filter({ visible: true }).first().click(); }
      catch (e) { console.error(volunteer.page.url(), (await volunteer.page.locator('body').innerText()).slice(-7000), errors, reads.slice(-20)); throw e; }
      await volunteer.page.getByRole('button', { name: t('Decline', '拒绝'), exact: true }).filter({ visible: true }).first().click();
      assert.equal(notices.filter(x => x.recipient === owner).length, 2);
      await page.reload({ waitUntil: 'domcontentloaded' }); await candidates().first().waitFor();
      await page.getByText(t('Personally confirmed 1/1', '本人已确认 1/1'), { exact: true }).filter({ visible: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: t('Accept', '接受排班'), exact: true }).count(), 0);
      await page.getByRole('button', { name: t('Next', '下一页'), exact: true }).first().click();
      await page.getByText(t('Page 2', '第 2 页'), { exact: true }).waitFor();
      await page.waitForFunction(id => Array.from(document.querySelectorAll('select')).filter(s => s.getClientRects().length && s.querySelector(`option[value="${id}"]`)).length === 2, member);
      assert.equal(await candidates().count(), 2);
      for (const current of [page, volunteer.page]) { assert.equal(await current.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false); }
      await page.screenshot({ path: path.join(os.tmpdir(), `alife-roster-batch-${language}-${width}.png`), fullPage: true });
      assert.deepEqual(errors, []);
      console.log(`PASS roster ${language} ${width}: two actors, retained multilingual draft, conflict rollback, batch invitations, notification link, self accept/decline, coordinator results and pagination`);
      await leader.context.close(); await volunteer.context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
