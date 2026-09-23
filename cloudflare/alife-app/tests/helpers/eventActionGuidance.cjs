const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

exports.checkActionGuidance = async ({ page, context, base, language, width, item, lifecycle, errors }) => {
  const zh = language === 'zh', t = (en, cn) => zh ? cn : en;
  const out = 'C:/Data/Alife/Temp/event-action-guidance-20260922';
  fs.mkdirSync(out, { recursive: true });
  const url = `${base}/groups/qa-group/events/qa-event/workspace?flow=setup&stage=approval`;
  const pack = item();
  pack.manifest.modules = [{ moduleCode: 'SAFETY.RAM', blockers: [{ en: 'Confirm the on-site leader.', zh: '请确认现场负责人。' }] }];
  pack.manifest.sections = [{ code: 'safety', title: { en: 'Safety', zh: '安全' }, status: 'attentionRequired', items: [], moduleCodes: ['SAFETY.RAM'], blockers: [{ en: 'Confirm the on-site leader.', zh: '请确认现场负责人。' }] }];
  let canDelegate = true, canDecide = false, memberError = false, writes = [], membershipReads = 0;
  const delegations = [{ id: 'other-delegation', scopeType: 'event', scopeId: 'other-event', delegatedToMemberId: 'external-id', expiresUtc: '2099-01-01T00:00:00Z' }];
  const gates = ['publish', 'registration'].map(gate => ({ gate, enforcementMode: 'dryRun', scopeType: 'event', allowed: true, requirementsSatisfied: false, eventPackageVersion: 1, governancePolicyVersion: 'fixture-policy', warnings: [], blockers: [
    ...['packageNotApproved', 'approvalDecisionMissing'].map(code => ({ code: `event.${gate}.${code}`, message: { en: 'Approval decision missing.', zh: '缺少审批决定。' }, responsibleRole: 'package.approver', nextAction: 'event.package.decide' })),
    { code: `event.${gate}.readinessBlocked`, message: { en: 'Readiness incomplete.', zh: '筹备未完成。' }, responsibleRole: 'event.team', nextAction: 'event.readiness.review' },
  ] }));
  await context.route('**/api/**', async route => {
    const req = route.request(), p = new URL(req.url()).pathname;
    // Composition preview uses POST but is a read-only calculation, not a save.
    if (req.method() !== 'GET' && !p.endsWith('/compose') && !p.endsWith('/plan/recompose')) writes.push({ path: p, body: req.postDataJSON(), headers: req.headers() });
    if (p.endsWith('/packages')) return route.fulfill({ json: { items: [pack], totalCount: 1, page: 1, pageSize: 10 } });
    if (p.endsWith('/capabilities')) return route.fulfill({ json: { canGenerate: true, canSubmit: pack.status === 'draft', canDecide, canManageDelegations: canDelegate, canPublish: false, conditions: [] } });
    if (p.endsWith('/lifecycle-gates')) return route.fulfill({ json: { ...lifecycle(), gates } });
    if (p.endsWith('/memberships')) { membershipReads++; return route.fulfill({ status: memberError ? 403 : 200, json: memberError ? { message: 'Forbidden fixture membership list' } : [{ memberId: 'qa', displayName: 'QA Leader', role: 'leader', status: 'approved' }, { memberId: 'private-helper-id', displayName: 'Grace Helper', role: 'member', status: 'approved' }, { memberId: 'not-approved-id', displayName: 'Pending Person', role: 'member', status: 'pending' }] }); }
    if (p === '/api/event-package-delegations') {
      if (req.method() === 'POST') { delegations.push({ ...req.postDataJSON(), id: 'new-delegation', eTag: '"delegation-1"' }); return route.fulfill({ json: delegations.at(-1) }); }
      return route.fulfill({ json: delegations });
    }
    return route.fallback();
  });
  const ready = async () => { await page.getByRole('heading', { name: t('What to do next', '接下来做什么'), exact: true }).waitFor(); await page.waitForFunction(() => !document.querySelector('[data-approval-actions] button')?.disabled); };
  await page.goto(url); await ready();
  const checklist = page.getByRole('region', { name: t('Next actions and outstanding items', '下一步与待处理事项') });
  assert.equal(await checklist.getByText(t('Complete event approval', '完成活动方案审批'), { exact: true }).count(), 1);
  assert.equal(await checklist.getByText(t('Trial · attention needed', '试运行 · 有待完善'), { exact: true }).count(), 2);
  assert.equal(await checklist.getByText(/event\.publish\.packageNotApproved/).isVisible(), false);
  await page.getByRole('button', { name: t('Open: Risk assessment', '前往处理：风险评估'), exact: true }).click();
  await page.locator('[data-module-editor="SAFETY.RAM"]').waitFor({ state: 'visible' });
  assert.match(page.url(), /module=SAFETY.RAM/); assert.match(page.url(), /reviewReturn=approval/);
  await page.getByRole('button', { name: t('← Back to formal approval', '← 返回正式审批'), exact: true }).click(); await ready();
  assert.equal(writes.length, 0, 'deep-link navigation must not save or submit');
  const delegation = page.locator('details').filter({ has: page.locator('summary', { hasText: t('Advanced: temporary approval delegation (optional)', '高级选项：临时委派审批（可选）') }) });
  assert.equal(await delegation.getAttribute('open'), null);
  await page.screenshot({ path: path.join(out, `approval-${language}-${width}.png`), fullPage: true });
  await delegation.locator('summary').first().click();
  const picker = page.getByLabel(t('Delegate to', '委派给谁'), { exact: true });
  await picker.waitFor();
  await page.waitForFunction(() => !document.querySelector('input[type="search"]')?.closest('fieldset')?.disabled);
  await picker.locator('option', { hasText: 'Grace Helper' }).waitFor({ state: 'attached' });
  assert.equal(await picker.locator('option', { hasText: 'Pending Person' }).count(), 0);
  await page.getByLabel(t('Find a member by name', '按姓名查找成员'), { exact: true }).fill('Grace');
  await picker.selectOption('private-helper-id');
  const expiry = delegation.locator('input[type="datetime-local"]');
  await expiry.fill('2000-01-01T12:00');
  const grant = page.getByRole('button', { name: t('Delegate this event’s approval', '委派本活动审批'), exact: true });
  assert.equal(await grant.isDisabled(), true);
  await expiry.fill('2099-01-01T12:00'); await grant.click();
  assert.equal(writes.length, 0, 'delegation confirmation is required');
  await page.getByRole('alertdialog').getByRole('button', { name: t('Confirm delegation', '确认委派'), exact: true }).click();
  await page.getByText(t('Delegation updated.', '委派已更新。'), { exact: true }).waitFor();
  assert.equal(writes.length, 1); assert.equal(writes[0].body.delegatedToMemberId, 'private-helper-id');
  assert.equal(writes[0].body.scopeId, 'qa-event'); assert.ok(writes[0].headers['idempotency-key']);
  assert.doesNotMatch(await delegation.innerText(), /private-helper-id|external-id|other-event/);
  assert.equal(await delegation.getByRole('button', { name: t('Revoke delegation', '撤销委派'), exact: true }).count(), 1);
  await delegation.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, `delegation-${language}-${width}.png`), fullPage: false });
  // Permission failure is actionable and never falls back to a manual ID field.
  memberError = true; await page.reload(); await ready(); await delegation.locator('summary').first().click();
  await delegation.getByRole('alert').waitFor(); assert.equal(await picker.isDisabled(), true);
  memberError = false; await delegation.getByRole('button', { name: t('Retry', '重试'), exact: true }).click();
  await picker.locator('option', { hasText: 'Grace Helper' }).waitFor({ state: 'attached' });
  // No permission means neither a delegation form nor membership request.
  canDelegate = false; pack.status = 'submitted'; await page.reload(); await ready();
  await checklist.getByText(t('Awaiting an approver', '等待审批人处理'), { exact: true }).waitFor();
  assert.equal(await delegation.count(), 0); const readCount = membershipReads;
  await page.waitForTimeout(200); assert.equal(membershipReads, readCount);
  canDecide = true; await page.reload(); await ready();
  await page.getByRole('button', { name: t('Review and decide', '前往审批'), exact: true }).click();
  assert.equal(await page.locator('[data-approval-decision]').evaluate(el => document.activeElement === el), true);
  const decisionTop = await page.locator('[data-approval-decision]').evaluate(el => el.getBoundingClientRect().top);
  assert.ok(decisionTop >= 70 && decisionTop < 400, `decision heading visible below header: ${decisionTop}`);
  await page.getByLabel(t('Reason in English', '英文理由'), { exact: true }).fill('Keep this unsaved review');
  await page.getByRole('button', { name: t('Open: Risk assessment', '前往处理：风险评估'), exact: true }).click();
  const discard = page.getByRole('alertdialog'); await discard.waitFor();
  await discard.getByRole('button', { name: t('Cancel', '取消'), exact: true }).click();
  assert.equal(await page.getByLabel(t('Reason in English', '英文理由'), { exact: true }).inputValue(), 'Keep this unsaved review');
  assert.equal(writes.length, 1, 'review navigation cannot approve or publish');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false);
  await context.route('**/api/events/qa-event/work*', route => {
    if (new URL(route.request().url()).pathname !== '/api/events/qa-event/work') return route.fallback();
    return route.fulfill({ json: { event: { eventId: 'qa-event', groupId: 'qa-group', title: { en: 'Community meal', zh: '社区聚餐' }, stage: 'preparation', canManage: true, roles: [] }, links: [], occurrences: [], occurrencePage: 1, hasMoreOccurrences: false, duties: [], reports: [], plan: null } });
  });
  await page.goto(`${base}/events/qa-event/work`);
  const continuePreparation = page.getByRole('link', { name: t('Continue preparation', '继续筹备'), exact: true });
  await continuePreparation.waitFor();
  await page.getByRole('navigation', { name: t('Event stages', '活动阶段') }).getByRole('button', { name: t('Delivery', '执行'), exact: true }).click();
  await page.getByText(t('Handle the selected date’s duties, check-in and on-site coordination.', '处理具体场次的岗位、签到与现场协作。'), { exact: true }).waitFor();
  assert.equal(await continuePreparation.count(), 0);
  await page.getByRole('navigation', { name: t('Event stages', '活动阶段') }).getByRole('button', { name: t('Preparation', '筹备'), exact: true }).click();
  await continuePreparation.click();
  await page.locator('[data-editorial-overview]').waitFor();
  assert.equal(writes.length, 1, 'stage navigation cannot change lifecycle state');
  assert.deepEqual(errors, []);
  console.log(`PASS action guidance ${language}/${width}: grouped gates, trial status, edit/return, role gates, delegation selection/confirmation/scope/error, no implicit writes`);
};
