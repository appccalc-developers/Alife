// Geometry-only, reproducible check against the actual Three animation/skinning
// implementation. Texture rendering and device QA remain separate.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { AnimationMixer, LoopOnce, LoopRepeat, Vector3 } from '../../cloudflare/alife-app/node_modules/three/build/three.module.js'
import { GLTFLoader } from '../../cloudflare/alife-app/node_modules/three/examples/jsm/loaders/GLTFLoader.js'
import { decompressCharacterDraco } from './gate-a-character-geometry.mjs'
import { composeVirtualChurchSharedMotion } from '../../cloudflare/alife-app/src/views/virtualChurchSharedMotion.ts'
import { createCommonHumanRigAdapter } from './rebase-character-joint-axes-candidate.mjs'
import { parseCharacterGlb } from './build-character-outfit-atlas-candidate.mjs'
import { freezeVirtualChurchUnanimatedCloneBoneMatrices, shareVirtualChurchOwnedCloneSkeletons } from '../../cloudflare/alife-app/src/views/virtualChurchResourceLeaseContract.ts'
import {
  gateAAnimationTransitionSeconds, gateAReviewLoopJoinTime,
  gateASynchronizedLocomotionTime, gateAReviewGaitBlendFrame,
  gateAReviewContributingActionWeight,
} from '../../cloudflare/alife-app/src/views/virtualChurchCharacterAnimation.ts'

const args = process.argv.slice(2)
const [beforePath, afterPath, motionPath] = args.filter(arg => !arg.startsWith('--'))
const commonHumanReferencePath = args.find(arg => arg.startsWith('--common-human-reference='))?.split('=').slice(1).join('=')
const commonHumanSetupOnly = args.includes('--common-human-setup-only')
const commonHumanCpu = args.includes('--common-human-cpu')
const commonHumanExportCpu = args.includes('--common-human-export-cpu')
const commonHumanQuickBlends = args.includes('--common-human-quick-blends')
assert.ok(args.filter(arg => arg.startsWith('--common-human-reference=')).length <= 1
  && (!args.some(arg => arg.startsWith('--common-human-reference=')) || commonHumanReferencePath), 'Empty or multiple common-human reference options')
