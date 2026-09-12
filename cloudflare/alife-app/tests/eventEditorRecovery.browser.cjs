// Fixture-only regression: never contacts a live backend or AI provider.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const path = require('node:path');
const os = require('node:os');
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://127.0.0.1:5173';
const text = (en, zh) => ({ en, zh });
const brief = { title: text('Community meal', '社区聚餐'), description: text('A meal together', '一同聚餐'), purpose: text('Fellowship', '团契'), personResponsible: 'QA Leader', locationName: text('Hall', '礼堂'), startDate: '2026-10-04T10:00:00Z', endDate: '2026-10-04T12:00:00Z', maxCapacity: 0, capacityUnit: 'People', currency: 'NZD', hardConstraints: [], optionalActivities: [], galleryUrls: [] };
const event = { id: 'qa-event', groupId: 'qa-group', titleEn: brief.title.en, titleZh: brief.title.zh, startDate: brief.startDate, endDate: brief.endDate, visibility: 'groupVisible', contactProfileIds: [], eventDataJson: JSON.stringify(brief) };
const template = { id: 'qa-template', code: 'qa', version: 1, name: text('Preparation checklist', '筹备清单'), description: text('Checklist', '清单'), stages: [] };
const workflow = { id: 'qa-workflow', eventId: event.id, status: 'active', template, steps: [{ id: 'qa-step', stepKey: 'ram', sortOrder: 1, name: text('Safety review', '安全审查'), isRequired: true, requiresApproval: true, integrationKey: 'ram', status: 'inProgress', artifacts: [{ id: 'qa-artifact', title: text('Saved safety document', '已保存的安全文件'), isRequired: true, status: 'draft', visibility: 'memberPrivate', fileAssetId: 'qa-file' }] }] };
const plan = { schemaVersion: '1.1.0', proposalHash: 'qa-hash', archetypeCode: 'simple-social', activityTypeCode: 'shared-meal', facts: { items: [], sourceHash: 'qa-facts' }, roleRequirements: [], workflowContributions: [], navigation: [], warnings: [], readiness: { status: 'notReady', blockers: [], warnings: [] }, moduleDecisions: [{ moduleCode: 'SAFETY.RAM', label: text('RAM and safety', 'RAM与安全'), status: 'selected', reasonCodes: [], dependencies: [], dataClasses: [], integrationKey: 'ram', surfaceKey: 'safety.ram', navigationOrder: 1 }] };

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const language of ['zh', 'en']) for (const width of [375, 1280]) {
      const zh = language === 'zh', t = (en, cn) => zh ? cn : en;
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(language => localStorage.setItem('alife.language', language), language);
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      const errors = [], writes = [];
      let catalogueUnavailable = false;
      let ram = { activityName: brief.title, activityDescription: brief.description, participantCount: 20, participantAgeRange: text('Adults', '成人'), isOuting: false, hazards: [], emergencyContacts: [], leaderConfirmed: false };
      const ramRecord = () => ({ id: 'qa-ram', eventId: event.id, groupId: event.groupId, schemaVersion: ram.schemaVersion || 1, eTag: 'ram-1', validity: 'Draft', residualLevel: 'Incomplete', status: 'draft', ramDataJson: JSON.stringify(ram), updatedUtc: '2026-09-11T00:00:00Z' });
      page.on('pageerror', error => errors.push(error.message));
      await context.route('**/api/**', async route => {
        const req = route.request(), pathname = new URL(req.url()).pathname;
        let data = [];
        if (req.method() !== 'GET') writes.push({ pathname, body: req.postDataJSON() });
        if (pathname === '/api/me') data = { id: 'qa', displayName: 'QA Leader', isGuest: false, isRegistered: true, platformRole: 'superadmin', permissions: ['admin.access', 'admin.events.audit'], memberships: [] };
        else if (pathname === '/api/groups/qa-group/events') data = [event];
        else if (pathname === '/api/events/qa-event' && req.method() === 'PUT') data = event;
        else if (pathname.endsWith('/ram/workspace')) data = { assessment: ramRecord(), policy: null, history: [], actions: [], onsiteCandidates: [], canEdit: true, canAudit: true, currentMemberId: 'qa', isRequired: true };
        else if (pathname.endsWith('/ram')) { if (req.method() === 'PUT') ram = JSON.parse(req.postDataJSON().ramDataJson); data = ramRecord(); }
        else if (pathname.endsWith('/workflow')) data = workflow;
        else if (pathname === '/api/event-workflow-templates') {
          assert.equal(new URL(req.url()).searchParams.get('groupId'), 'qa-group');
          if (catalogueUnavailable) return route.fulfill({ status: 503, json: { message: 'Catalogue unavailable' } });
          data = [template];
        }
        else if (pathname.endsWith('/workspace')) data = { eventId: event.id, owningGroupId: event.groupId, title: brief.title, canManage: true, items: [{ surfaceKey: 'safety.ram', moduleCode: 'SAFETY.RAM', label: text('RAM and safety', 'RAM与安全'), presentation: 'page', pathSegment: 'ram', order: 1, readiness: 'notReady', blockers: [] }] };
        else if (pathname.endsWith('/preparation')) data = { eventId: event.id, isFrozen: false, isApproved: false, canManage: true, canEdit: true };
        else if (pathname.endsWith('/plan')) data = { eventId: event.id, planVersion: 1, eTag: '"plan-1"', plan };
        else if (pathname.endsWith('/plan/recompose')) data = plan;
        else if (pathname.includes('/events/session/')) data = { sessionId: 'qa', draft: null, chatHistory: [], context: null };
        await route.fulfill({ status: 200, json: data });
      });
      const eventPath = '/groups/qa-group/events/qa-event';
      await page.goto(`${base}${eventPath}`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: t('More actions', '更多操作'), exact: true }).click();
      await page.getByRole('menuitem', { name: t('Workflow & outputs', '流程与产出物'), exact: true }).click();
      await page.getByRole('heading', { name: t('Preparation checklist', '筹备清单'), exact: true }).waitFor();
      await page.getByText(t('Saved safety document', '已保存的安全文件'), { exact: true }).waitFor();
      assert.match(await page.getByRole('link', { name: t('Open file', '打开文件'), exact: true }).getAttribute('href'), /qa-file\/open$/);
      await page.getByRole('link', { name: t('Open RAM workspace', '打开 RAM 工作区'), exact: true }).click();
      const ramPanel = page.locator('[data-ram-workspace]');
      await ramPanel.waitFor({ state: 'visible' });
      const count = ramPanel.getByLabel(t('Participant count', '参与人数'), { exact: true });
      await page.waitForFunction(() => document.querySelector('[data-ram-workspace] input[type=number]')?.value === '20');
      await count.fill('21');
      await Promise.all([
        page.waitForResponse(response => response.url().endsWith('/ram') && response.request().method() === 'PUT'),
        ramPanel.getByRole('button', { name: t('Save RAM draft', '保存 RAM 草稿'), exact: true }).click(),
      ]);
      assert.equal(ram.participantCount, 21);
      assert.deepEqual(ram.activityName, brief.title);
      await page.screenshot({ path: path.join(os.tmpdir(), `alife-editor-recovery-ram-${language}-${width}.png`) });
      assert.match(new URL(page.url()).pathname, /workspace\/ram$/);
      // Workspace and preparation both render the assessment directly. Legacy
      // saved-edit bookmarks redirect here without starting the retired AI tool.
      for (const suffix of ['/workspace/ram', '/workspace?flow=setup&stage=setup&module=safety.ram', '/edit?step=ram', '/edit?step=ram&flow=setup']) {
        await page.goto(`${base}${eventPath}${suffix}`, { waitUntil: 'domcontentloaded' });
        await ramPanel.waitFor({ state: 'visible' });
        assert.equal(await page.locator('#event-editor-panel-ram').count(), 0);
        assert.ok(!new URL(page.url()).pathname.endsWith('/edit'));
      }
      await page.getByRole('link', { name: t('Back to event preparation','返回活动筹备'), exact: true }).click();
      await ramPanel.waitFor({ state: 'visible' });
      assert.equal(new URL(page.url()).searchParams.get('module'), 'safety.ram');
      await page.goto(`${base}/events/edit?groupId=qa-group&eventId=qa-event&step=ram`);
      await ramPanel.waitFor({ state: 'visible' });
      assert.match(new URL(page.url()).pathname, /workspace\/ram$/);
      await page.waitForFunction(() => document.querySelector('[data-ram-workspace] input[type=number]')?.value === '21');
      catalogueUnavailable = true;
      await page.goto(`${base}${eventPath}?section=workflow`);
      await page.getByText(t('Saved safety document', '已保存的安全文件'), { exact: true }).waitFor();
      await page.getByText(/Catalogue unavailable/).waitFor();
      assert.deepEqual(errors, []);
      assert.ok(writes.every(write => write.pathname.endsWith('/ram') || write.pathname.endsWith('/plan/recompose')), writes.map(write => write.pathname).join(', '));
      console.log(`PASS ${language} ${width}: workflow menu/outputs and catalogue outage, embedded RAM save, workspace/preparation navigation, legacy bookmark redirects, no retired AI session or publication`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
