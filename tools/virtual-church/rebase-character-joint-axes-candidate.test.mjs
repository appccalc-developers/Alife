import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { AnimationMixer, LoopOnce, Matrix4, Quaternion, Vector3 } from '../../cloudflare/alife-app/node_modules/three/build/three.module.js'
import { GLTFLoader } from '../../cloudflare/alife-app/node_modules/three/examples/jsm/loaders/GLTFLoader.js'
import { encodeCharacterGlb, parseCharacterGlb } from './build-character-outfit-atlas-candidate.mjs'
import { rebaseCharacterJointAxes, createCommonHumanRigAdapter, factorCommonRigAffine, exportCommonHumanRigCandidate, bakeCommonHumanRigCandidate } from './rebase-character-joint-axes-candidate.mjs'

function fixture(reference = false, interpolation = 'LINEAR', change = () => {}, changeRest = () => {}) {
  const q = (axis, angle) => new Quaternion().setFromAxisAngle(new Vector3(...axis), angle).toArray()
  const j = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], buffers: [{}], bufferViews: [], accessors: [],
    nodes: [{ name: 'Root', children: [1, 4] },
      { name: 'J_Bip_C_Hips', translation: [0, 1, 0], rotation: q([0, 1, 0], reference ? 1.5 : .2), children: [2, 3] },
      { name: 'J_Bip_L_LowerLeg', translation: [.1, -.5, 0], rotation: q([1, 0, 0], reference ? Math.PI : .1) },
      { name: 'J_Sec_Attachment', translation: [.2, .1, .1] },
      { name: 'Body', mesh: 0, skin: 0 }],
    skins: [{ joints: [1, 2], skeleton: 1 }], meshes: [{ primitives: [] }], materials: [{ name: 'unchanged' }], animations: [] }
  const chunks = []; let length = 0
  const add = (data, type, width) => {
    const bytes = Buffer.from(data.buffer)
    const padding = (4 - length % 4) % 4; chunks.push(Buffer.alloc(padding)); length += padding
    const view = j.bufferViews.length; j.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length })
    chunks.push(bytes); length += bytes.length
    const id = j.accessors.length
    j.accessors.push({ bufferView: view, componentType: data instanceof Uint16Array ? 5123 : 5126, type, count: data.length / width })
    return id
  }
  const f = (a, type, width) => add(Float32Array.from(a), type, width)
  const p = { material: 0, attributes: {
    POSITION: f([0, 1, 0, .2, .5, 0, -.2, .3, .1], 'VEC3', 3),
    JOINTS_0: add(Uint16Array.from([0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0]), 'VEC4', 4),
    WEIGHTS_0: f([.7, .3, 0, 0, .8, .2, 0, 0, .5, .5, 0, 0], 'VEC4', 4),
  } }
  j.accessors[p.attributes.POSITION].min = [-.2, .3, 0]; j.accessors[p.attributes.POSITION].max = [.2, 1, .1]
  j.meshes[0].primitives.push(p)
  changeRest(j)
  const hips = new Matrix4().compose(new Vector3(...j.nodes[1].translation), new Quaternion(...j.nodes[1].rotation), new Vector3(...(j.nodes[1].scale ?? [1, 1, 1])))
  const leg = hips.clone().multiply(new Matrix4().compose(new Vector3(...j.nodes[2].translation), new Quaternion(...j.nodes[2].rotation), new Vector3(...(j.nodes[2].scale ?? [1, 1, 1]))))
  j.skins[0].inverseBindMatrices = f([...hips.clone().invert().elements, ...leg.invert().elements], 'MAT4', 16)
  const input = f([0, 1], 'SCALAR', 1)
  const keys = [q([0, 1, 0], .1), q([1, 0, 0], .8)]
  const rotationKeys = interpolation === 'CUBICSPLINE' ? keys.flatMap(v => [[.01, -.02, .03, .01], v, [-.02, .03, .01, -.01]]).flat() : keys.flat()
  j.animations.push({ name: 'Move', samplers: [{ input, output: f(rotationKeys, 'VEC4', 4), interpolation },
    { input, output: f([0, 1, 0, .3, 1.2, .1], 'VEC3', 3), interpolation: 'LINEAR' }],
    channels: [{ sampler: 0, target: { node: 1, path: 'rotation' } },
      { sampler: 0, target: { node: 2, path: 'rotation' } },
      { sampler: 0, target: { node: 3, path: 'rotation' } },
      { sampler: 1, target: { node: 1, path: 'translation' } }] })
  change(j)
  return encodeCharacterGlb(j, Buffer.concat(chunks))
}
const load = raw => new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length), '')

