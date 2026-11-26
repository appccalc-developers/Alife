// Local browser verification only: every API and speech response is fictional.
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
const root=fileURLToPath(new URL('../../', import.meta.url))
process.chdir(root) // Tailwind resolves its content globs against the current directory.
const req=createRequire(root+'/package.json')
const {createServer}=await import(pathToFileURL(req.resolve('vite')))
const template={code:'shared-meal',archetypeCode:'simple-social',version:2,name:{zh:'团契聚餐',en:'Fellowship meal'},description:{zh:'一起用餐',en:'Share a meal'},iconKey:'meal',defaults:{visibility:'groupVisible',registrationMode:'none',capacityUnit:'People'},preselectedModules:[],presetServiceSlots:[],presetProjects:[]}
const catalogue=[{code:'simple-social',version:1,name:{zh:'轻松相聚',en:'Simple social'},isSeries:false,occurrenceCount:1,hasSessions:false,hasZones:false,requiredModules:[],recommendedModules:[],conditionalModules:[],workflowTemplateRecommendations:[],activityTypes:[template]}]
const group='11111111-1111-1111-1111-111111111111'
let fail=false,slow=false,calls=0,creates=0
const plugin={name:'conversation-local-qa',enforce:'pre',transformIndexHtml(html){return html.replace('<head>','<head><script>'+String.raw`
localStorage.setItem('alife.language','zh');
window.__voice={instances:[],starts:0};
class MockRecognition{constructor(){window.__voice.instances.push(this)}start(){window.__voice.starts++;this.onstart?.();document.getElementById('qa-status').textContent='Microphone starts: '+window.__voice.starts}stop(){this.onend?.()}abort(){}emit(text){this.onresult?.({results:[Object.assign([{transcript:text}],{isFinal:true})]});this.onend?.()}}
window.SpeechRecognition=MockRecognition;
Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],cancel(){},speak(u){setTimeout(()=>u.onend?.(),200)}}});
window.SpeechSynthesisUtterance=class{constructor(t){this.text=t}};
window.addEventListener('DOMContentLoaded',()=>{const bar=document.createElement('div');bar.style='padding:10px;background:#edf3e7;font:12px sans-serif;position:relative;z-index:9999';bar.innerHTML='<strong>LOCAL QA — simulated APIs / microphone</strong> <button id="qa-meal">模拟聚餐语音</button> <button id="qa-correct">模拟人数纠正</button> <button id="qa-fail">下次项目请求失败</button> <button id="qa-slow">下次请求延迟</button> <button id="qa-error">模拟麦克风拒绝</button> <span id="qa-status">Microphone starts: 0</span>';document.body.prepend(bar);document.getElementById('qa-meal').onclick=()=>window.__voice.instances.at(-1)?.emit('11月21日18点到20点在教会大厅小组聚餐，12人，大家自带一道菜，不需要报名，仅限小组成员。');document.getElementById('qa-correct').onclick=()=>window.__voice.instances.at(-1)?.emit('人数改为16人');document.getElementById('qa-fail').onclick=()=>fetch('/__qa/fail',{method:'POST'});document.getElementById('qa-slow').onclick=()=>fetch('/__qa/slow',{method:'POST'});document.getElementById('qa-error').onclick=()=>window.__voice.instances.at(-1)?.onerror?.({error:'not-allowed'});});
`+'</script>')},configureServer(server){server.middlewares.use(async(req,res,next)=>{
const url=new URL(req.url,'http://localhost');const p=url.pathname
if(p.startsWith('/__qa/')){if(p.endsWith('fail'))fail=true;if(p.endsWith('slow'))slow=true;res.setHeader('content-type','application/json');res.end(JSON.stringify({calls,creates}));return}
if(!p.startsWith('/api/'))return next()
let raw='';for await(const chunk of req)raw+=chunk;const input=raw?JSON.parse(raw):{};let data=[]
if(p==='/api/me')data={id:'qa-leader',displayName:'QA Leader',isGuest:false,isRegistered:true,platformRole:'superadmin',permissions:['admin.access'],memberships:[]}
else if(p==='/api/event-archetypes')data=catalogue
else if(p==='/api/events/ram-authoring/context')data={policy:null,sourceVersion:'new:qa',title:{en:'Meal',zh:'聚餐'},questionDefinitions:[]}
else if(p.endsWith('/compose'))data={schemaVersion:'2.0.0',proposalHash:'qa',baselineETag:'"new"',facts:{items:[]},roleRequirements:[],workflowContributions:[],warnings:[],navigation:[],readiness:{status:'notReady',blockers:[]},moduleDecisions:[]}
else if(p.includes('/details-session/')&&p.endsWith('/message')){calls++;const s=input.appContext.knownFacts.snapshot;const f={...s.form,title:{en:'A table together',zh:'小组暖心聚餐'},description:{en:'A shared meal. Everyone brings one dish.',zh:'大家带一道菜，在熟悉的餐桌边慢慢聊。'},locationName:{en:'Church hall',zh:'教会大厅'},startLocal:'2026-11-21T18:00',endLocal:'2026-11-21T20:00',timeZone:'Pacific/Auckland',visibility:'groupVisible',registrationMode:'none'};const fields=Object.keys(f).filter(k=>JSON.stringify(f[k])!==JSON.stringify(s.form[k]));data={responseMode:'result',result:{...s,form:f,adoptedFields:fields,sources:{...s.sources,...Object.fromEntries(fields.map(k=>[k,'explicit']))},issues:[],assessment:{sufficiencyScore:80,summary:{en:'Review the draft',zh:'请核对草稿'}},assistantReply:{en:'A relaxed evening around the table. I have added the time and venue. Shall we review the arrangements?',zh:'一人一道菜，听起来就很热闹。我把时间和地点记下了，我们再一起核对一下安排，好吗？'}}};if(slow)await new Promise(r=>setTimeout(r,5000))}
else if(p==='/api/events/creation-project-assistance'){calls++;if(slow){slow=false;await new Promise(r=>setTimeout(r,5000))}if(fail){fail=false;res.statusCode=503;data={message:'模拟失败：草稿已保留 / Simulated failure: draft kept'}}else data={revision:input.revision,form:{...input.form,participantCount:input.message.includes('16')?16:12,activities:[{id:input.form.activities[0]?.id||'',attributes:['meal'],name:{en:'Bring a dish',zh:'一人一道菜'},conditions:{en:'Indoors, everyone brings one dish.',zh:'室内聚餐，每人带一道菜。'},occurrenceId:null}]},adoptedFields:['activities','participantCount'],assistantReply:{en:'The draft is ready for your review.',zh:'草稿整理好了，一起核对一下吧。'}}}
else if(p===`/api/groups/${group}/events`&&req.method==='POST'){creates++;data={id:'22222222-2222-2222-2222-222222222222'};console.log('SIMULATED_CREATE',JSON.stringify(input))}
else if(p.includes('capabilities'))data=[]
res.setHeader('content-type','application/json');res.setHeader('cache-control','no-store');res.end(JSON.stringify(data))
})}}
const server=await createServer({root,plugins:[plugin],server:{host:'127.0.0.1',port:58951,strictPort:true,proxy:{}}})
await server.listen();console.log('QA http://127.0.0.1:58951/events/new?groupId='+group)
