// All requests are fixtures. No provider calls, real approvals, policy publication or database writes.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const path = require('node:path');
const os = require('node:os');
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://127.0.0.1:5173';
const text = (en, zh) => ({ en, zh });
const eventId = '11111111-1111-1111-1111-111111111111';
const churchId = '22222222-2222-2222-2222-222222222222';
const categories = ['environment', 'activity', 'participants', 'transport', 'emergency'];
const makePolicy = () => ({ id: 'policy-1', churchId, version: 1, isPublished: false, eTag: 'policy-etag-1', data: {
  likelihood: [1,2,3,4,5].map(value => ({ value, label: text(`Likelihood ${value}`, `可能性 ${value}`), description: text(`Definition ${value}`, `定义 ${value}`) })),
  impact: [1,2,3,4,5].map(value => ({ value, label: text(`Impact ${value}`, `影响 ${value}`), description: text(`Definition ${value}`, `定义 ${value}`) })),
  matrix: [1,2,3,4,5].flatMap(likelihood => [1,2,3,4,5].map(impact => ({ likelihood, impact, level: null }))),
  categories: categories.map(code => ({ code, name: text(code, code), guidance: text('Consider people, equipment and task factors.', '考虑人员、设备和任务因素。') })),
  questions: Array.from({ length: 8 }, (_, i) => ({ code: `q${i}`, activityType: 'generic', categoryCode: categories[i % 5], text: text(`Question ${i}`, `问题 ${i}`), guidance: text('Who checks this and what remains unknown?', '由谁核查，还有哪些未知事项？') })),
  reviewRules: { reviewReminderDays: 7 }, source: 'Manual + SOP, test fixture',
} });
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const language of ['zh','en']) for (const width of [375,1280]) {
      const zh = language === 'zh', t = (en, cn) => zh ? cn : en;
      const context = await browser.newContext({ viewport: { width, height: 950 } });
      await context.addInitScript(language => localStorage.setItem('alife.language', language), language);
      const page = await context.newPage(); page.setDefaultTimeout(20000);
      const errors = [], writes = []; page.on('pageerror', e => errors.push(e.message));
      let policy = makePolicy(), history = [], actions = [], version = 1, workspaceReads = 0;
      let draft = { schemaVersion: 2, activities: [{ id: 'walk', type: 'hiking', name: text('Walk', '步行') }], participantCount: 12, authorAttendsAndLeads: true, onsiteMemberId: null, isOuting: false, isOvernight: false, isHighRisk: false, weatherConfirmation: text('', ''), accommodation: text('', ''), transport: text('', ''),
        hazards: [{ id: 'slip', activityId: 'walk', categoryCode: 'environment', hazard: text('Slip', '滑倒'), consequence: text('Injury', '受伤'), likelihood: 2, impact: 3, riskScore: 6, initialLevel: 'Green', controlMeasures: text('Check the surface', '检查路面'), personResponsible: 'QA', residualLikelihood: 1, residualImpact: 2, residualScore: 2, residualLevel: 'Green', additionalAction: text('Monitor', '持续观察') }],
        answers: policy.data.questions.map(q => ({ activityId: 'walk', questionCode: `generic:${q.code}`, answer: text('Checked', '已核查'), notApplicable: false, reason: text('', '') })),
      };
      let assessment = { eventId, groupId: churchId, schemaVersion: 2, eTag: 'ram-1', status: 'draft', validity: 'Draft', residualLevel: 'Green', policyVersionId: 'policy-1', currentRevisionId: null, authorMemberId: 'qa', createdUtc: '2026-09-11T12:00:00Z', updatedUtc: '2026-09-11T12:00:00Z', ramDataJson: JSON.stringify(draft) };
      await context.route('**/api/**', async route => {
        const req = route.request(), p = new URL(req.url()).pathname, body = req.method() === 'GET' ? null : req.postDataJSON();
        if (body) writes.push({ p, body }); let data = [];
        if (p === '/api/me') data = { id: 'qa', displayName: 'QA', isGuest: false, isRegistered: true, platformRole: 'superadmin', permissions: ['admin.events.manageRamPolicies','admin.events.audit'], memberships: [{ groupId: churchId, role: 'leader', status: 'approved' }] };
        else if (p === '/api/groups/visible') data = [{ id: churchId, isChurch: true, name: text('QA Church', '测试教会'), accessType: 'public', parentGroupId: null }];
        else if (p.endsWith('/ram-policies') && req.method() === 'GET') data = [policy];
        else if (p.endsWith('/ram-policies') && req.method() === 'PUT') { policy = { ...policy, data: body.data, eTag: 'policy-etag-2' }; data = policy; }
        else if (p.endsWith('/publish')) { assert.equal(body.confirmEveryCell, true); assert.ok(policy.data.matrix.every(c => c.level)); policy = { ...policy, isPublished: true, eTag: 'policy-etag-3', publishedByMemberId: 'qa', publishedUtc: '2026-09-11T12:00:00Z' }; data = policy; }
        else if (p.endsWith('/workspace') && !p.endsWith('/ram/workspace')) data = { eventId, owningGroupId: churchId, title: text('QA Event','测试活动'), canManage: false, planVersion: 1, sponsorshipStatus: 'none', readiness: { status: 'notReady' }, nextSteps: [], items: [{ surfaceKey: 'workspace.overview', presentation: 'tab', sectionKey: 'overview', label: text('Overview','总览'), order: 0, blockers: [] }, { surfaceKey: 'safety.ram', moduleCode: 'SAFETY.RAM', presentation: 'page', pathSegment: 'ram', label: text('RAM and safety','RAM 与安全'), order: 1, readiness: 'notReady', blockers: [] }] };
        else if (p.endsWith('/ram/workspace')) { workspaceReads++; data = { assessment, policy: policy.isPublished ? policy : null, history, actions, onsiteCandidates: [], canEdit: true, canAudit: true, currentMemberId: 'qa', isRequired: true }; }
        else if (p.endsWith('/ram') && req.method() === 'PUT') { assert.equal(body.schemaVersion, 2); assert.equal(body.expectedETag, assessment.eTag); draft = JSON.parse(body.ramDataJson); assessment = { ...assessment, eTag: `ram-${++version}`, ramDataJson: JSON.stringify(draft), status: 'draft', validity: 'Draft', currentRevisionId: null }; data = assessment; }
        else if (p.includes('/ram/actions/')) {
          const action = p.split('/').pop(); assert.ok(req.headers()['idempotency-key']);
          if (action === 'request-confirmation') { const revision = { id: 'revision-1', version: 1, schemaVersion: 2, policyVersionId: policy.id, contentHash: 'fixed-content-hash', residualLevel: 'Green', authorMemberId: 'qa', onsiteMemberId: 'qa', createdUtc: '2026-09-11T12:00:00Z' }; history = [revision]; assessment = { ...assessment, currentRevisionId: revision.id, validity: 'AwaitingConfirmation', eTag: `ram-${++version}` }; }
          else if (action === 'confirm') assessment = { ...assessment, validity: 'Confirmed', eTag: `ram-${++version}` };
          actions.push({ id: `action-${actions.length}`, revisionId: 'revision-1', actorMemberId: 'qa', action, reason: '', healthSafetySigned: false, createdUtc: '2026-09-11T12:00:00Z' }); data = assessment;
        }
        else if (p.includes('/ram/versions/')) data = { revision: history[0], ramDataJson: assessment.ramDataJson, policy, actions, isCurrent: true, validity: assessment.validity, isDraft: true };
        else if (p === '/api/events/ram-guidance') { assert.deepEqual(Object.keys(body).sort(), ['activityType','category','eventId','language']); return route.fulfill({ status: 503, json: { message: 'AI unavailable' } }); }
        await route.fulfill({ status: 200, headers: { 'Cache-Control': 'private, no-store' }, json: data });
      });
      await page.goto(`${base}/admin/ram-policies`);
      await page.getByRole('heading', { name: t('RAM policies and questions','RAM 政策与题库'), exact: true }).waitFor();
      await page.getByLabel('1 × 1', { exact: true }).waitFor();
      assert.equal(await page.getByRole('tablist').count(), 1);
      assert.equal(await page.getByRole('button', { name: t('Preview and publish','预览并发布'), exact: true }).isDisabled(), true);
      for (let l=1;l<=5;l++) for (let i=1;i<=5;i++) await page.getByLabel(`${l} × ${i}`, { exact: true }).selectOption((l+i)%3 === 0 ? 'Red' : 'Green');
      await page.getByRole('tab', { name: t('Questions','活动题库'), exact: true }).click();
      await page.getByLabel(t('Search questions','搜索题目'), { exact: true }).fill('q7');
      await page.locator('summary').filter({ hasText: t('Question 7','问题 7') }).waitFor();
      await page.getByLabel(t('Search questions','搜索题目'), { exact: true }).fill('');
      await page.getByRole('button', { name: t('Next','下一页'), exact: true }).click();
      await page.locator('summary').filter({ hasText: t('Question 7','问题 7') }).waitFor();
      await page.getByRole('tab', { name: t('Matrix','评分矩阵'), exact: true }).click();
      await page.getByRole('button', { name: t('Save policy draft','保存政策草稿'), exact: true }).click();
      await page.getByRole('button', { name: t('Preview and publish','预览并发布'), exact: true }).click();
      const dialog = page.getByRole('alertdialog'); await dialog.waitFor();
      await dialog.getByRole('button', { name: t('Confirm configuration and publish','确认全部配置并发布'), exact: true }).click();
      await page.getByText(t('Published, read-only','已发布，只读'), { exact: false }).waitFor();
      await page.screenshot({ path: path.join(os.tmpdir(), `alife-ram-policy-${language}-${width}.png`) });
      const workspacePath = `/groups/${churchId}/events/${eventId}/workspace`;
      await page.goto(`${base}${workspacePath}`);
      await page.getByRole('link', { name: /RAM and safety|RAM 与安全/ }).click();
      assert.equal(new URL(page.url()).pathname, `${workspacePath}/ram`);
      assert.equal(await page.locator('#event-editor-panel-ram').count(), 0);
      const area = async (en, cn) => { if (!await page.locator('[data-module-editor="SAFETY.RAM"]').count()) return; const button = page.locator('[data-module-editor="SAFETY.RAM"]').getByRole('button', { name: t(en, cn), exact: true }); if (await button.getAttribute('aria-expanded') !== 'true') await button.click(); };
      await area('Activities and conditions', '活动项目与条件');
      await page.getByLabel(t('Participant count','参与人数'), { exact: true }).waitFor();
      await page.getByLabel(t('Participant count','参与人数'), { exact: true }).fill('13');
      await page.getByRole('button', { name: t('Save RAM draft','保存 RAM 草稿'), exact: true }).click();
      await page.getByRole('status').filter({ hasText: t('Action completed.','操作已完成。') }).waitFor();
      assert.equal(draft.participantCount, 13);
      const readsBeforeLanguage = workspaceReads;
      await page.getByRole('button', { name: t('Select language, current language: English', '选择语言，当前语言：中文'), exact: true }).click();
      await page.getByRole('menuitemradio', { name: zh ? 'English' : '中文', exact: true }).click();
      await page.getByLabel(zh ? 'Participant count' : '参与人数', { exact: true }).waitFor();
      assert.equal(workspaceReads, readsBeforeLanguage);
      await page.getByRole('button', { name: zh ? 'Select language, current language: English' : '选择语言，当前语言：中文', exact: true }).click();
      await page.getByRole('menuitemradio', { name: zh ? '中文' : 'English', exact: true }).click();
      await page.getByLabel(t('Participant count','参与人数'), { exact: true }).waitFor();
      assert.equal(workspaceReads, readsBeforeLanguage);
      await area('Required questions', '适用必答题');
      const guidance = page.getByText(t('Explanation and follow-up prompts','解释与追问提示'), { exact: true }).first(); await guidance.click();
      await page.getByRole('button', { name: t('Ask AI to explain this risk category','请 AI 解释此类风险'), exact: true }).first().click();
      await page.getByText(t('AI is unavailable. Use the guidance above and continue answering manually.','AI 暂不可用。仍可查看上述提示并继续人工作答。'), { exact: true }).waitFor();
      const before = JSON.stringify(draft.hazards); assert.equal(before, JSON.stringify(JSON.parse(assessment.ramDataJson).hazards));
      await area('Personal confirmation and independent review', '本人确认与独立审核');
      const freeze = t('Freeze version and request personal confirmation','固定版本并请求本人确认');
      await page.getByRole('button', { name: freeze, exact: true }).click(); await page.getByRole('alertdialog').getByRole('button', { name: freeze, exact: true }).click();
      const confirm = t('I confirm I will attend and lead this version','本人确认出席并领导此版本活动');
      await page.getByRole('button', { name: confirm, exact: true }).click(); await page.getByRole('alertdialog').getByRole('button', { name: confirm, exact: true }).click();
      await page.getByText(t('Personally confirmed','本人已确认'), { exact: true }).waitFor();
      await page.locator('summary').filter({ hasText: 'v1 ·' }).click();
      await area('Version and signature history', '版本与签署历史');
      await page.getByRole('button', { name: t('View version / print','查看此版本／打印'), exact: true }).click();
      await page.getByText(t('DRAFT — NOT APPROVED','草稿 — 未经批准'), { exact: true }).waitFor();
      await page.emulateMedia({ media: 'print' });
      await page.pdf({ path: path.join(os.tmpdir(), `alife-ram-draft-${language}-${width}.pdf`), format: 'A4', printBackground: true });
      await page.emulateMedia({ media: 'screen' });
      await page.getByRole('button', { name: t('Close preview','关闭预览'), exact: true }).click();
      await page.screenshot({ path: path.join(os.tmpdir(), `alife-ram-workspace-${language}-${width}.png`), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
      assert.deepEqual(errors, []); assert.ok(workspaceReads >= 2);
      console.log(`PASS RAM ${language} ${width}: Workspace safety navigation, language stability, 25-cell policy, question pagination, explicit publication, manual save, AI outage isolation, personal version confirmation, protected draft print/PDF`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