test('offline affine factors preserve sheared/reflected bases as valid glTF TRS', () => {
  for (let i = 0; i < 80; i++) {
    const a = new Matrix4().compose(new Vector3(.1, -.3, .2), new Quaternion().setFromAxisAngle(new Vector3(1, 2, 3).normalize(), i / 13), new Vector3(i % 2 ? -1.2 : .9, 1.1, .7))
    const b = new Matrix4().compose(new Vector3(), new Quaternion().setFromAxisAngle(new Vector3(3, 1, 2).normalize(), i / 17), new Vector3(.8, 1.4, 1))
    const wanted = a.multiply(b), copy = wanted.clone(), represented = new Matrix4()
    for (const node of factorCommonRigAffine(wanted)) {
      assert.equal(node.matrix, undefined)
      represented.multiply(new Matrix4().compose(new Vector3().fromArray(node.translation ?? [0, 0, 0]), new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]), new Vector3().fromArray(node.scale ?? [1, 1, 1])))
    }
    assert.deepEqual(wanted.elements, copy.elements)
    assert.ok(represented.elements.every((value, k) => Math.abs(value - wanted.elements[k]) < 1e-9))
  }
  assert.throws(() => factorCommonRigAffine(new Matrix4().makeScale(0, 1, 1)), /Invalid affine/)
  const projective = new Matrix4(); projective.elements[3] = .2
  assert.throws(() => factorCommonRigAffine(projective), /Projective/)
})

for (const interpolation of ['LINEAR', 'STEP', 'CUBICSPLINE']) test(`exported common-rest hierarchy preserves mixed ${interpolation} with no adapter callback`, async () => {
  const source = fixture(false, interpolation), reference = fixture(true, 'LINEAR', () => {}, j => {
    j.nodes[1].translation = [.1, 1.2, -.04]; j.nodes[1].scale = [1.2, 1, .9]
    j.nodes[2].translation = [.2, -.65, .15]
  })
  const { output, report } = exportCommonHumanRigCandidate(source, reference)
  assert.equal(report.customPostMixCallbackRequired, false)
  assert.equal(report.sharedMotionImplemented, false)
  assert.equal(report.runtimeReleaseAllowed, false)
  const doc = parseCharacterGlb(output)
  assert.ok(doc.bin.subarray(0, parseCharacterGlb(source).bin.length).equals(parseCharacterGlb(source).bin))
  assert.deepEqual(doc.json.animations.map(a => a.samplers), parseCharacterGlb(source).json.animations.map(a => a.samplers))
  assert.ok(doc.json.nodes.every(n => n.matrix === undefined))
  const models = await Promise.all([source, output, reference].map(load))
  models.forEach(model => model.scene.updateMatrixWorld(true))
  for (const name of ['J_Bip_C_Hips', 'J_Bip_L_LowerLeg']) {
    const actual = models[1].scene.getObjectByName(name).matrixWorld, target = models[2].scene.getObjectByName(name).matrixWorld
    assert.ok(actual.elements.every((value, i) => Math.abs(value - target.elements[i]) < 1e-8), 'exported common human rest')
  }
  const states = models.slice(0, 2).map(model => {
    const mixer = new AnimationMixer(model.scene), primary = mixer.clipAction(model.animations[0]).setLoop(LoopOnce, 1)
    primary.clampWhenFinished = true; primary.play()
    const clip = model.animations[0].clone(); clip.name = 'Partial'
    clip.tracks = clip.tracks.filter(track => track.name.includes('J_Bip_C_Hips.quaternion'))
    assert.equal(clip.tracks.length, 1)
    clip.tracks[0].values = Float32Array.from(clip.tracks[0].values.map((v, i) => i % 4 < 3 ? -v : v))
    const partial = mixer.clipAction(clip).setLoop(LoopOnce, 1); partial.clampWhenFinished = true; partial.play()
    return { model, mixer, primary, partial }
  })
  for (const weight of [0, .15, .5, .85, 1]) for (let i = 0; i <= 60; i++) {
    const points = states.map(({ model, mixer, primary, partial }) => {
      model.scene.position.set(Math.sin(i) * .2, -.1, .3)
      model.scene.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), i / 30)
      model.scene.scale.set(.9, 1.1, 1.05)
      primary.setEffectiveWeight(1 - weight); partial.setEffectiveWeight(weight); mixer.setTime(i / 60)
      model.scene.updateMatrixWorld(true)
      const mesh = model.scene.getObjectByName('Body'); mesh.skeleton.update()
      return [0, 1, 2].map(v => mesh.getVertexPosition(v, new Vector3()).applyMatrix4(mesh.matrixWorld))
        .concat([model.scene.getObjectByName('J_Sec_Attachment').getWorldPosition(new Vector3())])
    })
    points[0].forEach((p, k) => assert.ok(p.distanceTo(points[1][k]) < 1e-6, `export weight ${weight} frame ${i} point ${k}`))
  }
  assert.ok(exportCommonHumanRigCandidate(source, reference).output.equals(output), 'deterministic export')
  assert.throws(() => exportCommonHumanRigCandidate(output, reference), /already exported/)
})