assert.ok(args.filter(arg => !arg.startsWith('--')).length <= 3)
assert.ok(args.filter(arg => arg.startsWith('--')).every(arg => arg.startsWith('--common-human-reference=') || arg === '--common-human-setup-only' || arg === '--common-human-cpu' || arg === '--common-human-export-cpu' || arg === '--common-human-quick-blends'), 'Unknown verifier option')
assert.ok(!commonHumanSetupOnly || commonHumanReferencePath, 'Setup-only requires an explicit common-human reference')
assert.ok(!(commonHumanCpu || commonHumanExportCpu) || commonHumanReferencePath, 'CPU mode requires an explicit common-human reference')
assert.ok(!((commonHumanCpu || commonHumanExportCpu) && commonHumanSetupOnly), 'CPU and setup-only are different scopes')
assert.ok(!(commonHumanCpu && commonHumanExportCpu), 'Adapter CPU and export CPU are different scopes')
assert.ok(!commonHumanQuickBlends || (commonHumanReferencePath && !commonHumanCpu && !commonHumanExportCpu && !commonHumanSetupOnly), 'Quick blends require a reference and a separate geometry scope')
assert.ok(!commonHumanReferencePath || !motionPath, 'Common-rest proof and separated shared-motion proof are different experiments')
assert.ok(beforePath && afterPath, 'Usage: node <script> before.glb after.glb [shared-motion.glb]')
const raw = await Promise.all([beforePath, afterPath].map(p => readFile(p)))
const exportedCommonRest = parseCharacterGlb(raw[1]).json.extras?.commonHumanRestCandidate
const load = async bytes => {
  const decoded = await decompressCharacterDraco(bytes), n = decoded.readUInt32LE(12)
  const doc = JSON.parse(decoded.subarray(20, 20 + n)), bin = decoded.subarray(n + 28)
  // In-memory only: avoid loading images in this geometry verifier. Do not use
  // this stripped parse for any colour, transparency or visual-fidelity claim.
  doc.materials = doc.materials.map(m => ({ name: m.name }))
  delete doc.images; delete doc.textures
  const text = Buffer.from(JSON.stringify(doc)), json = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32)
  text.copy(json)
  const header = Buffer.alloc(20), binHeader = Buffer.alloc(8)
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + bin.length, 8)
  header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
  binHeader.writeUInt32LE(bin.length); binHeader.writeUInt32LE(0x004e4942, 4)
  const file = Buffer.concat([header, json, binHeader, bin])
  const gltf = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.length), '')
  const meshes = []
  gltf.scene.traverse(n => { if (n.isSkinnedMesh) meshes.push(n) })
  assert.ok(meshes.length)
  return { ...gltf, meshes, mixer: new AnimationMixer(gltf.scene) }
}
const [before, after] = await Promise.all(raw.map(load))
if (commonHumanCpu || commonHumanExportCpu) {
  if (commonHumanCpu) {
    assert.ok(!exportedCommonRest, 'CPU adapter comparison must use unmodified source models')
    assert.ok(raw[0].equals(raw[1]), 'CPU pairs require independent instances of the exact same asset')
  } else assert.ok(exportedCommonRest, 'Export CPU requires a marked common-rest candidate')
  const reference = await readFile(commonHumanReferencePath)
  if (commonHumanExportCpu) {
    assert.equal(exportedCommonRest.version, 1)
    assert.equal(exportedCommonRest.sourceSha256, createHash('sha256').update(raw[0]).digest('hex'), 'Export source version differs')
    assert.equal(exportedCommonRest.referenceSha256, createHash('sha256').update(reference).digest('hex'), 'Export foundation version differs')
  }
  const models = [before, after, await load(raw[commonHumanExportCpu ? 1 : 0])]
  const adapters = [], freezes = [], staticHelpers = []
  const runtime = await readFile(new URL('../../cloudflare/alife-app/src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(runtime, /GATE_A_DESKTOP_IDLE_MIXER_INTERVAL_SECONDS = 1 \/ 30/)
  const modes = commonHumanExportCpu ? ['optimized-baseline', 'export-stock-updates', 'export-freeze-static-helpers'] : ['optimized-baseline', 'adapter-every-frame', 'adapter-after-mixer']
  const rounds = 7, frames = 1200, warmupFrames = 180, snapshots = []
  let snapshotMaximumMetres = 0
  try {
    const setup = models.map((model, i) => {
      const merged = shareVirtualChurchOwnedCloneSkeletons(model.scene)
      const frozen = freezeVirtualChurchUnanimatedCloneBoneMatrices(model.scene, model.animations)
      assert.ok(frozen.supported, 'Must retain the current static-bone optimization')
      freezes.push(frozen)
      const skeletons = new Set(model.meshes.map(mesh => mesh.skeleton))
      const adapter = i && !commonHumanExportCpu ? createCommonHumanRigAdapter(raw[0], reference, model.scene) : null
      adapters.push(adapter)
      adapter?.update()
      let frozenHelpers = 0
      if (commonHumanExportCpu && i === 2) model.scene.traverse(node => {
        if (!/^__VC_Common_(Left|Right)_/.test(node.name)) return
        assert.ok(!model.animations.some(clip => clip.tracks.some(track => track.name.startsWith(`${node.name}.`))), 'Constant helper must not be animated')
        if (!node.matrixAutoUpdate) return
        node.updateMatrix(); node.matrixAutoUpdate = false; staticHelpers.push(node); frozenHelpers++
      })
      return { model, adapter, skeletons, label: modes[i], merged, frozenBones: frozen.count, frozenHelpers }
    })
    assert.ok(setup.every(s => s.skeletons.size === setup[0].skeletons.size && (commonHumanExportCpu || s.frozenBones === setup[0].frozenBones)))
    const samplePose = context => {
      const first = models[0]
      for (let mi = 1; mi < models.length; mi++) first.meshes.forEach((mesh, index) => {
        const other = models[mi].meshes[index]
        assert.equal(mesh.geometry.attributes.position.count, other.geometry.attributes.position.count)
        const a = new Vector3(), b = new Vector3()
        for (let vi = 0; vi < mesh.geometry.attributes.position.count; vi++) {
          mesh.getVertexPosition(vi, a).applyMatrix4(mesh.matrixWorld)
          other.getVertexPosition(vi, b).applyMatrix4(other.matrixWorld)
          const error = a.distanceTo(b)
          assert.ok(Number.isFinite(error) && error < 1e-6, `CPU end-pose differs ${context}/${modes[mi]}`)
          snapshotMaximumMetres = Math.max(snapshotMaximumMetres, error)
        }
      })
      snapshots.push(context)
    }
    const results = []
    for (const clip of ['Idle_A', 'Walk', 'Run']) {
      const idle = clip === 'Idle_A', samples = modes.map(() => []), orders = []
      const prepare = state => {
        state.model.mixer.stopAllAction()
        const animation = state.model.animations.find(a => a.name === clip)
        assert.ok(animation)
        state.model.mixer.clipAction(animation).reset().setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(LoopRepeat, Infinity).play()
        state.model.mixer.setTime(0)
        state.adapter?.applyPose()
        state.model.scene.updateMatrixWorld(true)
        state.skeletons.forEach(s => s.update())
      }
      const frame = (state, i) => {
        const mixerAdvanced = !idle || i % 2 === 1
        if (mixerAdvanced) state.model.mixer.update(idle ? 2 / 60 : 1 / 60)
        if (state.label === 'adapter-every-frame' || (state.label === 'adapter-after-mixer' && mixerAdvanced)) state.adapter.applyPose()
        state.model.scene.updateMatrixWorld(true)
        // Deduplicate exactly as the real renderer does; never invent a
        // baseline that updates the same shared skeleton once per mesh.
        state.skeletons.forEach(s => s.update())
      }
      for (let round = 0; round < rounds; round++) {
        const order = [0, 1, 2].map(i => (i + round) % 3)
        if (round % 2) order.reverse()
        orders.push(order.map(i => modes[i]))
        for (const index of order) {
          const state = setup[index]; prepare(state)
          for (let i = 0; i < warmupFrames; i++) frame(state, i)
          const start = process.hrtime.bigint()
          for (let i = 0; i < frames; i++) frame(state, i)
          const elapsed = Number(process.hrtime.bigint() - start) / 1e6
          assert.ok(Number.isFinite(elapsed) && elapsed > 0)
          samples[index].push(elapsed)
        }
        samplePose(`${clip}/round-${round}`)
      }
      const median = values => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)]
      const medians = samples.map(median)
      results.push({ clip, frames, warmupFrames, rounds, orders,
        mixerHz: idle ? 30 : 60, worldAndUniqueSkeletonUpdatesPerFrame: 1,
        modes: samples.map((values, index) => ({ mode: modes[index], rawMilliseconds: values,
          medianTotalMilliseconds: medians[index], medianMillisecondsPerFrame: medians[index] / frames,
          extraMillisecondsPerFrame: (medians[index] - medians[0]) / frames,
          relativeComponentChangePercent: (medians[index] / medians[0] - 1) * 100 })) })
    }
    console.log(JSON.stringify({ passed: true, cpuComponentOnly: true, geometryFullSweepRun: false,
      hash: createHash('sha256').update(raw[0]).digest('hex'), referenceSha256: createHash('sha256').update(reference).digest('hex'),
      candidateSha256: commonHumanExportCpu ? createHash('sha256').update(raw[1]).digest('hex') : null,
      comparisonKind: commonHumanExportCpu ? 'Export hierarchy with stock or offline-frozen static helper nodes' : 'Post-mix affine adapter',
      setup: setup.map(s => ({ mode: s.label, frozenBones: s.frozenBones, frozenHelpers: s.frozenHelpers, uniqueSkeletons: s.skeletons.size, mergedSkeletons: s.merged })),
      results, endPoseSnapshots: snapshots.length, snapshotMaximumMetres,
      scope: 'Offline Node AnimationMixer + local/world matrices + one update per unique skeleton. No textures, rendering, RAF, controller or GPU; 1x clip rate, fixed 60Hz steps, desktop idle 30Hz.',
      runtimeReleaseAllowed: false }, null, 2))
  } finally {
    adapters.forEach(adapter => adapter?.dispose())
    freezes.forEach(frozen => frozen.restore())
    staticHelpers.forEach(node => { node.matrixAutoUpdate = true })
  }
  process.exit(0)
}
let commonHumanAdapter = null, commonHumanReferenceSha256 = null, commonRestResidual = null, commonHumanExportReport = null
if (commonHumanReferencePath) {
  const reference = await readFile(commonHumanReferencePath)
  commonHumanReferenceSha256 = createHash('sha256').update(reference).digest('hex')
  if (exportedCommonRest) {
    assert.equal(exportedCommonRest.version, 1)
    assert.equal(exportedCommonRest.sourceSha256, createHash('sha256').update(raw[0]).digest('hex'), 'Export source version differs')
    assert.equal(exportedCommonRest.referenceSha256, commonHumanReferenceSha256, 'Export foundation version differs')
    const target = await load(reference)
    target.scene.updateMatrixWorld(true); after.scene.updateMatrixWorld(true)
    const human = model => new Map([...new Set(model.meshes.flatMap(mesh => mesh.skeleton.bones))].filter(bone => /^J_Bip_/.test(bone.name)).map(bone => [bone.name, bone]))
    const a = human(after), b = human(target)
    assert.ok(a.size); assert.deepEqual([...a.keys()].sort(), [...b.keys()].sort())
    commonRestResidual = Math.max(...[...a].flatMap(([name, bone]) => bone.matrixWorld.elements.map((value, i) => Math.abs(value - b.get(name).matrixWorld.elements[i]))))
    commonHumanExportReport = { commonHumanJoints: a.size, customPostMixCallbackRequired: false, exportedCommonRest: true,
      sharedMotionImplemented: false, productionIntegrationAllowed: false, referenceSha256: commonHumanReferenceSha256,
      restWorldMatrixResidual: commonRestResidual,
      strategy: exportedCommonRest.strategy ?? 'static-trs-basis-hierarchy',
      interpretation: exportedCommonRest.strategy === 'approximate-240hz-local-trs-rebake'
        ? 'Approximate 240Hz local TRS rebake with no helper nodes. Original geometry/images/morphs retained, skeletal keys changed; mixed-motion equivalence unverified until compared. Not a shared-motion implementation or performance result.'
        : 'Exported static TRS basis hierarchy; original keys mixed by unmodified AnimationMixer. Not a shared-motion implementation or browser performance result.' }
  } else {
    assert.ok(raw[0].equals(raw[1]), 'Common-rest proof must compare independent instances of the exact same input')
    commonHumanAdapter = createCommonHumanRigAdapter(raw[1], reference, after.scene)
    commonHumanAdapter.update()
    commonRestResidual = commonHumanAdapter.verifyRest()
  }
  assert.ok(commonRestResidual < 1e-6, `Common human rest differs: ${commonRestResidual}`)
}
if (commonHumanSetupOnly) {
  const humanRig = commonHumanExportReport ?? { ...commonHumanAdapter.report, restWorldMatrixResidual: commonRestResidual }
  commonHumanAdapter?.dispose()
  console.log(JSON.stringify({ passed: true, setupOnly: true, geometryPoses: 0,
    hashes: raw.map(b => createHash('sha256').update(b).digest('hex')),
    referenceSha256: commonHumanReferenceSha256, humanRig, runtimeReleaseAllowed: false }, null, 2))
  process.exit(0)
}
let motionSha256 = null
if (motionPath) {
  const bytes = await readFile(motionPath)
  const motion = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), '')
  after.animations = composeVirtualChurchSharedMotion(after, motion)
  motionSha256 = createHash('sha256').update(bytes).digest('hex')
}
assert.equal(before.meshes.length, after.meshes.length)
assert.equal(before.animations.length, after.animations.length)
before.meshes.forEach((mesh, i) => {
  const other = after.meshes[i]
  assert.equal(mesh.name, other.name)
  assert.equal(mesh.geometry.attributes.position.count, other.geometry.attributes.position.count)
  assert.deepEqual(mesh.skeleton.bones.map(b => b.name), other.skeleton.bones.map(b => b.name))
})
const a = new Vector3(), b = new Vector3(), maximumAllowedMetres = (commonHumanAdapter || exportedCommonRest) ? .000001 : .0005, clips = []
let maximumWorldErrorMetres = 0, testedVertices = 0, poses = 0, worst
const comparePose = context => {
  let maximum = 0
  for (const model of [before, after]) {
    if (model === after && commonHumanAdapter) commonHumanAdapter.update()
    else {
      model.scene.updateMatrixWorld(true)
      model.meshes.forEach(m => m.skeleton.update())
    }
  }
  before.meshes.forEach((mesh, mi) => {
    const otherMesh = after.meshes[mi]
    for (let vi = 0; vi < mesh.geometry.attributes.position.count; vi++) {
      mesh.getVertexPosition(vi, a).applyMatrix4(mesh.matrixWorld)
      otherMesh.getVertexPosition(vi, b).applyMatrix4(otherMesh.matrixWorld)
      const error = a.distanceTo(b)
      assert.ok(Number.isFinite(error))
      if (error > maximumWorldErrorMetres) { maximumWorldErrorMetres = error; worst = { ...context, mesh: mesh.name, vertex: vi } }
      maximum = Math.max(maximum, error); testedVertices++
    }
  })
  poses++
  return maximum
}
if (commonHumanQuickBlends) {
  const pairs = [['Idle_A', 'Walk'], ['Walk', 'Run'], ['Run', 'Idle_A']]
  for (const [previous, next] of pairs) for (const weight of [0, .1, .3, .5, .7, .9, 1]) for (const phase of [0, .125, .25, .5, .75, .875, 1]) {
    for (const model of [before, after]) {
      model.mixer.stopAllAction(); model.mixer.setTime(0)
      const pair = [previous, next].map(name => {
        const clip = model.animations.find(clip => clip.name === name)
        assert.ok(clip, `Quick blend requires ${name}`)
        return model.mixer.clipAction(clip).reset().setLoop(LoopRepeat, Infinity).setEffectiveTimeScale(1).play()
      })
      pair[0].setEffectiveWeight(1 - weight); pair[1].setEffectiveWeight(weight)
      pair.forEach(action => { action.time = phase * action.getClip().duration })
      model.mixer.update(0)
    }
    comparePose({ previous, next, weight, phase })
  }
  const passed = maximumWorldErrorMetres <= maximumAllowedMetres
  commonHumanAdapter?.dispose()
  console.log(JSON.stringify({ passed, quickBlendOnly: true, fullGeometrySweepRun: false,
    hashes: raw.map(bytes => createHash('sha256').update(bytes).digest('hex')),
    referenceSha256: commonHumanReferenceSha256, commonHumanRig: commonHumanExportReport,
    pairs, poses, testedVertices, maximumWorldErrorMetres, maximumAllowedMetres, worst,
    strategy: exportedCommonRest?.strategy ?? 'post-mix-adapter', runtimeReleaseAllowed: false,
    remaining: 'A finite blend lattice, not all transitions, controller, continuous-time, rendering, performance or device acceptance.' }, null, 2))
  process.exit(passed ? 0 : 1)
}
for (const [index, clip] of before.animations.entries()) {
  const other = after.animations[index]
  assert.equal(clip.name, other.name); assert.equal(clip.duration, other.duration)
  for (const [model, animation] of [[before, clip], [after, other]]) {
    model.mixer.stopAllAction()
    const action = model.mixer.clipAction(animation).reset().setLoop(LoopOnce, 1)
    action.clampWhenFinished = true; action.play()
  }
  let clipMaximum = 0
  const count = Math.ceil(clip.duration * 60)
  for (let i = 0; i <= count; i++) {
    const time = Math.min(i / 60, clip.duration)
    for (const model of [before, after]) model.mixer.setTime(time)
    clipMaximum = Math.max(clipMaximum, comparePose({ clip: clip.name, time }))
  }
  const result = { clip: clip.name, poses: count + 1, maximumWorldErrorMetres: clipMaximum }
  clips.push(result); console.log(JSON.stringify(result))
}

