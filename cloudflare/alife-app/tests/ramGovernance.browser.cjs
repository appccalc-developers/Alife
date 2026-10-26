// All requests are fixtures. No provider calls, real approvals, policy publication or database writes.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const path = require('node:path');
const output=process.env.ALIFE_QA_OUTPUT || 'C:/Data/Alife/Temp/ram-policy-settings-20261011';
require('node:fs').mkdirSync(output,{recursive:true});
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://127.0.0.1:5173';
const text = (en, zh) => ({ en, zh });
const eventId = '11111111-1111-1111-1111-111111111111';
const churchId = '22222222-2222-2222-2222-222222222222';
const categories = ['environment', 'activity', 'participants', 'transport', 'emergency'];
const likelihood = [
  ['Rare', '极少', 'Less than 5% chance of occurring.', '发生机会低于 5%。'],
  ['Unlikely', '不太可能', '5–29% chance of occurring.', '发生机会为 5–29%。'],
  ['Moderate', '中等', '30–59% chance of occurring.', '发生机会为 30–59%。'],
  ['Likely', '很可能', '60–79% chance of occurring.', '发生机会为 60–79%。'],
  ['Almost certain', '几乎肯定', '80% or greater chance of occurring.', '发生机会为 80% 或以上。'],
];
const impact = [
  ['Negligible', '可忽略', 'Minor discomfort or negligible injury.', '轻微不适或可忽略的伤害。'],
  ['Minor', '轻微', 'Basic first aid; recovery in less than one week.', '基本急救；恢复时间少于一周。'],
  ['Moderate', '中等', 'Advanced first aid or medical visit; recovery in 1–6 weeks.', '进阶急救或就医；恢复时间为 1–6 周。'],
  ['Major', '严重', 'Hospital or emergency treatment; recovery longer than six weeks.', '医院或急诊治疗；恢复时间超过六周。'],
  ['Catastrophic', '灾难性', 'Immediate emergency response; permanent disability or death, or hospitalisation longer than six weeks.', '需立即紧急救援；永久残疾、死亡或住院超过六周。'],
];
const makePolicy = () => ({ id: 'policy-1', churchId, version: 1, isPublished: false, eTag: 'policy-etag-1', data: {
  likelihood: likelihood.map(([en, zh, descriptionEn, descriptionZh], index) => ({ value: index + 1, label: text(en, zh), description: text(descriptionEn, descriptionZh) })),
  impact: impact.map(([en, zh, descriptionEn, descriptionZh], index) => ({ value: index + 1, label: text(en, zh), description: text(descriptionEn, descriptionZh) })),
  matrix: [1,2,3,4,5].flatMap(likelihood => [1,2,3,4,5].map(impact => ({ likelihood, impact, level: null }))),
  categories: categories.map(code => ({ code, name: text(code, code), guidance: text('Consider people, equipment and task factors.', '考虑人员、设备和任务因素。') })),
  questions: Array.from({ length: 8 }, (_, i) => ({ code: `q${i}`, activityType: 'generic', categoryCode: categories[i % 5], text: text(`Question ${i}`, `问题 ${i}`), guidance: text('Who checks this and what remains unknown?', '由谁核查，还有哪些未知事项？') })),
  reviewRules: { reviewReminderDays: 7 }, source: 'Manual + SOP, test fixture',
} });
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const language of ['zh','en']) for (const width of [320,1280]) {
      const zh = language === 'zh', t = (en, cn) => zh ? cn : en;
      const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce', serviceWorkers: 'block', hasTouch: true });
      await context.addInitScript(language => localStorage.setItem('alife.language', language), language);
      const page = await context.newPage(); page.setDefaultTimeout(20000);
      const errors = [], writes = []; page.on('pageerror', e => errors.push(e.message));
      let policy = makePolicy(), history = [], actions = [], version = 1, workspaceReads = 0, policyReads = 0, authReads = 0;
      let draft = { schemaVersion: 2, activities: [{ id: 'walk', attributes: ['hiking'], name: text('Walk', '步行') }], participantCount: 12, authorAttendsAndLeads: true, onsiteMemberId: null, isOuting: false, isOvernight: false, isHighRisk: false, weatherConfirmation: text('', ''), accommodation: text('', ''), transport: text('', ''),
        hazards: [{ id: 'slip', activityId: 'walk', categoryCode: 'environment', hazard: text('Slip', '滑倒'), consequence: text('Injury', '受伤'), likelihood: 2, impact: 3, riskScore: 6, initialLevel: 'Green', controlMeasures: text('Check the surface', '检查路面'), personResponsible: 'QA', residualLikelihood: 1, residualImpact: 2, residualScore: 2, residualLevel: 'Green', additionalAction: text('Monitor', '持续观察') }],
        answers: policy.data.questions.map(q => ({ activityId: 'walk', questionCode: `generic:${q.code}`, answer: text('Checked', '已核查'), notApplicable: false, reason: text('', '') })),
      };
      let assessment = { eventId, groupId: churchId, schemaVersion: 2, eTag: 'ram-1', status: 'draft', validity: 'Draft', residualLevel: 'Green', policyVersionId: 'policy-1', currentRevisionId: null, authorMemberId: 'qa', createdUtc: '2026-09-11T12:00:00Z', updatedUtc: '2026-09-11T12:00:00Z', ramDataJson: JSON.stringify(draft) };
      await context.route('**/api/**', async route => {
        const req = route.request(), p = new URL(req.url()).pathname, body = req.method() === 'GET' ? null : req.postDataJSON();
        if (body) writes.push({ p, body }); let data = [];
        if (p === '/api/me') {
          // Let the current StrictMode profile finish before the obsolete response.
          if (++authReads === 1) await new Promise(resolve=>setTimeout(resolve,500));
          data = { id: 'qa', displayName: 'QA', isGuest: false, isRegistered: true, platformRole: 'superadmin', permissions: ['admin.events.manageRamPolicies','admin.events.audit'], memberships: [{ groupId: churchId, role: 'leader', status: 'approved' }] };
        }
        else if (p === '/api/groups/church') data = { id: churchId, isChurch: true, name: text('QA Church','测试教会'), accessType: 'public', parentGroupId: null };
        else if (p === '/api/groups/visible') data = [{ id: churchId, isChurch: true, name: text('QA Church', '测试教会'), accessType: 'public', parentGroupId: null }];
        else if (p.endsWith('/ram-policies') && req.method() === 'GET') { policyReads++; data = [policy]; }
        else if (p.endsWith('/ram-policies') && req.method() === 'PUT') { policy = { ...policy, data: body.data, eTag: 'policy-etag-2' }; data = policy; }
        else if (p.endsWith('/publish')) { assert.equal(body.confirmEveryCell, true); assert.ok(policy.data.matrix.every(c => c.level)); policy = { ...policy, isPublished: true, eTag: 'policy-etag-3', publishedByMemberId: 'qa', publishedUtc: '2026-09-11T12:00:00Z' }; data = policy; }
        else if (p.endsWith('/workspace') && !p.endsWith('/ram/workspace')) data = { eventId, owningGroupId: churchId, title: text('QA Event','测试活动'), canManage: false, planVersion: 1, sponsorshipStatus: 'none', readiness: { status: 'notReady' }, nextSteps: [], items: [{ surfaceKey: 'workspace.overview', presentation: 'tab', sectionKey: 'overview', label: text('Overview','总览'), order: 0, blockers: [] }, { surfaceKey: 'safety.ram', moduleCode: 'SAFETY.RAM', presentation: 'page', pathSegment: 'ram', label: text('RAM and safety','RAM 与安全'), order: 1, readiness: 'notReady', blockers: [] }] };
        else if (p === '/api/events/ram-authoring/context') data = { policy, sourceVersion: assessment.eTag, title: text('Event', '活动') };
        else if (p === '/api/events/ram-authoring/check') data = { draft: JSON.parse(body.ramDataJson), residualLevel: 'Yellow', issues: [{ field: 'ram.risk.slip.controlMeasures', message: text('Risk 1: verify the control measures.', '风险 1：请核实控制措施。') }], policy };
        else if (p === '/api/events/ram-assistance') {
          assert.deepEqual(Object.keys(body).sort(), ['activityType','attributes','brief','category','eventId','language','mode','selectedText','sourceVersion']);
          assert.ok(!JSON.stringify(body).includes('personResponsible'));
          data = { sourceVersion: assessment.eTag, suggestions: { controlMeasures: t('Check and mark wet surfaces', '检查并标示湿滑路面'), additionalAction: t('Review before starting', '出发前复查') }, questions: [t('Who will verify the surface?', '由谁核实路面情况？')] };
        }
        else if (p.endsWith('/ram/sync')) data = { isRequired: true, eTag: assessment.eTag, sync: { status: 'Reviewed', isUpdated: true, lastEvaluatedAt: null, error: null, reviewedByMemberId: 'qa', reviewedAt: null }, canReview: true, canRetry: true };
        else if (p.endsWith('/ram/workspace') && req.method() === 'GET') { workspaceReads++; data = { assessment, policy: policy.isPublished ? policy : null, history, actions, onsiteCandidates: [], canEdit: true, canAudit: true, currentMemberId: 'qa', isRequired: true }; }
        else if (p.endsWith('/ram/workspace') && req.method() === 'PUT') { assert.equal(body.schemaVersion, 2); assert.equal(body.expectedETag, assessment.eTag); draft = JSON.parse(body.ramDataJson); assessment = { ...assessment, eTag: `ram-${++version}`, ramDataJson: JSON.stringify(draft), status: 'draft', validity: 'Draft', currentRevisionId: null }; data = assessment; }
        else if (p.includes('/ram/actions/')) {
          const action = p.split('/').pop(); assert.ok(req.headers()['idempotency-key']);
          if (action === 'request-confirmation') { const revision = { id: 'revision-1', version: 1, schemaVersion: 2, policyVersionId: policy.id, contentHash: 'fixed-content-hash', residualLevel: 'Green', authorMemberId: 'qa', onsiteMemberId: 'qa', createdUtc: '2026-09-11T12:00:00Z' }; history = [revision]; assessment = { ...assessment, currentRevisionId: revision.id, validity: 'AwaitingConfirmation', eTag: `ram-${++version}` }; }
          else if (action === 'confirm') assessment = { ...assessment, validity: 'Confirmed', eTag: `ram-${++version}` };
          actions.push({ id: `action-${actions.length}`, revisionId: 'revision-1', actorMemberId: 'qa', action, reason: '', healthSafetySigned: false, createdUtc: '2026-09-11T12:00:00Z' }); data = assessment;
        }
        else if (p.includes('/ram/versions/')) data = { revision: history[0], ramDataJson: assessment.ramDataJson, policy, actions, isCurrent: true, validity: assessment.validity, isDraft: true };
        else if (p === '/api/events/ram-guidance') { assert.deepEqual(Object.keys(body).sort(), ['activityType','attributes','category','eventId','language']); return route.fulfill({ status: 503, json: { message: 'AI unavailable' } }); }
        await route.fulfill({ status: 200, headers: { 'Cache-Control': 'private, no-store' }, json: data });
      });
      if(process.env.ALIFE_RAM_WORKSPACE_ONLY==='1') policy = { ...policy, isPublished: true };
      else {
      await page.goto(`${base}/admin/ram-policies`,{waitUntil:'domcontentloaded'});
      await page.getByRole('heading', { name: t('RAM policy settings','RAM 政策设置'), exact: true }).waitFor().catch(async error=>{console.log({url:page.url(),errors,body:(await page.locator('body').innerText()).slice(0,1800)});throw error});
      assert.equal(await page.getByRole('combobox',{name:t('Church','教会'),exact:true}).count(),0);
      await page.getByLabel('1 × 1', { exact: true }).waitFor();
      assert.equal(await page.getByRole('tablist').count(), 1);
      assert.equal(await page.getByRole('button', { name: t('Preview and publish','预览并发布'), exact: true }).isDisabled(), true);
      const helpName=label=>zh?`${label}说明`:`About ${label}`;
      const checkHelp=async(label,expected,activation='focus')=>{
        const button=page.getByRole('button',{name:helpName(label),exact:true});
        await button.scrollIntoViewIfNeeded();
        if(activation==='hover')await button.hover();else if(activation==='tap')await button.tap();else await button.focus();
        const id=await button.getAttribute('aria-describedby');
        const popup=page.locator(`[id="${id}"]`);
        await popup.waitFor({state:'visible',timeout:5000});
        const content=await popup.innerText();for(const part of expected)assert.ok(content.includes(part),`${label}: ${content}`);
        await page.waitForTimeout(60);
        const bounds=await popup.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1&&bounds.y>=0&&bounds.y+bounds.height<=950+1);
        await page.keyboard.press('Escape');await popup.waitFor({state:'hidden'});
      };
      assert.equal(await page.getByText(t('The manual matrix has ambiguous colours. Confirm all 25 cells and explicitly publish. The system does not infer thresholds or publish automatically.','手册矩阵颜色存在歧义。必须逐格确认全部 25 格，再明确发布；系统不会代为设定阈值或发布。'),{exact:true}).isVisible(),false);
      await checkHelp(t('Review before publishing','发布前检查'),[t('Confirm all 25 cells','必须逐格确认全部 25 格')],'tap');
      await checkHelp(t('Policy information','政策说明'),[t('Published versions are immutable','发布版本不可变')],'hover');
      await checkHelp(t('Alpha Demo matrix preset','Alpha Demo 矩阵预设'),[t('not an approved church matrix','不是已批准的教会矩阵')]);
      await checkHelp(t('25-cell risk colour settings','25 格风险颜色设置'),[t('likelihood × impact','可能性 × 影响程度')]);
      // The horizontal axis is impact; the vertical axis is likelihood.
      const beforeAxisWrites=writes.length;
      for(const [kind,scales] of [['likelihood',likelihood],['impact',impact]])for(let n=1;n<=5;n++){
        const label=kind==='likelihood'?t(`Likelihood level ${n}`,`可能性档位 ${n}`):t(`Impact level ${n}`,`影响程度档位 ${n}`);
        const scale=scales[n-1];await checkHelp(label,[scale[zh?1:0],scale[zh?3:2]],n===1?'tap':'focus');
      }
      assert.equal(writes.length,beforeAxisWrites);
      await page.mouse.move(0,0);await page.keyboard.press('Escape');
      await page.evaluate(()=>{window.scrollTo(0,0);for(const table of document.querySelectorAll('table'))table.parentElement.scrollLeft=0});
      await page.screenshot({path:path.join(output,`ram-settings-axis-${language}-${width}.png`),fullPage:true});
      const writesBeforePreset = writes.length;
      await page.getByRole('button', { name: t('Load preset into all 25 cells','载入预设到全部 25 格'), exact: true }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: t('Load and continue editing','载入并继续编辑'), exact: true }).click();
      assert.equal(writes.length, writesBeforePreset);
      assert.equal(await page.getByLabel('1 × 1', { exact: true }).inputValue(), 'Green');
      assert.equal(await page.getByLabel('2 × 3', { exact: true }).inputValue(), 'Yellow');
      assert.equal(await page.getByLabel('4 × 5', { exact: true }).inputValue(), 'Red');
      await page.getByLabel('1 × 5', { exact: true }).selectOption('Yellow');
      await page.getByRole('tab', { name: t('Check items','检查项'), exact: true }).click();
      await page.getByLabel(t('Search check items','搜索检查项'), { exact: true }).fill('q7');
      await page.locator('summary').filter({ hasText: t('Question 7','问题 7') }).waitFor();
      await page.getByLabel(t('Search check items','搜索检查项'), { exact: true }).fill('');
      await page.getByRole('button', { name: t('Next','下一页'), exact: true }).click();
      await page.locator('summary').filter({ hasText: t('Question 7','问题 7') }).waitFor();
      await page.getByRole('tab', { name: t('Matrix','评分矩阵'), exact: true }).click();
      const verifyField=async(scope,label,marker)=>{
        const field=scope.getByRole('group',{name:label,exact:true});
        const primary=field.getByRole('textbox',{name:`${label} (${language})`,exact:true});
        const secondary=field.getByRole('textbox',{name:`${label} (${zh?'en':'zh'})`,exact:true});
        assert.equal(await primary.isVisible(),true);assert.equal(await secondary.isVisible(),false);
        await primary.fill(`${marker}-${language}`);
        await field.locator('summary').focus();await page.keyboard.press('Enter');
        assert.equal(await secondary.isVisible(),true);await secondary.fill(`${marker}-${zh?'en':'zh'}`);
        await field.locator('summary').click();assert.equal(await secondary.isVisible(),false);
        assert.equal(await primary.inputValue(),`${marker}-${language}`);
      };
      for(const [kind,label] of [['likelihood',t('Likelihood definitions','可能性定义')],['impact',t('Impact definitions','影响程度定义')]]){
        const scale=page.getByRole('group',{name:label,exact:true}).locator('details').first();
        await scale.locator('summary').first().click();
        await verifyField(scale,t('Scale label','档位名称'),`${kind}-label`);
        await verifyField(scale,t('Definition','定义说明'),`${kind}-definition`);
      }
      const beforeLanguage=policyReads;
      await page.getByRole('button',{name:t('Select language, current language: English','选择语言，当前语言：中文'),exact:true}).click();
      await page.getByRole('menuitemradio',{name:zh?'English':'中文',exact:true}).click();
      const switched=page.getByRole('textbox',{name:zh?'Scale label (en)':'档位名称 (zh)',exact:true}).first();
      assert.equal(await switched.isVisible(),true);
      assert.equal(await switched.inputValue(),`likelihood-label-${zh?'en':'zh'}`);
      await page.getByRole('button',{name:zh?'Select language, current language: English':'选择语言，当前语言：中文',exact:true}).click();
      await page.getByRole('menuitemradio',{name:zh?'中文':'English',exact:true}).click();
      assert.equal(policyReads,beforeLanguage);
      await page.mouse.move(0,0);await page.keyboard.press('Escape');
      await page.evaluate(()=>{window.scrollTo(0,0);for(const table of document.querySelectorAll('table'))table.parentElement.scrollLeft=0});
      await page.screenshot({path:path.join(output,`ram-settings-matrix-${language}-${width}.png`),fullPage:true});
      await page.getByRole('tab',{name:t('Categories','风险类别'),exact:true}).click();
      const category=page.getByRole('tabpanel').locator('article').first();
      await verifyField(category,t('Category name','类别名称'),'category-name');
      await verifyField(category,t('Risk identification guidance','风险识别提示'),'category-guidance');
      await page.mouse.move(0,0);await page.keyboard.press('Escape');
      await page.evaluate(()=>{window.scrollTo(0,0);for(const table of document.querySelectorAll('table'))table.parentElement.scrollLeft=0});
      await page.screenshot({path:path.join(output,`ram-settings-categories-${language}-${width}.png`),fullPage:true});
      await page.getByRole('tab',{name:t('Check items','检查项'),exact:true}).click();
      const item=page.getByRole('tabpanel').locator('details').first();
      await item.locator('summary').first().click();
      await verifyField(item,t('Check item','检查项'),'check-item');
      await verifyField(item,t('Explanation and follow-ups','解释与追问'),'check-guidance');
      assert.equal(await page.getByRole('tab',{name:t('Activity content categories','活动内容类别'),exact:true}).count(),0);
      const applicability=item.getByRole('combobox').first();
      assert.deepEqual(await applicability.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value)),['generic','hiking','water','sport','transport','camp','meal','outdoor']);
      await applicability.selectOption('meal');
      await page.mouse.move(0,0);await page.keyboard.press('Escape');
      await page.evaluate(()=>{window.scrollTo(0,0);for(const table of document.querySelectorAll('table'))table.parentElement.scrollLeft=0});
      await page.screenshot({path:path.join(output,`ram-settings-check-items-${language}-${width}.png`),fullPage:true});
      await page.getByRole('tab',{name:t('Matrix','评分矩阵'),exact:true}).click();
      await checkHelp(t('Likelihood level 1','可能性档位 1'),[`likelihood-label-${language}`,`likelihood-definition-${language}`]);
      await checkHelp(t('Impact level 1','影响程度档位 1'),[`impact-label-${language}`,`impact-definition-${language}`]);
      await page.getByRole('tab',{name:t('Check items','检查项'),exact:true}).click();
      await page.getByRole('button', { name: t('Save policy draft','保存政策草稿'), exact: true }).click();
      await page.getByRole('status').filter({hasText:t('Action completed.','操作已完成。')}).waitFor();
      for(const kind of ['likelihood','impact']){
        assert.deepEqual(policy.data[kind][0].label,text(`${kind}-label-en`,`${kind}-label-zh`));
        assert.deepEqual(policy.data[kind][0].description,text(`${kind}-definition-en`,`${kind}-definition-zh`));
      }
      assert.deepEqual(policy.data.categories[0].name,text('category-name-en','category-name-zh'));
      assert.deepEqual(policy.data.categories[0].guidance,text('category-guidance-en','category-guidance-zh'));
      assert.deepEqual(policy.data.questions[0].text,text('check-item-en','check-item-zh'));
      assert.deepEqual(policy.data.questions[0].guidance,text('check-guidance-en','check-guidance-zh'));
      assert.equal(policy.data.questions[0].activityType,'meal');
      assert.equal(policy.data.questions[0].code,'q0');assert.equal(policy.churchId,churchId);
      await page.getByRole('button', { name: t('Preview and publish','预览并发布'), exact: true }).click();
      const dialog = page.getByRole('alertdialog'); await dialog.waitFor();
      await dialog.getByRole('button', { name: t('Confirm configuration and publish','确认全部配置并发布'), exact: true }).click();
      await page.getByText(t('Published, read-only','已发布，只读'), { exact: false }).waitFor();
      await page.screenshot({ path: path.join(output, `alife-ram-policy-${language}-${width}.png`) });
      await page.getByRole('tab',{name:t('Review rules','审核规则'),exact:true}).click();
      await checkHelp(t('Review rules','审核规则'),[t('independent review for every RAM','所有 RAM 独立审核')],'tap');
      await page.getByRole('tab',{name:t('Matrix','评分矩阵'),exact:true}).click();
      await checkHelp(t('Likelihood level 1','可能性档位 1'),[`likelihood-label-${language}`,`likelihood-definition-${language}`],'tap');
      await page.getByRole('tab',{name:t('Check items','检查项'),exact:true}).click();
      await page.getByRole('tabpanel').locator('details').first().locator('summary').first().click();
      const readOnlyItem=page.getByRole('textbox',{name:`${t('Check item','检查项')} (${language})`,exact:true}).first();
      assert.equal(await readOnlyItem.isDisabled(),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
      assert.deepEqual(errors,[]);
      console.log(`PASS RAM settings ${language}/${width}: automatic church, all bilingual fields, language/draft stability, check item filtering/pagination, matrix preset, save round-trip, explicit publication/read-only`);
      if(process.env.ALIFE_RAM_POLICY_ONLY==='1'){await context.close();continue;}
      }
      const workspacePath = `/groups/${churchId}/events/${eventId}/workspace`;
      await page.goto(`${base}${workspacePath}`);
      await page.getByRole('link', { name: /RAM and safety|RAM 与安全/ }).click();
      assert.equal(new URL(page.url()).pathname, `${workspacePath}/ram`);
      assert.equal(await page.locator('#event-editor-panel-ram').count(), 0);
      const area = async (en, cn) => { if (!await page.locator('[data-module-editor="SAFETY.RAM"]').count()) return; const button = page.locator('[data-module-editor="SAFETY.RAM"]').getByRole('button', { name: t(en, cn), exact: true }); if (await button.getAttribute('aria-expanded') !== 'true') await button.click(); };
      await area('Activities and conditions', '活动项目与条件');
      await page.locator('[data-ram-activity]').first().locator('summary').first().click();
      await page.locator('[data-ram-risk]').first().locator('summary').first().click();
      const riskSelects = page.locator('[data-ram-risk]').first().getByRole('combobox');
      const likelihoodOption = await riskSelects.nth(2).locator('option:checked').textContent();
      assert.ok(likelihoodOption.includes(t('Unlikely','不太可能')));
      assert.ok(likelihoodOption.includes(t('5–29% chance of occurring.','发生机会为 5–29%。')));
      const impactOption = await riskSelects.nth(3).locator('option:checked').textContent();
      assert.ok(impactOption.includes(t('Moderate','中等')));
      assert.ok(impactOption.includes(t('Advanced first aid or medical visit','进阶急救或就医')));
      await page.getByLabel(t('Responsible person','负责人'), { exact: true }).fill('Co-leader');
      await page.getByRole('button', { name: t('Save RAM draft','保存 RAM 草稿'), exact: true }).click();
      await page.getByRole('status').filter({ hasText: t('Action completed.','操作已完成。') }).waitFor();
      assert.equal(draft.hazards[0].personResponsible, 'Co-leader'); assert.equal(draft.participantCount, 12);
      const readsBeforeLanguage = workspaceReads;
      await page.getByRole('button', { name: t('Select language, current language: English', '选择语言，当前语言：中文'), exact: true }).click();
      await page.getByRole('menuitemradio', { name: zh ? 'English' : '中文', exact: true }).click();
      await page.getByLabel(zh ? 'Responsible person' : '负责人', { exact: true }).waitFor();
      assert.equal(workspaceReads, readsBeforeLanguage);
      await page.getByRole('button', { name: zh ? 'Select language, current language: English' : '选择语言，当前语言：中文', exact: true }).click();
      await page.getByRole('menuitemradio', { name: zh ? '中文' : 'English', exact: true }).click();
      await page.getByLabel(t('Responsible person','负责人'), { exact: true }).waitFor();
      assert.equal(workspaceReads, readsBeforeLanguage);
      await page.getByRole('button', { name: t('Check draft and ratings', '检查草稿及评分'), exact: true }).click();
      await page.getByRole('button', { name: t('Risk 1: verify the control measures.', '风险 1：请核实控制措施。'), exact: true }).click();
      assert.equal(await page.locator('[data-ram-field="ram.risk.slip"]').getAttribute('open'), '');
      await page.locator('summary').filter({ hasText: t('AI drafting / rewriting', 'AI 协助起草／改写') }).click();
      await page.getByLabel(t('Working on', '处理内容'), { exact: false }).selectOption('slip');
      await page.getByLabel(t('Non-sensitive activity brief to send', '将发送的非敏感活动概要'), { exact: true }).fill(t('A small group walk on a public path.', '小组在公共步道步行。'));
      await page.getByLabel(t('This is the sending preview. I removed names, contacts, health and confidential information. The full RAM is not sent.', '以上为发送预览。我已移除姓名、联系方式、健康和保密信息；不会发送整份 RAM。'), { exact: true }).check();
      await page.getByRole('button', { name: t('Send preview and generate suggestions', '发送预览并生成建议'), exact: true }).click();
      await page.getByText(t('Suggestions requiring human verification', '待人工核实的建议'), { exact: true }).waitFor();
      const savedBeforeAdoption = assessment.ramDataJson;
      await page.getByRole('button', { name: t('Adopt this suggestion into draft', '采纳此项到草稿'), exact: true }).first().click();
      assert.equal(assessment.ramDataJson, savedBeforeAdoption);
      await page.getByLabel(t('Responsible person','负责人'), { exact: true }).fill('Lead helper');
      assert.equal(await page.getByRole('button', { name: t('Adopt this suggestion into draft', '采纳此项到草稿'), exact: true }).isDisabled(), true);
      await page.getByRole('button', { name: t('Save RAM draft','保存 RAM 草稿'), exact: true }).click();
      await page.getByRole('status').filter({ hasText: t('Action completed.','操作已完成。') }).waitFor();
      assert.equal(draft.hazards[0].controlMeasures[language], t('Check and mark wet surfaces', '检查并标示湿滑路面'));
      assert.equal(draft.hazards[0].controlMeasures[zh ? 'en' : 'zh'], zh ? 'Check the surface' : '检查路面');
      const source = page.locator('[data-ram-field="ram.activities"] > details').first();
      await source.locator('summary').first().click();
      const sourceChecks = source.locator('[data-applicable-checks]'); await sourceChecks.locator('summary').click();
      assert.equal(await sourceChecks.locator('[data-applicable-check]').count(), 8);
      assert.equal(await page.getByText(t('Required questions', '适用必答题'), { exact: true }).count(), 0);
      await sourceChecks.locator('[data-applicable-check]').first().getByRole('button').click();
      await page.locator('[popover]:popover-open').filter({ hasText: t('Who checks this and what remains unknown?', '由谁核查，还有哪些未知事项？') }).waitFor();
      await page.keyboard.press('Escape');
      const before = JSON.stringify(draft.hazards); assert.equal(before, JSON.stringify(JSON.parse(assessment.ramDataJson).hazards));
      await area('Personal confirmation and independent review', '本人确认与独立审核');
      const freeze = t('Freeze version and request personal confirmation','固定版本并请求本人确认');
      await page.getByRole('button', { name: freeze, exact: true }).click(); await page.getByRole('alertdialog').getByRole('button', { name: freeze, exact: true }).click();
      const confirm = t('I confirm I will attend and lead this version','本人确认出席并领导此版本活动');
      await page.getByRole('button', { name: confirm, exact: true }).click(); await page.getByRole('alertdialog').getByRole('button', { name: confirm, exact: true }).click();
      await page.getByText(t('Personally confirmed','本人已确认'), { exact: true }).waitFor();
      await area('Version and signature history', '版本与签署历史');
      await page.getByRole('button', { name: t('View / print','查看／打印'), exact: true }).click();
      await page.getByText(t('DRAFT — NOT APPROVED','草稿 — 未经批准'), { exact: true }).waitFor();
      await page.emulateMedia({ media: 'print' });
      await page.pdf({ path: path.join(output, `alife-ram-draft-${language}-${width}.pdf`), format: 'A4', printBackground: true });
      await page.emulateMedia({ media: 'screen' });
      await page.getByRole('button', { name: t('Close preview','关闭预览'), exact: true }).click();
      await page.screenshot({ path: path.join(output, `alife-ram-workspace-${language}-${width}.png`), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
      assert.deepEqual(errors, []); assert.ok(workspaceReads >= 2);
      console.log(`PASS RAM ${language} ${width}: Workspace safety navigation, language stability, Alpha Demo 25-cell preset, bilingual scale definitions, question pagination, explicit publication, manual save, AI outage isolation, personal version confirmation, protected draft print/PDF`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
