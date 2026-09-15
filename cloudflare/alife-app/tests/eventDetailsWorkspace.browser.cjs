// All application APIs, speech recognition and AI replies are fixtures. No live writes.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const path = require('node:path');
const os = require('node:os');
const { showDetailsPane, expandTranslation } = require('./helpers/eventDetailsWorkspace.cjs');
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://127.0.0.1:5173';
const label = (en, zh) => ({ en, zh });
const template = { code: 'shared-meal', archetypeCode: 'simple-social', version: 2, name: label('Fellowship meal', '团契聚餐'), description: label('Share a meal', '一起用餐'), defaults: { visibility: 'groupVisible', registrationMode: 'none', capacityUnit: 'People' }, preselectedModules: [], presetServiceSlots: [] };
const modules = [['TEAM.WORK','Tasks and handoffs','任务与交接'],['SERVICE.ROSTER','Roles and shifts','岗位轮班'],['PEOPLE.REGISTRATION','Registration','邀请报名'],['SAFETY.RAM','RAM and safety','RAM 安全'],['SAFEGUARDING.CHILD','Safeguarding','儿童保护'],['PROGRAM.PRODUCTION','Programme','节目安排'],['PLACE.RESOURCE','Venues','场地资源'],['MOVE.STAY','Travel and stay','交通住宿'],['FOOD.HOSPITALITY','Hospitality','餐饮接待'],['MONEY.FINANCE','Fees','费用财务'],['COMMS.FOLLOWUP','Follow-up','沟通跟进'],['FESTIVAL.OPERATIONS','Operations','现场运营']];
// Sample the browser-composited material, including transparency and reflected light.
// Reading backgroundColor alone cannot measure text contrast on layered glass.
async function checkCardContrast(page, grid) {
  const cards = await grid.evaluate(el => {
    const origin = el.getBoundingClientRect();
    return [...el.querySelectorAll('button')].map(node => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x - origin.x, y: rect.y - origin.y, width: rect.width, height: rect.height, color: getComputedStyle(node).color };
    });
  });
  // Fixed app chrome can overlap a tall grid capture; it is a different material.
  await grid.evaluate(grid => {
    for (const node of document.querySelectorAll('body *')) if (!node.contains(grid) && ['fixed', 'sticky'].includes(getComputedStyle(node).position)) node.setAttribute('data-contrast-overlay', '');
  });
  const hideContent = await page.addStyleTag({ content: '.event-module-card > *, [data-contrast-overlay] { visibility: hidden !important; }' });
  let raster;
  try { raster = (await grid.screenshot({ path: path.join(os.tmpdir(), 'alife-prism-composite.png') })).toString('base64'); }
  finally { await hideContent.evaluate(el => el.remove()); await page.locator('[data-contrast-overlay]').evaluateAll(nodes => nodes.forEach(node => node.removeAttribute('data-contrast-overlay'))); }
  const contrasts = await page.evaluate(async ({ cards, raster }) => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(raster), c => c.charCodeAt(0))], { type: 'image/png' }));
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const luminance = rgb => rgb.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126,.7152,.0722][i], 0);
    return cards.map(card => {
      const text = luminance(card.color.match(/[\d.]+/g).slice(0, 3).map(Number)); let minimum = Infinity;
      for (let y = Math.ceil(card.y + 10); y < card.y + card.height - 10; y += 4) for (let x = Math.ceil(card.x + 10); x < card.x + card.width - 10; x += 4) {
        const offset = (y * canvas.width + x) * 4;
        const backdrop = luminance([...pixels.slice(offset, offset + 3)]);
        minimum = Math.min(minimum, (Math.max(text, backdrop) + .05) / (Math.min(text, backdrop) + .05));
      }
      return minimum;
    });
  }, { cards, raster });
  for (const contrast of contrasts) assert.ok(contrast >= 4.5, `composited domain text contrast: ${contrast.toFixed(2)}:1`);
  return Math.min(...contrasts);
}
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.ALIFE_BROWSER_EXECUTABLE ? { executablePath: process.env.ALIFE_BROWSER_EXECUTABLE } : {}) });
  try {
    for (const language of (process.env.ALIFE_QA_LANGUAGES || 'zh,en').split(',')) for (const width of (process.env.ALIFE_QA_WIDTHS || '320,768,1024,1280').split(',').map(Number)) {
      const zh = language === 'zh', t = (en, cn) => zh ? cn : en;
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      await context.addInitScript(language => localStorage.setItem('alife.language', language), language);
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      const errors = [], messages = [], closes = []; let writes = 0, composeLoads = 0;
      page.on('pageerror', error => errors.push(error.message));
      await context.route('**/api/**', async route => {
        const req = route.request(), url = new URL(req.url()); let data = [], status = 200;
        if (url.pathname === '/api/me') data = { id: 'qa', displayName: 'QA Leader', isGuest: false, isRegistered: true, platformRole: 'superadmin', permissions: ['admin.access'], memberships: [] };
        else if (url.pathname === '/api/event-archetypes') data = [{ code: 'simple-social', version: 1, name: label('Simple social','轻松相聚'), isSeries: width === 768, occurrenceCount: 1, hasSessions: false, hasZones: false, requiredModules: [], recommendedModules: [], conditionalModules: [], workflowTemplateRecommendations: [], activityTypes: [template] }];
        else if (url.pathname.endsWith('/compose')) { composeLoads++; data = { schemaVersion: '1.1.0', proposalHash: 'qa', baselineETag: '"new"', facts: { items: [] }, roleRequirements: [], workflowContributions: [], warnings: [], navigation: [], readiness: { status: 'notReady', blockers: [] }, moduleDecisions: modules.map(([moduleCode,en,cn]) => ({ moduleCode, label: label(en,cn), status: moduleCode === 'TEAM.WORK' ? 'required' : 'inactive', reasonCodes: [], dependencies: [] })) }; }
        else if (url.pathname.includes('/details-session/') && url.pathname.endsWith('/message')) {
          const input = req.postDataJSON(), snapshot = input.appContext.knownFacts.snapshot; messages.push({ id: url.pathname.split('/')[4], ...input });
          if (input.message === 'failure') { status = 503; data = { message: 'AI unavailable for fixture retry' }; }
          else data = { responseMode: 'result', result: { version: 1, revision: snapshot.revision - (input.message === 'stale' ? 1 : 0), form: { ...snapshot.form, title: label('Community fellowship meal','社区团契聚餐') }, sources: { ...snapshot.sources, title: 'explicit' }, adoptedFields: ['title'], fieldAssessments: [], issues: [], assessment: { sufficiencyScore: 30, summary: label('Please review the details','请核对活动资料') }, assistantReply: label('I have added the event title. When and where will you meet?', '活动名称已整理好。这次准备何时、在哪里相聚？') } };
        } else if (url.pathname.endsWith('/close')) closes.push(url.pathname);
        else if (['POST','PUT','DELETE'].includes(req.method())) writes++;
        await route.fulfill({ status, json: data });
      });
      await page.goto(`${base}/events/new?groupId=qa-group`);
      await page.getByRole('button', { name: /轻松相聚|Simple social/ }).click();
      await page.getByRole('button', { name: /团契聚餐|Fellowship meal/ }).click();
      await page.getByRole('button', { name: t('Start arranging','开始安排'), exact: true }).click();
      await page.getByRole('button', { name: /Show all modules|显示所有模块/ }).click();
      const grid = page.locator('.event-module-grid'); await grid.locator('button').nth(11).waitFor();
      assert.equal(await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), width >= 1280 ? 6 : width >= 1024 ? 4 : width >= 768 ? 3 : 2);
      if (language === 'en') for (const name of ['Registration', 'Safeguarding', 'Programme']) {
        assert.equal(await grid.getByText(name, { exact: true }).evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); return range.getClientRects().length; }), 1, `${name} must fit without splitting a word`);
      }
      const minimumContrast = await checkCardContrast(page, grid);
      if (language === 'en' && width === 1280) {
        const card = grid.locator('button').first(), session = await context.newCDPSession(page);
        const restingShadow = await card.evaluate(el => getComputedStyle(el).boxShadow);
        await card.hover(); assert.notEqual(await card.evaluate(el => getComputedStyle(el).boxShadow), restingShadow, 'hover depth');
        await card.click(); assert.equal(await card.getAttribute('data-selected'), 'true');
        await card.focus(); assert.equal(await card.evaluate(el => getComputedStyle(el).outlineStyle), 'solid', 'keyboard focus');
        await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-reduced-transparency', value: 'reduce' }] });
        assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches), true);
        assert.equal(await card.evaluate(el => getComputedStyle(el).backdropFilter), 'none');
        assert.equal(await card.evaluate(el => getComputedStyle(el).backgroundImage), 'none');
        await checkCardContrast(page, grid);
        await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'forced-colors', value: 'active' }] });
        assert.equal(await card.evaluate(el => getComputedStyle(el).backgroundImage), 'none');
        assert.equal(await card.evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
        await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        await session.detach();
        await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'none' });
        await page.getByRole('button', { name: /Back to modules|返回模块总览/, exact: true }).click();
        await page.mouse.move(0, 0); await page.locator('[data-arrangement-tile="EVENT.DETAILS"]').focus();
      }
      console.log(`Prism Glass ${language} ${width}: minimum composited text contrast ${minimumContrast.toFixed(2)}:1`);
      await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(os.tmpdir(), `alife-pilot-overview-${language}-${width}.png`), fullPage: true });
      await page.locator('[data-arrangement-tile="EVENT.DETAILS"]').click();
      const workspace = page.locator('.event-details-workspace');
      await showDetailsPane(page, 'form');
      const title = workspace.locator('[data-detail-field="title"]');
      assert.equal(await title.getByLabel(zh ? 'English' : '中文', { exact: true }).isVisible(), false);
      await title.getByLabel(zh ? '中文' : 'English', { exact: true }).fill(t('Fellowship with neighbours and new families','邻里与新家庭的团契聚餐'));
      const layoutWidth = await workspace.evaluate(el => el.getBoundingClientRect().width);
      assert.equal(await workspace.getAttribute('data-wide'), String(width >= 1024 && layoutWidth >= 880));
      if (await workspace.getAttribute('data-wide') !== 'true') {
        const formTab = workspace.getByRole('tab', { name: t('Details form','资料表单'), exact: true });
        await formTab.focus(); await formTab.press('ArrowRight');
        assert.equal(await workspace.getByRole('tab', { name: t('AI assistant','AI 助手'), exact: true }).getAttribute('aria-selected'), 'true');
        await page.keyboard.press('ArrowLeft'); assert.equal(await formTab.getAttribute('aria-selected'), 'true');
      }
      await showDetailsPane(page, 'assistant');
      await workspace.locator('.event-pending-fields').getByRole('button', { name: t('Title','活动名称'), exact: false }).click();
      await page.waitForFunction(() => document.activeElement?.getAttribute('data-locale') === (document.documentElement.lang.startsWith('zh') ? 'en' : 'zh'));
      assert.equal(await title.getByLabel(zh ? 'English' : '中文', { exact: true }).isVisible(), true);
      await showDetailsPane(page, 'assistant');
      const prompt = workspace.locator('textarea[maxlength="8000"]');
      const send = workspace.getByRole('button', { name: t('Send and organise details','发送并整理资料'), exact: true });
      await prompt.fill('Please organise our fellowship'); await send.click();
      await workspace.getByRole('log').getByText(t('I have added the event title. When and where will you meet?','活动名称已整理好。这次准备何时、在哪里相聚？'), { exact: true }).waitFor();
      assert.equal(await title.getAttribute('data-ai-updated'), 'true');
      assert.equal(await title.evaluate(el => getComputedStyle(el).animationName), 'none', 'reduced-motion feedback is static');
      await prompt.fill('Keep this draft message');
      if (await workspace.getAttribute('data-wide') === 'true') {
        await workspace.getByRole('button', { name: /Collapse assistant|收起助手/ }).click();
        await showDetailsPane(page, 'assistant');
      } else { await showDetailsPane(page, 'form'); await showDetailsPane(page, 'assistant'); }
      assert.equal(await prompt.inputValue(), 'Keep this draft message');
      assert.equal(await workspace.getByRole('log').locator(':scope > div').count(), 2);
      const composeBefore = composeLoads;
      await page.locator('[data-arrangement-tile="TEAM.WORK"]').click();
      await page.locator('[data-arrangement-tile="EVENT.DETAILS"]').click();
      await showDetailsPane(page, 'assistant');
      assert.equal(await prompt.inputValue(), 'Keep this draft message');
      assert.equal(closes.length, 0); assert.equal(composeLoads, composeBefore);
      await prompt.fill('failure'); await send.click(); await workspace.getByRole('alert').waitFor(); assert.equal(await prompt.inputValue(), 'failure');
      await prompt.fill('stale'); await send.click(); await workspace.getByText(/old reply was not adopted|未采用旧回复/).waitFor(); assert.equal(await prompt.inputValue(), 'stale');
      assert.equal(messages[0].id, messages.at(-1).id);
      await prompt.fill('Retry organising the event'); await send.click();
      await page.waitForFunction(() => document.querySelector('[role="log"]')?.children.length === 4);
      await prompt.fill('We will meet at the community hall');
      await workspace.scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(os.tmpdir(), `alife-pilot-assistant-${language}-${width}.png`), fullPage: true });
      await showDetailsPane(page, 'form');
      await workspace.locator('.event-detail-zone > summary').click();
      await page.getByLabel(t('Event time zone','活动时区'), { exact: true }).fill('Pacific/Auckland');
      await page.getByLabel(t('Start time','开始时间'), { exact: true }).fill('2026-10-04T18:00');
      await page.getByLabel(t('End time','结束时间'), { exact: true }).fill('2026-10-04T20:00');
      const desc = workspace.locator('[data-detail-field="description"]');
      await desc.getByLabel(zh ? '中文' : 'English', { exact: true }).fill(t('An evening of shared food and conversation.','一起用餐，认识新朋友，分享近况。'));
      await workspace.scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(os.tmpdir(), `alife-pilot-form-${language}-${width}.png`), fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      // Invalid hidden time zone must be revealed by existing creation validation.
      await page.getByLabel(t('Event time zone','活动时区'), { exact: true }).fill('invalid/zone');
      await workspace.locator('.event-detail-zone > summary').click();
      await showDetailsPane(page, 'assistant');
      await page.getByRole('navigation', { name: t('Event preparation flow','活动筹备流程') }).getByRole('button', { name: /Create|确认创建/ }).click();
      try { await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Event time zone' || document.activeElement?.getAttribute('aria-label') === '活动时区'); } catch (error) { console.error(await page.evaluate(() => ({ active: document.activeElement?.outerHTML, errors: [...document.querySelectorAll('[role=alert]')].map(x => x.textContent), views: [...document.querySelectorAll('.event-details-workspace')].map(x => x.outerHTML.slice(0,400)) }))); await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(os.tmpdir(), 'alife-pilot-failure.png'), fullPage: true }); throw error; }
      assert.equal(writes, 0); assert.deepEqual(errors, []);
      console.log(`PASS pilot ${language} ${width}: layout, bilingual reveal, AI feedback, session continuity, no navigation writes, failure/stale recovery, hidden validation`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
