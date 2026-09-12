// All application APIs are fixtures. Run against Vite; no real events are created.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const os = require('node:os');
const path = require('node:path');
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://127.0.0.1:5173';
const label = (en, zh) => ({ en, zh });
const template = { code: 'shared-meal', archetypeCode: 'simple-social', version: 2, name: label('Fellowship meal', '团契聚餐'), description: label('Share a meal', '一起用餐'), iconKey: 'meal', defaults: { visibility: 'groupVisible', registrationMode: 'none', capacityUnit: 'People' }, preselectedModules: ['SERVICE.ROSTER'], presetServiceSlots: [{ roleCode: 'programme.team', label: label('Welcome team', '接待同工'), requiredCount: 2, eligibilityCode: 'approvedGroupMember' }] };
const catalogue = [{ code: 'simple-social', version: 1, name: label('Simple social', '轻松相聚'), isSeries: false, occurrenceCount: 1, hasSessions: false, hasZones: false, requiredModules: [], recommendedModules: [], conditionalModules: [], workflowTemplateRecommendations: [], activityTypes: [template] }];
const modules = [ ['SAFEGUARDING.CHILD', 'Child safeguarding', '儿童保护'], ['SAFETY.RAM', 'RAM and safety', 'RAM 与安全'], ['TEAM.WORK', 'Team and tasks', '团队与任务'], ['SERVICE.ROSTER', 'Roles and shifts', '岗位与轮班'], ['PROGRAM.PRODUCTION', 'Programme and production', '节目与制作'], ['PLACE.RESOURCE', 'Venue and resources', '场地与资源'], ['PEOPLE.REGISTRATION','Registration','邀请报名'], ['FESTIVAL.OPERATIONS','Operations','现场运营'], ['MOVE.STAY','Travel and stay','交通住宿'], ['FOOD.HOSPITALITY','Food','餐饮'], ['MONEY.FINANCE','Finance','费用'], ['COMMS.FOLLOWUP','Follow-up','跟进'] ];
const venue = { id: 'venue-1', managingGroupId: 'qa-group', name: label('Main hall', '主礼堂'), address: label('10 Main Road', '主路10号'), capacity: 50, isActive: true, eTag: '"venue-v1"' };
const relatedModules = new Set(['TEAM.WORK', 'SERVICE.ROSTER']);

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const language of (process.env.ALIFE_QA_LANGUAGES || 'zh,en').split(',')) for (const width of (process.env.ALIFE_QA_WIDTHS || '320,375,768,1280').split(',').map(Number)) {
      const zh = language === 'zh', t = (en, cn) => zh ? cn : en;
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
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
          const body = request.postDataJSON(); assert.equal(JSON.parse(body.ramDataJson).hazards[0].hazard.en, 'Private RAM hazard'); assert.ok(!body.eventDataJson.includes('Private RAM hazard')); assert.ok(!JSON.stringify(body.eventContext).includes('Private RAM hazard'));
          creates.push({ body, key: request.headers()['idempotency-key'] });
          status = creates.length === 1 ? 409 : 503;
          data = { message: creates.length === 1 ? 'A venue conflicts with another booking.' : 'Temporary failure for retry test.' };
        }
        await route.fulfill({ status, json: data });
      });
      const next = () => page.getByRole('navigation', { name: t('Event preparation flow', '活动筹备流程') }).getByRole('button').filter({ hasText: t('Create', '确认创建') }).click();
      const region = (en, cn) => page.getByRole('region', { name: t(en, cn), exact: true });
      const fillText = async (root, title, en, cn) => {
        const group = root.getByRole('group', { name: title, exact: true });
        await group.getByLabel('English', { exact: true }).fill(en); await group.getByLabel('中文', { exact: true }).fill(cn);
      };
      await page.goto(`${base}/events/new?groupId=qa-group`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.getByRole('button', { name: /轻松相聚|Simple social/ }).click();
      await page.getByRole('button', { name: /团契聚餐|Fellowship meal/ }).click(); await page.getByRole('button', { name: t('Start arranging', '开始安排'), exact: true }).click();
      await page.locator('[data-arrangement-tile="EVENT.DETAILS"]').click();
      await fillText(page, t('Event title', '活动名称'), 'Community meal', '社区聚餐');
      await fillText(page, t('Description', '活动说明'), 'A meal together', '一同聚餐');
      await page.getByLabel(t('Start time', '开始时间'), { exact: true }).fill('2026-10-04T18:00');
      await page.getByLabel(t('End time', '结束时间'), { exact: true }).fill('2026-10-04T20:00');
      await page.locator('[data-arrangement-tile="EVENT.DETAILS"]').click();
      assert.equal(await page.locator('footer').last().getByRole('button').count(), 1);
      await page.getByRole('button', { name: t('Back to top', '回到开头'), exact: true }).click();
      const tile = code => page.locator(`[data-arrangement-tile="${code}"]`);
      const open = async code => { if (await tile(code).getAttribute('aria-expanded') !== 'true') await tile(code).click(); return page.locator(`[data-module-editor="${code}"]`); };
      const work = async (root, en, cn) => { const button = root.getByRole('button', { name: t(en, cn), exact: true }); if (await button.count() && await button.getAttribute('aria-expanded') !== 'true') await button.click(); };
      const enable = async code => { const root = await open(code); await work(root, 'Settings and responsibilities', '设置与职责'); await root.getByRole('button', { name: t('Yes','是'), exact: true }).click(); return root; };
      const top = page.getByRole('group', { name: t('Event module overview', '活动模块总览'), exact: true });
      const modeButton = page.getByRole('button', { name: /显示(所有|相关)模块|Show (all|related) modules/ });
      const relatedCount = modules.filter(([moduleCode]) => relatedModules.has(moduleCode)).length;
      await top.locator('button').nth(relatedCount - 1).waitFor();
      assert.equal(await top.locator('button').count(), relatedCount);
      assert.equal((await modeButton.textContent() || '').trim(), zh ? `显示所有模块（${modules.length}）` : `Show all modules (${modules.length})`);
      assert.equal(await modeButton.count(), 1);
      await modeButton.click();
      await modeButton.waitFor();
      assert.equal(await top.locator('button').count(), 12);
      assert.equal((await modeButton.textContent() || '').trim(), zh ? `显示相关模块（${relatedCount}/${modules.length}）` : `Show related modules (${relatedCount}/${modules.length})`);
      assert.equal(await page.locator('[data-module-editor]:visible').count(), 0);
      assert.equal(await top.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), width >= 1024 ? 6 : width >= 768 ? 4 : 3);
      await page.screenshot({ path: path.join(os.tmpdir(), `alife-module-overview-${language}-${width}.png`) });
      const ram = await enable('SAFETY.RAM');
      await work(ram, 'Activities and conditions', '活动项目与条件');
      await ram.getByLabel(t('Participant count', '参与人数'), { exact: true }).fill('12');
      await work(ram, 'Risk details', '风险明细');
      assert.equal(await ram.getByLabel(t('Participant count', '参与人数'), { exact: true }).isVisible(), false);
      await ram.getByRole('button', { name: t('Add risk', '添加风险'), exact: true }).click();
      const privateText = 'Private RAM hazard';
      await ram.getByLabel(`${t('Hazard','危害')} (en)`, { exact: true }).fill(privateText);
      assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes(privateText));
      await page.screenshot({ path: path.join(os.tmpdir(), `alife-inline-ram-risk-${language}-${width}.png`) });
      const roster = await open('SERVICE.ROSTER'); await work(roster, 'Role shifts', '岗位轮班');
      await roster.getByLabel(t('People needed', '所需人数'), { exact: true }).fill('4');
      assert.equal(await ram.isVisible(), false);
      await open('SAFETY.RAM');
      assert.equal(await ram.getByLabel(`${t('Hazard','危害')} (en)`, { exact: true }).inputValue(), privateText);
      await ram.getByRole('button', { name: t('Back to modules','返回模块总览'), exact: true }).click();
      assert.equal(await page.locator('[data-module-editor]:visible').count(), 0);
      assert.equal(await tile('SAFETY.RAM').evaluate(el => el === document.activeElement), true);
      await tile('SAFETY.RAM').press('Enter');
      await page.locator('[id="module-heading-SAFETY.RAM"]').waitFor();
      assert.equal(await page.locator('[id="module-heading-SAFETY.RAM"]').evaluate(el => el === document.activeElement), true);
      const programme = await enable('PROGRAM.PRODUCTION');
      await work(programme, 'Role shifts', '岗位轮班');
      assert.equal(await programme.getByLabel(t('People needed','所需人数'), { exact: true }).inputValue(), '4');
      await work(programme, 'Programme plan', '节目安排');
      await next(); await page.getByRole('alert').filter({ hasText: /节目|programme/ }).waitFor();
      await programme.getByRole('button', { name: t('Add session','添加环节'), exact: true }).click();
      await programme.getByRole('button', { name: t('Add programme item','添加节目'), exact: true }).click();
      await fillText(programme, t('Programme title','节目名称'), 'Welcome and prayer','欢迎与祷告');
      await programme.getByLabel(t('Duration (minutes)','时长（分钟）'), { exact: true }).fill('15');
      const venues = await enable('PLACE.RESOURCE'); await work(venues, 'Venue plan','场地安排');
      await venues.getByRole('button', { name: t('Add venue booking','添加场地安排'), exact: true }).click();
      await venues.getByLabel(t('Choose venue','选择场地')).selectOption('venue-1');
      await venues.getByLabel(t('Expected attendance','所需人数')).fill('51'); await venues.getByRole('alert').waitFor();
      await venues.getByLabel(t('Expected attendance','所需人数')).fill('30');
      await venues.scrollIntoViewIfNeeded(); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(os.tmpdir(), `alife-arrangements-venue-${language}-${width}.png`) });
      await page.waitForFunction(() => !document.querySelector('[data-module-editor="PLACE.RESOURCE"] [data-module-confirmation] input').disabled);
      const fetches = venueLoads, compositions = composeLoads;
      await page.getByRole('button', { name: t('Select language, current language: English','选择语言，当前语言：中文'), exact: true }).click();
      await page.getByRole('menuitemradio', { name: zh ? 'English' : '中文', exact: true }).click();
      await page.getByRole('region', { name: zh ? 'Venue and resources' : '场地与资源', exact: true }).waitFor();
      assert.equal(venueLoads, fetches); assert.equal(composeLoads, compositions);
      assert.equal(await venues.getByLabel(zh ? 'Expected attendance' : '所需人数').inputValue(), '30');
      await page.getByRole('button', { name: zh ? 'Select language, current language: English' : '选择语言，当前语言：中文', exact: true }).click();
      await page.getByRole('menuitemradio', { name: zh ? '中文' : 'English', exact: true }).click();
      const venueConfirmation = venues.getByRole('checkbox', { name: t('Details confirmed','填写已确认'), exact: true, includeHidden: true });
      await venueConfirmation.check();
      await open('PROGRAM.PRODUCTION');
      const confirmation = programme.getByRole('checkbox', { name: t('Details confirmed','填写已确认'), exact: true });
      assert.equal(await confirmation.isChecked(), false); await confirmation.check();
      await programme.getByLabel(t('Duration (minutes)','时长（分钟）'), { exact: true }).fill('20');
      assert.equal(await confirmation.isChecked(), false); assert.equal(await venueConfirmation.isChecked(), true); await confirmation.check();
      await open('PLACE.RESOURCE'); assert.equal(await venues.getByLabel(t('Expected attendance','所需人数')).inputValue(), '30');
      await next(); await page.getByRole('heading', { name: t('Review event plan', '确认活动方案'), exact: true }).waitFor();
      await page.getByRole('heading', { name: t('Module confirmation and responsible roles', '模块确认与负责人'), exact: true }).waitFor();
      await page.getByText(t('Welcome and prayer', '欢迎与祷告'), { exact: false }).filter({ visible: true }).waitFor();
      await page.getByRole('button', { name: t('Confirm and create event', '确认创建活动'), exact: true }).click();
      await page.getByRole('alert').filter({ hasText: /conflict|冲突/ }).waitFor();
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
