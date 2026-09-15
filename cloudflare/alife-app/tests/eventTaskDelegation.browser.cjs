// Isolated component integration against Vite. All application requests use fixtures.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://127.0.0.1:5173';
const output = process.env.ALIFE_BROWSER_OUTPUT || require('node:os').tmpdir();
const localized = (en, zh) => ({ en, zh });
const dependencyVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '../node_modules/.vite/deps/_metadata.json'), 'utf8')).browserHash;
const harness = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh';
RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
const React = (await import('/node_modules/.vite/deps/react.js?v=${dependencyVersion}')).default;
const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js?v=${dependencyVersion}')).default;
const { BrowserRouter } = await import('/node_modules/.vite/deps/react-router-dom.js?v=${dependencyVersion}');
const { AuthProvider, useAuthStore } = await import('/src/stores/auth.tsx');
const { EventTeamPanel } = await import('/src/components/events/EventOperationsSurfaces.tsx');
const { default: EventTaskDetailPanel } = await import('/src/components/events/EventTaskDetailPanel.tsx');
const { default: EventTaskPublicationMaterial } = await import('/src/components/events/EventTaskPublicationMaterial.tsx');
const { ToolTileDeck } = await import('/src/components/events/ArrangementTileDeck.tsx');
await import('/src/styles/global.css');
function Harness() {
  const [moduleSelections, setModuleSelections] = React.useState({}); const [revision, setRevision] = React.useState(1);
  const auth = useAuthStore(); React.useEffect(() => { void auth.bootstrap(); }, []);
  if (!auth.me) return React.createElement('p', null, 'Loading fixture');
  return React.createElement('main', { style: { padding: 12, maxWidth: 1100, margin: 'auto' } },
    React.createElement('button', { onClick: () => auth.updateLanguage(auth.language === 'zh' ? 'en' : 'zh') }, 'Switch fixture language'),
    React.createElement('button', { onClick: () => setModuleSelections(previous => ({ 'PLACE.RESOURCE': previous['PLACE.RESOURCE'] === false })) }, 'Toggle fixture venue'),
    React.createElement('button', { onClick: () => { setModuleSelections({}); setRevision(value => value + 1); } }, 'Reload fixture plan'),
    location.search.includes('material') ? React.createElement(EventTaskPublicationMaterial, { eventId: 'qa-event', zh: auth.language === 'zh' }) :
    location.search.includes('detail') ? React.createElement(EventTaskDetailPanel, { eventId: 'qa-event', taskId: 'custom-task' }) :
    React.createElement(ToolTileDeck, { zh: auth.language === 'zh' }, React.createElement(EventTeamPanel, { eventId: 'qa-event', groupId: 'qa-group', language: auth.language, eventBasePath: '/events/qa-event', canManage: true, setupFlow: true, moduleSelections, planRevision: String(revision), item: { readiness: 'notReady', label: { en: 'Tasks', zh: '任务' } } })));
}
createRoot(document.getElementById('root')).render(React.createElement(AuthProvider, null, React.createElement(BrowserRouter, null, React.createElement(Harness))));
</script></body></html>`;

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const language of ['zh', 'en']) for (const width of [320, 1280]) {
      const zh = language === 'zh', t = (en, cn) => zh ? cn : en;
      const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      await context.addInitScript(lang => localStorage.setItem('alife.language', lang), language);
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      const errors = [], writes = []; let reads = 0, actor = 'owner', task = null, failPreparation = false, savedVenueEnabled = true;
      page.on('pageerror', e => errors.push(e.message));
      const roles = [{ id: 'owner-role', memberId: 'owner', roleRequirementKey: 'TEAM.WORK:event.accountableOwner', status: 'accepted' }];
      const team = () => ({ canManage: actor === 'owner', members: [{ id: 'team-member', memberId: 'helper', displayName: 'Helper / 协作同工', status: 'accepted' }], roles, tasks: task ? [task] : [], readinessBlockers: [],
        roleRequirements: [['TEAM.WORK', 'event.accountableOwner'], ['PLACE.RESOURCE', 'resource.coordinator']].map(([moduleCode, roleCode]) => ({ moduleCode, roleCode, requirementKey: `${moduleCode}:${roleCode}`, minimum: 1, recommended: 1, maximum: 1, eligibility: [], separationFrom: [] })),
        enabledModules: [{ moduleCode: 'TEAM.WORK', label: localized('Tasks and handoffs', '任务与交接') }, { moduleCode: 'PLACE.RESOURCE', label: localized('Venue and resources', '场地与资源') }].filter(module => savedVenueEnabled || module.moduleCode !== 'PLACE.RESOURCE') });
      const detail = () => ({ task, history: [], participants: [{ id: 'owner', name: 'Owner' }, { id: 'helper', name: 'Helper' }], canManage: actor === 'owner', canRespond: actor === 'helper' && task.assignmentStatus === 'invited', canPrepare: actor === 'helper' && task.assignmentStatus === 'accepted', canSubmit: false, canWithdraw: false, canReview: false });
      await context.route(`${base}/__task-qa**`, route => route.fulfill({ contentType: 'text/html', body: harness }));
      await context.route('**/api/**', async route => {
        const request = route.request(), url = new URL(request.url()), p = url.pathname; let data = [];
        if (request.method() === 'GET') reads++; else writes.push(p);
        if (p === '/api/me') data = { id: actor, displayName: actor, isRegistered: true, isGuest: false, memberships: [], permissions: [] };
        else if (p.endsWith('/team')) data = team();
        else if (p.endsWith('/memberships')) data = [{ memberId: 'owner', displayName: 'Owner', status: 'approved' }, { memberId: 'helper', displayName: 'Helper / 协作同工', status: 'approved' }];
        else if (p.endsWith('/occurrences')) data = [{ id: 'occurrence', eventId: 'qa-event', startUtc: '2030-10-04T10:00:00Z', endUtc: '2030-10-04T12:00:00Z' }];
        else if (p.endsWith('/role-assignments')) { roles.push({ id: 'venue-role', ...request.postDataJSON(), status: 'invited' }); data = roles.at(-1); }
        else if (p.endsWith('/tasks')) { const body = request.postDataJSON(); assert.equal(body.requireAcceptance, true); task = { ...body, id: 'custom-task', eventId: 'qa-event', assignmentStatus: 'invited', status: 'todo', eTag: '"task-1"', dependencies: [], blockers: [], preparation: localized('', '') }; data = task; }
        else if (p.endsWith('/accept-assignment')) { assert.equal(request.headers()['if-match'], task.eTag); task = { ...task, assignmentStatus: 'accepted', eTag: '"task-2"' }; data = detail(); }
        else if (p.endsWith('/save-preparation')) {
          assert.ok(request.headers()['idempotency-key']);
          if (failPreparation) { failPreparation = false; return route.fulfill({ status: 503, json: { message: 'Fixture save failed' } }); }
          task = { ...task, preparation: request.postDataJSON().preparation, preparationUpdatedUtc: '2030-09-01T00:00:00Z', eTag: '"task-3"', status: 'inProgress' }; data = detail();
        } else if (p.endsWith('/select-publication')) { task = { ...task, preparationPublicationCandidate: request.postDataJSON().publicationCandidate, eTag: '"task-3-selection-1"' }; data = detail(); }
        else if (p.endsWith('/tasks/custom-task')) data = detail();
        return route.fulfill({ status: 200, headers: { 'Cache-Control': 'private, no-store' }, json: data });
      });
      await page.goto(`${base}/__task-qa`);
      await page.getByText(t('Enabled module responsibilities', '已启用模块负责人'), { exact: true }).waitFor().catch(async error => { console.error(errors, await page.locator('body').innerText()); throw error; });
      const moduleHeading = page.getByText(t('Enabled module responsibilities', '已启用模块负责人'), { exact: true });
      assert.equal(await moduleHeading.locator('xpath=ancestor::details[1]').getAttribute('open'), null);
      await moduleHeading.click();
      await page.getByText(t('Venue and resources', '场地与资源'), { exact: true }).click();
      // The role heading uses the established role label.
      const roleSelect = page.locator('[data-arrangement-roles] select').last();
      await roleSelect.selectOption('helper');
      await page.locator('[data-arrangement-roles]').getByRole('button', { name: t('Invite', '邀请'), exact: true }).click();
      await page.getByText(t('Awaiting acceptance', '待本人接受'), { exact: true }).waitFor();
      const venueRow = page.locator('[data-team-module="PLACE.RESOURCE"]');
      assert.equal(await venueRow.getByText(t('Invite a member for this role', '邀请成员承担此角色'), { exact: true }).count(), 0);
      await venueRow.locator(':scope > summary').click();
      assert.equal(await roleSelect.isVisible(), false);
      assert.match(await venueRow.locator(':scope > summary').innerText(), /Helper/);
      await page.screenshot({ path: path.join(output, `modules-${language}-${width}.png`), fullPage: true });
      const beforeToggle = reads, writesBeforeToggle = writes.length;
      await page.getByRole('button', { name: 'Toggle fixture venue' }).click();
      assert.equal(await venueRow.count(), 0);
      assert.equal(reads, beforeToggle); assert.equal(writes.length, writesBeforeToggle);
      await page.getByRole('button', { name: 'Toggle fixture venue' }).click();
      assert.equal(await venueRow.count(), 1); assert.equal(roles.length, 2);
      savedVenueEnabled = false;
      await page.getByRole('button', { name: 'Reload fixture plan' }).click();
      await page.getByText(t('1 modules', '1 个模块'), { exact: true }).waitFor();
      assert.equal(await venueRow.count(), 0);
      const taskSection = page.locator('details[data-tool-panel]').filter({ has: page.getByText(t('Custom tasks and preparation', '自定义任务与准备情况'), { exact: true }) });
      await taskSection.locator(':scope > summary').click();
      await taskSection.getByLabel(`${t('Task title', '任务标题')} · ${zh ? '中文' : 'English'}`, { exact: true }).fill(zh ? '布置迎新角' : 'Prepare the welcome corner');
      assert.equal(await taskSection.getByLabel(`${t('Task title', '任务标题')} · ${zh ? 'English' : '中文'}`, { exact: true }).isVisible(), false);
      await taskSection.locator('form details summary').first().click();
      await taskSection.getByLabel(`${t('Task title', '任务标题')} · ${zh ? 'English' : '中文'}`, { exact: true }).fill(zh ? 'Prepare the welcome corner' : '布置迎新角');
      await taskSection.getByLabel(`${t('Task description', '任务描述')} · ${zh ? '中文' : 'English'}`, { exact: true }).fill(zh ? '摆放桌椅与欢迎卡片' : 'Arrange tables and welcome cards');
      await taskSection.locator('form details summary').nth(1).click();
      await taskSection.getByLabel(`${t('Task description', '任务描述')} · ${zh ? 'English' : '中文'}`, { exact: true }).fill(zh ? 'Arrange tables and welcome cards' : '摆放桌椅与欢迎卡片');
      await taskSection.getByLabel(t('Assignee', '負責人'), { exact: false }).selectOption('helper');
      await taskSection.getByLabel(t('Occurrence', '关联场次'), { exact: false }).selectOption('occurrence');
      await taskSection.getByLabel(t('Due', '期限'), { exact: true }).fill('2030-10-03T17:00');
      const beforeSwitch = reads;
      await page.getByRole('button', { name: 'Switch fixture language' }).click();
      await page.getByRole('button', { name: 'Switch fixture language' }).click();
      assert.equal(reads, beforeSwitch);
      await taskSection.getByRole('button', { name: t('Add task', '新增任務'), exact: true }).click();
      await page.getByRole('link', { name: t('Prepare the welcome corner', '布置迎新角'), exact: true }).waitFor();
      assert.equal(task.description.zh, '摆放桌椅与欢迎卡片'); assert.equal(task.eventOccurrenceId, 'occurrence');
      assert.equal(await page.getByText(/AI|岗位轮班|Role shifts/).count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(output, `team-${language}-${width}.png`), fullPage: true });
      actor = 'helper'; await page.goto(`${base}/__task-qa?detail`);
      await page.getByRole('button', { name: t('Accept delegation', '接受委派'), exact: true }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: t('Confirm', '确认'), exact: true }).click();
      await page.getByLabel(`${t('Preparation update', '准备情况')} · ${zh ? '中文' : 'English'}`, { exact: true }).fill(zh ? '桌椅和欢迎卡已准备好' : 'Tables and welcome cards are ready');
      await page.locator('fieldset details summary').click();
      await page.getByLabel(`${t('Preparation update', '准备情况')} · ${zh ? 'English' : '中文'}`, { exact: true }).fill(zh ? 'Tables and welcome cards are ready' : '桌椅和欢迎卡已准备好');
      failPreparation = true;
      for (let attempt = 0; attempt < 2; attempt++) {
        await page.getByRole('button', { name: t('Save preparation update', '保存准备情况'), exact: true }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: t('Confirm', '确认'), exact: true }).click();
        if (!attempt) await page.getByText('Fixture save failed', { exact: false }).waitFor();
      }
      await page.waitForFunction(() => document.querySelector('button') && !document.querySelector('[role="alertdialog"]'));
      assert.equal(task.preparation.zh, '桌椅和欢迎卡已准备好');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(output, `preparation-${language}-${width}.png`), fullPage: true });
      actor = 'owner'; await page.goto(`${base}/__task-qa?detail`);
      await page.getByRole('button', { name: t('Select as publication material', '选作发布素材'), exact: true }).click();
      const selectionResponse = page.waitForResponse(response => response.url().endsWith('/select-publication'));
      await page.getByRole('alertdialog').getByRole('button', { name: t('Confirm', '确认'), exact: true }).click();
      await selectionResponse;
      await page.goto(`${base}/__task-qa?material`);
      await page.getByRole('button', { name: t('Copy bilingual material', '复制双语素材'), exact: true }).waitFor();
      assert.equal(await page.getByText(t('Tables and welcome cards are ready', '桌椅和欢迎卡已准备好'), { exact: true }).isVisible(), true);
      assert.equal(await page.getByText(t('桌椅和欢迎卡已准备好', 'Tables and welcome cards are ready'), { exact: true }).isVisible(), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(output, `material-${language}-${width}.png`), fullPage: true });
      assert.deepEqual(errors, []); await context.close(); console.log(`PASS ${language} ${width}: modules, delegation, bilingual drafts, no refetch, failure/retry, layout`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
