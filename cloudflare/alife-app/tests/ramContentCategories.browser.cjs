const assert = require('node:assert/strict');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://localhost:5173';
const bi = value => ({en:value,zh:value});
const questions = ['generic','meal','water','outdoor'].map(code=>({code,activityType:code,categoryCode:'activity',text:bi(code+' check'),guidance:bi(code+' guidance')}));
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  for(const zh of [true,false]) for(const width of [320,1280]) for(const creation of [false,true]) {
   const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));let reads=0;
   await page.route('**/api/**',route=>{if(route.request().url().includes('/ram-authoring/context')){reads++;if(creation&&zh&&width===320&&reads===1)return route.fulfill({status:503,json:{message:'Fixture policy unavailable'}});return route.fulfill({json:{policy:{data:{questions}},sourceVersion:'fixture'}})}return route.fulfill({status:401,json:{}})});
   await page.route('**/attributes-fixture',route=>route.fulfill({contentType:'text/html',body:'<html><body><div id="fixture" class="mx-auto max-w-5xl space-y-6 p-4"></div></body></html>'}));await page.goto(base+'/attributes-fixture');
   await page.evaluate(async({zh,creation,questions})=>{
    const runtime=(await import('/@react-refresh')).default;runtime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/src/styles/global.css');
    const React=(await import('/node_modules/.vite/deps/react.js')).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
    const {ActivityPlanEditor}=await import('/src/components/events/EventActivityPlanPanel.tsx'),{default:RamSourceSummary}=await import('/src/components/events/RamSourceSummary.tsx'),{AuthProvider}=await import('/src/stores/auth.tsx');
    function Fixture(){const[currentZh,setZh]=React.useState(zh),[disabled,setDisabled]=React.useState(false);window.switchLanguage=()=>setZh(value=>!value);window.makeReadonly=()=>setDisabled(true);const[data,setData]=React.useState({questionnaireVersion:2,activities:[{id:'existing',attributes:[],name:{en:'Picnic',zh:'野餐'},conditions:{en:'',zh:''},answers:{}}],participantCount:10,isOuting:false,isOvernight:false,isHighRisk:false,weatherConfirmation:{en:'',zh:''}});window.fixtureData=data;return React.createElement(React.Fragment,null,React.createElement(ActivityPlanEditor,{data,onChange:setData,zh:currentZh,disabled,...(creation?{groupId:'22222222-2222-2222-2222-222222222222'}:{checkItems:questions,questionDefinitions:[]})}),React.createElement('div',{'data-ram-fixture':true},React.createElement(RamSourceSummary,{draft:data,zh:currentZh,policy:{questions}})))}
    createRoot(document.getElementById('fixture')).render(React.createElement(AuthProvider,null,React.createElement(Fixture)));
   },{zh,creation,questions});
   if(creation&&zh&&width===320){await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('button',{name:'添加活动项目',exact:true}).isDisabled(),false);await page.getByRole('button',{name:'重新读取',exact:true}).click()}
   const item=page.locator('[data-planned-activity]').first();await item.locator('summary').first().click();
   const checks=item.locator('[data-applicable-checks]');await checks.locator('summary').click();await checks.locator('[data-applicable-check]').first().waitFor();assert.equal(await checks.locator('[data-applicable-check]').count(),1);
   const meal=item.getByRole('checkbox',{name:zh?'聚餐':'Meal',exact:true}),outdoor=item.getByRole('checkbox',{name:zh?'户外':'Outdoor',exact:true});await meal.check();await outdoor.focus();await page.keyboard.press('Space');
   assert.deepEqual(await checks.locator('[data-applicable-check]').evaluateAll(nodes=>nodes.map(n=>n.dataset.applicableCheck)),['generic:generic','meal:meal','outdoor:outdoor']);
   const help=checks.locator('[data-applicable-check="meal:meal"]').getByRole('button');await help.click();await page.locator('[popover]:popover-open').filter({hasText:'meal guidance'}).waitFor();await page.keyboard.press('Escape');
   const ram=page.locator('[data-ram-fixture]');const ramActivity=ram.locator('[data-ram-field="ram.activities"] > details').first();if(await ramActivity.getAttribute('open')===null)await ramActivity.locator('summary').first().click();await ramActivity.locator('[data-applicable-checks] > summary').click();assert.equal(await ramActivity.locator('[data-applicable-check]').count(),3);
   await outdoor.uncheck();assert.equal(await checks.locator('[data-applicable-check]').count(),2);await meal.uncheck();assert.equal(await checks.locator('[data-applicable-check]').count(),1);
   assert.equal((await page.evaluate(()=>window.fixtureData)).isOuting,false);assert.equal((await page.evaluate(()=>window.fixtureData)).activities.some(a=>Object.hasOwn(a,'type')),false);assert.deepEqual((await page.evaluate(()=>window.fixtureData)).activities[0].attributes,[]);
   await item.getByRole('checkbox',{name:zh?'徒步':'Hiking',exact:true}).check();assert.equal(await outdoor.isChecked(),false);
   const readsBefore=reads;await page.evaluate(()=>window.switchLanguage());await item.getByRole('checkbox',{name:zh?'Hiking':'徒步',exact:true}).waitFor();assert.equal(await item.getByRole('checkbox',{name:zh?'Hiking':'徒步',exact:true}).isChecked(),true);assert.equal(reads,readsBefore);await page.evaluate(()=>window.switchLanguage());await item.getByRole('checkbox',{name:zh?'徒步':'Hiking',exact:true}).waitFor();await page.evaluate(()=>window.makeReadonly());await page.waitForFunction(()=>document.querySelector('[data-activity-attributes] input').disabled);assert.equal(await checks.locator('[data-applicable-check]').first().getByRole('button').isEnabled(),true);
   if(process.env.ALIFE_ATTRIBUTE_SCREENSHOTS){await page.screenshot({path:process.env.ALIFE_ATTRIBUTE_SCREENSHOTS+`/attributes-${zh?'zh':'en'}-${width}-${creation?'creation':'saved'}.png`,fullPage:true})}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);assert.deepEqual(errors,[]);console.log(`PASS attributes ${zh?'zh':'en'}/${width}/${creation?'creation':'saved'}: independent multi-select, general union, two check lists, keyboard`);await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
