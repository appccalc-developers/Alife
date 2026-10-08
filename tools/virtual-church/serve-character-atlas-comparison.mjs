// Local, read-only asset comparison. No app routing, installs or generated files.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, realpath } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import ts from '../../cloudflare/alife-app/node_modules/typescript/lib/typescript.js'

const [beforePath, afterPath, portText = '5188', skinOption, batchOption] = process.argv.slice(2)
assert.ok(skinOption === undefined || skinOption === '--church-skin', 'Unknown comparison material mode')
assert.ok(batchOption === undefined || batchOption === '--original-map-batch', 'Unknown batch mode')
const churchSkin = skinOption === '--church-skin'
const originalMapBatch = batchOption === '--original-map-batch'
assert.ok(!originalMapBatch || beforePath === afterPath, 'Original-map comparison must use the identical input twice')
assert.ok(beforePath && afterPath, 'Usage: node <script> before.glb after.glb [port]')
const port = Number(portText)
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535)
const releaseBase = resolve(dirname(fileURLToPath(import.meta.url)), '../../cloudflare/alife-app/public/virtual-church-assets/v3/releases')
const approvedBaselines = await Promise.all([
  ['gate-a-baseline-r9', 'female'], ['male-hero-v14-r1', 'male'],
].map(async ([release, role]) => ({
  root: await realpath(resolve(releaseBase, release, 'characters')),
  name: new RegExp(`^character-hero-${role}-(low|medium|high)\\.glb$`),
})))
const files = await Promise.all([beforePath, afterPath].map(async (path, index) => {
  const resolved = await realpath(path)
  // Read the approved baseline in place; do not require a disposable duplicate.
  // Candidates remain confined to Data, and HTTP exposes only these two files.
  const fromData = resolved.toLowerCase().startsWith('c:\\data\\alife\\temp\\')
  const baseline = (index === 0 || originalMapBatch) && approvedBaselines.some(({ root, name }) =>
    resolved.startsWith(root + sep) && name.test(resolved.slice(root.length + 1)))
  assert.ok((fromData || baseline) && resolved.endsWith('.glb'))
  return readFile(resolved)
}))
const identities = files.map(bytes => ({ bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }))
const threeRoot = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '../../cloudflare/alife-app/node_modules/three'))
const wardrobeSource = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../../cloudflare/alife-app/src/views/virtualChurchCharacterWardrobe.ts'), 'utf8')
const wardrobeJs = ts.transpileModule(wardrobeSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 } }).outputText
const batchSource = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), '../../cloudflare/alife-app/src/views/virtualChurchOutfitBatch.ts'), 'utf8')
const batchJs = ts.transpileModule(batchSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 } }).outputText
  .replaceAll('three/examples/jsm/', 'three/addons/').replace('./virtualChurchCharacterWardrobe.ts', '/wardrobe.js')
