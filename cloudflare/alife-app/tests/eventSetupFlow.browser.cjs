// Fixture-only browser integration: no live events, image uploads, AI calls or publication.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const path = require('node:path');
const os = require('node:os');
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://127.0.0.1:5173';
const text = (en, zh) => ({ en, zh });
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const file = { name: 'poster.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') };
const template = { code: 'shared-meal', archetypeCode: 'simple-social', version: 2, name: text('Fellowship meal', '团契聚餐'), description: text('Share a meal', '一起用餐'), iconKey: 'meal', defaults: { visibility: 'groupVisible', registrationMode: 'none', capacityUnit: 'People' }, preselectedModules: [], presetServiceSlots: [] };
const catalogue = [{ code: 'simple-social', version: 1, name: text('Simple social', '轻松相聚'), isSeries: false, occurrenceCount: 1, hasSessions: false, hasZones: false, requiredModules: [], recommendedModules: [], conditionalModules: [], workflowTemplateRecommendations: [], activityTypes: [template] }];
const proposal = { schemaVersion: '1.1.0', proposalHash: 'qa-hash', baselineETag: '"plan-new"', archetypeCode: 'simple-social', activityTypeCode: 'shared-meal', facts: { items: [], sourceHash: 'facts' }, roleRequirements: [], workflowContributions: [], navigation: [], warnings: [], readiness: { status: 'notReady', blockers: [], warnings: [] }, moduleDecisions: [{ moduleCode: 'TEAM.WORK', label: text('Team and tasks', '团队与任务'), status: 'required', reasonCodes: [], dependencies: [], dataClasses: [], integrationKey: '', surfaceKey: 'team.work', navigationOrder: 1 }] };

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const language of (process.env.ALIFE_QA_LANGUAGES || 'zh,en').split(',')) for (const width of (process.env.ALIFE_QA_WIDTHS || '320,768,1280').split(',').map(Number)) {
      const zh = language === 'zh', t = (en, cn) => zh ? cn : en;
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(language => localStorage.setItem('alife.language', language), language);
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      const errors = [], creates = [], posterSaves = [], publishes = [], uploads = [], ai = [], detailSaves = [], acceptedPlans = [], taskSaves = [];
      let savedPlan = structuredClone(proposal), planRevision = 1;
      for (const [moduleCode, en, cn] of [['PEOPLE.REGISTRATION', 'Invitations and registration', '邀请与报名'], ['SERVICE.ROSTER', 'Roles and shifts', '岗位与轮班'], ['SAFETY.RAM', 'RAM and safety', 'RAM与安全'], ['SAFEGUARDING.CHILD', 'Child safeguarding', '儿童保护']]) {
        savedPlan.moduleDecisions.push({ ...structuredClone(proposal.moduleDecisions[0]), moduleCode, label: text(en, cn), surfaceKey: moduleCode.toLowerCase(), navigationOrder: savedPlan.moduleDecisions.length + 1 });
      }
      const venue = { id: 'qa-venue', managingGroupId: 'qa-group', name: text('Hall', '礼堂'), address: text('Address', '地址'), capacity: 50, isActive: true, eTag: '"venue-1"' };
      let arrangements = { occurrenceId: 'qa-occurrence', startUtc: '2026-10-04T10:00:00Z', endUtc: '2026-10-04T12:00:00Z', eTag: '"arrangements-1"', serviceSlots: [{ id: 'qa-slot', details: { roleCode: 'welcome', requiredCount: 3, eligibilityCode: 'approvedGroupMember', startOffsetMinutes: -15, endOffsetMinutes: 120 } }], sessions: [{ id: 'qa-session', details: { title: text('Opening', '开场'), startOffsetMinutes: 0, endOffsetMinutes: 120, items: [{ title: text('Welcome', '欢迎'), description: text('Opening remarks', '开场介绍'), startOffsetMinutes: 0, durationMinutes: 15 }] }, itemIds: ['qa-item'] }], venueBookings: [{ id: 'qa-booking', details: { venueId: 'qa-venue', venueETag: venue.eTag, requiredCapacity: 20, startOffsetMinutes: 0, endOffsetMinutes: 120 }, venue }] };
      const assessment = { tier: 'standard', policyVersion: 'qa-policy-custom', approvalDeadlineUtc: '2026-09-30T10:00:00Z', finalConfirmationWindowHours: 96, tiers: ['enhanced', 'standard', 'light'].map(tier => ({ tier, applies: tier !== 'enhanced', selected: tier === 'standard', reasons: tier === 'standard' ? [{ code: 'registration', message: text('Enabled tool: registration.', '已启用功能：报名。') }] : [] })) };
      for (const [moduleCode, en, cn] of [['PROGRAM.PRODUCTION', 'Programme and production', '节目与制作'], ['PLACE.RESOURCE', 'Venue and resources', '场地与资源'], ['MOVE.STAY', 'Travel and stay', '交通与住宿']]) savedPlan.moduleDecisions.push({ ...structuredClone(proposal.moduleDecisions[0]), moduleCode, label: text(en, cn), status: 'selected', surfaceKey: moduleCode.toLowerCase() });
      const roleRequirements = input => [['TEAM.WORK', 'event.accountableOwner'], ['SERVICE.ROSTER', 'roster.coordinator'], ['SAFETY.RAM', 'ram.author'], ['SAFETY.RAM', 'ram.approver']].filter(([module, code]) => code === 'event.accountableOwner' || (input?.humanSelections.find(x => x.moduleCode === module)?.selected ?? savedPlan.moduleDecisions.find(x => x.moduleCode === module)?.status !== 'inactive')).map(([moduleCode, roleCode]) => ({ moduleCode, roleCode, requirementKey: `${moduleCode}:${roleCode}`, minimum: 1, recommended: 1, eligibility: [], separationFrom: [] }));
      savedPlan.roleRequirements = roleRequirements();
      const roleAssignments = [{ id: 'owner-role', roleRequirementKey: 'TEAM.WORK:event.accountableOwner', memberId: 'qa', status: 'accepted' }];
      const roleInvites = [];
      const applySelections = input => ({ ...savedPlan, arrangementConfirmations: input.arrangementConfirmations, roleRequirements: roleRequirements(input), moduleDecisions: savedPlan.moduleDecisions.map(item => {
        const selected = input.humanSelections.find(selection => selection.moduleCode === item.moduleCode)?.selected;
        return selected === undefined ? item : { ...item, status: selected ? 'selected' : 'inactive' };
      }) });
      savedPlan.moduleDecisions.push({ moduleCode: 'COMMS.FOLLOWUP', label: text('Communications', '活动沟通'), status: 'inactive', reasonCodes: [], dependencies: [], dataClasses: [], integrationKey: '', surfaceKey: 'comms.followup', navigationOrder: 2 });
      let reads = 0, approved = false, submitted = false, returned = false, reopen = null, published = false, conflict = width === 1280;
      let info = { eventId: 'qa-event', groupId: 'qa-group', brief: { title: text('Community meal', '社区聚餐'), description: text('A meal together', '一同聚餐'), purpose: text('', ''), locationName: text('Hall', '礼堂'), startDate: '2026-10-04T10:00:00Z', endDate: '2026-10-04T12:00:00Z' }, posterImageUrl: null, visibility: width === 320 ? 'groupVisible' : width === 768 ? 'churchVisible' : 'public', registrationMode: 'none', eTag: '"poster-v1"', canManage: true };
      let ramAssessment = null;
      let updatedUtc = '2026-09-11T00:00:00Z';
      const record = () => ({ id: 'qa-event', groupId: 'qa-group', titleEn: info.brief.title.en, titleZh: info.brief.title.zh, startDate: info.brief.startDate, endDate: info.brief.endDate, updatedUtc, visibility: info.visibility, contactProfileIds: [], eventDataJson: JSON.stringify({ ...info.brief, maxCapacity: 0, visibility: info.visibility, capacityUnit: 'People', currency: 'NZD', hardConstraints: [], optionalActivities: [], galleryUrls: [], privateContact: 'preserved' }) });
      const preparation = () => ({ eventId: 'qa-event', isFrozen: approved, isApproved: approved, canManage: true, canEdit: !approved, approvedPackageId: approved ? 'qa-package' : null, reopenRequest: reopen });
      const item = () => ({ id: 'qa-package', eventId: 'qa-event', scopeType: 'event', coverageMode: 'explicitOccurrences', coveredOccurrenceIds: [], version: 1, eventPlanVersion: 1, packageSchemaVersion: '1.0', governancePolicyVersion: 'qa-policy', governanceTier: assessment.tier, status: approved ? 'approved' : returned ? 'returnedForAmendment' : submitted ? 'submitted' : 'draft', approvalValidityStatus: approved ? 'active' : 'notDecided', contentHash: 'qa-content-hash', sourceVectorHash: 'qa-source', manifest: { eventTitle: info.brief.title, legacyTransition: 'formalPackageRequired', modules: [], blockers: [], sections: [] }, sourceReferences: [], decisions: [], conditions: [], generatedUtc: '2026-09-11T00:00:00Z', eTag: '"package-v1"' });
      const lifecycle = () => ({ eventId: 'qa-event', publicationStatus: published ? 'published' : 'draft', publishGateSatisfied: approved, gateMode: 'enforced', reasonCodes: [], eTag: '"lifecycle-v1"', registrationStatus: 'closed', gates: [{ gate: 'publish', enforcementMode: 'enforced', allowed: approved, requirementsSatisfied: approved, blockers: approved ? [] : [{ code: 'approvalRequired', message: text('Formal approval is required.', '需要正式审批。'), responsibleRole: 'approver', nextAction: 'approve' }], warnings: [] }] });
      page.on('pageerror', error => errors.push(error.message));
      await context.route('https://example.org/poster.png', route => route.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') }));
      await context.route('**/api/**', async route => {
        const req = route.request(), pathname = new URL(req.url()).pathname; let data = [], status = 200;
        if (req.method() === 'GET') reads++;
        if (pathname === '/api/me') data = { id: 'qa', displayName: 'QA Leader', isGuest: false, isRegistered: true, platformRole: 'superadmin', permissions: ['admin.access'], memberships: [] };
        else if (pathname === '/api/event-archetypes') data = catalogue;
        else if (pathname.endsWith('/compose')) data = proposal;
        else if (pathname === '/api/groups/qa-group/events' && req.method() === 'POST') { creates.push(req.postDataJSON()); data = { id: 'qa-event', groupId: 'qa-group' }; }
        else if (pathname === '/api/groups/qa-group/events' && req.method() === 'GET') data = [record()];
        else if (pathname === '/api/events/qa-event' && req.method() === 'PUT') { assert.equal(req.headers()['if-match'], `"${updatedUtc}"`); updatedUtc = new Date(Date.parse(updatedUtc) + 1000).toISOString(); detailSaves.push({ body: req.postDataJSON(), headers: req.headers() }); const body = req.postDataJSON(); info.brief = { ...info.brief, ...JSON.parse(body.eventDataJson), title: text(body.titleEn, body.titleZh) }; data = record(); }
        else if (pathname.endsWith('/venue-reservations')) data = { eventId: 'qa-event', managingGroupId: 'qa-group', venues: [venue], reservations: [], conflicts: [], readiness: { blockers: [], capacitySufficient: true, bookingsConfirmed: false, conflictsResolved: true }, canManage: true, canManageCatalogue: true };
        else if (pathname === '/api/events/qa-event/safeguarding' && width === 1280) data = { eventId: 'qa-event', accessMode: 'lead', availablePolicies: [], occurrences: [], enrollmentOptions: [], memberOptions: [], children: [], workerEvidence: [], audit: [], readiness: { blockers: [] }, configurationETag: '"safeguarding-1"' };
        else if (pathname === '/api/events/qa-event/travel' && width === 1280) data = { eventId: 'qa-event', occurrences: [], eligibleMembers: [], drivers: [], vehicles: [], journeys: [], ramEvidence: { status: 'draft', checksComplete: false }, readiness: { blockers: [] }, canManage: true };
        else if (pathname.includes('/safeguarding') || pathname.includes('/travel')) { status = 403; data = { message: 'Duty access required' }; }
        else if (pathname.endsWith('/programme/sessions/qa-session') && req.method() === 'PUT') { assert.equal(req.headers()['if-match'], '"programme-1"'); const body = req.postDataJSON(); arrangements.sessions[0].details.title = body.title; updatedUtc = new Date(Date.parse(updatedUtc) + 1000).toISOString(); data = { eventId: 'qa-event', occurrenceId: 'qa-occurrence', eTag: '"programme-2"', canManage: true, sessions: arrangements.sessions.map(row => ({ id: row.id, title: row.details.title, startUtc: arrangements.startUtc, endUtc: arrangements.endUtc, status: 'draft', items: row.details.items.map((value, i) => ({ ...value, id: row.itemIds[i] })) })) }; }
        else if (pathname.endsWith('/programme')) data = { eventId: 'qa-event', occurrenceId: 'qa-occurrence', eTag: '"programme-1"', canManage: true, sessions: arrangements.sessions.map(row => ({ id: row.id, title: row.details.title, startUtc: arrangements.startUtc, endUtc: arrangements.endUtc, status: 'draft', items: row.details.items.map((value, i) => ({ ...value, id: row.itemIds[i] })) })) };
        else if (pathname.endsWith('/roster')) data = { eventId: 'qa-event', occurrenceId: 'qa-occurrence', eTag: '"roster-1"', canManage: true, readinessBlockers: [], slots: arrangements.serviceSlots.map(row => ({ ...row.details, id: row.id, startUtc: arrangements.startUtc, endUtc: arrangements.endUtc, confirmedCount: 0, assignments: [] })) };
        else if (pathname.endsWith('/venues')) data = { managingGroupId: 'qa-group', venues: [venue], canManage: true };
        else if (pathname.endsWith('/occurrences')) data = [{ id: 'qa-occurrence', eventId: 'qa-event', startUtc: arrangements.startUtc, endUtc: arrangements.endUtc, status: 'scheduled' }, ...(width === 1280 ? [{ id: 'qa-occurrence-2', eventId: 'qa-event', startUtc: '2026-10-11T10:00:00Z', endUtc: '2026-10-11T12:00:00Z', status: 'scheduled' }] : [])];
        else if (pathname.endsWith('/preparation/arrangements')) data = new URL(req.url()).searchParams.get('occurrenceId') === 'qa-occurrence-2' ? { ...arrangements, occurrenceId: 'qa-occurrence-2', startUtc: '2026-10-11T10:00:00Z', endUtc: '2026-10-11T12:00:00Z' } : arrangements;
        else if (pathname.endsWith('/packages/assessment')) data = assessment;
        else if (pathname.endsWith('/preparation')) data = preparation();
        else if (pathname.endsWith('/reopen-requests')) { reopen = { id: 'qa-reopen', eventPackageId: 'qa-package', status: 'pending', reason: req.postDataJSON().reason, eTag: '"reopen-v1"', canReview: true }; data = preparation(); }
        else if (pathname.endsWith('/qa-reopen/review')) { assert.equal(req.headers()['if-match'], '"reopen-v1"'); assert.ok(req.headers()['idempotency-key']); approved = false; published = false; submitted = false; reopen = { ...reopen, status: 'approved', canReview: false, reviewReason: req.postDataJSON().reason }; data = preparation(); }
        else if (pathname.endsWith('/ram') && req.method() === 'PUT') { const body = req.postDataJSON(); assert.equal(body.schemaVersion, 2); updatedUtc = new Date(Date.parse(updatedUtc) + 1000).toISOString(); ramAssessment = { eventId: 'qa-event', groupId: 'qa-group', schemaVersion: 2, eTag: 'ram-saved', validity: 'Draft', status: 'draft', residualLevel: 'Incomplete', ramDataJson: body.ramDataJson, policyVersionId: null }; data = ramAssessment; }
        else if (pathname.endsWith('/ram/workspace')) data = { assessment: ramAssessment, policy: null, history: [], actions: [], onsiteCandidates: [], canEdit: true, canAudit: false, currentMemberId: 'qa', isRequired: true };
        else if (pathname.endsWith('/workspace')) data = { eventId: 'qa-event', owningGroupId: 'qa-group', title: info.brief.title, canManage: true, items: savedPlan.moduleDecisions.filter(x => x.status !== 'inactive').map(x => ({ surfaceKey: x.surfaceKey, moduleCode: x.moduleCode, label: x.label, order: x.navigationOrder, readiness: 'notReady', presentation: 'page', blockers: [] })) };
        else if (pathname.endsWith('/plan')) data = { eventId: 'qa-event', planVersion: planRevision, eTag: `"plan-v${planRevision}"`, plan: savedPlan };
        else if (pathname.endsWith('/plan/recompose')) data = applySelections(req.postDataJSON());
        else if (pathname.endsWith('/plan/accept')) { acceptedPlans.push({ body: req.postDataJSON(), headers: req.headers() }); updatedUtc = new Date(Date.parse(updatedUtc) + 1000).toISOString(); if (req.postDataJSON().arrangements) arrangements = { ...arrangements, ...req.postDataJSON().arrangements, eTag: `"arrangements-${planRevision + 1}"` }; arrangements.venueBookings = arrangements.venueBookings.map(row => ({ ...row, venue })); planRevision++; savedPlan = applySelections(req.postDataJSON().composition); data = { eventId: 'qa-event', planVersion: planRevision, eTag: `"plan-v${planRevision}"`, plan: savedPlan }; }
        else if (pathname.endsWith('/tasks') && req.method() === 'POST') { taskSaves.push(req.postDataJSON()); updatedUtc = new Date(Date.parse(updatedUtc) + 1000).toISOString(); data = { id: 'qa-task' }; }
        else if (pathname.endsWith('/memberships')) data = [{ memberId: 'qa', displayName: 'QA Leader', status: 'approved' }];
        else if (pathname.endsWith('/role-assignments') && req.method() === 'POST') { const body = req.postDataJSON(); roleInvites.push(body); const assignment = { ...body, id: 'roster-role', status: 'invited' }; roleAssignments.push(assignment); data = assignment; }
        else if (pathname.endsWith('/role-assignments/roster-role/accept')) { roleAssignments.find(x => x.id === 'roster-role').status = 'accepted'; data = roleAssignments.find(x => x.id === 'roster-role'); }
        else if (pathname.endsWith('/team')) data = { members: [{ id: 'team-qa', memberId: 'qa', displayName: 'QA Leader', status: 'accepted' }], roles: roleAssignments, tasks: [], roleRequirements: savedPlan.roleRequirements, readinessBlockers: [], canManage: true };
        else if (pathname.endsWith('/poster')) {
          if (req.method() === 'PUT') {
            posterSaves.push({ body: req.postDataJSON(), headers: req.headers() });
            if (conflict) { conflict = false; status = 412; info = { ...info, eTag: '"poster-v2"', brief: { ...info.brief, locationName: text('New hall', '新礼堂') } }; data = { message: 'Event details changed.' }; }
            else { info = { ...info, posterImageUrl: req.postDataJSON().posterImageUrl, eTag: '"poster-saved"' }; data = info; }
          } else data = info;
        } else if (pathname.includes('/api/images/')) { uploads.push(pathname); data = { image: { url: 'https://example.org/poster.png' } }; }
        else if (pathname === '/api/ai/event-poster') { ai.push(req.postData()); data = { imageBase64: png, mimeType: 'image/png', model: 'fixture', context: { groupName: text('Group', '小组'), churchName: text('Church', '教会') } }; }
        else if (pathname.endsWith('/packages/current')) data = item();
        else if (pathname.endsWith('/packages/generate') && req.method() === 'POST') { submitted = false; returned = false; data = item(); }
        else if (pathname.endsWith('/packages')) data = { items: [item()], totalCount: 1, page: 1, pageSize: 10 };
        else if (pathname.endsWith('/capabilities')) data = { canGenerate: !approved, canSubmit: !submitted && !approved && !returned, canDecide: submitted && !approved && !returned, canPublish: approved, conditions: [] };
        else if (pathname.endsWith('/lifecycle-gates')) data = lifecycle();
        else if (pathname.endsWith('/submit')) { submitted = true; returned = false; data = item(); }
        else if (pathname.endsWith('/decisions')) { returned = req.postDataJSON().decisionType === 'returnForAmendment'; approved = !returned; data = item(); }
        else if (pathname.endsWith('/publish')) { publishes.push(req.postDataJSON()); published = true; data = lifecycle(); }
        await route.fulfill({ status, json: data });
      });
      const click = (en, cn) => page.getByRole('button', { name: t(en, cn), exact: true }).click();
      const flow = () => page.getByRole('navigation', { name: t('Event preparation flow', '活动筹备流程'), exact: true });
      const stage = name => flow().getByRole('link', { name }).click();
      const checkLayout = async name => { await page.evaluate(() => window.scrollTo(0, 0)); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name); await page.screenshot({ path: path.join(os.tmpdir(), `alife-flow-${name}-${language}-${width}.png`) }); };
      await page.goto(`${base}/events/new?groupId=qa-group`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.getByRole('button', { name: /轻松相聚|Simple social/ }).click();
      await page.getByRole('button', { name: /团契聚餐|Fellowship meal/ }).click(); await click('Continue', '继续');
      for (const [label, en, cn] of [[t('Event title', '活动名称'), 'Community meal', '社区聚餐'], [t('Description', '活动说明'), 'A meal together', '一同聚餐']]) {
        const group = page.getByRole('group', { name: label, exact: true }); await group.getByLabel('English', { exact: true }).fill(en); await group.getByLabel('中文', { exact: true }).fill(cn);
      }
      await page.getByLabel(t('Start time', '开始时间'), { exact: true }).fill('2026-10-04T18:00');
      await page.getByLabel(t('End time', '结束时间'), { exact: true }).fill('2026-10-04T20:00'); await click('Continue', '继续'); await click('Continue', '继续');
      await click('Confirm and create event', '确认创建活动');
      await page.waitForURL('**/qa-event/workspace?flow=setup&stage=arrangements');
      await page.getByRole('group', { name: /Team and tasks.*Enable|团队与任务.*是否启用/ }).waitFor(); assert.equal(await flow().locator('li').count(), 7); assert.equal(await page.getByLabel(t('Choose a tool to configure', '选择要设置的功能')).count(), 0); assert.equal(creates.length, 1);
      assert.equal(await flow().getByRole('button', { disabled: true }).count(), 3); await checkLayout('setup');
      await page.goto(`${base}/groups/qa-group/events/qa-event/workspace?flow=setup&stage=setup&module=team.work`);
      await page.getByRole('heading', { name: /Team members|团队成员/, exact: true }).waitFor();
      assert.equal(await flow().getByRole('link', { name: /Arrangements|活动安排/ }).getAttribute('aria-current'), 'step');
      const team = page.getByRole('region', { name: t('Team and tasks', '团队与任务'), exact: true });
      await team.getByLabel(t('English title', '英文標題'), { exact: true }).fill('Prepare tables');
      await team.getByRole('button', { name: `${t('Collapse', '收起')} ${t('Team and tasks', '团队与任务')}`, exact: true }).click();
      await team.getByRole('button', { name: `${t('Expand', '展开')} ${t('Team and tasks', '团队与任务')}`, exact: true }).click();
      assert.equal(await team.getByLabel(t('English title', '英文標題'), { exact: true }).inputValue(), 'Prepare tables');
      await stage(/Details|活动资料/); await stage(/Arrangements|活动安排/);
      assert.equal(await team.getByLabel(t('English title', '英文標題'), { exact: true }).inputValue(), 'Prepare tables');
      await team.getByLabel(t('Chinese title', '中文標題'), { exact: true }).fill('安排桌椅');
      await Promise.all([page.waitForResponse(response => response.url().endsWith('/tasks') && response.request().method() === 'POST' && response.ok()), team.getByRole('button', { name: t('Add task', '新增任務'), exact: true }).click()]);
      await page.waitForFunction(() => !document.querySelector('fieldset:disabled'));
      assert.equal(taskSaves.length, 1); assert.equal(taskSaves[0].title.en, 'Prepare tables');
      assert.deepEqual(errors, []);
      if (width === 1280) { await page.getByRole('heading', { name: t('Child consent, check-in & safe collection', '儿童同意、签到与安全交接'), exact: true }).waitFor(); await page.getByRole('heading', { name: t('Pickup journeys & passenger manifests', '接送行程与乘车名单'), exact: true }).waitFor(); }
      assert.deepEqual(await team.locator('input,select,textarea').evaluateAll(nodes => nodes.filter(node => { const r = node.getBoundingClientRect(); return r.width && (r.left < 0 || r.right > innerWidth + 1); }).map(node => node.outerHTML.slice(0, 120))), [], 'embedded team fields fit the mobile viewport');
      await team.screenshot({ path: path.join(os.tmpdir(), `alife-integrated-team-${language}-${width}.png`) });
      await page.goto(`${base}/groups/qa-group/events/qa-event/edit`);
      await page.waitForFunction(() => location.pathname.endsWith('/workspace') && new URLSearchParams(location.search).get('stage') === 'details');
      assert.equal(await flow().getByRole('link', { name: /Template|选择模板/ }).count(), 0);
      const titleGroup = () => page.getByRole('group', { name: t('Event title', '活动名称'), exact: true });
      await titleGroup().getByLabel('English', { exact: true }).fill('Revised meal');
      assert.equal(await flow().getByRole('link', { name: /5.*Approval|5.*正式审批/ }).count(), 0);
      await stage(/Arrangements|活动安排/); await page.getByRole('group', { name: /Team and tasks.*Enable|团队与任务.*是否启用/ }).waitFor();
      assert.equal(await page.getByRole('button', { name: t('Open RAM assessment', '打开 RAM 评估表'), exact: true }).count(), 0);
      const ram = page.getByRole('region', { name: t('RAM and safety', 'RAM与安全'), exact: true });
      await ram.getByLabel(t('Participant count', '参与人数'), { exact: true }).fill('14');
      await ram.getByRole('button', { name: `${t('Collapse','收起')} ${t('RAM and safety','RAM与安全')}`, exact: true }).click();
      assert.equal(await ram.getByLabel(t('Participant count', '参与人数'), { exact: true }).isVisible(), false);
      await ram.getByRole('button', { name: `${t('Expand','展开')} ${t('RAM and safety','RAM与安全')}`, exact: true }).click();
      assert.equal(await ram.getByLabel(t('Participant count', '参与人数'), { exact: true }).inputValue(), '14');
      await ram.getByRole('button', { name: t('Save RAM draft', '保存 RAM 草稿'), exact: true }).click();
      await ram.getByRole('status').filter({ hasText: /Action completed|操作已完成/ }).waitFor();
      await stage(/Details|活动资料/); assert.equal(await titleGroup().getByLabel('English', { exact: true }).inputValue(), 'Revised meal');
      await click('Save event details', '保存活动资料'); await page.getByRole('status').filter({ hasText: /Event details saved|活动资料已保存/ }).waitFor();
      await stage(/Arrangements|活动安排/);
      assert.equal(new URLSearchParams(new URL(page.url()).search).get('stage'), 'arrangements');
      await page.getByRole('heading', { name: t('Risk Assessment and Management', '风险评估与管理'), exact: true }).waitFor();
      await page.getByRole('heading', { name: t('Risk details', '风险明细'), exact: true }).waitFor();
      assert.equal(await page.getByLabel(t('Participant count', '参与人数'), { exact: true }).isEnabled(), true);
      await page.getByRole('button', { name: t('Add risk', '添加风险'), exact: true }).waitFor();
      await checkLayout('ram-entry');
      const toolGroup = item => page.getByRole('group', { name: `${item.label[language]} · ${t('Enable', '是否启用')}`, exact: true });
      const programme = page.getByRole('region', { name: t('Programme and production', '节目与制作'), exact: true });
      const sessionForm = programme.locator('form').filter({ has: page.getByLabel('Session English title', { exact: true }) });
      const programmeConfirmed = page.getByRole('checkbox', { name: t('Programme and venue · Confirmed', '节目与场地 · 已确认'), exact: true });
      await programmeConfirmed.check();
      await sessionForm.getByLabel('Session English title', { exact: true }).fill('Revised opening');
      assert.equal(await programmeConfirmed.isChecked(), false, 'unsaved inline edits also reset section review');
      await Promise.all([page.waitForResponse(response => response.url().endsWith('/programme/sessions/qa-session') && response.ok()), sessionForm.getByRole('button', { name: t('Save', '儲存'), exact: true }).click()]);
      await page.waitForFunction(() => !document.querySelector('fieldset:disabled'));
      assert.equal(arrangements.sessions[0].details.title.en, 'Revised opening');
      await programme.getByRole('button', { name: t('Print run sheet', '列印流程表'), exact: true }).click();
      const printPreview = page.getByRole('dialog', { name: t('Programme print preview', '节目流程打印预览'), exact: true });
      await printPreview.waitFor(); assert.equal(await printPreview.getByRole('heading', { name: t('Revised opening', '开场'), exact: true }).count(), 1);
      await page.emulateMedia({ media: 'print' }); assert.equal(await page.locator('#root').isVisible(), false); assert.equal(await printPreview.isVisible(), true);
      await page.emulateMedia({ media: 'screen' }); await printPreview.getByRole('button', { name: t('Close preview', '关闭预览'), exact: true }).click();

      const originallyRequired = savedPlan.moduleDecisions.filter(item => item.status === 'required');
      assert.equal(originallyRequired.length, 5);
      for (const item of originallyRequired) {
        const group = toolGroup(item);
        assert.equal(await group.getByRole('button', { name: t('Yes', '是'), exact: true }).getAttribute('aria-pressed'), 'true');
        await group.getByRole('button', { name: t('No', '否'), exact: true }).click();
      }
      await toolGroup(savedPlan.moduleDecisions.find(item => item.moduleCode === 'COMMS.FOLLOWUP')).getByRole('button', { name: t('Yes', '是'), exact: true }).click();
      await click('Review tool changes', '查看功能变更');
      await Promise.all([page.waitForResponse(response => response.url().endsWith('/plan/accept') && response.ok()), click('Confirm event arrangements', '确认保存活动安排')]);
      await page.getByRole('status').filter({ hasText: /Event arrangements saved|活动安排已保存/ }).waitFor();
      assert.equal(acceptedPlans[0].body.arrangements, undefined, 'selection save must preserve operational rows'); assert.equal(arrangements.sessions[0].details.title.en, 'Revised opening');
      assert.equal(acceptedPlans.length, 1); assert.ok(acceptedPlans[0].headers['if-match']); assert.ok(acceptedPlans[0].headers['idempotency-key']);
      for (const item of originallyRequired) {
        assert.equal(acceptedPlans[0].body.composition.humanSelections.find(selection => selection.moduleCode === item.moduleCode).selected, false);
        assert.equal(await toolGroup(item).getByRole('button', { name: t('No', '否'), exact: true }).getAttribute('aria-pressed'), 'true');
      }
      await stage(/Details|活动资料/); assert.equal(await titleGroup().getByLabel('English', { exact: true }).inputValue(), 'Revised meal');
      await click('Save event details', '保存活动资料'); await page.getByRole('status').filter({ hasText: /Event details saved|活动资料已保存/ }).waitFor();
      assert.equal(detailSaves.length, 2); assert.ok(detailSaves[0].headers['if-match']); assert.equal(JSON.parse(detailSaves[0].body.eventDataJson).privateContact, 'preserved');
      await page.goto(`${base}/groups/qa-group/events/qa-event/workspace?flow=setup&stage=arrangements`);
      for (const item of originallyRequired) {
        const group = toolGroup(item);
        await group.waitFor();
        assert.equal(await group.getByRole('button', { name: t('No', '否'), exact: true }).getAttribute('aria-pressed'), 'true');
        await group.getByRole('button', { name: t('Yes', '是'), exact: true }).click();
      }
      await checkLayout('optional-tools');
      await click('Review tool changes', '查看功能变更');
      await Promise.all([page.waitForResponse(response => response.url().endsWith('/plan/accept') && response.ok()), click('Confirm event arrangements', '确认保存活动安排')]);
      await page.getByRole('status').filter({ hasText: /Event arrangements saved|活动安排已保存/ }).waitFor();
      assert.equal(acceptedPlans.length, 2); assert.equal(acceptedPlans[1].body.arrangements, undefined); assert.equal(arrangements.serviceSlots[0].details.requiredCount, 3);
      for (const item of originallyRequired) assert.equal(acceptedPlans[1].body.composition.humanSelections.find(selection => selection.moduleCode === item.moduleCode).selected, true);
      assert.equal(await page.getByRole('button', { name: t('Pending', '待确认'), exact: true }).count(), 0);
      assert.equal(await team.getByRole('heading', { name: /RAM author|RAM 填表人|Roster coordinator|同工排班协调人/ }).count(), 0);
      assert.equal(await ram.getByRole('heading', { name: t('RAM author', 'RAM 填表人'), exact: true }).count(), 1);
      assert.equal(await ram.getByRole('heading', { name: t('RAM approver', 'RAM 审核人'), exact: true }).count(), 1);
      const rosterRole = page.getByRole('region', { name: t('Roster coordinator', '同工排班协调人'), exact: true });
      await rosterRole.getByRole('combobox').selectOption('qa');
      await rosterRole.getByRole('button', { name: t('Invite', '邀请'), exact: true }).click();
      await rosterRole.getByRole('button', { name: t('Accept role', '接受角色'), exact: true }).click();
      await rosterRole.getByText(t('Accepted', '已接受'), { exact: true }).waitFor();
      assert.equal(roleInvites[0].roleRequirementKey, 'SERVICE.ROSTER:roster.coordinator');
      const confirmed = page.getByRole('checkbox', { name: t('Safety · Confirmed', '安全 · 已确认'), exact: true });
      assert.equal(await confirmed.isChecked(), false);
      await confirmed.check();
      await click('Confirm event arrangements', '确认保存活动安排');
      await page.getByRole('status').filter({ hasText: /Event arrangements saved|活动安排已保存/ }).waitFor();
      assert.equal(acceptedPlans.at(-1).body.composition.arrangementConfirmations.safety, true);
      await page.reload(); await confirmed.waitFor(); assert.equal(await confirmed.isChecked(), true);
      await ram.getByRole('button', { name: t('No', '否'), exact: true }).click();
      assert.equal(await confirmed.isChecked(), false);
      assert.equal(await ram.getByRole('heading', { name: t('RAM author', 'RAM 填表人'), exact: true }).count(), 0);
      await ram.getByRole('button', { name: t('Yes', '是'), exact: true }).click();
      await confirmed.check();
      await click('Continue', '继续');
      await page.getByRole('heading', { name: t('Section confirmation and responsible roles', '分区确认与负责人'), exact: true }).waitFor();
      await page.getByRole('region', { name: t('Roster coordinator', '同工排班协调人'), exact: true }).getByText('QA Leader', { exact: true }).waitFor();
      await checkLayout('arrangement-confirmation-review');
      await page.locator('article').filter({ has: page.getByRole('heading', { name: t('Section confirmation and responsible roles', '分区确认与负责人'), exact: true }) }).screenshot({ path: path.join(os.tmpdir(), `alife-arrangement-role-summary-${language}-${width}.png`) });
      if (process.env.ALIFE_QA_STOP_AFTER_ARRANGEMENTS === '1') { console.log(`PASS ${language} ${width}: integrated tools, task/programme writes, row preservation, refreshed concurrency, collapse/navigation and responsive inputs`); await context.close(); continue; }
      await page.goto(`${base}/groups/qa-group/events/qa-event/workspace?flow=setup&stage=publish`);
      await page.getByRole('heading', { name: t('This step is currently unavailable', '此步骤暂不可进入'), exact: true }).waitFor(); assert.equal(publishes.length, 0);
      await click('Go to formal approval', '前往正式审批');
      const assessmentRegion = page.getByRole('region', { name: t('Approval tier and reply deadline', '审批等级与批复时间'), exact: true });
      await assessmentRegion.waitFor(); await assessmentRegion.screenshot({ path: path.join(os.tmpdir(), `alife-flow-assessment-${language}-${width}.png`) }); assert.equal(await assessmentRegion.locator('time').getAttribute('datetime'), '2026-09-30T10:00:00Z'); assert.match(await assessmentRegion.innerText(), /96/);
      const submit = async () => { await click('Submit for approval', '提交正式审批'); await page.getByRole('alertdialog').getByRole('button', { name: t('Submit for approval', '提交正式审批'), exact: true }).click(); };
      const decide = async returned => {
        await page.getByRole('combobox', { name: /Decision|决定/ }).selectOption(returned ? 'returnForAmendment' : 'approve').catch(async error => { console.error({ submitted, approved, body: await page.locator('body').innerText() }); throw error; });
        await page.getByLabel(t('Reason in English', '英文理由'), { exact: true }).fill('Reviewed for fixture approval');
        await page.getByLabel(t('Reason in Chinese', '中文理由'), { exact: true }).fill('测试审批已核对');
        await click('Confirm and record decision', '确认并记录决定'); await page.getByRole('alertdialog').getByRole('button', { name: t('Record decision', '记录决定'), exact: true }).click();
        await page.getByText(returned ? 'returnedForAmendment · notDecided' : 'approved · active', { exact: true }).waitFor();
      };
      await submit(); await decide(true);
      await stage(/Details|活动资料/); await titleGroup().getByLabel('English', { exact: true }).fill('Amended meal'); await click('Save event details', '保存活动资料');
      await page.getByRole('status').filter({ hasText: /Event details saved|活动资料已保存/ }).waitFor();
      await stage(/5.*Approval|5.*正式审批/); await click('Generate a new version', '从当前资料生成新版本'); await submit(); await decide(false);
      assert.equal(publishes.length, 0); await checkLayout('approval');
      assert.equal(await flow().getByRole('link', { name: /Details|活动资料|Arrangements|活动安排|Team and tools|团队与功能/ }).count(), 0);
      await page.goto(`${base}/groups/qa-group/events/qa-event/workspace?flow=setup&stage=details`);
      await page.getByRole('heading', { name: t('This step is currently unavailable', '此步骤暂不可进入'), exact: true }).waitFor();
      await click('Go to formal approval', '前往正式审批'); await click('Continue to poster', '继续海报制作');
      await page.getByLabel(t('Upload an existing poster', '上传现有海报')).setInputFiles(file);
      await page.getByRole('img', { name: t('Poster draft for review', '待核对的海报草案'), exact: true }).waitFor();
      assert.equal(posterSaves.length, 0); assert.equal(uploads.length, 0);
      await page.getByLabel(t('Base image', '海报底图'), { exact: true }).setInputFiles(file);
      await page.getByLabel(t('Design guidance', '设计要求')).fill('Warm bilingual poster');
      await click('Generate poster draft', '生成海报草案');
      await page.getByRole('button', { name: t('Generate poster draft', '生成海报草案'), exact: true }).waitFor();
      await page.waitForFunction(() => !document.querySelector('fieldset:disabled'));
      assert.equal(ai.length, 1); assert.equal(posterSaves.length, 0); await checkLayout('poster');
      await stage(/5.*Approval|5.*正式审批/); await stage(/6.*Poster|6.*海报制作/);
      assert.equal(await page.getByLabel(t('Design guidance', '设计要求')).inputValue(), 'Warm bilingual poster');
      await click('Adopt and save poster', '采用并保存海报');
      if (width === 1280) {
        await page.getByRole('alert').waitFor(); await click('Refresh event details', '刷新活动资料');
        await page.getByRole('button', { name: t('Checked against the latest details', '已按最新资料核对'), exact: true }).waitFor();
        assert.equal(await page.getByRole('button', { name: t('Adopt and save poster', '采用并保存海报'), exact: true }).isDisabled(), true);
        await click('Checked against the latest details', '已按最新资料核对'); await click('Adopt and save poster', '采用并保存海报');
      }
      await page.getByRole('status').filter({ hasText: /Poster saved|海报已保存/ }).waitFor().catch(async error => { console.error({ alerts: await page.getByRole('alert').allTextContents(), uploads, posterSaves }); throw error; });
      assert.deepEqual(Object.keys(posterSaves.at(-1).body), ['posterImageUrl']); assert.ok(posterSaves.at(-1).headers['if-match']); assert.ok(posterSaves.at(-1).headers['idempotency-key']);
      await click('Continue to publication', '继续发布活动');
      await page.getByRole('button', { name: t('Confirm and publish event', '确认并发布活动'), exact: true }).waitFor();
      await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(x => /Confirm and publish event|确认并发布活动/.test(x.textContent))?.disabled);
      await checkLayout('publish'); const count = reads;
      await page.getByRole('button', { name: t('Select language, current language: English', '选择语言，当前语言：中文'), exact: true }).click(); await page.getByRole('menuitemradio', { name: zh ? 'English' : '中文', exact: true }).click();
      await page.getByRole('heading', { name: zh ? 'Publish event' : '发布活动', exact: true }).waitFor(); assert.equal(reads, count);
      await page.getByRole('button', { name: zh ? 'Select language, current language: English' : '选择语言，当前语言：中文', exact: true }).click(); await page.getByRole('menuitemradio', { name: zh ? '中文' : 'English', exact: true }).click();
      await click('Confirm and publish event', '确认并发布活动'); await page.getByRole('alertdialog').getByRole('button', { name: /Cancel|取消/, exact: true }).click(); assert.equal(publishes.length, 0);
      await click('Confirm and publish event', '确认并发布活动'); await page.getByRole('alertdialog').getByRole('button', { name: t('Publish', '确认发布'), exact: true }).click();
      await page.getByRole('status').filter({ hasText: /Event published|活动已发布/ }).waitFor(); assert.equal(publishes.length, 1); assert.equal(publishes[0].packageId, 'qa-package');
      await page.reload(); await page.getByRole('status').filter({ hasText: /Event published|活动已发布/ }).waitFor(); assert.ok(page.url().includes('stage=publish')); assert.equal(creates.length, 1); assert.deepEqual(errors, []);
      await stage(/5.*Approval|5.*正式审批/);
      const requestReason = page.getByRole('group', { name: t('Changes needed and reason', '需要修改的内容及原因'), exact: true });
      await requestReason.getByLabel('English', { exact: true }).fill('Need to revise'); await requestReason.getByLabel('中文', { exact: true }).fill('需要再修改');
      await click('Request reopening for changes', '申请撤销审批并修改'); await page.getByRole('alertdialog').getByRole('button', { name: t('Confirm', '确认'), exact: true }).click();
      await page.getByText(t('Reopening requested; preparation remains frozen', '撤销申请待处理，方案仍冻结'), { exact: true }).waitFor();
      assert.equal(await flow().getByRole('link', { name: /Details|活动资料/ }).count(), 0); assert.equal(published, true);
      const reviewReason = page.getByRole('group', { name: t('Review reason', '处理理由'), exact: true });
      await reviewReason.getByLabel('English', { exact: true }).fill('Allow revision'); await reviewReason.getByLabel('中文', { exact: true }).fill('允许再修改');
      await click('Approve reopening', '同意撤销并解冻'); await page.getByRole('alertdialog').getByRole('button', { name: t('Confirm', '确认'), exact: true }).click();
      await page.getByText(t('Reopening approved; preparation is editable', '已同意撤销，活动可重新筹备'), { exact: true }).waitFor();
      assert.equal(published, false); assert.equal(await flow().getByRole('link', { name: /6.*Poster|6.*海报制作|7.*Publish|7.*发布活动/ }).count(), 0);
      await stage(/Details|活动资料/); await titleGroup().waitFor(); await stage(/5.*Approval|5.*正式审批/); await submit(); await decide(false);
      assert.equal(published, false); assert.equal(creates.length, 1); assert.deepEqual(errors, []); await checkLayout('reapproved');
      console.log(`PASS ${language} ${width}: repeated edits, return/amend/approve, frozen routes, post-approval poster, publication, reopen/reapprove, same event, language and layout`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
