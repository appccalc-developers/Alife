// Fixture-only browser integration: no live events, image uploads, AI calls or publication.
const assert = require('node:assert/strict');
const { showDetailsPane, expandTranslation } = require('./helpers/eventDetailsWorkspace.cjs');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const path = require('node:path');
const os = require('node:os');
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://127.0.0.1:5173';
const timezoneCheck = process.env.ALIFE_QA_TIMEZONE_ONLY === '1';
const aiTimezoneCheck = process.env.ALIFE_QA_AI_TIMEZONE === '1';
const apiTime = value => timezoneCheck ? value.replace(/Z$/, '') : value;
const text = (en, zh) => ({ en, zh });
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const file = { name: 'poster.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') };
const template = { code: 'shared-meal', archetypeCode: 'simple-social', version: 2, name: text('Fellowship meal', '团契聚餐'), description: text('Share a meal', '一起用餐'), iconKey: 'meal', defaults: { visibility: 'groupVisible', registrationMode: 'none', capacityUnit: 'People' }, preselectedModules: [], presetServiceSlots: [] };
const catalogue = [{ code: 'simple-social', version: 1, name: text('Simple social', '轻松相聚'), isSeries: false, occurrenceCount: 1, hasSessions: false, hasZones: false, requiredModules: [], recommendedModules: [], conditionalModules: [], workflowTemplateRecommendations: [], activityTypes: [template] }];
const proposal = { schemaVersion: '1.1.0', proposalHash: 'qa-hash', baselineETag: '"plan-new"', archetypeCode: 'simple-social', activityTypeCode: 'shared-meal', facts: { items: [], sourceHash: 'facts' }, roleRequirements: [], workflowContributions: [], navigation: [], warnings: [], readiness: { status: 'notReady', blockers: [], warnings: [] }, moduleDecisions: [{ moduleCode: 'TEAM.WORK', label: text('Team and tasks', '团队与任务'), status: 'required', reasonCodes: [], dependencies: [], dataClasses: [], integrationKey: '', surfaceKey: 'team.work', navigationOrder: 1 }] };

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.ALIFE_BROWSER_EXECUTABLE ? { executablePath: process.env.ALIFE_BROWSER_EXECUTABLE } : {}) }); let lastPage = null;
  try {
    for (const language of (process.env.ALIFE_QA_LANGUAGES || 'zh,en').split(',')) for (const width of (process.env.ALIFE_QA_WIDTHS || '320,375,768,1280').split(',').map(Number)) {
      const zh = language === 'zh', t = (en, cn) => zh ? cn : en;
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block', ...(timezoneCheck ? { timezoneId: process.env.ALIFE_QA_DEVICE_ZONE || 'America/Los_Angeles' } : {}) });
      await context.addInitScript(language => localStorage.setItem('alife.language', language), language);
      const page = await context.newPage(); lastPage = page; page.setDefaultTimeout(30000);
      const errors = [], creates = [], posterSaves = [], publishes = [], uploads = [], ai = [], detailSaves = [], acceptedPlans = [], taskSaves = [];
      let savedPlan = structuredClone(proposal), planRevision = 1;
      for (const [moduleCode, en, cn] of [['PEOPLE.REGISTRATION', 'Invitations and registration', '邀请与报名'], ['SERVICE.ROSTER', 'Roles and shifts', '岗位与轮班'], ['SAFETY.RAM', 'RAM and safety', 'RAM与安全'], ['SAFEGUARDING.CHILD', 'Child safeguarding', '儿童保护']]) {
        savedPlan.moduleDecisions.push({ ...structuredClone(proposal.moduleDecisions[0]), moduleCode, label: text(en, cn), surfaceKey: moduleCode.toLowerCase(), navigationOrder: savedPlan.moduleDecisions.length + 1 });
      }
      const venue = { id: 'qa-venue', managingGroupId: 'qa-group', name: text('Hall', '礼堂'), address: text('Address', '地址'), capacity: 50, isActive: true, eTag: '"venue-1"' };
      let arrangements = { occurrenceId: 'qa-occurrence', startUtc: '2026-10-04T10:00:00Z', endUtc: '2026-10-04T12:00:00Z', eTag: '"arrangements-1"', serviceSlots: [{ id: 'qa-slot', details: { roleCode: 'welcome', requiredCount: 3, eligibilityCode: 'approvedGroupMember', startOffsetMinutes: -15, endOffsetMinutes: 120 } }], sessions: [{ id: 'qa-session', details: { title: text('Opening', '开场'), startOffsetMinutes: 0, endOffsetMinutes: 120, items: [{ title: text('Welcome', '欢迎'), description: text('Opening remarks', '开场介绍'), startOffsetMinutes: 0, durationMinutes: 15 }] }, itemIds: ['qa-item'] }], venueBookings: [{ id: 'qa-booking', details: { venueId: 'qa-venue', venueETag: venue.eTag, requiredCapacity: 20, startOffsetMinutes: 0, endOffsetMinutes: 120 }, venue }] };
      const assessment = { tier: 'standard', policyVersion: 'qa-policy-custom', approvalDeadlineUtc: '2026-09-30T10:00:00Z', finalConfirmationWindowHours: 96, tiers: ['enhanced', 'standard', 'light'].map(tier => ({ tier, applies: tier !== 'enhanced', selected: tier === 'standard', reasons: tier === 'standard' ? [{ code: 'registration', message: text('Enabled tool: registration.', '已启用功能：报名。') }] : [] })) };
      for (const [moduleCode, en, cn] of [['PROGRAM.PRODUCTION', 'Programme and production', '节目与制作'], ['PLACE.RESOURCE', 'Venue and resources', '场地与资源'], ['MOVE.STAY', 'Travel and stay', '交通与住宿']]) savedPlan.moduleDecisions.push({ ...structuredClone(proposal.moduleDecisions[0]), moduleCode, label: text(en, cn), status: 'selected', surfaceKey: moduleCode.toLowerCase() });
      for (const code of ['FOOD.HOSPITALITY','MONEY.FINANCE','FESTIVAL.OPERATIONS']) savedPlan.moduleDecisions.push({ ...structuredClone(proposal.moduleDecisions[0]), moduleCode: code, label: text(code, code), status: 'inactive', surfaceKey: code.toLowerCase() });
      const roleRequirements = input => [['TEAM.WORK', 'event.accountableOwner'], ['TEAM.WORK', 'event.lead'], ['SERVICE.ROSTER', 'roster.coordinator'], ['SAFETY.RAM', 'ram.author'], ['SAFETY.RAM', 'ram.approver']].filter(([module, code]) => code === 'event.accountableOwner' || (input?.humanSelections.find(x => x.moduleCode === module)?.selected ?? savedPlan.moduleDecisions.find(x => x.moduleCode === module)?.status !== 'inactive')).map(([moduleCode, roleCode]) => ({ moduleCode, roleCode, requirementKey: `${moduleCode}:${roleCode}`, minimum: 1, recommended: 1, eligibility: [], separationFrom: [] }));
      savedPlan.roleRequirements = roleRequirements();
      const roleAssignments = [{ id: 'owner-role', roleRequirementKey: 'TEAM.WORK:event.accountableOwner', memberId: 'qa', status: 'accepted' }];
      const roleInvites = []; let rosterGroups = []; const rosterAssignments = []; let rosterRevision = 1;
      const applySelections = input => ({ ...savedPlan, arrangementConfirmations: input.arrangementConfirmations, moduleConfirmations: input.moduleConfirmations, roleRequirements: roleRequirements(input), moduleDecisions: savedPlan.moduleDecisions.map(item => {
        const selected = input.humanSelections.find(selection => selection.moduleCode === item.moduleCode)?.selected;
        return selected === undefined || (selected && item.status === 'required') ? item : { ...item, status: selected ? 'selected' : 'inactive' };
      }) });
      savedPlan.moduleDecisions.push({ moduleCode: 'COMMS.FOLLOWUP', label: text('Communications', '活动沟通'), status: 'inactive', reasonCodes: [], dependencies: [], dataClasses: [], integrationKey: '', surfaceKey: 'comms.followup', navigationOrder: 2 });
      let viewOnly = false, enrollmentFailure = false, delayPreparationOnce = false; let reads = 0, approved = false, submitted = false, returned = false, reopen = null, published = false, conflict = width === 1280;
      let info = { eventId: 'qa-event', groupId: 'qa-group', brief: { title: text('Community meal', '社区聚餐'), description: text('A meal together', '一同聚餐'), purpose: text('', ''), locationName: text('Hall', '礼堂'), startDate: '2026-10-04T10:00:00Z', endDate: '2026-10-04T12:00:00Z' }, posterImageUrl: null, visibility: width === 320 ? 'groupVisible' : width === 768 ? 'churchVisible' : 'public', registrationMode: 'none', eTag: '"poster-v1"', canManage: true };
      let ramAssessment = null; const ramRevision = { id: 'ram-version', version: 1, schemaVersion: 2, policyVersionId: null, contentHash: 'fixture-hash', residualLevel: 'Incomplete', authorMemberId: 'qa', onsiteMemberId: null, createdUtc: '2026-09-12T00:00:00Z' };
      let updatedUtc = '2026-09-11T00:00:00Z';
      const record = () => ({ id: 'qa-event', groupId: 'qa-group', accountableOwnerMemberId: 'qa', titleEn: info.brief.title.en, titleZh: info.brief.title.zh, startDate: apiTime(info.brief.startDate), endDate: apiTime(info.brief.endDate), updatedUtc, visibility: info.visibility, contactProfileIds: [], eventDataJson: JSON.stringify({ ...info.brief, ...(timezoneCheck ? { timeZone: 'Australia/Perth' } : {}), maxCapacity: info.brief.maxCapacity || 0, visibility: info.visibility, capacityUnit: 'People', currency: 'NZD', hardConstraints: [], optionalActivities: [], galleryUrls: [], privateContact: 'preserved' }) });
      const preparation = () => ({ eventId: 'qa-event', isFrozen: approved, isApproved: approved, canManage: true, canEdit: !approved && !viewOnly, approvedPackageId: approved ? 'qa-package' : null, reopenRequest: reopen });
      const item = () => ({ id: 'qa-package', eventId: 'qa-event', scopeType: 'event', coverageMode: 'explicitOccurrences', coveredOccurrenceIds: [], version: 1, eventPlanVersion: 1, packageSchemaVersion: '1.0', governancePolicyVersion: 'qa-policy', governanceTier: assessment.tier, status: approved ? 'approved' : returned ? 'returnedForAmendment' : submitted ? 'submitted' : 'draft', approvalValidityStatus: approved ? 'active' : 'notDecided', contentHash: 'qa-content-hash', sourceVectorHash: 'qa-source', manifest: { eventTitle: info.brief.title, legacyTransition: 'formalPackageRequired', modules: [], blockers: [], sections: [] }, sourceReferences: [], decisions: [], conditions: [], generatedUtc: '2026-09-11T00:00:00Z', eTag: '"package-v1"' });
      const lifecycle = () => ({ eventId: 'qa-event', publicationStatus: published ? 'published' : 'draft', publishGateSatisfied: approved, gateMode: 'enforced', reasonCodes: [], eTag: '"lifecycle-v1"', registrationStatus: 'closed', gates: [{ gate: 'publish', enforcementMode: 'enforced', allowed: approved, requirementsSatisfied: approved, blockers: approved ? [] : [{ code: 'approvalRequired', message: text('Formal approval is required.', '需要正式审批。'), responsibleRole: 'approver', nextAction: 'approve' }], warnings: [] }] });
      page.on('pageerror', error => { errors.push(error.message); console.error('PAGE ERROR', error.message) });
      page.on('console', message => { if (message.type() === 'error') console.error('BROWSER ERROR', message.text()); });
      await context.route('https://example.org/poster.png', route => route.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') }));
      await context.route('**/api/**', async route => {
        const req = route.request(), pathname = new URL(req.url()).pathname; let data = [], status = 200;
        if (req.method() === 'GET') reads++;
        if (pathname === '/api/me') data = { id: 'qa', displayName: 'QA Leader', isGuest: false, isRegistered: true, platformRole: 'superadmin', permissions: ['admin.access'], memberships: [] };
        else if (pathname.endsWith('/enrollments') && enrollmentFailure) { status = 503; data = { message: 'Enrollment temporarily unavailable' }; } else if (pathname === '/api/event-archetypes') data = catalogue;
        else if (pathname.endsWith('/compose') && !pathname.endsWith('/plan/recompose')) data = proposal;
        else if (pathname === '/api/groups/qa-group/events' && req.method() === 'POST') { creates.push(req.postDataJSON()); data = { id: 'qa-event', groupId: 'qa-group' }; }
        else if (pathname === '/api/groups/qa-group/events' && req.method() === 'GET') data = [record()];
        else if (pathname === '/api/events/qa-event' && req.method() === 'PUT') { assert.equal(req.headers()['if-match'], `"${updatedUtc}"`); updatedUtc = new Date(Date.parse(updatedUtc) + 1000).toISOString(); detailSaves.push({ body: req.postDataJSON(), headers: req.headers() }); const body = req.postDataJSON(); info.brief = { ...info.brief, ...JSON.parse(body.eventDataJson), title: text(body.titleEn, body.titleZh) }; data = record(); }
        else if (pathname.endsWith('/venue-reservations')) data = { eventId: 'qa-event', managingGroupId: 'qa-group', venues: [venue], reservations: [], conflicts: [], readiness: { blockers: [], capacitySufficient: true, bookingsConfirmed: false, conflictsResolved: true }, canManage: true, canManageCatalogue: true };
        else if (pathname === '/api/events/qa-event/safeguarding' && width === 1280) data = { eventId: 'qa-event', accessMode: 'lead', availablePolicies: [], occurrences: [], enrollmentOptions: [], memberOptions: [], children: [], workerEvidence: [], audit: [], readiness: { blockers: [] }, configurationETag: '"safeguarding-1"' };
        else if (pathname === '/api/events/qa-event/travel' && width === 1280) data = { eventId: 'qa-event', occurrences: [], eligibleMembers: [], drivers: [], vehicles: [], journeys: [], ramEvidence: { status: 'draft', checksComplete: false }, readiness: { blockers: [] }, canManage: true };
        else if (pathname.includes('/safeguarding') || pathname.includes('/travel')) { status = 403; data = { message: 'Duty access required' }; }
        else if (pathname.endsWith('/programme/sessions/qa-session') && req.method() === 'PUT') { assert.equal(req.headers()['if-match'], '"programme-1"'); const body = req.postDataJSON(); arrangements.sessions[0].details.title = body.title; updatedUtc = new Date(Date.parse(updatedUtc) + 1000).toISOString(); data = { eventId: 'qa-event', occurrenceId: 'qa-occurrence', eTag: '"programme-2"', canManage: true, sessions: arrangements.sessions.map(row => ({ id: row.id, title: row.details.title, startUtc: arrangements.startUtc, endUtc: arrangements.endUtc, status: 'draft', items: row.details.items.map((value, i) => ({ ...value, id: row.itemIds[i] })) })) }; }
        else if (pathname.endsWith('/programme')) data = { eventId: 'qa-event', occurrenceId: 'qa-occurrence', eTag: '"programme-1"', canManage: true, sessions: arrangements.sessions.map(row => ({ id: row.id, title: row.details.title, startUtc: arrangements.startUtc, endUtc: arrangements.endUtc, status: 'draft', items: row.details.items.map((value, i) => ({ ...value, id: row.itemIds[i] })) })) };
        else if (pathname.endsWith('/roster/groups')) {
          if (req.method() === 'PUT') { const body = req.postDataJSON(), old = rosterGroups.find(x => x.roleCode === body.roleCode); assert.equal(req.headers()['if-match'], old?.eTag || '"new"'); data = { ...body, eTag: `"group-${++rosterRevision}"` }; rosterGroups = [...rosterGroups.filter(x => x.roleCode !== body.roleCode), data]; }
          else data = rosterGroups;
        }
        else if (pathname.endsWith('/roster/page')) data = { page: 1, pageSize: 4, total: 1, timeZone: 'Australia/Perth', canManage: true, canConfigure: true, isRecurring: false, defaultsVersion: null, defaultsETag: '"defaults-0"', groups: rosterGroups, people: [{ id: 'qa', displayName: 'QA Leader' }, { id: 'qa2', displayName: 'QA Helper' }], occurrences: [{ id: 'qa-occurrence', startUtc: arrangements.startUtc, endUtc: arrangements.endUtc, roster: { eventId: 'qa-event', occurrenceId: 'qa-occurrence', eTag: `"roster-${rosterRevision}"`, canManage: true, readinessBlockers: [], slots: [] } }] };
        else if (pathname.endsWith('/roster')) data = { eventId: 'qa-event', occurrenceId: 'qa-occurrence', eTag: `"roster-${rosterRevision}"`, canManage: true, canConfigure: true, readinessBlockers: [], slots: arrangements.serviceSlots.map(row => ({ ...row.details, id: row.id, startUtc: arrangements.startUtc, endUtc: arrangements.endUtc, confirmedCount: 0, assignments: rosterAssignments, moduleCode: rosterGroups.find(g => g.roleCode === row.details.roleCode)?.moduleCode || 'SERVICE.ROSTER', candidateMemberIds: rosterGroups.find(g => g.roleCode === row.details.roleCode)?.memberIds || [] })) };
        else if (pathname.endsWith('/venues')) data = { managingGroupId: 'qa-group', venues: [venue], canManage: true };
        else if (pathname.endsWith('/occurrences')) data = [{ id: 'qa-occurrence', eventId: 'qa-event', startUtc: arrangements.startUtc, endUtc: arrangements.endUtc, status: 'scheduled' }, ...(width === 1280 ? [{ id: 'qa-occurrence-2', eventId: 'qa-event', startUtc: '2026-10-11T10:00:00Z', endUtc: '2026-10-11T12:00:00Z', status: 'scheduled' }] : [])];
        else if (pathname.endsWith('/preparation/arrangements')) data = new URL(req.url()).searchParams.get('occurrenceId') === 'qa-occurrence-2' ? { ...arrangements, occurrenceId: 'qa-occurrence-2', startUtc: '2026-10-11T10:00:00Z', endUtc: '2026-10-11T12:00:00Z' } : arrangements;
        else if (pathname.endsWith('/packages/assessment')) data = assessment;
        else if (pathname.endsWith('/preparation')) { if (delayPreparationOnce) { delayPreparationOnce = false; await new Promise(resolve => setTimeout(resolve, 650)); } data = preparation(); }
        else if (pathname.endsWith('/reopen-requests')) { reopen = { id: 'qa-reopen', eventPackageId: 'qa-package', status: 'pending', reason: req.postDataJSON().reason, eTag: '"reopen-v1"', canReview: true }; data = preparation(); }
        else if (pathname.endsWith('/qa-reopen/review')) { assert.equal(req.headers()['if-match'], '"reopen-v1"'); assert.ok(req.headers()['idempotency-key']); approved = false; published = false; submitted = false; reopen = { ...reopen, status: 'approved', canReview: false, reviewReason: req.postDataJSON().reason }; data = preparation(); }
        else if (pathname.endsWith('/ram') && req.method() === 'PUT') { const body = req.postDataJSON(); assert.equal(body.schemaVersion, 2); updatedUtc = new Date(Date.parse(updatedUtc) + 1000).toISOString(); ramAssessment = { eventId: 'qa-event', groupId: 'qa-group', schemaVersion: 2, eTag: 'ram-saved', validity: 'Draft', status: 'draft', residualLevel: 'Incomplete', ramDataJson: body.ramDataJson, policyVersionId: null }; data = ramAssessment; }
        else if (pathname.endsWith('/ram/versions/ram-version')) data = { revision: ramRevision, ramDataJson: ramAssessment.ramDataJson, policy: null, actions: [], isCurrent: true, validity: 'Draft', isDraft: true };
        else if (pathname.endsWith('/ram/workspace')) data = { assessment: ramAssessment, policy: null, history: [ramRevision], actions: [], onsiteCandidates: [], canEdit: true, canAudit: false, currentMemberId: 'qa', isRequired: true };
        else if (pathname.endsWith('/ram/sync')) data = { isRequired: false, eTag: '"ram-sync-v1"', canReview: false, canRetry: false, sync: { status: 'Draft', isUpdated: false, lastEvaluatedAt: null, error: null, reviewedByMemberId: null, reviewedAt: null } };
        else if (pathname.endsWith('/activity-plan')) data = { data: { activities: [], participantCount: null, isOuting: false, isOvernight: false, isHighRisk: false, weatherConfirmation: text('', '') }, eTag: '"activity-plan-v1"', canEdit: true, legacyCandidate: null, reports: [] };
        else if (pathname.endsWith('/workspace')) data = { eventId: 'qa-event', owningGroupId: 'qa-group', title: info.brief.title, canManage: true, items: savedPlan.moduleDecisions.filter(x => x.status !== 'inactive').map(x => ({ surfaceKey: x.surfaceKey, moduleCode: x.moduleCode, label: x.label, order: x.navigationOrder, readiness: 'notReady', presentation: 'page', blockers: [] })) };
        else if (pathname.endsWith('/plan')) data = { eventId: 'qa-event', planVersion: planRevision, eTag: `"plan-v${planRevision}"`, plan: savedPlan };
        else if (pathname.endsWith('/plan/recompose')) data = applySelections(req.postDataJSON());
        else if (pathname.endsWith('/plan/accept')) { acceptedPlans.push({ body: req.postDataJSON(), headers: req.headers() }); updatedUtc = new Date(Date.parse(updatedUtc) + 1000).toISOString(); if (req.postDataJSON().arrangements) arrangements = { ...arrangements, ...req.postDataJSON().arrangements, eTag: `"arrangements-${planRevision + 1}"` }; arrangements.venueBookings = arrangements.venueBookings.map(row => ({ ...row, venue })); planRevision++; savedPlan = applySelections(req.postDataJSON().composition); data = { eventId: 'qa-event', planVersion: planRevision, eTag: `"plan-v${planRevision}"`, plan: savedPlan }; }
        else if (pathname.endsWith('/tasks') && req.method() === 'POST') { taskSaves.push(req.postDataJSON()); updatedUtc = new Date(Date.parse(updatedUtc) + 1000).toISOString(); data = { id: 'qa-task' }; }
        else if (pathname.endsWith('/memberships')) data = [{ memberId: 'qa', displayName: 'QA Leader', status: 'approved' }, { memberId: 'qa2', displayName: 'QA Helper', status: 'approved' }];
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
        else if (pathname.includes('/details-session/') && pathname.endsWith('/message')) {
          const body = req.postDataJSON(), snapshot = body.appContext.knownFacts.snapshot;
          const day = snapshot.form.startLocal.slice(0, 10);
          const invalid = body.message === 'bad-zone', stale = body.message === 'stale';
          data = { responseMode: 'result', result: { ...snapshot, revision: snapshot.revision - (stale ? 1 : 0), form: { ...snapshot.form, timeZone: invalid ? 'UTC' : snapshot.form.timeZone, startLocal: `${day}T08:00`, endLocal: `${day}T16:00` }, sources: { ...snapshot.sources, startLocal: 'explicit', endLocal: 'explicit' }, adoptedFields: ['startLocal', 'endLocal'], fieldAssessments: [], issues: [], assessment: { sufficiencyScore: 30, summary: text('Review details', '请核对资料') }, assistantReply: text('Time updated in the event time zone.', '已按活动时区更新时间。') } };
        }
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
      const tile = code => page.locator(`[data-arrangement-tile="${code}"]`);
      const open = async code => { await page.waitForFunction(() => { const overview = document.querySelector('[data-arrangement-overview]'); return overview && !overview.closest('fieldset:disabled') && !overview.querySelector(':scope > [role="status"]')?.textContent?.trim(); }); if (!await tile(code).isVisible()) await page.getByRole('button', { name: /Show all modules|显示所有模块/ }).click(); await tile(code).waitFor(); const selecting = await tile(code).getAttribute('aria-expanded') !== 'true'; if (selecting) await tile(code).click(); const root = page.locator(`[data-module-editor="${code}"]`); await root.waitFor({ state: 'visible' }); if (selecting) await page.waitForFunction(code => document.activeElement === document.getElementById(`module-heading-${code}`), code); return root; };
      const work = async (root, en, cn) => { const summary = root.locator('summary').filter({ has: page.getByText(t(en, cn), { exact: true }) }); await summary.waitFor(); const card = summary.locator('..'); if (await card.getAttribute('open') === null) await summary.click(); return card; };

      const settings = async code => { const root = await open(code); await work(root,'Settings and responsibilities','设置与职责'); return root; };
      const click = (en, cn) => page.getByRole('button', { name: t(en, cn), exact: true }).click();
      const askTime = async (message = t('Change to 8am to 4pm', '改为早上八点到下午四点')) => {
        await showDetailsPane(page, 'assistant');
        const input = page.locator('[data-module-editor="EVENT.DETAILS"] textarea[maxlength="8000"]:visible');
        await input.fill(message); await click('Send and organise details', '发送并整理资料');
        if (message === 'bad-zone' || message === 'stale') {
          await page.getByText(message === 'stale' ? /old reply was not adopted|未采用旧回复/ : /Invalid AI time/).waitFor();
          assert.equal(await input.inputValue(), message);
        } else await page.getByText(t('Time updated in the event time zone.', '已按活动时区更新时间。'), { exact: true }).last().waitFor();
      };
      const clickWhenEnabled = async button => {
        await button.click();
      };
      const waitForDetailsSave = async () => {
        const before = detailSaves.length;
        const response = page.waitForResponse(response => response.url().endsWith('/api/events/qa-event') && response.request().method() === 'PUT' && response.ok());
        await click('Save event details', '保存活动资料');
        await response;
        assert.equal(detailSaves.length, before + 1);
        await page.getByRole('status').filter({ hasText: /Event details saved|活动资料已保存/ }).waitFor();
      };
      const waitForArrangementSave = async before => {
        await click('Save arrangements', '保存活动安排');
        for (let attempt = 0; attempt < 200 && acceptedPlans.length <= before; attempt += 1) await page.waitForTimeout(100);
        assert.ok(acceptedPlans.length > before, 'arrangement changes must be accepted after an explicit save');
        await page.waitForTimeout(1600);
        await page.getByRole('status').filter({ hasText: /Event arrangements saved|活动安排已保存/ }).waitFor();
        return acceptedPlans.at(-1);
      };
      const flow = () => page.getByRole('navigation', { name: t('Event preparation flow', '活动筹备流程'), exact: true });
      const stage = async name => { if (name.source === 'Details|活动资料') { if (!await tile('EVENT.DETAILS').isVisible()) await flow().getByRole('link', { name: /Arrangements|活动安排/ }).click(); await open('EVENT.DETAILS'); return }; await flow().getByRole('link', { name }).click(); };
      const checkLayout = async name => { await page.evaluate(() => window.scrollTo(0, 0)); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name); await page.screenshot({ path: path.join(os.tmpdir(), `alife-flow-${name}-${language}-${width}.png`) }); };
      await page.goto(`${base}/events/new?groupId=qa-group`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.getByRole('button', { name: /轻松相聚|Simple social/ }).click();
      await page.getByRole('button', { name: /团契聚餐|Fellowship meal/ }).click(); await click('Start arranging', '开始安排'); await open('EVENT.DETAILS');
      const checkDetailsHeader = async () => {
        const card = page.locator('[data-event-details-card]');
        const heading = card.locator('header').getByRole('heading', { name: t('Fellowship meal', '团契聚餐'), exact: true });
        const toggle = card.locator('header').getByRole('button', { name: /Show (all|related) modules|显示(所有|相关)模块/ });
        await heading.waitFor(); assert.equal(await toggle.count(), 1);
        assert.equal(await card.getByText(t('Event details', '活动资料'), { exact: true }).count(), 0);
        const headingBox = await heading.boundingBox(), toggleBox = await toggle.boundingBox();
        assert.ok(width < 480 ? toggleBox.y >= headingBox.y + headingBox.height - 1 : toggleBox.x >= headingBox.x + headingBox.width - 1);
        const expanded = await tile('EVENT.DETAILS').getAttribute('aria-expanded');
        await toggle.click(); assert.equal(await tile('EVENT.DETAILS').getAttribute('aria-expanded'), expanded);
        await toggle.click();
      };
      await checkDetailsHeader();
      for (const [label, en, cn] of [[t('Event title', '活动名称'), 'Community meal', '社区聚餐'], [t('Description', '活动说明'), 'A meal together', '一同聚餐']]) {
        const group = page.getByRole('group', { name: label, exact: true }); await showDetailsPane(page, 'form'); await expandTranslation(group); await group.getByLabel('English', { exact: true }).fill(en); await group.getByLabel('中文', { exact: true }).fill(cn);
      }
      await page.getByLabel(t('Start time', '开始时间'), { exact: true }).fill('2026-10-04T18:00');
      await page.getByLabel(t('End time', '结束时间'), { exact: true }).fill('2026-10-04T20:00');
      if (aiTimezoneCheck) {
        for (const message of ['bad-zone', 'stale']) {
          await askTime(message);
          assert.equal(await page.getByLabel(t('Start time', '开始时间'), { exact: true }).inputValue(), '2026-10-04T18:00');
        }
        await askTime();
        assert.equal(await page.getByLabel(t('Start time', '开始时间'), { exact: true }).inputValue(), '2026-10-04T08:00');
      }
      await page.evaluate(label => { window.__rosterBatchFlashes = 0; new MutationObserver(() => {
        if (location.pathname.endsWith('/workspace') && document.body.innerText.includes(label)) window.__rosterBatchFlashes++;
      }).observe(document.body, { childList: true, subtree: true, characterData: true }); }, t('Schedule across dates', '多场次手工排班'));
      delayPreparationOnce = true;
      await flow().getByRole('button', { name: /Create|确认创建/ }).click();
      await click('Confirm and create event', '确认创建活动');
      await page.waitForURL('**/qa-event/workspace?flow=setup&stage=arrangements');
      await tile('TEAM.WORK').waitFor(); assert.equal(await flow().locator('li').count(), 6); assert.equal(await page.getByLabel(t('Choose a tool to configure', '选择要设置的功能')).count(), 0); assert.equal(creates.length, 1);
      assert.equal(await page.getByRole('heading', { name: t('RAM · Final risk review', 'RAM · 汇总风险核对') }).count(), 0);
      assert.equal(await page.getByText(t('Schedule across dates', '多场次手工排班'), { exact: true }).count(), 0);
      assert.equal(await page.evaluate(() => window.__rosterBatchFlashes), 0);
      assert.equal(await flow().getByRole('button', { disabled: true }).count(), 3); await checkLayout('setup');
      const safetyPanel = page.getByRole('region', { name: t('RAM and safety', 'RAM与安全'), exact: true });
      await open('SAFETY.RAM');
      assert.equal(await safetyPanel.getByRole('heading', { name: t('RAM · Final risk review', 'RAM · 汇总风险核对') }).count(), 1);
      await open('TEAM.WORK');
      if (process.env.ALIFE_STAGE_ROLE_SMOKE === '1') {
        assert.deepEqual(errors, []);
        console.log(`PASS preparation ${language}/${width}: delayed status, no coordinator-batch flash, saved Event setup and layout`);
        await context.close(); continue;
      }
      if (timezoneCheck) {
        await checkDetailsHeader();
        await open('EVENT.DETAILS');
        const start = () => page.getByLabel(t('Start time', '开始时间'), { exact: true });
        const end = () => page.getByLabel(t('End time', '结束时间'), { exact: true });
        const saved = page.waitForResponse(response => response.url().endsWith('/api/events/qa-event') && response.request().method() === 'PUT' && response.ok() && response.request().postDataJSON().startDate === '2026-12-06T02:00:00.000Z');
        await end().fill('2026-12-06T20:00'); await start().fill('2026-12-06T10:00');
        await click('Save event details', '保存活动资料'); await saved;
        await page.getByRole('status').filter({ hasText: /Event details saved|活动资料已保存/ }).waitFor();
        assert.equal(detailSaves.at(-1).body.endDate, '2026-12-06T12:00:00.000Z');
        assert.equal(JSON.parse(detailSaves.at(-1).body.eventDataJson).timeZone, 'Australia/Perth');
        if (aiTimezoneCheck) {
          const aiSaved = page.waitForResponse(response => response.url().endsWith('/api/events/qa-event') && response.request().method() === 'PUT' && response.ok() && response.request().postDataJSON().startDate === '2026-12-06T00:00:00.000Z');
          await askTime(); await click('Save event details', '保存活动资料'); await aiSaved;
          await page.getByRole('status').filter({ hasText: /Event details saved|活动资料已保存/ }).waitFor();
          assert.equal(detailSaves.at(-1).body.endDate, '2026-12-06T08:00:00.000Z');
        }
        const writes = detailSaves.length;
        for (let reload = 0; reload < 2; reload++) {
          await page.goto(`${base}/groups/qa-group/events/qa-event/workspace?flow=setup&stage=details`, { waitUntil: 'domcontentloaded' });
          try { await start().waitFor(); } catch (error) { console.error('Timezone reload failed', page.url(), errors, await page.locator('body').innerText()); throw error; }
          assert.equal(await start().inputValue(), aiTimezoneCheck ? '2026-12-06T08:00' : '2026-12-06T10:00');
          assert.equal(await end().inputValue(), aiTimezoneCheck ? '2026-12-06T16:00' : '2026-12-06T20:00');
          await page.waitForTimeout(1300); assert.equal(detailSaves.length, writes);
        }
        await checkLayout('timezone'); assert.deepEqual(errors, []);
        console.log(`PASS ${language} ${width}: ${aiTimezoneCheck ? 'AI 08:00–16:00, invalid/stale response retention, creation and saved editing' : '10:00–20:00'}, save/reload, offsetless SQL timestamps, ${process.env.ALIFE_QA_DEVICE_ZONE || 'America/Los_Angeles'}, no repeat writes`);
        await context.close(); continue;
      }
      if (process.env.ALIFE_QA_DETAILS_ONLY === '1') {
        const details = await open('EVENT.DETAILS');
        await showDetailsPane(page, 'form');
        const titleGroup = details.getByRole('group', { name: t('Event title', '活动名称'), exact: true });
        await expandTranslation(titleGroup);
        const title = titleGroup.getByLabel('English', { exact: true });
        await title.fill('Retained event title');
        await page.waitForTimeout(1300); assert.equal(detailSaves.length, 0, 'manual editing is a draft until explicit save');
        await askTime();
        await page.waitForTimeout(1300); assert.equal(detailSaves.length, 0, 'AI adoption cannot persist');
        await open('TEAM.WORK'); await open('EVENT.DETAILS');
        await showDetailsPane(page, 'form');
        assert.equal(await title.inputValue(), 'Retained event title');
        await waitForDetailsSave();
        await showDetailsPane(page, 'assistant');
        assert.equal(await details.getByRole('log').locator(':scope > div').count(), 2);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: path.join(os.tmpdir(), `alife-pilot-saved-${language}-${width}.png`), fullPage: true });
        await page.goto(`${base}/groups/qa-group/events/qa-event/workspace?flow=setup&stage=details`);
        await page.locator('[data-module-editor="EVENT.DETAILS"]:visible').waitFor();
        await showDetailsPane(page, 'form');
        await expandTranslation(page.locator('[data-detail-field="title"]'));
        assert.equal(await page.locator('[data-detail-field="title"]').getByLabel('English', { exact: true }).inputValue(), 'Retained event title');
        assert.equal(detailSaves.length, 1);
        // Current registration rules own capacity; the details form must not create a competing field.
        info.brief.registrationRulesVersion = 1; info.brief.maxCapacity = 24;
        viewOnly = true; await page.reload(); await open('EVENT.DETAILS');
        await showDetailsPane(page, 'form');
        await expandTranslation(page.locator('[data-detail-field="title"]'));
        assert.equal(await page.locator('[data-detail-field="title"]').getByLabel('English', { exact: true }).isDisabled(), true);
        assert.equal(await page.locator('[data-detail-field="maxCapacity"] input').count(), 0);
        await page.getByText(/Capacity and deadline are managed|人数上限和截止时间由/).waitFor();
        await showDetailsPane(page, 'assistant');
        assert.equal(await page.getByRole('button', { name: t('Send and organise details', '发送并整理资料'), exact: true }).isDisabled(), true);
        await showDetailsPane(page, 'form');
        viewOnly = false; approved = true; await page.reload();
        await page.getByRole('heading', { name: t('This step is currently unavailable','此步骤暂不可进入'), exact: true }).waitFor();
        assert.equal(await page.locator('[data-module-editor="EVENT.DETAILS"]').count(), 0);
        assert.equal(await page.getByRole('button', { name: t('Save event details','保存活动资料'), exact: true }).count(), 0);
        assert.equal(detailSaves.length, 1); assert.deepEqual(errors, []);
        console.log(`PASS saved pilot ${language} ${width}: manual/AI drafts, explicit save, session retention, legacy details link, managed capacity, read-only browsing, approval freeze`);
        await context.close(); continue;
      }
      viewOnly = true; enrollmentFailure = true;
      await page.reload();
      const readOnlyTeam = await open('TEAM.WORK');
      assert.equal(await readOnlyTeam.locator('details[data-tool-panel][open]').count(), 1);
      const readOnlySettings = await work(readOnlyTeam, 'Settings and responsibilities', '设置与职责');
      assert.equal(await readOnlySettings.getByRole('switch').isDisabled(), true);
      await readOnlySettings.locator(':scope > summary').press('Enter');
      assert.equal(await readOnlySettings.getAttribute('open'), null, 'read-only cards can collapse');
      await readOnlySettings.locator(':scope > summary').press('Space');
      assert.notEqual(await readOnlySettings.getAttribute('open'), null, 'read-only cards can expand');
      const readOnlyTasks = await work(readOnlyTeam, 'Custom tasks and preparation', '自定义任务与准备情况');
      assert.equal(await readOnlyTasks.getByRole('button', { name: t('Add task', '新增任务'), exact: true }).isDisabled(), true);
      await readOnlyTasks.locator(':scope > summary').press('Enter');
      assert.equal(await readOnlyTasks.getAttribute('open'), null, 'disclosure remains usable inside a disabled business fieldset');
      await readOnlyTasks.locator(':scope > summary').press('Space');
      assert.notEqual(await readOnlyTasks.getAttribute('open'), null);
      viewOnly = false; await page.reload();
      const failedEnrollment = await open('PEOPLE.REGISTRATION');
      const failedSummary = failedEnrollment.locator('summary').filter({ hasText: /Loading failed|读取失败/ });
      await failedSummary.waitFor();
      assert.equal(await failedSummary.locator('..').getAttribute('open'), null, 'async error card starts closed');
      await failedSummary.click(); enrollmentFailure = false;
      await failedEnrollment.getByRole('button', { name: t('Retry', '重试'), exact: true }).click();
      await failedSummary.waitFor({ state: 'detached' });
      assert.equal(detailSaves.length, 0); assert.equal(acceptedPlans.length, 0); assert.equal(taskSaves.length, 0);
      await page.reload();
      await page.goto(`${base}/groups/qa-group/events/qa-event/workspace?flow=setup&stage=setup&module=team.work`);
      await settings('TEAM.WORK');
      assert.equal(await page.getByRole('heading', { name: /Team members|团队成员/, exact: true }).isVisible(), false);
      assert.equal(await tile('EVENT.DETAILS').locator('select').count(), 0);
      await page.getByRole('region', { name: t('On-site event lead', '现场活动领队'), exact: true }).waitFor();
      assert.equal(await flow().getByRole('link', { name: /Arrangements|活动安排/ }).getAttribute('aria-current'), 'step');
      const team = page.getByRole('region', { name: t('Team and tasks', '团队与任务'), exact: true });
      const rosterModule = page.getByRole('region', { name: t('Roles and shifts', '岗位与轮班'), exact: true });
      await open('SERVICE.ROSTER'); await work(rosterModule, 'Role shifts', '岗位轮班');
      await rosterModule.getByText(t('Position settings and personal availability by date', '单场次岗位设置与个人可用性'), { exact: true }).click();
      const groupEditor = rosterModule.locator('[data-roster-candidate-group]');
      await groupEditor.locator('summary').click();

      await groupEditor.getByLabel(t('Add to this role group', '加入此岗位候选组'), { exact: true }).selectOption('qa');
      await groupEditor.getByRole('button', { name: t('Add candidate', '加入候选组'), exact: true }).click();
      await groupEditor.getByLabel(t('Add to this role group', '加入此岗位候选组'), { exact: true }).selectOption('qa2');
      await groupEditor.getByRole('button', { name: t('Add candidate','加入候选组'), exact: true }).click();
      await groupEditor.getByRole('button', { name: t('Move up QA Helper','上移 QA Helper'), exact: true }).click();
      await groupEditor.getByLabel(t('Owning module', '所属模块'), { exact: true }).selectOption('PEOPLE.REGISTRATION');
      await open('TEAM.WORK'); await open('SERVICE.ROSTER');
      assert.equal(await groupEditor.getByLabel(t('Owning module','所属模块'), { exact: true }).inputValue(), 'PEOPLE.REGISTRATION');
      await groupEditor.getByRole('button', { name: t('Save role candidate group', '保存岗位候选组'), exact: true }).click();
      const registration = page.getByRole('region', { name: t('Invitations and registration', '邀请与报名'), exact: true });
      await open('PEOPLE.REGISTRATION'); await work(registration, 'Role shifts', '岗位轮班');
      await registration.getByText(t('Position settings and personal availability by date', '单场次岗位设置与个人可用性'), { exact: true }).click();
      await registration.locator('[data-roster-candidate-group]').waitFor();
      assert.equal(await rosterModule.locator('[data-roster-candidate-group]').count(), 0);
      assert.deepEqual(rosterGroups[0].memberIds, ['qa2','qa']);
      await registration.screenshot({ path: path.join(os.tmpdir(), `alife-role-roster-${language}-${width}.png`) });
      if (process.env.ALIFE_QA_ROSTER_ONLY === '1') { assert.deepEqual(errors, []); console.log(`PASS role roster ${language} ${width}`); await context.close(); continue; }
      await open('TEAM.WORK'); await work(team, 'Custom tasks and preparation', '自定义任务与准备情况');
      await team.getByLabel(t('English title', '英文標題'), { exact: true }).fill('Prepare tables');
      await tile('TEAM.WORK').click(); await open('TEAM.WORK');
      assert.equal(await team.getByLabel(t('English title','英文標題'), { exact: true }).inputValue(), 'Prepare tables');
      await team.getByLabel(t('Chinese title', '中文標題'), { exact: true }).fill('安排桌椅');
      await Promise.all([page.waitForResponse(response => response.url().endsWith('/tasks') && response.request().method() === 'POST' && response.ok()), team.getByRole('button', { name: t('Add task', '新增任务'), exact: true }).click()]);
      await page.waitForFunction(() => !document.querySelector('[data-module-editor]:not([hidden])')?.closest('fieldset:disabled'));
      assert.equal(taskSaves.length, 1); assert.equal(taskSaves[0].title.en, 'Prepare tables');
      assert.deepEqual(errors, []);

      assert.deepEqual(await team.locator('input,select,textarea').evaluateAll(nodes => nodes.filter(node => { const r = node.getBoundingClientRect(); return r.width && (r.left < 0 || r.right > innerWidth + 1); }).map(node => node.outerHTML.slice(0, 120))), [], 'embedded team fields fit the mobile viewport');
      await team.screenshot({ path: path.join(os.tmpdir(), `alife-integrated-team-${language}-${width}.png`) });
      await page.goto(`${base}/groups/qa-group/events/qa-event/edit`);
      await page.waitForFunction(() => location.pathname.endsWith('/workspace') && new URLSearchParams(location.search).get('stage') === 'details');
      assert.equal(await flow().getByRole('link', { name: /Template|选择模板/ }).count(), 0);
      const titleGroup = () => page.getByRole('group', { name: t('Event title', '活动名称'), exact: true });
      await titleGroup().getByLabel('English', { exact: true }).fill('Revised meal');
      assert.equal(await flow().getByRole('link', { name: /4.*Approval|4.*正式审批/ }).count(), 0);
      await stage(/Arrangements|活动安排/); await tile('TEAM.WORK').waitFor(); await waitForDetailsSave();
      assert.equal(await page.getByRole('button', { name: t('Open RAM assessment', '打开 RAM 评估表'), exact: true }).count(), 0);
      const ram = page.getByRole('region', { name: t('RAM and safety', 'RAM与安全'), exact: true });
      await open('SAFETY.RAM'); await work(ram, 'Activities and conditions','活动项目与条件');
      assert.equal(await ram.getByRole('heading', { name: t('RAM · Final risk review', 'RAM · 汇总风险核对') }).count(), 1);
      await ram.getByLabel(t('Participant count','参与人数'), { exact: true }).fill('14');
      await open('TEAM.WORK'); await open('SAFETY.RAM');
      assert.equal(await ram.getByLabel(t('Participant count','参与人数'), { exact: true }).inputValue(), '14');
      await ram.getByRole('button', { name: t('Save RAM draft', '保存 RAM 草稿'), exact: true }).click();
      await ram.getByRole('status').filter({ hasText: /Action completed|操作已完成/ }).waitFor();
      await work(ram, 'Version and signature history', '版本与签署历史');
      await ram.locator('summary').filter({ hasText: /v1/ }).click();
      await ram.getByRole('button', { name: t('View version / print','查看此版本／打印'), exact: true }).click();
      const ramPrint = page.getByRole('dialog').filter({ hasText: t('DRAFT — NOT APPROVED','草稿 — 未经批准') });
      await ramPrint.waitFor(); await page.emulateMedia({ media: 'print' });
      assert.equal(await page.locator('#root').isVisible(), false); assert.equal(await ramPrint.isVisible(), true);
      await page.pdf({ path: path.join(os.tmpdir(), `alife-embedded-ram-${language}-${width}.pdf`), format: 'A4', printBackground: true });
      await page.emulateMedia({ media: 'screen' }); await ramPrint.getByRole('button', { name: t('Close preview','关闭预览'), exact: true }).click();
      await work(ram, 'Activities and conditions', '活动项目与条件');
      await stage(/Details|活动资料/); assert.equal(await titleGroup().getByLabel('English', { exact: true }).inputValue(), 'Revised meal');
      await stage(/Arrangements|活动安排/);
      assert.equal(new URLSearchParams(new URL(page.url()).search).get('stage'), 'arrangements');
      await open('SAFETY.RAM'); await page.getByRole('heading', { name: t('Risk Assessment and Management', '风险评估与管理'), exact: true }).waitFor();
      await work(ram, 'Risk details', '风险明细');
      assert.equal(await ram.getByLabel(t('Participant count','参与人数'), { exact: true }).count(), 1);
      await page.getByRole('button', { name: t('Add risk', '添加风险'), exact: true }).waitFor();
      await checkLayout('ram-entry');
      const toolGroup = item => page.locator(`[data-module-editor="${item.moduleCode}"]`);
      const programme = page.getByRole('region', { name: t('Programme and production', '节目与制作'), exact: true });
      const sessionForm = programme.locator('form').filter({ has: page.getByLabel('Session English title', { exact: true }) });
      const programmeConfirmed = programme.getByRole('checkbox', { name: t('Details confirmed', '填写已确认'), exact: true });
      await open('PROGRAM.PRODUCTION'); await work(programme, 'Programme sessions', '节目环节');
      await page.waitForFunction(() => !document.querySelector('[data-module-editor="PROGRAM.PRODUCTION"] [data-module-confirmation] input')?.disabled);
      await programmeConfirmed.check();
      await sessionForm.getByLabel('Session English title', { exact: true }).fill('Revised opening');
      await page.waitForFunction(() => document.querySelector('[data-module-editor="PROGRAM.PRODUCTION"] [data-module-confirmation] input')?.checked === false);
      assert.equal(await programmeConfirmed.isChecked(), false, 'unsaved inline edits also reset section review');
      const venueModule = await open('PLACE.RESOURCE');
      await work(venueModule, 'Venue catalogue', '場地目錄');
      const venueForm = venueModule.locator('form').filter({ has: page.getByRole('button', { name: t('Add venue','加入目錄'), exact: true }) });
      await venueForm.getByLabel('English', { exact: true }).fill('Unsaved hall');
      await open('PROGRAM.PRODUCTION'); assert.equal(await sessionForm.getByLabel('Session English title', { exact: true }).inputValue(), 'Revised opening');
      await open('PLACE.RESOURCE'); assert.equal(await venueForm.getByLabel('English', { exact: true }).inputValue(), 'Unsaved hall');
      await venueForm.getByLabel('English', { exact: true }).fill(''); await open('PROGRAM.PRODUCTION');

      await Promise.all([page.waitForResponse(response => response.url().endsWith('/programme/sessions/qa-session') && response.ok()), sessionForm.getByRole('button', { name: t('Save', '儲存'), exact: true }).click()]);
      await page.waitForFunction(() => !document.querySelector('[data-module-editor]:not([hidden])')?.closest('fieldset:disabled'));
      assert.equal(arrangements.sessions[0].details.title.en, 'Revised opening');
      await work(programme, 'Programme and production', '节目与制作');
      await programme.getByRole('button', { name: t('Print run sheet', '列印流程表'), exact: true }).click();
      const printPreview = page.getByRole('dialog', { name: t('Programme print preview', '节目流程打印预览'), exact: true });
      await printPreview.waitFor(); assert.equal(await printPreview.getByRole('heading', { name: t('Revised opening', '开场'), exact: true }).count(), 1);
      await page.emulateMedia({ media: 'print' }); assert.equal(await page.locator('#root').isVisible(), false); assert.equal(await printPreview.isVisible(), true);
      await page.emulateMedia({ media: 'screen' }); await printPreview.getByRole('button', { name: t('Close preview', '关闭预览'), exact: true }).click();

      if (process.env.ALIFE_QA_TILES_ONLY === '1') { assert.deepEqual(errors, []); console.log(`PASS saved tiles ${language} ${width}: ordered candidates, module/RAM/programme/venue drafts, confirmations, print isolation`); await context.close(); continue; }
      const firstSaveCount = acceptedPlans.length;
      const requiredModules = savedPlan.moduleDecisions.filter(item => item.status === 'required');
      const originallyRequired = requiredModules.filter(item => item.moduleCode !== 'TEAM.WORK');
      assert.equal(requiredModules.length, 5);
      await settings('TEAM.WORK'); assert.equal(await team.getByRole('switch').getAttribute('aria-checked'), 'true'); assert.equal(await team.getByRole('switch').isDisabled(), true);
      for (const item of originallyRequired) {
        const selectionSaves = acceptedPlans.length; await settings(item.moduleCode); const group = toolGroup(item);
        assert.equal(await group.getByRole('switch').getAttribute('aria-checked'), 'true');
        await clickWhenEnabled(group.getByRole('switch')); await waitForArrangementSave(selectionSaves);
      }
      await settings('COMMS.FOLLOWUP'); await clickWhenEnabled(toolGroup(savedPlan.moduleDecisions.find(item => item.moduleCode === 'COMMS.FOLLOWUP')).getByRole('switch'));
      const firstAccepted = await waitForArrangementSave(firstSaveCount);
      assert.equal(Object.keys(firstAccepted.body.composition.moduleConfirmations).length, 12);
      assert.equal(firstAccepted.body.arrangements, undefined, 'selection save must preserve operational rows'); assert.equal(arrangements.sessions[0].details.title.en, 'Revised opening');
      assert.ok(firstAccepted.headers['if-match']); assert.ok(firstAccepted.headers['idempotency-key']);
      for (const item of originallyRequired) {
        assert.equal(firstAccepted.body.composition.humanSelections.find(selection => selection.moduleCode === item.moduleCode).selected, false);
        await settings(item.moduleCode); assert.equal(await toolGroup(item).getByRole('switch').getAttribute('aria-checked'), 'false');
      }
      await stage(/Details|活动资料/); assert.equal(await titleGroup().getByLabel('English', { exact: true }).inputValue(), 'Revised meal');
      assert.equal(detailSaves.length, 1); assert.ok(detailSaves[0].headers['if-match']); assert.equal(JSON.parse(detailSaves[0].body.eventDataJson).privateContact, 'preserved');
      const secondSaveCount = acceptedPlans.length;
      await page.goto(`${base}/groups/qa-group/events/qa-event/workspace?flow=setup&stage=arrangements`);
      for (const item of originallyRequired) {
        const selectionSaves = acceptedPlans.length; await settings(item.moduleCode); const group = toolGroup(item);
        await group.waitFor();
        assert.equal(await group.getByRole('switch').getAttribute('aria-checked'), 'false');
        await clickWhenEnabled(group.getByRole('switch')); await waitForArrangementSave(selectionSaves);
      }
      await checkLayout('optional-tools');
      const secondAccepted = await waitForArrangementSave(secondSaveCount);
      assert.equal(secondAccepted.body.arrangements, undefined); assert.equal(arrangements.serviceSlots[0].details.requiredCount, 3);
      for (const item of originallyRequired) assert.equal(secondAccepted.body.composition.humanSelections.find(selection => selection.moduleCode === item.moduleCode).selected, true);
      assert.equal(await page.getByRole('button', { name: t('Pending', '待确认'), exact: true }).count(), 0);
      assert.equal(await team.getByRole('heading', { name: /RAM author|RAM 填表人|Roster coordinator|同工排班协调人/ }).count(), 0);
      await settings('SAFETY.RAM'); assert.equal(await ram.getByRole('heading', { name: t('RAM author', 'RAM 填表人'), exact: true }).count(), 1);
      assert.equal(await ram.getByRole('heading', { name: t('RAM approver', 'RAM 审核人'), exact: true }).count(), 1);
      await settings('SERVICE.ROSTER'); const rosterRole = page.getByRole('region', { name: t('Roster coordinator', '同工排班协调人'), exact: true });
      await rosterRole.getByRole('combobox').selectOption('qa');
      await rosterRole.getByRole('button', { name: t('Invite', '邀请'), exact: true }).click();
      await rosterRole.getByRole('button', { name: t('Accept role', '接受角色'), exact: true }).click();
      await rosterRole.getByText(t('Accepted', '已接受'), { exact: true }).waitFor();
      assert.equal(roleInvites[0].roleRequirementKey, 'SERVICE.ROSTER:roster.coordinator');
      await settings('SAFETY.RAM'); const confirmed = ram.getByRole('checkbox', { name: t('Details confirmed','填写已确认'), exact: true });
      assert.equal(await confirmed.isChecked(), false);
      const confirmationSaveCount = acceptedPlans.length;
      await confirmed.check();
      await waitForArrangementSave(confirmationSaveCount);
      assert.equal(acceptedPlans.at(-1).body.composition.moduleConfirmations['SAFETY.RAM'], true);
      await page.reload(); await settings('SAFETY.RAM'); await confirmed.waitFor(); assert.equal(await confirmed.isChecked(), true);
      const showAllForToggle = page.getByRole('button', { name: /Show all modules|显示所有模块/ });
      if (await showAllForToggle.isVisible()) await showAllForToggle.click();
      await clickWhenEnabled(ram.getByRole('switch'));
      assert.equal(await confirmed.isChecked(), false);
      assert.equal(await ram.getByRole('heading', { name: t('RAM author', 'RAM 填表人'), exact: true }).count(), 0);
      await clickWhenEnabled(ram.getByRole('switch'));
      for (let attempt = 0; attempt < 150 && !await confirmed.isEnabled(); attempt += 1) await page.waitForTimeout(100);
      assert.equal(await confirmed.isEnabled(), true);
      assert.equal(await confirmed.isChecked(), false);
      // Restoring the original enabled/confirmed selection can be a no-op, so it need not produce another save.
      await confirmed.check();
      await stage(/Create|确认创建/);
      await page.getByRole('heading', { name: t('Module confirmation and responsible roles', '模块确认与负责人'), exact: true }).waitFor();
      await page.getByRole('region', { name: t('Roster coordinator', '同工排班协调人'), exact: true }).getByText('QA Leader', { exact: true }).waitFor();
      await checkLayout('arrangement-confirmation-review');
      await page.locator('article').filter({ has: page.getByRole('heading', { name: t('Module confirmation and responsible roles', '模块确认与负责人'), exact: true }) }).screenshot({ path: path.join(os.tmpdir(), `alife-arrangement-role-summary-${language}-${width}.png`) });
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
      await stage(/Details|活动资料/); await titleGroup().getByLabel('English', { exact: true }).fill('Amended meal'); await waitForDetailsSave();
      await stage(/4.*Approval|4.*正式审批/); await click('Generate a new version', '从当前资料生成新版本'); await submit(); await decide(false);
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
      await page.waitForFunction(() => !document.querySelector('[data-module-editor]:not([hidden])')?.closest('fieldset:disabled'));
      assert.equal(ai.length, 1); assert.equal(posterSaves.length, 0); await checkLayout('poster');
      await stage(/4.*Approval|4.*正式审批/); await stage(/5.*Poster|5.*海报制作/);
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
      await stage(/4.*Approval|4.*正式审批/);
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
      await stage(/Details|活动资料/); await titleGroup().waitFor(); await stage(/4.*Approval|4.*正式审批/); await submit(); await decide(false);
      assert.equal(published, false); assert.equal(creates.length, 1); assert.deepEqual(errors, []); await checkLayout('reapproved');
      console.log(`PASS ${language} ${width}: repeated edits, return/amend/approve, frozen routes, post-approval poster, publication, reopen/reapprove, same event, language and layout`);
      await context.close();
    }
  } catch (error) { if (lastPage && !lastPage.isClosed()) { await lastPage.screenshot({ path: path.join(os.tmpdir(), 'alife-setup-failure.png') }); console.error(await lastPage.evaluate(() => ({ url: location.href, language: document.documentElement.lang, modules: Array.from(document.querySelectorAll('[data-module-editor]:not([hidden])')).map(el => ({ code: el.getAttribute('data-module-editor'), text: el.textContent.slice(0, 1500), cards: Array.from(el.querySelectorAll('[data-tool-panel]')).map(card => ({ open: card.open, summary: card.querySelector('summary')?.textContent })) })) }))); } throw error; } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
