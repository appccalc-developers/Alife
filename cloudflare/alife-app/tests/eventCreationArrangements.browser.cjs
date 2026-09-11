// All application APIs are fixtures. Run against Vite; no real events are created.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const os = require('node:os');
const path = require('node:path');
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://127.0.0.1:5173';
const label = (en, zh) => ({ en, zh });
const template = { code: 'shared-meal', archetypeCode: 'simple-social', version: 2, name: label('Fellowship meal', '团契聚餐'), description: label('Share a meal', '一起用餐'), iconKey: 'meal', defaults: { visibility: 'groupVisible', registrationMode: 'none', capacityUnit: 'People' }, preselectedModules: ['SERVICE.ROSTER'], presetServiceSlots: [{ roleCode: 'welcome', label: label('Welcome team', '接待同工'), requiredCount: 2, eligibilityCode: 'approvedGroupMember' }] };
const catalogue = [{ code: 'simple-social', version: 1, name: label('Simple social', '轻松相聚'), isSeries: false, occurrenceCount: 1, hasSessions: false, hasZones: false, requiredModules: [], recommendedModules: [], conditionalModules: [], workflowTemplateRecommendations: [], activityTypes: [template] }];
const modules = [ ['TEAM.WORK', 'Team and tasks', '团队与任务'], ['SERVICE.ROSTER', 'Roles and shifts', '岗位与轮班'], ['PROGRAM.PRODUCTION', 'Programme and production', '节目与制作'], ['PLACE.RESOURCE', 'Venue and resources', '场地与资源'] ];
const venue = { id: 'venue-1', managingGroupId: 'qa-group', name: label('Main hall', '主礼堂'), address: label('10 Main Road', '主路10号'), capacity: 50, isActive: true, eTag: '"venue-v1"' };

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const language of ['zh', 'en']) for (const width of [320, 768, 1280]) {
      const zh = language === 'zh', t = (en, cn) => zh ? cn : en;
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(language => localStorage.setItem('alife.language', language), language);
      const page = await context.newPage(); page.setDefaultTimeout(12000);
      const errors = [], creates = []; let venueLoads = 0, composeLoads = 0;
      page.on('pageerror', e => errors.push(e.message));
      await context.route('**/api/**', async route => {
        const request = route.request(), pathname = new URL(request.url()).pathname;
        let data = [], status = 200;
        if (pathname === '/api/me') data = { id: 'qa', displayName: 'QA Leader', isGuest: false, isRegistered: true, platformRole: 'superadmin', permissions: ['admin.access'], memberships: [] };
        else if (pathname === '/api/event-archetypes') data = catalogue;
        else if (pathname.endsWith('/venues')) { venueLoads++; data = { managingGroupId: 'qa-group', canManage: true, venues: [venue] }; }
        else if (pathname.endsWith('/compose')) {
          composeLoads++; const input = request.postDataJSON();
          data = { schemaVersion: '1.1.0', proposalHash: JSON.stringify(input.humanSelections), baselineETag: '"plan-new"', facts: { items: [], sourceHash: 'facts' }, roleRequirements: [], workflowContributions: [], navigation: [], warnings: [], readiness: { status: 'notReady', blockers: [], warnings: [] },
            moduleDecisions: modules.map(([moduleCode, en, cn]) => ({ moduleCode, label: label(en, cn), status: moduleCode === 'TEAM.WORK' ? 'required' : (input.humanSelections.find(x => x.moduleCode === moduleCode)?.selected ?? moduleCode === 'SERVICE.ROSTER') ? 'selected' : 'inactive', reasonCodes: [], dependencies: [], dataClasses: [], integrationKey: '', surfaceKey: '', navigationOrder: 1 })) };
        } else if (pathname.endsWith('/events') && request.method() === 'POST') {
          creates.push({ body: request.postDataJSON(), key: request.headers()['idempotency-key'] });
          status = creates.length === 1 ? 409 : 503;
          data = { message: creates.length === 1 ? 'A venue conflicts with another booking.' : 'Temporary failure for retry test.' };
        }
        await route.fulfill({ status, json: data });
      });
      const next = () => page.getByRole('button', { name: t('Continue', '继续'), exact: true }).click();
      const region = (en, cn) => page.getByRole('region', { name: t(en, cn), exact: true });
      const fillText = async (root, title, en, cn) => {
        const group = root.getByRole('group', { name: title, exact: true });
        await group.getByLabel('English', { exact: true }).fill(en); await group.getByLabel('中文', { exact: true }).fill(cn);
      };
      await page.goto(`${base}/events/new?groupId=qa-group`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.getByRole('button', { name: /轻松相聚|Simple social/ }).click();
      await page.getByRole('button', { name: /团契聚餐|Fellowship meal/ }).click(); await next();
      await fillText(page, t('Event title', '活动名称'), 'Community meal', '社区聚餐');
      await fillText(page, t('Description', '活动说明'), 'A meal together', '一同聚餐');
      await page.getByLabel(t('Start time', '开始时间'), { exact: true }).fill('2026-10-04T18:00');
      await page.getByLabel(t('End time', '结束时间'), { exact: true }).fill('2026-10-04T20:00'); await next();
      const roster = region('Roles and shifts', '岗位与轮班'), programme = region('Programme and production', '节目与制作'), venues = region('Venue and resources', '场地与资源');
      await roster.getByLabel(t('People needed', '所需人数'), { exact: true }).fill('4');
      assert.equal(await region('Team and tasks', '团队与任务').getByRole('button').count(), 0);
      await roster.getByRole('button', { name: t('No', '否'), exact: true }).click();
      await roster.getByRole('button', { name: t('Yes', '是'), exact: true }).click();
      assert.equal(await roster.getByLabel(t('People needed', '所需人数'), { exact: true }).inputValue(), '4');
      const summary = roster.locator('summary'); await summary.click();
      assert.equal(await roster.getByLabel(t('People needed', '所需人数'), { exact: true }).isVisible(), false);
      await summary.click(); await roster.scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(os.tmpdir(), `alife-arrangements-roster-${language}-${width}.png`) });
      await programme.getByRole('button', { name: t('Yes', '是'), exact: true }).click();
      await next(); await page.getByRole('alert').filter({ hasText: /节目|programme/ }).waitFor();
      await programme.getByRole('button', { name: t('Add session', '添加环节'), exact: true }).click();
      await programme.getByRole('button', { name: t('Add programme item', '添加节目'), exact: true }).click();
      await fillText(programme, t('Programme title', '节目名称'), 'Welcome and prayer', '欢迎与祷告');
      await programme.getByLabel(t('Duration (minutes)', '时长（分钟）'), { exact: true }).fill('15');
      await venues.getByRole('button', { name: t('Yes', '是'), exact: true }).click();
      await venues.getByRole('button', { name: t('Refresh venues', '刷新场地列表'), exact: true }).waitFor({ state: 'visible' });
      await venues.getByRole('button', { name: t('Add venue booking', '添加场地安排'), exact: true }).click();
      await venues.getByLabel(t('Choose venue', '选择场地')).selectOption('venue-1');
      await venues.getByLabel(t('Expected attendance', '所需人数')).fill('51');
      await venues.getByRole('alert').waitFor(); await venues.getByLabel(t('Expected attendance', '所需人数')).fill('30');
      await venues.scrollIntoViewIfNeeded(); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(os.tmpdir(), `alife-arrangements-venue-${language}-${width}.png`) });
      assert.equal(creates.length, 0);
      const fetches = venueLoads, compositions = composeLoads;
      await page.getByRole('button', { name: t('Select language, current language: English', '选择语言，当前语言：中文'), exact: true }).click();
      await page.getByRole('menuitemradio', { name: zh ? 'English' : '中文', exact: true }).click();
      await page.getByRole('region', { name: zh ? 'Venue and resources' : '场地与资源', exact: true }).waitFor();
      assert.equal(venueLoads, fetches); assert.equal(composeLoads, compositions);
      await page.getByRole('button', { name: zh ? 'Select language, current language: English' : '选择语言，当前语言：中文', exact: true }).click();
      await page.getByRole('menuitemradio', { name: language === 'zh' ? '中文' : 'English', exact: true }).click();
      await next(); await page.getByRole('heading', { name: t('Review event plan', '确认活动方案'), exact: true }).waitFor();
      await page.getByText(t('Welcome and prayer', '欢迎与祷告'), { exact: false }).waitFor();
      await page.getByRole('button', { name: t('Confirm and create event', '确认创建活动'), exact: true }).click();
      await page.getByRole('alert').filter({ hasText: /conflict|冲突/ }).waitFor();
      assert.equal(await roster.getByLabel(t('People needed', '所需人数'), { exact: true }).inputValue(), '4');
      assert.equal(creates.length, 1); const payload = creates[0].body.arrangements;
      assert.equal(payload.serviceSlots[0].requiredCount, 4); assert.equal(payload.sessions[0].items[0].title.zh, '欢迎与祷告');
      assert.equal(payload.venueBookings[0].venueETag, '"venue-v1"'); assert.equal(payload.venueBookings[0].requiredCapacity, 30);
      await next(); await page.getByRole('button', { name: t('Confirm and create event', '确认创建活动'), exact: true }).click();
      await page.getByRole('alert').filter({ hasText: /Temporary/ }).waitFor();
      assert.equal(creates[1].key, creates[0].key); assert.deepEqual(creates[1].body, creates[0].body);
      assert.deepEqual(errors, []);
      console.log(`PASS ${language} ${width}: required rule, Yes/No, collapse, retained draft, validation, bilingual fields, venue capacity, summary, atomic payload, conflict recovery, idempotent retry, no language refetch, responsive layout`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
