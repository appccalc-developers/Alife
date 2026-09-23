// Isolated API fixtures only. No real users, invitations, approvals or provider writes.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://127.0.0.1:5173';
const output = process.env.ALIFE_BROWSER_OUTPUT || require('node:os').tmpdir();
const eventId = '11111111-1111-1111-1111-111111111111', groupId = '22222222-2222-2222-2222-222222222222';
const actorId = '33333333-3333-3333-3333-333333333333', venueId = '44444444-4444-4444-4444-444444444444';
const text = (en, zh) => ({ en, zh });
const title = text('Sunday community gathering', '主日社区聚会');
const summary = { eventId, groupId, title, startUtc: '2030-10-01T01:00:00Z', endUtc: '2030-10-01T04:00:00Z', posterImageUrl: '/media/alife-message-poster.jpg', stage: 'preparation', canManage: true, roles: [] };
const rules = { purpose: text('Coordinate attendance', '协调参加人数'), audience: 'public', eligibleGroupId: null, eligibility: text('Community members and guests', '社区成员和访客'), capacity: 40, opensUtc: '2026-01-01T00:00:00Z', deadlineUtc: '2030-10-10T00:00:00Z', allowWaitlist: true, channel: 'both', terms: text('Please follow the event rules', '请遵守活动规则'), privacyNotice: text('Used to organize this event', '仅用于办理本活动'), cancellationTerms: text('Contact the registration lead', '请联系报名负责人'), manualReview: false, materials: [{ id: 'work', label: text('Work description', '作品说明'), kind: 'text', required: true, maxCount: 1, maxBytes: 100000 }], feeMinor: 0, currency: 'AUD', paymentInstructions: text('', ''), refundTerms: text('', ''), moneyFlowScope: 'unspecified' };
const person = () => ({ id: 'person', memberId: actorId, displayName: 'Fixture participant', isChild: false, guardianName: '', guardianMemberId: null, seatStatus: 'draft', procedureStatus: 'incomplete', consentMethod: '', consentedUtc: null, eligibilityVerified: false, materialsVerified: false, answersJson: '{}', paidMinor: 0, refundedMinor: 0, isLegacy: false, proxyAccessRevoked: false });
const report = () => ({ eventId, moduleCode: 'FOOD.HOSPITALITY', id: 'report', draft: text('Bring a shared lunch', '准备分享午餐'), status: 'draft', submittedRevisionId: null, adoptedRevisionId: null, eTag: 'report-v1', canEdit: true, canAdopt: false, frozen: false, revisions: [], actions: [] });
const planContext = { title, startUtc: '2030-10-01T01:00:00Z', endUtc: '2030-10-01T04:00:00Z', acceptedPlan: { planVersion: 1, acceptedUtc: '2026-09-14T00:00:00Z', humanDecisions: [], plan: { activityTypeCode: 'community', archetypeCode: 'single', proposalHash: 'fixture', moduleDecisions: [], facts: { items: [] }, roleRequirements: [], readiness: { blockers: [], warnings: [] } } }, details: { description: text('Gather for worship and lunch', '一起崇拜和午餐') }, reports: [], venues: [], weeklyVenues: [], rosterNeeds: [], registrationRules: rules, registrationRulesVersion: 1, programme: [{ title: text('Main session', '主要环节'), startUtc: '2030-10-01T01:00:00Z', endUtc: '2030-10-01T04:00:00Z', items: [{ title: text('Welcome', '欢迎'), description: text('Welcome everyone', '欢迎所有参加者'), startOffsetMinutes: 0, durationMinutes: 10 }] }] };

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let activePage;
  try {
    for (const language of ['zh', 'en']) for (const width of [320, 1280]) {
      const zh = language === 'zh', t = (en, cn) => zh ? cn : en;
      const context = await browser.newContext({ viewport: { width, height: 950 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
      await context.addInitScript(lang => localStorage.setItem('alife.language', lang), language);
      const page = await context.newPage(); activePage = page; page.setDefaultTimeout(20000);
      const errors = [], writes = []; let role = 'author', sessionActor = actorId, failSave = true, failWork = false, reportReads = 0, saved = report(), currentPerson = person(), released = false, restoreConflict = false;
      page.on('pageerror', error => errors.push(error.message));
      await context.route('**/api/**', async route => {
        const req = route.request(), p = new URL(req.url()).pathname, method = req.method(); let data = [];
        if (method !== 'GET') writes.push({ p, method });
        if (p === '/api/me') data = { id: sessionActor, displayName: 'Fixture participant', isRegistered: true, isGuest: false, memberships: [{ groupId, role: 'member', status: 'approved' }], permissions: [] };
        else if (p === '/api/events/work') data = { items: role === 'ordinary' ? [] : [summary], page: 1, hasMore: false };
        else if (p === `/api/events/${eventId}/work`) {
          if (failWork) return route.fulfill({ status: 503, json: { message: 'Fixture unavailable' } });
          if (role === 'ordinary') return route.fulfill({ status: 403, json: { message: 'No preparation access' } });
          data = { event: { ...summary, canManage: role === 'owner' }, links: [{ key: role === 'reviewer' ? 'ram' : 'report', stage: 'preparation', title: role === 'reviewer' ? text('RAM independent review', 'RAM 独立审核') : text('Food report', '餐饮报告'), url: role === 'reviewer' ? `/events/${eventId}/workspace/ram` : `/events/${eventId}/reports/FOOD.HOSPITALITY`, canEdit: role === 'author' }], plan: null, planContext, reports: [], duties: [], occurrences: [{ id: 'occ', startUtc: '2030-10-01T01:00:00Z', endUtc: '2030-10-01T04:00:00Z', stage: 'execution', status: 'scheduled' }], occurrencePage: 1, hasMoreOccurrences: false };
        } else if (p.includes('/reports/')) {
          if (method === 'GET') { reportReads++; data = { ...saved, canEdit: role === 'author', canAdopt: role === 'owner' }; }
          else {
            assert.ok(req.headers()['if-match']); assert.ok(req.headers()['idempotency-key']);
            const operation = p.split('/').pop(), body = req.postDataJSON();
            if (operation === 'save' && failSave) { failSave = false; return route.fulfill({ status: 503, json: { message: 'Retry this saved draft' } }); }
            if (operation === 'save') saved = { ...saved, draft: body.text, eTag: 'report-v2' };
            if (operation === 'submit') saved = { ...saved, status: 'submitted', eTag: 'report-v3', submittedRevisionId: 'revision-1', revisions: [{ id: 'revision-1', version: 1, text: saved.draft, authorMemberId: actorId, planVersion: 1, submittedUtc: '2026-09-14T00:00:00Z' }] };
            if (operation === 'adopt') saved = { ...saved, status: 'adopted', eTag: 'report-v4', adoptedRevisionId: 'revision-1', submittedRevisionId: null };
            saved.actions.push({ operation, reason: '', actorMemberId: actorId, createdUtc: '2026-09-14T00:00:00Z', revisionId: 'revision-1' });
            data = { ...saved, canEdit: role === 'author', canAdopt: role === 'owner' };
          }
        } else if (p === `/api/events/${eventId}/registration-work`) data = { eventId, title, groupId, policy: { version: 1, rules, eTag: 'rules-v1', feeApprovalStatus: 'notRequired' }, canConfigure: false, canManage: false, canFinance: false, canApproveFees: false, approved: true, publiclyOpen: false, confirmed: currentPerson.seatStatus === 'confirmed' ? 1 : 0, reserved: 0, waitlisted: 0, applications: [{ id: 'application', organiserMemberId: actorId, allowSplit: false, isInvitation: true, invitationMode: 'byDeadline', invitedUtc: '2026-09-14T00:00:00Z', reservationExpiresUtc: rules.deadlineUtc, eTag: 'application-v1', channel: 'app', policyVersion: 1, participants: [currentPerson], createdByMemberId: actorId, manualOrganiserName: '' }], page: 1, hasMore: false, eventStartUtc: '2030-10-10T00:00:00Z', eventEndUtc: '2030-10-10T04:00:00Z' };
        else if (p.includes('/registration-work/applications/') && method === 'POST') {
          assert.ok(req.headers()['if-match']); assert.ok(req.headers()['idempotency-key']);
          const operation = p.split('/').pop(), body = req.postDataJSON();
          if (operation === 'answers') currentPerson = { ...currentPerson, answersJson: body.answersJson };
          if (operation === 'consent') currentPerson = { ...currentPerson, consentMethod: 'selfOnline', consentedUtc: '2026-09-14T00:00:00Z' };
          if (operation === 'complete') {
            if (!currentPerson.consentedUtc) return route.fulfill({ status: 409, json: { message: 'Participant consent is required.' } });
            currentPerson = { ...currentPerson, procedureStatus: 'complete', seatStatus: 'confirmed' };
          }
          data = 'application';
        } else if (p === `/api/groups/${groupId}/venues`) data = { managingGroupId: groupId, canManage: true, venues: [{ id: venueId, managingGroupId: groupId, name: text('Main hall', '主堂'), address: text('Community centre', '社区中心'), capacity: 100, isActive: true, timeZone: 'Australia/Perth', kind: 'venue', eTag: 'venue-v1' }] };
        else if (p.endsWith('/calendar')) data = { venueId, timeZone: 'Australia/Perth', rules: [{ id: 'weekly', eventId, firstDate: '2026-09-20', lastDate: null, startMinute: 540, endMinute: 720, timeZone: 'Australia/Perth', requiredCapacity: 40, canManage: true, eTag: 'rule-v1' }], entries: [{ bookingId: 'weekly', eventId, title, startUtc: '2027-09-19T01:00:00Z', endUtc: '2027-09-19T04:00:00Z', localDate: '2027-09-19', weekly: true, released, invalidLocalTime: false, canManage: true, eTag: 'rule-v1' }], history: [{ ruleId: 'weekly', localDate: '2026-09-20', action: 'create', reason: 'Weekly Sunday worship', actorMemberId: actorId, createdUtc: '2026-09-14T00:00:00Z' }] };
        else if (p.endsWith('/exceptions')) {
          assert.ok(req.headers()['if-match']); assert.ok(req.headers()['idempotency-key']);
          if (restoreConflict) return route.fulfill({ status: 409, json: { message: 'Another event occupies this released time.' } });
          released = req.postDataJSON().released; data = 'weekly';
        }
        return route.fulfill({ status: 200, headers: { 'Cache-Control': 'private, no-store' }, json: data });
      });
      const overflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${language}/${width} page overflow`);
      const capture = async name => { await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); await page.screenshot({ path: path.join(output, name), fullPage: true }); };
      const confirm = async () => page.getByRole('alertdialog').getByRole('button', { name: t('Confirm', '确认'), exact: true }).click();
      const languageSwitch = async () => {
        await page.getByRole('button', { name: zh ? '选择语言，当前语言：中文' : 'Select language, current language: English', exact: true }).click();
        await page.getByRole('menuitemradio', { name: zh ? 'English' : '中文', exact: true }).click();
      };
      await page.goto(`${base}/event-work`);
      await page.getByRole('link', { name: t('Open workspace', '进入工作空间'), exact: true }).click();
      await page.getByRole('navigation', { name: t('Event stages', '活动阶段') }).waitFor();
      assert.equal(writes.length, 0); await overflow();
      await page.getByRole('link', { name: t('Open work', '进入处理'), exact: true }).click();
      await page.getByLabel('中文报告', { exact: true }).fill('请准备午餐，并在活动结束后清理场地。');
      await page.getByLabel('English report', { exact: true }).fill('Prepare lunch and clean the venue after the gathering.');
      await page.waitForLoadState('networkidle'); const beforeLanguage = reportReads;
      await languageSwitch();
      assert.equal(await page.getByLabel('中文报告', { exact: true }).inputValue(), '请准备午餐，并在活动结束后清理场地。');
      assert.equal(reportReads, beforeLanguage);
      await page.getByRole('button', { name: zh ? 'Select language, current language: English' : '选择语言，当前语言：中文', exact: true }).click();
      await page.getByRole('menuitemradio', { name: zh ? '中文' : 'English', exact: true }).click();
      const save = page.getByRole('button', { name: t('Save draft', '保存草稿'), exact: true });
      await save.focus(); await page.keyboard.press('Enter'); await page.getByText('Retry this saved draft', { exact: false }).waitFor();
      assert.equal(await page.getByLabel('English report', { exact: true }).inputValue(), 'Prepare lunch and clean the venue after the gathering.');
      await save.click();
      await page.getByRole('button', { name: t('Submit to owner', '提交总负责人审阅'), exact: true }).click(); await confirm();
      await page.getByText(t('Awaiting owner review', '等待总负责人审阅'), { exact: true }).waitFor();
      assert.equal(await page.getByLabel('English report', { exact: true }).isDisabled(), true);
      role = 'owner'; await page.reload();
      assert.equal(await page.getByLabel('English report', { exact: true }).count(), 0);
      await page.getByRole('button', { name: t('Adopt into plan', '采用进正式方案'), exact: true }).click(); await confirm();
      await page.getByText(t('Adopted version', '正式采用版本'), { exact: false }).waitFor(); await overflow();
      await capture(`collaboration-report-${language}-${width}.png`);
      // Reviewer has a plan context and RAM link; no authoring control is projected.
      role = 'reviewer'; await page.goto(`${base}/events/${eventId}/work?plan=1`);
      await page.getByText(t('Complete event plan (read only)', '完整活动方案（只读）'), { exact: true }).waitFor();
      await page.getByText(t('Registration steps and conditions', '报名程序与条件'), { exact: true }).waitFor();
      await page.getByText(t('Programme and sessions', '节目与环节安排'), { exact: true }).waitFor();
      await capture(`collaboration-review-context-${language}-${width}.png`);
      assert.equal(await page.getByRole('link', { name: t('Open work', '进入处理'), exact: true }).count(), 0);
      role = 'ordinary'; sessionActor = '55555555-5555-5555-5555-555555555555';
      await page.evaluate(() => window.dispatchEvent(new Event('alife-group-memberships-changed')));
      await page.getByText('No preparation access', { exact: false }).waitFor();
      assert.equal(await page.locator('[data-ram-plan-context]').count(), 0);
      role = 'author'; sessionActor = actorId; failWork = true;
      await page.evaluate(() => window.dispatchEvent(new Event('alife-group-memberships-changed')));
      await page.getByText('Fixture unavailable', { exact: false }).waitFor();
      failWork = false; await page.getByRole('button', { name: t('Retry', '重试'), exact: true }).click(); await page.getByRole('navigation', { name: t('Event stages', '活动阶段') }).waitFor();
      await page.goto(`${base}/events/${eventId}/registration-work`);
      await page.getByText(t('Household stays together', '整组同进退'), { exact: false }).waitFor();
      await page.getByLabel(t('Work description', '作品说明'), { exact: false }).fill('My submitted artwork / 我的参展作品');
      await page.getByRole('button', { name: t('Save answers', '保存文字材料'), exact: true }).click();
      await page.getByRole('button', { name: t('Complete this person’s procedures', '完成此人的报名手续'), exact: true }).click(); await confirm();
      await page.getByText('Participant consent is required.', { exact: false }).waitFor();
      await page.getByRole('button', { name: t('I personally agree to the rules and privacy notice', '我本人同意参加规则与隐私说明'), exact: true }).click(); await confirm();
      await page.getByRole('button', { name: t('Complete this person’s procedures', '完成此人的报名手续'), exact: true }).click(); await confirm();
      await page.getByText(t('Place confirmed', '名额已确认'), { exact: true }).waitFor(); await overflow();
      await capture(`collaboration-registration-${language}-${width}.png`);
      await page.goto(`${base}/groups/${groupId}/venues?venue=${venueId}&event=${eventId}`);
      await page.getByText(t('No end date', '无终止日期'), { exact: false }).waitFor();
      await page.getByLabel(t('From', '从'), { exact: true }).fill('2027-09-01');
      await page.getByLabel(t('Until (up to one year)', '至（最多一年）'), { exact: true }).fill('2027-09-30');
      await page.getByRole('button', { name: t('Release this date', '释放此日占用'), exact: true }).click();
      await page.getByLabel(t('Reason', '原因'), { exact: true }).fill('The congregation meets elsewhere on this date.');
      await page.getByRole('button', { name: t('Confirm', '确认'), exact: true }).click(); await confirm();
      await page.getByRole('button', { name: t('Restore this date', '恢复此日占用'), exact: true }).click();
      restoreConflict = true; await page.getByLabel(t('Reason', '原因'), { exact: true }).fill('Request to restore');
      await page.getByRole('button', { name: t('Confirm', '确认'), exact: true }).click(); await confirm();
      await page.getByText('Another event occupies this released time.', { exact: false }).waitFor(); await overflow();
      assert.equal(released, true);
      await capture(`collaboration-calendar-${language}-${width}.png`);
      assert.deepEqual(errors, []);
      console.log(`PASS collaboration ${language}/${width}: persistent work, role-specific report adoption, keyboard, language/draft retention, retry, review background, denied private plan, participant procedures, weekly release/restore conflict`);
      await context.close();
    }
  } catch (error) {
    if (activePage && !activePage.isClosed()) { console.error(activePage.url(), await activePage.locator('body').innerText()); await activePage.screenshot({ path: path.join(output, 'collaboration-failure.png'), fullPage: true }); }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