test('common-rest export refuses mismatched joints, invalid parent and joint mesh payload', () => {
  assert.throws(() => exportCommonHumanRigCandidate(fixture(), fixture(true, 'LINEAR', j => { j.nodes[2].name = 'Other' })), /every reference joint/)
  assert.throws(() => exportCommonHumanRigCandidate(fixture(), fixture(true, 'LINEAR', j => { j.nodes[0].name = 'OtherRoot' })), /Parent differs/)
  assert.throws(() => exportCommonHumanRigCandidate(fixture(false, 'LINEAR', j => { j.nodes[1].mesh = 0 }), fixture(true)), /joint payload/)
  assert.throws(() => exportCommonHumanRigCandidate(fixture(), fixture(true, 'LINEAR', j => { j.nodes[1].translation[1] += .2 })), /inverse binds are not common/)
})

for (const interpolation of ['LINEAR', 'STEP', 'CUBICSPLINE']) test(`approximate common-rest bake has no helper nodes and retains ${interpolation} single-clip sampled skinning`, async () => {
  const source = fixture(false, interpolation), reference = fixture(true)
  const { output, report } = await bakeCommonHumanRigCandidate(source, reference)
  assert.equal(report.addedNodes, 0); assert.equal(report.runtimeReleaseAllowed, false)
  assert.equal(report.singleAndMixedMotionVerified, false)
  const before = parseCharacterGlb(source), after = parseCharacterGlb(output)
  assert.deepEqual(after.json.nodes.map(n => ({ name: n.name, children: n.children })), before.json.nodes.map(n => ({ name: n.name, children: n.children })))
  assert.ok(after.json.nodes.every(n => !n.matrix && !n.name.startsWith('__VC_Common_')))
  const models = await Promise.all([source, output, reference].map(load))
  models.forEach(model => model.scene.updateMatrixWorld(true))
  for (const name of ['J_Bip_C_Hips', 'J_Bip_L_LowerLeg']) {
    const target = models[2].scene.getObjectByName(name).matrixWorld, actual = models[1].scene.getObjectByName(name).matrixWorld
    assert.ok(actual.elements.every((value, i) => Math.abs(value - target.elements[i]) < 1e-8))
  }
  const states = models.slice(0, 2).map(model => {
    const mixer = new AnimationMixer(model.scene), action = mixer.clipAction(model.animations[0]).setLoop(LoopOnce, 1)
    action.clampWhenFinished = true; action.play(); return { model, mixer }
  })
  for (let i = 0; i <= 120; i++) {
    const points = states.map(({ model, mixer }) => {
      mixer.setTime(i / 120); model.scene.updateMatrixWorld(true)
      const mesh = model.scene.getObjectByName('Body'); mesh.skeleton.update()
      return [0, 1, 2].map(v => mesh.getVertexPosition(v, new Vector3()).applyMatrix4(mesh.matrixWorld))
    })
    points[0].forEach((p, k) => assert.ok(p.distanceTo(points[1][k]) < 1e-6, `rebake sample ${i}/${k}`))
  }
})

test('approximate rebake refuses substantial shear rather than deleting helper nodes blindly', async () => {
  await assert.rejects(bakeCommonHumanRigCandidate(fixture(), fixture(true, 'LINEAR', () => {}, j => { j.nodes[1].scale = [1.2, 1, .9] })), /significant shear/)
})

