const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.ALIFE_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ALIFE_BROWSER_BASE_URL || 'http://127.0.0.1:5175';
const output = process.env.ALIFE_BROWSER_OUTPUT || require('node:os').tmpdir();
const version = JSON.parse(fs.readFileSync(path.join(__dirname, '../node_modules/.vite/deps/_metadata.json'))).browserHash;
const harness = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
const React=(await import('/node_modules/.vite/deps/react.js?v=${version}')).default;
const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js?v=${version}')).default;
const {BrowserRouter}=await import('/node_modules/.vite/deps/react-router-dom.js?v=${version}');
const {AuthProvider,useAuthStore}=await import('/src/stores/auth.tsx');
const {default:Panel}=await import('/src/components/events/RamSyncPanel.tsx');
const {default:Modal}=await import('/src/components/events/RamReviewModal.tsx');
await import('/src/styles/global.css');
function App(){const auth=useAuthStore();const [open,setOpen]=React.useState(false),[done,setDone]=React.useState(false);React.useEffect(()=>{void auth.bootstrap()},[]);return React.createElement('main',{style:{padding:16,maxWidth:1000,margin:'auto'}},React.createElement('button',{onClick:()=>auth.updateLanguage(auth.language==='zh'?'en':'zh')},'Switch language'),React.createElement(Panel,{eventId:'qa-event',zh:auth.language==='zh'}),React.createElement('button',{onClick:()=>setOpen(true)},'Submit fixture'),open?React.createElement(Modal,{eventId:'qa-event',zh:auth.language==='zh',onClose:()=>setOpen(false),onReviewed:async()=>{setOpen(false);setDone(true)}}):null,done?React.createElement('p',null,'Reviewed fixture'):null)}
createRoot(document.getElementById('root')).render(React.createElement(AuthProvider,null,React.createElement(BrowserRouter,null,React.createElement(App))));
</script></body></html>`;
(async()=>{fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({headless:true});try{
for(const lang of ['zh','en']) for(const width of [320,1280]){
 const zh=lang==='zh',t=(en,cn)=>zh?cn:en;const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
 await ctx.addInitScript(value=>localStorage.setItem('alife.language',value),lang);const page=await ctx.newPage();page.setDefaultTimeout(15000);await page.clock.install();
 let status='Syncing',etag='sync-1',reads=0,reviews=0,recalculations=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const sync=()=>({isRequired:true,eTag:etag,canReview:true,canRetry:true,sync:{status,isUpdated:['AI_Updated','Reviewed'].includes(status),lastEvaluatedAt:null,error:null,reviewedByMemberId:null,reviewedAt:null}});
 const text=(en,zh)=>({en,zh});const draft={schemaVersion:2,activities:[{id:'water',type:'water',name:text('Kayaking','皮划艇')}],hazards:[{id:'risk-1',activityId:'water',categoryCode:'activity',hazard:text('Possible immersion','可能落水'),consequence:text('Potential injury','可能受伤'),controlMeasures:text('Verify lifejackets','核实救生衣'),additionalAction:text('Confirm conditions','确认条件'),likelihood:3,impact:4,riskScore:12,residualLikelihood:1,residualImpact:4,residualScore:4,personResponsible:'Leader'}],answers:[]};
 await ctx.route(`${base}/__ram-sync-qa`,route=>route.fulfill({contentType:'text/html',body:harness}));
 await ctx.route('**/api/**',async route=>{const req=route.request(),p=new URL(req.url()).pathname;let data={};
  if(p==='/api/me')data={id:'owner',displayName:'Owner',isRegistered:true,isGuest:false,memberships:[],permissions:[]};
  else if(p.endsWith('/sync')&&req.method()==='GET'){reads++;data=sync();}
  else if(p.endsWith('/sync/recalculate')){assert.equal(req.postDataJSON().expectedETag,etag);recalculations++;if(recalculations===1)return route.fulfill({status:503,json:{message:'Fixture sync failure'}});status='Syncing';data=sync();}
  else if(p.endsWith('/sync/review')){assert.equal(req.postDataJSON().expectedETag,etag);assert.equal(status,'AI_Updated');reviews++;status='Reviewed';data=sync();}
  else if(p.endsWith('/ram/workspace'))data={assessment:{eventId:'qa-event',groupId:'qa-group',ramDataJson:JSON.stringify(draft),schemaVersion:2,eTag:etag,status:'draft',sync:sync().sync},policy:null,history:[],actions:[],onsiteCandidates:[],canEdit:true,canAudit:false,currentMemberId:'owner',isRequired:true};
  return route.fulfill({status:200,headers:{'Cache-Control':'private, no-store'},json:data});});
 await page.goto(`${base}/__ram-sync-qa`);await page.getByText(t('AI syncing','AI 同步中'),{exact:true}).waitFor();await page.getByRole('button',{name:'Submit fixture'}).click();
 const modal=page.getByRole('dialog'),confirm=modal.getByRole('button',{name:t('Confirm review and continue','确认核对，继续提交')});await modal.waitFor();assert.equal(await confirm.isDisabled(),true);assert.equal(reviews,0);
 status='AI_Updated';etag='sync-2';await page.clock.runFor(6500);await modal.getByText(t('Possible immersion','可能落水'),{exact:true}).waitFor();await modal.getByText(t('Possible immersion','可能落水'),{exact:true}).click();assert.equal(await confirm.isDisabled(),true);
 const before=reads;await page.getByRole('button',{name:'Switch language'}).evaluate(el=>el.click());await page.getByRole('button',{name:'Switch language'}).evaluate(el=>el.click());assert.equal(reads,before);
 await modal.getByRole('checkbox').check();assert.equal(await confirm.isEnabled(),true);
 status='Outdated';etag='sync-3';await page.clock.runFor(6500);await modal.getByText(t('Needs review','需要核对'),{exact:true}).waitFor();assert.equal(await confirm.isDisabled(),true);assert.equal(reviews,0);
 status='AI_Updated';etag='sync-4';await page.clock.runFor(6500);await modal.getByRole('checkbox').waitFor();assert.equal(await modal.getByRole('checkbox').isChecked(),false);await modal.getByRole('checkbox').check();await modal.getByText(t('Possible immersion','可能落水'),{exact:true}).click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(output,`ram-review-${lang}-${width}.png`),fullPage:true});
 await confirm.click();await page.getByText('Reviewed fixture',{exact:true}).waitFor();assert.equal(reviews,1);const reassess=page.getByRole('button',{name:t('Reassess risks with AI','AI 重新评估风险'),exact:true});await reassess.click();let warning=page.getByRole('alertdialog');await warning.getByText(t('Existing confirmation','已有确认'),{exact:false}).waitFor();await warning.getByRole('button').last().click();await page.getByRole('alert').waitFor();assert.equal(recalculations,1);await reassess.click();await page.getByRole('alertdialog').getByRole('button').last().click();await page.getByText(t('AI syncing','AI 同步中'),{exact:true}).waitFor();assert.equal(await reassess.isDisabled(),true);assert.equal(recalculations,2);assert.deepEqual(errors,[]);await ctx.close();console.log('PASS RAM review',lang,width);
}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
