// Real editors/providers, with browser-local API and speech fixtures. No live writes.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://localhost:5173';
const output = process.env.ALIFE_BROWSER_OUTPUT || require('node:os').tmpdir();
const eventId = '11111111-1111-1111-1111-111111111111', groupId = '22222222-2222-2222-2222-222222222222';
const ownerId = '33333333-3333-3333-3333-333333333333', activityId = '44444444-4444-4444-4444-444444444444';
const bi = (en, zh = en) => ({ en, zh });
const initialRules = { purpose: bi('Coordinate attendance', '协调人数'), audience: 'group', eligibleGroupId: groupId, eligibility: bi('Guests welcome', '欢迎访客'), capacity: 30, opensUtc: '2026-10-01T01:00:00Z', deadlineUtc: '2026-10-02T01:00:00Z', allowWaitlist: true, channel: 'app', terms: bi('Follow the rules', '遵守规则'), privacyNotice: bi('Used for this event', '用于本活动'), cancellationTerms: bi('Tell the organiser', '通知组织者'), manualReview: false, materials: [{ id: 'legacy-note', label: bi('Notes', '备注'), kind: 'text', required: true, maxCount: 1, maxBytes: 1024 }], feeMinor: 0, currency: 'NZD', paymentInstructions: bi(''), refundTerms: bi(''), moneyFlowScope: 'unspecified' };
const harness = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;
const [react, reactDOM, providers, auth, operations, registration] = await Promise.all([import('/node_modules/.vite/deps/react.js'), import('/node_modules/.vite/deps/react-dom_client.js'), import('/src/app/AppProviders.tsx'), import('/src/stores/auth.tsx'), import('/src/components/events/EventOperationsSurfaces.tsx'), import('/src/components/events/EventRegistrationRulesEditor.tsx')]);
await import('/src/styles/global.css');
const React = react.default || react, ReactDOM = reactDOM.default || reactDOM, h = React.createElement;
function Harness() {
 const state = auth.useAuthStore(); const [tab, setTab] = React.useState('tasks'), [readOnly, setReadOnly] = React.useState(false);
 window.__setFormTab = setTab; window.__setReadOnly = setReadOnly; window.__language = state.updateLanguage;
 return h('main', { style: { maxWidth: 1200, margin: 'auto', padding: 12 } },
  h('section', { hidden: tab !== 'tasks', 'data-fixture': 'tasks' }, h(operations.EventTeamPanel, { eventId: '${eventId}', groupId: '${groupId}', language: state.language, canManage: !readOnly, eventBasePath: '/events/${eventId}', item: { readiness: 'notReady' } })),
  h('section', { hidden: tab !== 'registration', 'data-fixture': 'registration' }, h(registration.default, { eventId: '${eventId}' })));
}
ReactDOM.createRoot(document.getElementById('root')).render(h(providers.default, null, h(Harness)));
</script></body></html>`;
async function pane(workspace, name) {
  await workspace.waitFor({ state: 'visible' });
  await workspace.page().waitForFunction(el => el.dataset.wide === String(innerWidth >= 1024 && el.getBoundingClientRect().width >= 880), await workspace.elementHandle());
  if (await workspace.getAttribute('data-wide') === 'true') {
    if (name === 'assistant' && await workspace.getAttribute('data-assistant-open') !== 'true') await workspace.getByRole('button', { name: /Show assistant|展开助手/ }).click();
  } else await workspace.getByRole('tab', { name: name === 'assistant' ? /AI assistant|AI 助手/ : /Task form|任务表单|Registration rules form|报名规则表单/ }).click();
}
async function layout(page, workspace, scope) {
  await pane(workspace, 'assistant');
  const send = workspace.getByRole('button', { name: /Send and organise details|发送并整理资料/ }), voice = workspace.getByRole('button', { name: /Voice input|语音输入/, exact: true });
  const a = await send.boundingBox(), b = await voice.boundingBox(), input = await workspace.locator('textarea[maxlength="8000"]').boundingBox();
  if (!(b.x > a.x && Math.abs(a.y - b.y) <= 2.5)) await workspace.screenshot({ path: path.join(output, 'alife-form-layout-failure.png') });
  assert.ok(b.x > a.x && Math.abs(a.y - b.y) <= 2.5, JSON.stringify({ send: a, voice: b })); assert.ok(a.y >= input.y + input.height);
  if (await workspace.getAttribute('data-wide') === 'true') {
    const form = await workspace.locator('.event-details-form').boundingBox(), assistant = await workspace.locator('.event-details-assistant').boundingBox();
    if (scope === 'tasks') {
      assert.ok(Math.abs(form.y + form.height - assistant.y - assistant.height) < 2, 'task form/assistant bottoms align');
      assert.ok(await workspace.locator('.event-assistant-content').evaluate(el => el.scrollHeight <= el.clientHeight + 2), 'only the task conversation can overflow');
    }
  }
  if (scope === 'registration') {
    const panel = workspace.locator('.event-details-assistant--viewport'), bounds = await panel.boundingBox();
    assert.ok(bounds.height <= 1.5 * page.viewportSize().height + 2, 'registration assistant stays near one and a half viewport heights');
    assert.equal(await panel.evaluate(el => getComputedStyle(el).overflowY), 'auto');
    await panel.evaluate(el => { el.scrollTop = el.scrollHeight; });
    assert.ok(await workspace.locator('.event-assistant-completion').isVisible(), 'completion remains reachable inside the assistant');
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}
(async () => {
 const browser = await chromium.launch({ headless: true, ...(process.env.ALIFE_BROWSER_EXECUTABLE ? { executablePath: process.env.ALIFE_BROWSER_EXECUTABLE } : {}) });
 try {
  for (const language of (process.env.ALIFE_QA_LANGUAGES || 'zh,en').split(',')) for (const width of (process.env.ALIFE_QA_WIDTHS || '320,768,1280').split(',').map(Number)) {
   const context = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId: 'Australia/Perth', reducedMotion: 'reduce', serviceWorkers: 'block' });
   await context.addInitScript(language => {
    localStorage.setItem('alife.language', language); window.__voice = [];
    window.SpeechRecognition = class { constructor() { this.aborts = 0; window.__voice.push(this); } start() { this.onstart?.(); } stop() { this.onend?.(); } abort() { this.aborts++; } };
   }, language);
   const page = await context.newPage(); page.setDefaultTimeout(15000); const errors = [], requests = [], writes = []; let release, readonly = false, rules = structuredClone(initialRules);
   page.on('pageerror', e => errors.push(e.message));
   await context.route('**/__qa/forms', route => route.fulfill({ contentType: 'text/html', body: harness }));
   await context.route('**/api/**', async route => {
    const req = route.request(), p = new URL(req.url()).pathname; let data = [], status = 200;
    if (p === '/api/me') data = { id: ownerId, displayName: 'QA Owner', isGuest: false, isRegistered: true, memberships: [], permissions: [] };
    else if (p.endsWith('/memberships')) data = [{ memberId: ownerId, displayName: 'QA Owner', status: 'approved' }];
    else if (p.endsWith('/activity-plan')) data = { data: { activities: [{ id: activityId, name: bi('Shared meal', '聚餐'), conditions: bi(''), type: 'generic' }], participantCount: null, isOuting: false, isOvernight: false, isHighRisk: false, weatherConfirmation: bi('') }, eTag: 'activity-v1', canEdit: true, reports: [], legacyCandidate: null };
    else if (p.endsWith('/team')) data = { members: [{ id: 'team-qa', memberId: ownerId, displayName: 'Private member', status: 'accepted' }], roles: [], tasks: [], roleRequirements: [], readinessBlockers: [], enabledModules: [], canManage: true };
    else if (p.endsWith('/registration-work')) data = { eventId, groupId, eventStartUtc: '2026-10-03T01:00:00Z', policy: { rules, eTag: 'rules-v1', version: 1 }, canConfigure: !readonly, applications: [{ privateRecord: 'DO NOT SEND' }] };
    else if (p === '/api/events/form-assistance') {
      const input = req.postDataJSON(); requests.push(input);
      assert.ok(!JSON.stringify(input).includes('Private member')); assert.ok(!JSON.stringify(input).includes('DO NOT SEND'));
      assert.ok(!Object.hasOwn(input.form, 'eligibleGroupId')); assert.ok(!Object.hasOwn(input.form, 'assignedMemberId'));
      assert.ok(!Object.hasOwn(input.form, 'description')); assert.ok(!Object.hasOwn(input.form, 'activityId'));
      if (input.message === 'failure') { status = 503; data = { message: 'Fixture unavailable' }; }
      else {
        if (input.message === 'slow') await new Promise(resolve => { release = resolve; });
        const patch = input.scope === 'tasks' ? { title: bi('Prepare venue', '准备场地'), dueLocal: '2026-10-02T16:00', requiresApproval: true } : { purpose: bi('Coordinate a shared meal', '协调聚餐'), capacity: 48, materials: [...input.form.materials, { id: '', label: bi('Dietary note', '饮食备注'), kind: 'text', required: true, maxCount: 1, maxBytes: 10485760 }] };
        data = { revision: input.revision, form: { ...input.form, ...patch }, adoptedFields: Object.keys(patch), assistantReply: bi('Draft updated. Please review.', '草稿已更新，请核对。') };
      }
    } else if (['POST','PUT','DELETE'].includes(req.method())) { writes.push({ p, body: req.postDataJSON() }); if (p.endsWith('/rules')) { rules = req.postDataJSON(); data = { rules, eTag: 'rules-v2', version: 2 }; } else data = { id: 'task' }; }
    await route.fulfill({ status, json: data });
   });
   await page.goto(`${base}/__qa/forms`);
   await page.waitForFunction(() => typeof window.__setFormTab === 'function').catch(error => { console.error(errors); throw error; });
   for (const scope of ['tasks', 'registration']) {
    await page.evaluate(scope => window.__setFormTab(scope), scope);
    const workspace = page.locator(`[data-fixture="${scope}"] .event-details-workspace`); await workspace.waitFor().catch(async error => { console.error({ errors, url: page.url(), content: (await page.content()).slice(0, 1600) }); throw error });
    await layout(page, workspace, scope);
    assert.equal(await workspace.getByRole('button', { name: /Back to event details form|回到活动资料表单/ }).count(), 0);
    const prompt = workspace.locator('textarea[maxlength="8000"]'), send = workspace.getByRole('button', { name: /Send and organise details|发送并整理资料/ });
    await prompt.fill('Prepare the draft'); const before = writes.length; await send.click(); await workspace.getByRole('log').getByText(/Draft updated|草稿已更新/).waitFor(); assert.equal(writes.length, before);
    await pane(workspace, 'form');
    if (scope === 'tasks') { assert.equal(await workspace.locator('[data-detail-field="title"] [data-locale="en"]').inputValue(), 'Prepare venue'); assert.equal(await workspace.locator('.event-details-form select[required]').inputValue(), ''); }
    else {
      const field = workspace.locator('[data-detail-field="purpose"]');
      await field.getByLabel(language === 'zh' ? '中文' : 'English', { exact: true }).waitFor().catch(async error => { console.error(await workspace.locator('.event-details-form').evaluate(el => el.outerHTML.slice(0, 4500)), errors); throw error; });
      assert.equal(await field.getByLabel(language === 'zh' ? '中文' : 'English', { exact: true }).inputValue(), language === 'zh' ? '协调聚餐' : 'Coordinate a shared meal');
      assert.equal(await field.getByLabel(language === 'zh' ? 'English' : '中文', { exact: true }).isVisible(), false);
      await field.locator('summary').click(); assert.equal(await field.getByLabel(language === 'zh' ? 'English' : '中文', { exact: true }).isVisible(), true);
      assert.equal(await workspace.locator('[data-detail-field="materials"] > fieldset').count(), 2);
    }
    await pane(workspace, 'assistant'); await prompt.fill('Retain this message');
    const count = requests.length; await page.evaluate(language => window.__language(language === 'zh' ? 'en' : 'zh'), language); assert.equal(await prompt.inputValue(), 'Retain this message'); assert.equal(requests.length, count);
    await page.evaluate(language => window.__language(language), language);
    await workspace.getByRole('button', { name: /Voice input|语音输入/, exact: true }).click();
    await page.evaluate(scope => window.__setFormTab(scope === 'tasks' ? 'registration' : 'tasks'), scope);
    await page.waitForFunction(() => window.__voice.at(-1).aborts > 0);
    await page.evaluate(scope => window.__setFormTab(scope), scope); await pane(workspace, 'assistant'); assert.equal(await prompt.inputValue(), 'Retain this message');
    await prompt.fill('failure'); await send.click(); await workspace.getByRole('alert').waitFor(); assert.equal(await prompt.inputValue(), 'failure');
    await prompt.fill('slow');
    await Promise.all([page.waitForRequest(r => r.url().endsWith('/form-assistance') && r.postDataJSON().message === 'slow'), send.click()]);
    await pane(workspace, 'form');
    if (scope === 'tasks') {
      const english = workspace.locator('[data-detail-field="title"] [data-locale="en"]');
      if (!await english.isVisible()) await workspace.locator('[data-detail-field="title"] summary').click();
      await english.fill('Manual edit');
    }
    else await workspace.locator('[data-detail-field="capacity"] input').fill('55');
    for (let attempt = 0; !release && attempt < 50; attempt++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.ok(release, 'the delayed reply is ready'); release(); release = null;
    await pane(workspace, 'assistant'); await workspace.getByRole('alert').filter({ hasText: /old reply was not adopted|未采用旧回复/ }).waitFor(); assert.equal(await prompt.inputValue(), 'slow');
    await prompt.fill('Retained after retry'); await layout(page, workspace, scope); await workspace.screenshot({ path: path.join(output, `alife-form-assistant-${scope}-${language}-${width}.png`) });
    await pane(workspace, 'form');
    if (scope === 'tasks') {
      await workspace.locator('.event-details-form select[required]').selectOption(ownerId);
      await workspace.getByLabel(/Linked activity|关联活动项目/).selectOption(activityId);
      await Promise.all([page.waitForResponse(r => r.url().endsWith('/tasks') && r.request().method() === 'POST'), workspace.getByRole('button', { name: /Add task|新增任务/ }).click()]);
      const saved = writes.at(-1).body; assert.equal(saved.title.en, 'Manual edit'); assert.equal(saved.assignedMemberId, ownerId); assert.equal(saved.activityId, activityId); assert.equal(saved.dueUtc, '2026-10-02T08:00:00.000Z');
    }
    if (scope === 'registration') {
      await Promise.all([page.waitForResponse(r => r.url().endsWith('/rules') && r.request().method() === 'PUT'), workspace.getByRole('button', { name: /Save registration plan|保存报名方案/ }).click()]);
      const saved = writes.at(-1).body; assert.equal(saved.capacity, 55); assert.equal(saved.materials[0].id, 'legacy-note'); assert.ok(saved.materials[1].id); assert.equal(saved.eligibleGroupId, groupId);
    }
   }
   await page.evaluate(() => { window.__setFormTab('tasks'); window.__setReadOnly(true); });
   const tasks = page.locator('[data-fixture="tasks"] .event-details-workspace'); await pane(tasks, 'assistant'); assert.equal(await tasks.getByRole('button', { name: /Send and organise details|发送并整理资料/ }).isDisabled(), true);
   readonly = true;
   await page.evaluate(async () => { const { queryClient } = await import('/src/db/queryClient.ts'); await queryClient.invalidateQueries({ queryKey: ['registration-work'] }); window.__setFormTab('registration'); });
   const registration = page.locator('[data-fixture="registration"] .event-details-workspace'); await pane(registration, 'assistant'); assert.equal(await registration.getByRole('button', { name: /Send and organise details|发送并整理资料/ }).isDisabled(), true);
   assert.deepEqual(errors, []); console.log(`PASS form assistants ${language} ${width}: layout, scoped drafts, bilingual fields, manual save, stale/failure, language/module continuity, hidden voice and read-only`);
   await context.close();
  }
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