test('single-clip rebake success must not be reported as equivalent mixed-motion skinning', async () => {
  const source = fixture(false, 'LINEAR', j => {
    const other = structuredClone(j.animations[0]); other.name = 'Partial'
    other.channels = other.channels.filter(channel => channel.target.node === 1 && channel.target.path === 'rotation')
    j.animations.push(other)
  })
  const reference = fixture(true, 'LINEAR', () => {}, j => { j.nodes[1].translation = [.2, 1.3, .1] })
  const baked = await bakeCommonHumanRigCandidate(source, reference)
  const models = await Promise.all([source, baked.output].map(load))
  const points = models.map(model => {
    const mixer = new AnimationMixer(model.scene)
    for (const clip of model.animations) {
      const action = mixer.clipAction(clip).setLoop(LoopOnce, 1).setEffectiveWeight(.5)
      action.clampWhenFinished = true; action.play()
    }
    // The partial clip keeps source translation at rest while the primary
    // translates. Rebaking gives both explicit translated-basis tracks, which
    // must not be assumed to commute with the source partial/default blend.
    mixer.setTime(.5); model.scene.updateMatrixWorld(true)
    const mesh = model.scene.getObjectByName('Body'); mesh.skeleton.update()
    return [0, 1, 2].map(v => mesh.getVertexPosition(v, new Vector3()).applyMatrix4(mesh.matrixWorld))
  })
  const maximum = Math.max(...points[0].map((point, i) => point.distanceTo(points[1][i])))
  assert.ok(maximum > .001, `Negative blend fixture must really differ, got ${maximum}`)
  assert.equal(baked.report.singleAndMixedMotionVerified, false)
  assert.equal(baked.report.runtimeReleaseAllowed, false)
})

for (const interpolation of ['LINEAR', 'STEP', 'CUBICSPLINE']) test(`axis rebase preserves real skinning and attachments with ${interpolation} and shared samplers`, async () => {
  const source = fixture(false, interpolation), copy = Buffer.from(source), reference = fixture(true)
  const { output, report } = rebaseCharacterJointAxes(source, reference)
  assert.ok(source.equals(copy))
  assert.equal(report.sharedHumanAxes, 2)
  assert.equal(report.sharedMotionImplemented, false)
  const models = await Promise.all([source, output, reference].map(load))
  models.forEach(m => m.scene.updateMatrixWorld(true))
  for (const name of ['J_Bip_C_Hips', 'J_Bip_L_LowerLeg']) {
    const a = models[1].scene.getObjectByName(name).getWorldQuaternion(new Quaternion())
    const b = models[2].scene.getObjectByName(name).getWorldQuaternion(new Quaternion())
    assert.ok(a.angleTo(b) < 1e-6, 'reference rest axes aligned')
  }
  const mixers = models.slice(0, 2).map(m => {
    const mixer = new AnimationMixer(m.scene), action = mixer.clipAction(m.animations[0]).setLoop(LoopOnce, 1)
    action.clampWhenFinished = true; action.play(); return mixer
  })
  for (let i = 0; i <= 120; i++) {
    const points = models.slice(0, 2).map((m, index) => {
      mixers[index].setTime(i / 120); m.scene.updateMatrixWorld(true)
      const mesh = m.scene.getObjectByName('Body'); mesh.skeleton.update()
      const vertices = [0, 1, 2].map(v => mesh.getVertexPosition(v, new Vector3()).applyMatrix4(mesh.matrixWorld))
      vertices.push(m.scene.getObjectByName('J_Sec_Attachment').getWorldPosition(new Vector3()))
      return vertices
    })
    points[0].forEach((v, k) => assert.ok(v.distanceTo(points[1][k]) < 1e-6, `Pose ${i}, point ${k}`))
  }
})