const page = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>角色材质对比 / Character atlas comparison</title>
<style>body{margin:20px;background:#f5f2eb;color:#18332d;font:15px Segoe UI,Microsoft YaHei,sans-serif}header,p{max-width:1000px}button{min-height:44px;margin:4px;padding:8px 14px}button:focus-visible{outline:3px solid #176b5a}main{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0;width:min(512px,100%)}canvas{width:100%;height:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere}figcaption{margin:8px 0}</style>
<header><h1>材质合并对比 / Atlas comparison</h1><p>固定姿势、灯光与镜头；${churchSkin ? '皮肤使用当前教堂的浅色非受光和透明规则，其余材质保留资产原样。Church skin rules; other materials remain authored.' : '使用资产原始材质，不是教堂运行时补光。Fixed authored-material diagnostic, not the church runtime.'} 换装复用教堂配色；走跑为资产片段取样，不代表完整控制器或整页性能。Church outfit tints; sampled authored clips, not the controller or full-page performance.</p></header>
<nav aria-label="对比控制 / Comparison controls"><button id="self" disabled>自检 / Self-check</button><button data-angle="0" disabled>正向 / Front</button><button data-angle="45" disabled>右前 / Right 45</button><button data-angle="-45" disabled>左前 / Left 45</button><button data-angle="90" disabled>侧向 / Side</button><button data-angle="180" disabled>背向 / Back</button><button id="sweep" disabled>环绕检查 / Sweep</button><button data-frame="face" disabled>脸部 / Face</button><button data-frame="body" disabled>全身 / Body</button><button data-frame="distant" disabled>远距 / Distant</button></nav>
<button id="worst" disabled>最大差异样本 / Worst sample</button><p role="status" id="status">加载中 / Loading</p><main><figure><figcaption>合并前 / Before</figcaption><canvas id="before" width="512" height="512" aria-label="合并前角色"></canvas></figure><figure><figcaption>候选 / Candidate</figcaption><canvas id="after" width="512" height="512" aria-label="候选角色"></canvas></figure></main><pre id="report" aria-label="差异诊断 / Difference report"></pre>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {GATE_A_SKIN_UNLIT_COLOR,gateAIsSkinMaterial,gateAUsesOpaqueAlphaPath,gateAIsOutfitMaterial,gateAApplyOutfitMaterialTint,GATE_A_OUTFIT_MATERIAL_TINTS} from '/wardrobe.js';
import {createVirtualChurchOutfitBatch} from '/outfit-batch.js';
const status=document.querySelector('#status'), report=document.querySelector('#report');
try {
 const decoder=new DRACOLoader().setDecoderPath('/three/examples/jsm/libs/draco/gltf/');
 const loader=new GLTFLoader().setDRACOLoader(decoder);
 const models=await Promise.all(['/before.glb','/after.glb'].map(url=>loader.loadAsync(url)));
 const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});
 const batch=${originalMapBatch}?createVirtualChurchOutfitBatch(models[1].scene,models[1].animations,renderer.capabilities.maxTextures):null;
 if(batch&&!batch.supported)throw Error('Batch rejected: '+batch.reason);
 const outfitMaterials=new Map();
 for(const model of models)model.scene.traverse(node=>{
  if(!node.isMesh)return;
  for(const material of Array.isArray(node.material)?node.material:[node.material]){
   if(gateAIsOutfitMaterial(material.name)&&material.color&&!outfitMaterials.has(material))outfitMaterials.set(material,material.color.clone());
  }
 });
 let outfit='classic';
 function setOutfit(id){
  if(!Object.hasOwn(GATE_A_OUTFIT_MATERIAL_TINTS,id))throw Error('Unknown outfit');
  const tint=new THREE.Color(GATE_A_OUTFIT_MATERIAL_TINTS[id]);
  for(const [material,authored] of outfitMaterials)gateAApplyOutfitMaterialTint(material.color,tint,authored);
  outfit=id;
 }
 if(${churchSkin})for(const model of models)model.scene.traverse(node=>{
  if(!node.isMesh)return;
  const convert=source=>{
   if(!gateAIsSkinMaterial(source.name)||!source.isMeshStandardMaterial)return source;
   const skin=new THREE.MeshBasicMaterial({name:source.name,color:GATE_A_SKIN_UNLIT_COLOR,map:source.map,alphaMap:source.alphaMap,alphaTest:source.alphaTest,opacity:source.opacity,transparent:source.transparent,side:source.side,depthTest:source.depthTest,depthWrite:source.depthWrite,vertexColors:source.vertexColors,toneMapped:false});
   if(gateAUsesOpaqueAlphaPath(skin.name))skin.alphaTest=0;
   return skin;
  };
  node.material=Array.isArray(node.material)?node.material.map(convert):convert(node.material);
 });
 renderer.setSize(512,512); renderer.setPixelRatio(1); renderer.outputColorSpace=THREE.SRGBColorSpace;
 const mixers=models.map(model=>new THREE.AnimationMixer(model.scene));
 let pose={clip:'Idle_A',phase:0};
 function setPose(name,phase){
  const clips=models.map(model=>model.animations.find(c=>c.name===name));
  if(clips.some(clip=>!clip))throw Error('Both candidates must contain '+name);
  mixers.forEach((mixer,i)=>{mixer.stopAllAction();mixer.clipAction(clips[i]).reset().play();mixer.setTime(clips[i].duration*phase);});
  pose={clip:name,phase};
 }
 const idle=models[0].animations.find(c=>c.name==='Idle_A');
 if(idle)setPose('Idle_A',Math.min(.5/idle.duration,.99));
 const scenes=models.map(model=>{
  const scene=new THREE.Scene(); scene.background=new THREE.Color('#66766f'); scene.add(model.scene);
  scene.add(new THREE.HemisphereLight(0xffffff,0x888888,2));
  const light=new THREE.DirectionalLight(0xffffff,2); light.position.set(2,3,4);scene.add(light);
  scene.updateMatrixWorld(true); return scene;
 });
 const head=new THREE.Vector3(); let headBone;
 models[0].scene.traverse(n=>{if(n.isBone&&/(?:^|_)Head$/.test(n.name))headBone=n;});
 if(!headBone)throw Error('Cannot identify head bone; refusing an inferred close-up');
 headBone.getWorldPosition(head); head.y+=.055;
 const bounds=new THREE.Box3().setFromObject(models[0].scene), bodyCentre=bounds.getCenter(new THREE.Vector3());
 const bodyDistance=bounds.getSize(new THREE.Vector3()).y/2/Math.tan(THREE.MathUtils.degToRad(17.5))*1.15;
 let framing='face';
 const camera=new THREE.PerspectiveCamera(35,1,.01,100);
 const canvases=['before','after'].map(id=>document.getElementById(id));
 const contexts=canvases.map(c=>c.getContext('2d',{willReadFrequently:true}));
 function compare(angle,self=false){
  const r=angle*Math.PI/180;
  const target=framing==='face'?head:bodyCentre, distance=framing==='face'?.72:bodyDistance*(framing==='distant'?2:1);
  camera.position.copy(target).add(new THREE.Vector3(Math.sin(r)*distance,.01,Math.cos(r)*distance));camera.lookAt(target);camera.updateMatrixWorld();
  const draws=[];
  [0,self?0:1].forEach((index,i)=>{renderer.render(scenes[index],camera);draws.push(renderer.info.render.calls);contexts[i].drawImage(renderer.domElement,0,0);});
  const a=contexts[0].getImageData(0,0,512,512).data,b=contexts[1].getImageData(0,0,512,512).data;
  let changedPixels=0,aboveTwo=0,maxChannelError=0,sum=0;
  for(let i=0;i<a.length;i+=4){let delta=0;for(let c=0;c<3;c++){const d=Math.abs(a[i+c]-b[i+c]);delta=Math.max(delta,d);sum+=d;}if(delta)changedPixels++;if(delta>2)aboveTwo++;maxChannelError=Math.max(maxChannelError,delta);}
  return {angle,framing,pose:{...pose},outfit,self,changedPixels,aboveTwo,maxChannelError,meanChannelError:sum/(512*512*3),draws};
 }
 let worstSample=null;
 // Account retained CPU backing stores, including hidden originals. This is
 // deliberately not a claim about driver allocation or Three's morph textures.
 function geometryMemory(root){
  const buffers=new Set(), geometries=new Set();let attributeBytes=0;
  root.traverse(node=>{if(node.geometry)geometries.add(node.geometry);});
  for(const geometry of geometries){
   const attributes=[...Object.values(geometry.attributes),...Object.values(geometry.morphAttributes).flat(),geometry.index].filter(Boolean);
   for(const attribute of attributes){const array=attribute.isInterleavedBufferAttribute?attribute.data.array:attribute.array;buffers.add(array.buffer);attributeBytes+=array.byteLength;}
  }
  return {geometries:geometries.size,uniqueBackingStoreBytes:[...buffers].reduce((sum,buffer)=>sum+buffer.byteLength,0),attributeViewBytes:attributeBytes};
 }
 const memory=models.map(model=>geometryMemory(model.scene));
 const benchmark=document.createElement('button');benchmark.textContent='配对耗时 / Paired timing';document.querySelector('nav').append(benchmark);
 benchmark.onclick=async()=>{
  const controls=[...document.querySelectorAll('button')];controls.forEach(button=>button.disabled=true);
  const gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),pending=[],cpu=[[],[]],gpu=[[],[]];
  let invalidGpu=false;const frames=[];let lastFrame;
  const nextFrame=()=>new Promise((resolve,reject)=>{
   const frame=requestAnimationFrame(time=>{clearTimeout(deadline);if(lastFrame!==undefined)frames.push(time-lastFrame);lastFrame=time;resolve();});
   const deadline=setTimeout(()=>{cancelAnimationFrame(frame);reject(Error('Frame scheduling timeout; sample discarded'));},5000);
  });
  const drain=()=>{
   if(ext&&gl.getParameter(ext.GPU_DISJOINT_EXT))invalidGpu=true;
   for(let i=pending.length-1;i>=0;i--){const item=pending[i];if(gl.getQueryParameter(item.query,gl.QUERY_RESULT_AVAILABLE)){
    gpu[item.index].push(gl.getQueryParameter(item.query,gl.QUERY_RESULT)/1e6);gl.deleteQuery(item.query);pending.splice(i,1);
   }}
  };
  const summary=values=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);return {samples:values.length,medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))]};};
  try{
   framing='body';setPose('Walk',.375);compare(45);
   // Warm both shader paths; pixel readback is outside every timed interval.
   for(let i=0;i<12;i++){renderer.render(scenes[0],camera);renderer.render(scenes[1],camera);}
   for(let pair=0;pair<60;pair++){
    await nextFrame();if(document.visibilityState!=='visible')throw Error('Keep comparison visible while sampling');
    drain();status.textContent='配对取样 / Sampling '+(pair+1)+'/60';
    for(const index of pair%2?[1,0]:[0,1]){
     const query=ext?gl.createQuery():null;if(query)gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
     const start=performance.now();renderer.render(scenes[index],camera);cpu[index].push(performance.now()-start);
     if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push({query,index});}
    }
   }
   const deadline=performance.now()+10000;
   while(pending.length&&performance.now()<deadline){await nextFrame();drain();}
   show({method:'512px static Walk pose, 60 alternating pairs, warmed renderer; CPU submission excludes readback, not FPS or whole-church performance.',memory,extraRetainedCpuBackingStoreBytes:memory[1].uniqueBackingStoreBytes-memory[0].uniqueBackingStoreBytes,cpuSubmission:cpu.map(summary),gpuElapsed:ext&&!invalidGpu&&!pending.length?gpu.map(summary):null,gpuStatus:!ext?'extension unavailable':invalidGpu?'disjoint: discarded':pending.length?'query timeout: discarded':'valid',frameScheduling:summary(frames),comparison:compare(45)});
  }catch(error){report.textContent=JSON.stringify({samplingFailed:true,reason:error.message});status.textContent='取样中止 / Sampling stopped: '+error.message;}
  finally{pending.forEach(item=>gl.deleteQuery(item.query));controls.forEach(button=>button.disabled=false);document.querySelector('#worst').disabled=!worstSample;}
 };
 function show(result){if(result.worst)worstSample=result.worst;document.querySelector('#worst').disabled=!worstSample;report.textContent=JSON.stringify({identities:${JSON.stringify(identities)},churchSkinRules:${churchSkin},originalMapBatch:batch?.supported?{parts:batch.parts.length,maps:batch.maps.length}:null,head:head.toArray(),result},null,2);status.textContent='检查完成 / Ready';}
 document.querySelector('#worst').onclick=()=>{if(!worstSample)return;const sample=worstSample;framing=sample.framing;setOutfit(sample.outfit);setPose(sample.pose.clip,sample.pose.phase);show(compare(sample.angle));};
 document.querySelectorAll('[data-angle]').forEach(button=>button.onclick=()=>show(compare(Number(button.dataset.angle))));
 document.querySelectorAll('[data-frame]').forEach(button=>button.onclick=()=>{framing=button.dataset.frame;show(compare(0));});
 document.querySelector('#self').onclick=()=>show(compare(0,true));
 document.querySelector('#sweep').onclick=()=>{const results=[];for(let angle=-180;angle<180;angle+=5)results.push(compare(angle));show({views:results.length,worst:results.reduce((a,b)=>a.aboveTwo>b.aboveTwo?a:b),results});};
 for(const [id,label] of Object.entries({classic:'原色 / Classic',service:'服侍 / Service',community:'团契 / Community'})){
  const button=document.createElement('button');button.textContent=label;
  button.onclick=()=>{setOutfit(id);show(compare(0));};document.querySelector('nav').append(button);
 }
 // Explicit sampled authored clips, not an app-controller or FPS benchmark.
 if(['Walk','Run'].every(name=>models.every(model=>model.animations.some(c=>c.name===name)))){
  const motion=document.createElement('button');motion.textContent='走跑取样 / Walk-run samples';motion.id='motion';
  document.querySelector('nav').append(motion);
  motion.onclick=()=>{const results=[];for(const frame of ['body','distant'])for(const name of ['Walk','Run'])for(const phase of [.125,.375,.625,.875]){
   framing=frame;setPose(name,phase);for(const angle of [-135,-90,-45,0,45,90,135,180])results.push(compare(angle));
  }show({views:results.length,method:'Authored Walk/Run poses, four phases and eight angles at two distances; no app gait/controller or FPS claim.',worst:results.reduce((a,b)=>a.aboveTwo>b.aboveTwo?a:b),results});};
 }
 document.querySelectorAll('button').forEach(b=>b.disabled=false);show(compare(0));
 window.addEventListener('pagehide',()=>{if(batch?.supported)batch.dispose();decoder.dispose();renderer.dispose();renderer.forceContextLoss();},{once:true});
}catch(error){status.textContent='加载失败 / Failed: '+error.message;document.documentElement.dataset.failed='true';console.error(error);}
</script></html>`

const server = createServer(async (req, res) => {
  try {
    assert.ok(req.method === 'GET' || req.method === 'HEAD')
    assert.ok(req.headers.host === '127.0.0.1:' + port || req.headers.host === 'localhost:' + port)
    const path = new URL(req.url, 'http://127.0.0.1').pathname
    let data, mime
    if (path === '/') { data = page; mime = 'text/html; charset=utf-8' }
    else if (path === '/wardrobe.js') { data = wardrobeJs; mime = 'text/javascript' }
    else if (path === '/outfit-batch.js') { data = batchJs; mime = 'text/javascript' }
    else if (path === '/before.glb' || path === '/after.glb') { data = files[path === '/before.glb' ? 0 : 1]; mime = 'model/gltf-binary' }
    else if (path.startsWith('/three/')) {
      const source = await realpath(resolve(threeRoot, decodeURIComponent(path.slice(7))))
      assert.ok(source.startsWith(threeRoot + sep))
      assert.ok(source.endsWith('.js') || source.endsWith('.wasm'))
      data = await readFile(source); mime = source.endsWith('.wasm') ? 'application/wasm' : 'text/javascript'
    } else { res.writeHead(404); res.end(); return }
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    res.end(req.method === 'HEAD' ? undefined : data)
  } catch { res.writeHead(404); res.end() }
})
server.listen(port, '127.0.0.1', () => console.log(JSON.stringify({ url: 'http://127.0.0.1:' + port, identities })))
