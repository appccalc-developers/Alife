// Run with Node's --experimental-strip-types and ALIFE_PLAYWRIGHT_MODULE pointing
// to an available Playwright installation. Every API request is intercepted;
// this test never publishes a real policy or needs an authenticated account.
const assert=require('node:assert/strict');
const pw=require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const {defaults}=require('./fixtures/eventPackagePolicy.ts');
(async()=>{
 const browser=await pw.chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:320,height:900}});const page=await context.newPage();page.setDefaultTimeout(5000);
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
 try {
 await page.goto('http://localhost:5173/admin/event-package-policies');
 await page.getByRole('alert').filter({hasText:'暂时无法完成请求'}).waitFor();
 failDefaults=false;slowDefaults=true;await page.getByRole('button',{name:'刷新政策列表'}).click();
 await page.getByRole('status').filter({hasText:'正在读取政策'}).waitFor();
 await page.getByRole('button',{name:'初始化试运行政策',exact:true}).waitFor();slowDefaults=false;
 assert.equal(keys.length,0);console.log('load failure, loading, retry and no automatic publication passed');
 for(const language of ['zh','en']){
  await page.evaluate(lang=>localStorage.setItem('alife.language',lang),language);
  for(const width of [320,768,1280]){
   await page.setViewportSize({width,height:900});await page.reload();
   await page.getByRole('button',{name:language==='zh'?'初始化试运行政策':'Initialize a dry-run policy',exact:true}).click();
   const tierTabs=page.getByRole('tablist',{name:language==='zh'?'审批判断顺序':'Approval decision order'});
   const labels=language==='zh'?['如果 · 加强审批','否则如果 · 标准审批','否则 · 简易审批']:['If · Enhanced approval','Else if · Standard approval','Else · Light approval'];
   assert.deepEqual(await tierTabs.getByRole('tab').allTextContents(),labels);
   assert.equal(await tierTabs.getByRole('tab').nth(0).getAttribute('aria-selected'),'true');
   const option=language==='zh'?'儿童参与':'Children participating';
   await page.getByRole('tabpanel').getByLabel(option,{exact:true}).check();
   await tierTabs.getByRole('tab').nth(1).click();
   assert.equal(await page.getByRole('tabpanel').getByLabel(option,{exact:true}).isChecked(),false);
   await tierTabs.getByRole('tab').nth(0).click();
   assert.equal(await page.getByRole('tabpanel').getByLabel(option,{exact:true}).isChecked(),true);
   await tierTabs.getByRole('tab').nth(0).focus();await page.keyboard.press('End');
   assert.equal(await tierTabs.getByRole('tab').nth(2).getAttribute('aria-selected'),'true');
   assert.equal(await page.getByRole('tabpanel').locator('details,input[type=checkbox]').count(),0);
   assert.equal(await page.getByRole('tabpanel').getByRole('spinbutton').count(),2);
   const visibleTab=await tierTabs.evaluate(el=>{const b=el.getBoundingClientRect(),s=el.querySelector('[aria-selected=true]').getBoundingClientRect();return s.left>=b.left-1&&s.right<=b.right+1});
   assert.equal(visibleTab,true);
   await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');
   assert.equal(await tierTabs.getByRole('tab').nth(1).getAttribute('aria-selected'),'true');
   await page.keyboard.press('ArrowLeft');
   await tierTabs.scrollIntoViewIfNeeded();
   const dimensions=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
   if(dimensions.scrollWidth>width)throw new Error(`Overflow ${language} ${width}: ${dimensions.scrollWidth}`);
   await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),`alife-policy-${language}-${width}.png`)});
   console.log('layout',language,width,'passed');
  }
 }
 await page.evaluate(()=>localStorage.setItem('alife.language','zh'));await page.reload();
 await page.getByRole('button',{name:'初始化试运行政策',exact:true}).click();console.log('initialized');
 await page.getByRole('button',{name:'预览变更与审批影响'}).click();assert.equal(posts.length,1);console.log('preview failure observed');

 await page.getByRole('alert').filter({hasText:'暂时无法完成请求'}).waitFor();failPreview=false;
 await page.getByRole('button',{name:'预览变更与审批影响'}).click();await page.getByRole('dialog',{name:'确认政策变更'}).waitFor();console.log('preview passed');
 await page.waitForFunction(()=>!!document.activeElement?.closest('[role=dialog]'));await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('[role=dialog]')),true);console.log('modal focus passed');
 await page.getByRole('button',{name:'确认发布并生效'}).click();await page.getByRole('alert').filter({hasText:'暂时无法完成请求'}).waitFor();failPublish=false;
 await page.getByRole('button',{name:'确认发布并生效'}).click();await page.getByRole('status').filter({hasText:'政策已发布并生效'}).waitFor();if(keys[0]!==keys[1])throw new Error('Idempotency key changed');console.log('retry stable key passed');
 const historical={...policies[0],id:'historical',version:'Historical',retiredUtc:'2026-09-01T00:00:00Z',effectiveFromUtc:'2026-01-01T00:00:00Z'};policies.push(historical);await page.reload();
 await page.getByLabel('选择查看的版本',{exact:true}).selectOption('historical');
 if(!await page.getByLabel('执行方式',{exact:true}).isDisabled())throw new Error('History is editable');
 await page.getByRole('tab',{name:'否则 · 简易审批',exact:true}).click();
 assert.equal(await page.getByRole('tabpanel').getByRole('spinbutton').first().isDisabled(),true);
 assert.equal(await page.getByRole('tabpanel').locator('details').count(),0);
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
 }catch(e){console.error(e.message);console.log((await page.locator('body').innerText()).slice(-1200));process.exitCode=1;}finally{await browser.close();}
})();