test('axis rebase rejects missing joints, parent mismatch, real shear and ambiguous names', () => {
  const source = fixture()
  assert.throws(() => rebaseCharacterJointAxes(source, fixture(true, 'LINEAR', j => { j.nodes[2].name = 'Missing' })), /Missing reference joint/)
  assert.throws(() => rebaseCharacterJointAxes(source, fixture(true, 'LINEAR', j => { j.nodes[0].name = 'OtherRoot' })), /Parent differs/)
  assert.throws(() => rebaseCharacterJointAxes(fixture(false, 'LINEAR', j => { j.nodes[1].scale = [2, 1, 1] }), fixture(true)), /Nonuniform scale/)
  assert.throws(() => rebaseCharacterJointAxes(source, fixture(true, 'LINEAR', j => { j.nodes[2].name = j.nodes[1].name })), /Ambiguous joint/)
  assert.throws(() => rebaseCharacterJointAxes(fixture(false, 'LINEAR', j => { j.animations[0].channels[3].target.path = 'scale' }), fixture(true)), /Animated nonuniform scale/)
  assert.deepEqual(parseCharacterGlb(source).json.nodes[1].scale, undefined)
})

for (const interpolation of ['LINEAR', 'STEP', 'CUBICSPLINE']) test(`full common-rest proof preserves post-mix skinning with ${interpolation}, unequal lengths and scales`, async () => {
  const source = fixture(false, interpolation)
  const reference = fixture(true, 'LINEAR', () => {}, j => {
    j.nodes[1].translation = [.1, 1.2, -.04]
    j.nodes[1].scale = [1.00003, 1, .99999]
    j.nodes[2].translation = [.2, -.65, .15]
  })
  const models = await Promise.all([source, source, reference].map(load))
  const originalInverse = models[1].scene.getObjectByName('Body').skeleton.boneInverses.map(m => m.clone())
  const adapter = createCommonHumanRigAdapter(source, reference, models[1].scene)
  assert.throws(() => createCommonHumanRigAdapter(source, reference, models[1].scene), /already owns/)
  adapter.update()
  assert.ok(adapter.verifyRest() < 1e-6)
  assert.equal(adapter.report.commonHumanJoints, 2)
  assert.ok(adapter.report.commonHumanInverseBindResidual < 1e-6)
  assert.equal(adapter.report.sharedMotionImplemented, false)
  assert.equal(adapter.report.productionIntegrationAllowed, false)
  const mixers = models.slice(0, 2).map(m => new AnimationMixer(m.scene))
  const actions = mixers.map((m, i) => {
    const primary = m.clipAction(models[i].animations[0]).setLoop(LoopOnce, 1)
    primary.clampWhenFinished = true; primary.play()
    // A partial second action exercises default/rest contribution as well as
    // quaternion mixing. Translational basis compensation follows the mixer.
    const partial = models[i].animations[0].clone()
    partial.name = 'Partial'
    partial.tracks = partial.tracks.filter(t => t.name.includes('J_Bip_C_Hips.quaternion'))
    partial.tracks[0].values = Float32Array.from(partial.tracks[0].values.map((v, k) => k % 4 < 3 ? -v : v))
    const secondary = m.clipAction(partial).setLoop(LoopOnce, 1)
    secondary.clampWhenFinished = true; secondary.play()
    return [primary, secondary]
  })
  const sample = () => models.slice(0, 2).map(model => {
    const mesh = model.scene.getObjectByName('Body')
    return [0, 1, 2].map(i => mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld))
      .concat([model.scene.getObjectByName('J_Sec_Attachment').getWorldPosition(new Vector3())])
  })
  try {
    for (const weight of [0, .15, .5, .85, 1]) for (let i = 0; i <= 60; i++) {
      models.slice(0, 2).forEach(model => {
        model.scene.position.set(Math.sin(i) * .2, -.1, .3)
        model.scene.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), i / 30)
        model.scene.scale.set(.9, 1.1, 1.05)
      })
      actions.forEach(([primary, secondary]) => { primary.setEffectiveWeight(1 - weight); secondary.setEffectiveWeight(weight) })
      mixers.forEach(m => m.setTime(i / 60))
      models[0].scene.updateMatrixWorld(true)
      models[0].scene.getObjectByName('Body').skeleton.update()
      if (i % 2) {
        adapter.applyPose()
        models[1].scene.updateMatrixWorld(true)
        models[1].scene.getObjectByName('Body').skeleton.update()
      } else adapter.update()
      const [before, after] = sample()
      before.forEach((v, k) => assert.ok(v.distanceTo(after[k]) < 1e-6, `weight ${weight}, frame ${i}, point ${k}`))
      adapter.update()
      const again = sample()[1]
      again.forEach((v, k) => assert.ok(v.distanceTo(after[k]) < 1e-12, 'adapter must be idempotent'))
    }
  } finally { adapter.dispose() }
  const mesh = models[1].scene.getObjectByName('Body')
  mesh.skeleton.boneInverses.forEach((m, i) => assert.deepEqual(m.elements, originalInverse[i].elements))
  for (const name of ['J_Bip_C_Hips', 'J_Bip_L_LowerLeg', 'J_Sec_Attachment']) {
    assert.equal(models[1].scene.getObjectByName(name).matrixAutoUpdate, true)
  }
  const [before, after] = sample()
  before.forEach((v, k) => assert.ok(v.distanceTo(after[k]) < 1e-12, 'dispose restores original animation space'))
  adapter.dispose()
  assert.throws(() => adapter.update(), /Disposed/)
  assert.throws(() => adapter.applyPose(), /Disposed/)
})