// Match the runtime's helpers/clip loop policy, but keep this explicitly a
// geometry comparison harness, not a replacement for controller/browser tests.
const contract = JSON.parse(await readFile(new URL('../../cloudflare/alife-app/src/views/virtualChurchCharacterAnimationContract.json', import.meta.url)))
const runtime = await readFile(new URL('../../cloudflare/alife-app/src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
const maleSpeed = kind => {
  const match = runtime.match(new RegExp(`const gateACharacter${kind}Speed =[\\s\\S]*?\\? ([\\d.]+)`))
  assert.ok(match, `Locate current male ${kind} speed; do not silently use stale calibration`)
  const speed = Number(match[1]); assert.ok(speed > 0)
  return speed
}
const walkSpeed = maleSpeed('Walk'), runSpeed = maleSpeed('Run')
const reset = model => { model.mixer.stopAllAction(); model.mixer.setTime(0) }
const actionFor = (model, name) => {
  const clip = model.animations.find(c => c.name === name)
  assert.ok(clip, `Missing ${name}`)
  const oneShot = contract.oneShotClips.includes(name) && !name.startsWith('Turn_')
  const action = model.mixer.clipAction(clip).reset().setEffectiveWeight(1).setEffectiveTimeScale(1)
  action.setLoop(oneShot ? LoopOnce : LoopRepeat, oneShot ? 1 : Infinity)
  action.clampWhenFinished = oneShot
  return action
}
const transitions = [
  ['Idle_A', 'Walk_Start'], ['Idle_B', 'Run_Start'],
  ['Walk_Start', 'Walk'], ['Run_Start', 'Run'],
  ['Walk', 'Walk_Stop'], ['Run', 'Run_Stop'],
  ['Walk_Stop', 'Idle_A'], ['Run_Stop', 'Idle_B'],
  ['Walk_Stop', 'Walk'], ['Run_Stop', 'Run'],
  ['Walk_Start', 'Walk_Stop'], ['Run_Start', 'Run_Stop'],
]
let transitionCases = 0, transitionMaximum = 0
for (const [previous, next] of transitions) for (const hz of [20, 60, 120]) for (const phase of [0, .37, .93, 1]) {
  const duration = gateAAnimationTransitionSeconds(previous, next)
  for (const model of [before, after]) {
    reset(model)
    // Stop -> loop resumes the cached loop clock in the actual controller.
    const resume = previous === 'Walk_Stop' && next === 'Walk' || previous === 'Run_Stop' && next === 'Run'
    const cached = resume ? actionFor(model, next).play() : null
    const old = actionFor(model, previous).play()
    if (cached) { cached.time = phase * cached.getClip().duration; cached.enabled = false }
    old.time = phase * old.getClip().duration
    model.mixer.update(0)
    const cachedTime = cached?.time
    old.fadeOut(duration)
    const incoming = actionFor(model, next)
    incoming.time = resume
      ? gateASynchronizedLocomotionTime(cachedTime, incoming.getClip().duration, incoming.getClip().duration)
      : gateAReviewLoopJoinTime(previous, next, incoming.getClip().duration)
    incoming.fadeIn(duration).play()
  }
  for (let frame = 0; frame <= Math.ceil((duration + .15) * hz); frame++) {
    for (const model of [before, after]) model.mixer.update(frame ? 1 / hz : 0)
    transitionMaximum = Math.max(transitionMaximum, comparePose({ transition: `${previous}->${next}`, hz, phase, frame }))
  }
  transitionCases++
}
console.log(JSON.stringify({ transitionCases, maximumWorldErrorMetres: transitionMaximum }))

let gaitCases = 0, gaitMaximum = 0, mixedFrames = 0
for (const previous of ['Walk', 'Run']) for (const hz of [20, 60, 120]) for (const phase of [0, .37, .93]) {
  for (const speed of [0, walkSpeed, runSpeed]) for (const reverse of [false, true]) {
    const next = previous === 'Walk' ? 'Run' : 'Walk'
    const duration = gateAAnimationTransitionSeconds(previous, next)
    const states = [before, after].map(model => {
      reset(model)
      const old = actionFor(model, previous).play(), incoming = actionFor(model, next).play()
      old.time = phase * old.getClip().duration
      incoming.time = gateASynchronizedLocomotionTime(old.time, old.getClip().duration, incoming.getClip().duration)
      incoming.setEffectiveWeight(0)
      model.mixer.update(0)
      return { model, walk: previous === 'Walk' ? old : incoming, run: previous === 'Run' ? old : incoming,
        blend: { fromWalkWeight: previous === 'Walk' ? 1 : 0, toWalkWeight: next === 'Walk' ? 1 : 0, remaining: duration, duration } }
    })
    const reverseFrame = Math.ceil(duration * hz / 2)
    for (let frame = 0; frame <= Math.ceil(duration * 2 * hz); frame++) {
      for (const state of states) {
        if (reverse && frame === reverseFrame) {
          const w = gateAReviewContributingActionWeight(state.walk), r = gateAReviewContributingActionWeight(state.run)
          assert.ok(w > 0 && r > 0, 'reverse while both clips actually contribute')
          state.blend = { fromWalkWeight: w / (w + r), toWalkWeight: previous === 'Walk' ? 1 : 0, remaining: duration, duration }
        }
        const result = gateAReviewGaitBlendFrame(state.blend, frame ? 1 / hz : 0, speed,
          state.walk.getClip().duration, state.run.getClip().duration, walkSpeed, runSpeed)
        assert.ok(Math.abs(result.walkWeight + result.runWeight - 1) < 1e-12)
        state.walk.setEffectiveWeight(result.walkWeight).setEffectiveTimeScale(result.walkRate)
        state.run.setEffectiveWeight(result.runWeight).setEffectiveTimeScale(result.runRate)
        state.blend.remaining = result.remaining
        state.model.mixer.update(frame ? 1 / hz : 0)
        if (result.walkWeight > 0 && result.runWeight > 0) mixedFrames++
      }
      gaitMaximum = Math.max(gaitMaximum, comparePose({ gait: `${previous}->${next}`, hz, phase, speed, reverse, frame }))
    }
    gaitCases++
  }
}
assert.ok(mixedFrames > 0)
console.log(JSON.stringify({ gaitCases, mixedFrames, maximumWorldErrorMetres: gaitMaximum }))
const passed = maximumWorldErrorMetres <= maximumAllowedMetres
const commonHumanRig = commonHumanExportReport ?? (commonHumanAdapter ? { ...commonHumanAdapter.report,
  referenceSha256: commonHumanReferenceSha256, restWorldMatrixResidual: commonRestResidual,
  interpretation: 'Post-mix in-memory full-affine binding proof. No exported canonical GLB, shared clip download, frontend integration or speed gain.' } : null)
commonHumanAdapter?.dispose()
console.log(JSON.stringify({ passed, hashes: raw.map(b => createHash('sha256').update(b).digest('hex')),
  motionSha256,
  commonHumanRig,
  poses, testedVertices, maximumWorldErrorMetres, maximumAllowedMetres, worst,
  singleClipSampleHz: 60, transitionSampleHz: [20, 60, 120], clips: clips.length,
  transitionCases, gaitCases, runtimeReleaseAllowed: false,
  remaining: 'Discrete geometry comparisons only; controller integration, rendered motion, continuous-time bounds and real-device review remain unverified.' }, null, 2))
process.exitCode = passed ? 0 : 1
