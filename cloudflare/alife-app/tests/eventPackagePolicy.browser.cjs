// Run with Node's --experimental-strip-types and ALIFE_PLAYWRIGHT_MODULE pointing
// to an available Playwright installation. Every API request is intercepted;
// this test never publishes a real policy or needs an authenticated account.
const assert=require('node:assert/strict');
const pw=require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const {defaults:baseDefaults}=require('./fixtures/eventPackagePolicy.ts');
const defaults=structuredClone(baseDefaults);
defaults.facts.push({code:'money.hasIncome',label:{en:'Income collected',zh:'收取款项'}});
defaults.activityTypes=[{code:'fellowship',label:{en:'Fellowship',zh:'团契'}}];
defaults.modules=[{code:'SAFETY.RAM',label:{en:'Risk assessment',zh:'风险评估'}}];
const output=process.env.ALIFE_POLICY_QA_OUTPUT;
if(!output)throw new Error('Set ALIFE_POLICY_QA_OUTPUT to a task-specific directory under C:/Data/Alife/Temp');
require('node:fs').mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await pw.chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:320,height:900}});const page=await context.newPage();page.setDefaultTimeout(5000);
 const requests=[];page.on("request",r=>{if(r.url().includes("/api/"))requests.push(r.url())});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let policies=[],posts=[],keys=[],failPreview=true,failPublish=true,failDefaults=true,slowDefaults=false;
 await context.addInitScript(()=>{if(!localStorage.getItem('alife.language'))localStorage.setItem('alife.language','zh')});
 await context.route('**/api/**',async route=>{
 const path=new URL(route.request().url()).pathname;let data=[];
 if(path==='/api/me')data={id:'qa',displayName:'QA Admin',isGuest:false,isRegistered:true,isAdmin:true,platformRole:'superadmin',permissions:['admin.access','admin.events.managePackagePolicies'],memberships:[]};
 else if(path.endsWith('/event-package-policies/defaults')){if(slowDefaults)await new Promise(r=>setTimeout(r,600));if(failDefaults)return route.fulfill({status:503,json:{message:'Unavailable'}});data=defaults;}
 else if(path.endsWith('/event-package-policies/preview')){posts.push(route.request().postDataJSON()); if(failPreview)return route.fulfill({status:503,json:{message:'Preview unavailable'}});data={currentPolicyId:null,affectedEventCount:2,affectedApprovalCount:1,impactToken:'impact'};}
 else if(path.endsWith('/event-package-policies/publish')){keys.push(route.request().headers()['idempotency-key']);if(failPublish)return route.fulfill({status:503,json:{message:'Network interrupted'}});data={...route.request().postDataJSON(),id:'new',isPublished:true,publishedUtc:new Date().toISOString(),publishedByDisplayName:'QA Admin',publishedByMemberId:'qa',retiredUtc:null};policies=[data];}
 else if(path.endsWith('/event-package-policies/rollout-report'))data={windowDays:30,evaluatedOperationCount:0,wouldBlockOperationCount:0,affectedEventCount:0,reasons:[]};
 else if(path.endsWith('/event-package-policies'))data=policies;
 await route.fulfill({status:200,json:data});});
 const settlePolicyRoute=async()=>{
   // StrictMode can complete an obsolete bootstrap before the current profile;
   // re-enter through client navigation after both fixture responses settle.
   await page.waitForTimeout(400);
   if(new URL(page.url()).pathname==='/')await page.evaluate(()=>{history.pushState(null,'','/admin/event-package-policies');window.dispatchEvent(new PopStateEvent('popstate'))});
 };
 try {
 await page.goto('http://localhost:5173/admin/event-package-policies');
 await settlePolicyRoute();
 await page.getByRole('alert').filter({hasText:'暂时无法完成请求'}).waitFor();
 failDefaults=false;slowDefaults=true;await page.getByRole('button',{name:'刷新政策列表'}).click();
 await page.getByRole('status').filter({hasText:'正在读取政策'}).waitFor();
 await page.getByRole('button',{name:'初始化试运行政策',exact:true}).waitFor();slowDefaults=false;
 assert.equal(keys.length,0);console.log('load failure, loading, retry and no automatic publication passed');
 for(const language of ['zh','en']){
  await page.evaluate(lang=>localStorage.setItem('alife.language',lang),language);
  for(const width of [320,768,1280]){
   await page.setViewportSize({width,height:900});await page.reload();await settlePolicyRoute();
   await page.getByRole('button',{name:language==='zh'?'初始化试运行政策':'Initialize a dry-run policy',exact:true}).click();
   const names=language==='zh'?['加强审批','标准审批','简易审批']:['Enhanced approval','Standard approval','Light approval'];
   const tiers=names.map(name=>page.getByRole('region',{name,exact:true}));
   assert.equal(await page.locator('section[aria-labelledby^="policy-tier-"] input[type=number]').count(),6);
   for(const tier of tiers)assert.equal(await tier.locator('details').getAttribute('open'),null);
   const enhanced=tiers[0],standard=tiers[1],light=tiers[2];
   const option=language==='zh'?'儿童参与':'Children participating';
   await enhanced.locator('summary').click();
   assert.equal(await enhanced.getByRole('checkbox').count(),4);
   await enhanced.getByLabel(option,{exact:true}).check();
   assert.equal(await enhanced.getByLabel(option,{exact:true}).isChecked(),true);
   await standard.locator('summary').click();
   assert.equal(await standard.getByLabel(option,{exact:true}).isChecked(),false);
   await standard.getByLabel(language==='zh'?'团契':'Fellowship',{exact:true}).check();
   await enhanced.getByLabel(language==='zh'?'风险评估':'Risk assessment',{exact:true}).check();
   const chosenColor=await enhanced.getByLabel(option,{exact:true}).locator('..').evaluate(el=>getComputedStyle(el).color);
   const otherColor=await standard.getByLabel(option,{exact:true}).locator('..').evaluate(el=>getComputedStyle(el).color);
   assert.notEqual(chosenColor,otherColor);
   await light.locator('summary').focus();await page.keyboard.press('Enter');
   assert.equal(await light.getByRole('checkbox').count(),0);
   assert.equal(await light.getByRole('spinbutton').count(),2);
   // Popovers work with focus, Escape, click/touch and hover, and stay in the viewport.
   const help=page.getByRole('button',{name:language==='zh'?'审批判断顺序说明':'About Approval decision order',exact:true});
   await help.focus();
   const popup=page.getByRole('tooltip').filter({hasText:language==='zh'?'事实条件只匹配':'Fact conditions require'});
   await popup.waitFor({state:'visible'});
   await page.waitForTimeout(60);
   const bounds=await popup.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);
   await page.keyboard.press('Escape');await popup.waitFor({state:'hidden'});
   await help.click();await popup.waitFor({state:'visible'});
   await page.keyboard.press('Escape');await page.getByRole('heading',{name:names[0],exact:true}).click();
   await help.hover();await popup.waitFor({state:'visible'});
   await page.mouse.move(width-1,0);await popup.waitFor({state:'hidden'});
   // Collapsing conditions retains all edits and keeps common fields visible.
   await enhanced.locator('summary').click();await standard.locator('summary').click();await light.locator('summary').click();
   for(const tier of tiers)assert.equal(await tier.getByRole('spinbutton').count(),2);
   const dimensions=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
   assert.ok(dimensions.scrollWidth<=width,`Overflow ${language} ${width}: ${dimensions.scrollWidth}`);
   await page.evaluate(()=>window.scrollTo(0,0));
   await page.screenshot({path:require('node:path').join(output,`alife-policy-edit-${language}-${width}.png`),fullPage:true});
   console.log('layout',language,width,'passed');
  }
 }
 const beforeSwitch=requests.filter(url=>url.includes('/event-package-policies')).length;
 const draftName=await page.getByLabel('New version name',{exact:true}).inputValue();
 const enhancedEnglish=page.getByRole('region',{name:'Enhanced approval',exact:true});
 await enhancedEnglish.locator('summary').click();
 await page.getByRole('button',{name:'Select language, current language: English',exact:true}).click();
 await page.getByRole('menuitemradio',{name:'中文',exact:true}).click();
 await page.getByRole('heading',{name:'新版本草稿',exact:true}).waitFor();
 assert.equal(await page.getByLabel('新版本名称',{exact:true}).inputValue(),draftName);
 const switchedEnhanced=page.getByRole('region',{name:'加强审批',exact:true});
 assert.equal(await switchedEnhanced.locator('details').getAttribute('open'),'');
 assert.equal(await switchedEnhanced.getByLabel('儿童参与',{exact:true}).isChecked(),true);
 assert.equal(requests.filter(url=>url.includes('/event-package-policies')).length,beforeSwitch);
 console.log('language switch retains draft, expansion and policy request identity');
 await page.evaluate(()=>localStorage.setItem('alife.language','zh'));await page.reload();await settlePolicyRoute();
 await page.getByRole('button',{name:'初始化试运行政策',exact:true}).click();console.log('initialized');
 await page.getByRole('button',{name:'预览变更与审批影响'}).click();assert.equal(posts.length,1);console.log('preview failure observed');

 await page.getByRole('alert').filter({hasText:'暂时无法完成请求'}).waitFor();failPreview=false;
 await page.getByRole('button',{name:'预览变更与审批影响'}).click();await page.getByRole('dialog',{name:'确认政策变更'}).waitFor();console.log('preview passed');
 await page.waitForFunction(()=>!!document.activeElement?.closest('[role=dialog]'));await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('[role=dialog]')),true);console.log('modal focus passed');
 await page.getByRole('button',{name:'确认发布并生效'}).click();await page.getByRole('alert').filter({hasText:'暂时无法完成请求'}).waitFor();failPublish=false;
 await page.getByRole('button',{name:'确认发布并生效'}).click();await page.getByRole('status').filter({hasText:'政策已发布并生效'}).waitFor();if(keys[0]!==keys[1])throw new Error('Idempotency key changed');console.log('retry stable key passed');
 const historical={...policies[0],id:'historical',version:'Historical',retiredUtc:'2026-09-01T00:00:00Z',effectiveFromUtc:'2026-01-01T00:00:00Z'};policies.push(historical);await page.reload();await settlePolicyRoute();
 assert.equal(await page.getByLabel('选择查看的版本',{exact:true}).isVisible(),false);
 await page.locator('summary').filter({hasText:'政策版本'}).click();
 await page.getByLabel('选择查看的版本',{exact:true}).selectOption('historical');
 if(!await page.getByLabel('执行方式',{exact:true}).isDisabled())throw new Error('History is editable');
 const historyLight=page.getByRole('region',{name:'简易审批',exact:true});
 assert.equal(await historyLight.getByRole('spinbutton').first().isDisabled(),true);
 assert.equal(await historyLight.locator('details').getAttribute('open'),null);
 // A published policy only displays selected triggers, across all three catalogues.
 policies[0].rules.tierRules.find(r=>r.tier==='enhanced').whenAnyConfirmedFactCodes=['people.childrenPresent'];
 policies[0].rules.tierRules.find(r=>r.tier==='enhanced').whenAnyModuleCodes=['SAFETY.RAM'];
 policies[0].rules.tierRules.find(r=>r.tier==='standard').whenAnyActivityTypeCodes=['fellowship'];
 policies[1].rules=structuredClone(policies[0].rules);
 for(const language of ['zh','en']){
  await page.evaluate(lang=>localStorage.setItem('alife.language',lang),language);
  for(const width of [320,1280]){
   await page.setViewportSize({width,height:900});await page.reload();await settlePolicyRoute();
   const enhanced=page.getByRole('region',{name:language==='zh'?'加强审批':'Enhanced approval',exact:true});
   const standard=page.getByRole('region',{name:language==='zh'?'标准审批':'Standard approval',exact:true});
   await enhanced.locator('summary').click();await standard.locator('summary').click();
   assert.equal(await enhanced.getByRole('checkbox').count(),0);
   await enhanced.getByText(language==='zh'?'儿童参与':'Children participating',{exact:true}).waitFor();
   await enhanced.getByText(language==='zh'?'风险评估':'Risk assessment',{exact:true}).waitFor();
   await standard.getByText(language==='zh'?'团契':'Fellowship',{exact:true}).waitFor();
   assert.equal(await enhanced.getByText(language==='zh'?'收取款项':'Income collected',{exact:true}).count(),0);
   assert.equal(await standard.getByText(language==='zh'?'儿童参与':'Children participating',{exact:true}).count(),0);
   await page.evaluate(()=>window.scrollTo(0,0));
   await page.screenshot({path:require('node:path').join(output,`alife-policy-read-${language}-${width}.png`),fullPage:true});
  }
 }
 await page.evaluate(()=>localStorage.setItem('alife.language','zh'));await page.reload();await settlePolicyRoute();
 await page.locator('summary').filter({hasText:'政策版本'}).click();
 await page.getByLabel('选择查看的版本',{exact:true}).selectOption('historical');
 await page.getByRole('button',{name:'以此版本恢复',exact:true}).click();
 await page.getByLabel('选择查看的版本',{exact:true}).selectOption('new');
 await page.getByRole('alertdialog',{name:'放弃未发布的修改？'}).waitFor();
 await page.getByRole('button',{name:'继续编辑',exact:true}).click();
 await page.getByRole('button',{name:'预览变更与审批影响'}).click();
 await page.getByRole('dialog',{name:'确认政策变更'}).waitFor();
 if(posts.at(-1).sourcePolicyId!=='historical'||posts.at(-1).expectedCurrentPolicyId!=='new')throw new Error('Restore lineage incorrect');
 await page.waitForFunction(()=>!!document.activeElement?.closest('[role=dialog]'));
 await page.keyboard.press('Escape');
 await page.getByRole('dialog',{name:'确认政策变更'}).waitFor({state:'hidden'});
 console.log('history, unsaved changes and restore lineage passed');
 await page.getByRole('link',{name:'返回系统管理',exact:true}).click();
 await page.getByRole('alertdialog',{name:'未保存的更改'}).waitFor();
 assert.ok(page.url().endsWith('/admin/event-package-policies'));console.log('back navigation protected');
 if(errors.length)throw new Error(errors.join(';'));console.log('page errors: none');
 }catch(e){console.error(e.message);console.log({url:page.url(),requests:requests.slice(-15),errors});console.log((await page.locator('body').innerText()).slice(-1200));process.exitCode=1;}finally{await browser.close();}
})();