test('full-rest adapter rejects invalid reference/current scene before mutating inverse binds', async () => {
  const source = fixture(), model = await load(source)
  const skeleton = model.scene.getObjectByName('Body').skeleton
  const original = skeleton.boneInverses.map(m => m.elements.slice())
  assert.throws(() => createCommonHumanRigAdapter(source, fixture(true, 'LINEAR', j => { j.nodes[2].name = 'Missing' }), model.scene), /every reference joint/)
  assert.throws(() => createCommonHumanRigAdapter(source, fixture(true, 'LINEAR', j => { j.nodes[0].name = 'OtherRoot' }), model.scene), /Parent differs/)
  assert.throws(() => createCommonHumanRigAdapter(source, fixture(true, 'LINEAR', j => { j.nodes[1].translation[1] += .2 }), model.scene), /inverse binds are not common/)
  model.scene.getObjectByName('J_Bip_C_Hips').position.x += .1
  assert.throws(() => createCommonHumanRigAdapter(source, fixture(true), model.scene), /not at source rest/)
  assert.deepEqual(skeleton.boneInverses.map(m => m.elements), original)
})

test('common-rest adapter resolves original glTF attachment names, not sanitized animation names', async () => {
  const source = fixture(false, 'LINEAR', j => { j.nodes[3].name = 'Head Collider' })
  const model = await load(source)
  assert.ok(model.scene.getObjectByName('Head_Collider'))
  const adapter = createCommonHumanRigAdapter(source, fixture(true), model.scene)
  adapter.update()
  assert.ok(adapter.verifyRest() < 1e-6)
  adapter.dispose()
})

test('common-rest proof rejects a loaded skin missing a required human joint', async () => {
  const source = fixture(), model = await load(source)
  const skeleton = model.scene.getObjectByName('Body').skeleton
  skeleton.bones.pop(); skeleton.boneInverses.pop()
  const inverse = skeleton.boneInverses[0].elements.slice()
  assert.throws(() => createCommonHumanRigAdapter(source, fixture(true), model.scene), /Skinned human coverage/)
  assert.deepEqual(skeleton.boneInverses[0].elements, inverse)
})

for (const [options, message] of [
  [['--unknown'], /Unknown verifier option/],
  [['--common-human-setup-only'], /Setup-only requires/],
  [['--common-human-reference='], /Empty or multiple/],
  [['--common-human-cpu'], /CPU mode requires/],
  [['--common-human-export-cpu'], /CPU mode requires/],
  [['--common-human-cpu', '--common-human-setup-only', '--common-human-reference=missing.glb'], /different scopes/],
  [['--common-human-export-cpu', '--common-human-setup-only', '--common-human-reference=missing.glb'], /different scopes/],
  [['--common-human-export-cpu', '--common-human-cpu', '--common-human-reference=missing.glb'], /different scopes/],
  [['--common-human-quick-blends'], /Quick blends require/],
  [['--common-human-quick-blends', '--common-human-setup-only', '--common-human-reference=missing.glb'], /Quick blends require/],
  [['--common-human-quick-blends', '--common-human-export-cpu', '--common-human-reference=missing.glb'], /Quick blends require/],
]) test(`common-rest verifier rejects invalid options before file reads: ${options.join(' ')}`, () => {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', fileURLToPath(new URL('./verify-character-animation-reduction.mjs', import.meta.url)), 'missing.glb', 'missing.glb', ...options], { encoding: 'utf8', timeout: 10000 })
  assert.equal(result.status, 1)
  assert.match(result.stderr, message)
  assert.doesNotMatch(result.stderr, /ENOENT/)
})
