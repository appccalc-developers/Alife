import assert from 'node:assert/strict'
import test from 'node:test'
import { AnimationClip, AnimationMixer, LoopOnce } from '../../cloudflare/alife-app/node_modules/three/build/three.module.js'
import { GLTFLoader } from '../../cloudflare/alife-app/node_modules/three/examples/jsm/loaders/GLTFLoader.js'
import { encodeCharacterGlb as encode, parseCharacterGlb as parse, readAccessor } from './build-character-outfit-atlas-candidate.mjs'
import { extractLodMotion, applyLodMotion, stripLodSkeletalMotion, compactSkeletalMotionStorage, versionLodMotion } from './share-character-lod-motion-candidate.mjs'
import { composeVirtualChurchSharedMotion, VirtualChurchSharedMotionError } from '../../cloudflare/alife-app/src/views/virtualChurchSharedMotion.ts'

function fixture({ dense = false, interpolation = 'LINEAR', morph = .5, mutate = () => {} } = {}) {
  const json = { asset: { version: '2.0' }, buffers: [{}], bufferViews: [], accessors: [],
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'Root', children: [1, 2] },
      { name: 'Hips', translation: [0, 1, 0] }, { name: 'Body', mesh: 0, weights: [0] }],
    meshes: [], animations: [] }
  const parts = []; let length = 0
  const add = (values, type, width) => {
    const bytes = Buffer.from(Float32Array.from(values).buffer), view = json.bufferViews.length
    json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length }); length += bytes.length; parts.push(bytes)
    const id = json.accessors.length
    json.accessors.push({ bufferView: view, componentType: 5126, count: values.length / width, type }); return id
  }
  const position = add([0, 0, 0, 1, 0, 0, 0, 1, 0], 'VEC3', 3), shape = add([0, .1, 0, 0, .2, 0, 0, .3, 0], 'VEC3', 3)
  json.accessors[position].min = [0, 0, 0]; json.accessors[position].max = [1, 1, 0]
  json.accessors[shape].min = [0, .1, 0]; json.accessors[shape].max = [0, .3, 0]
  json.meshes = [{ primitives: [{ attributes: { POSITION: position }, targets: [{ POSITION: shape }] }] }]
  const times = dense ? [0, .5, 1] : [0, 1]
  const values = times.flatMap(t => interpolation === 'CUBICSPLINE' ? [0, 0, 0, t, 1, 0, 0, 0, 0] : [t, 1, 0])
  json.animations = [{ name: 'Move', samplers: [
    { input: add(times, 'SCALAR', 1), output: add(values, 'VEC3', 3), interpolation },
    { input: add([0, 1], 'SCALAR', 1), output: add([0, morph], 'SCALAR', 1), interpolation: 'LINEAR' }],
    channels: [{ sampler: 0, target: { node: 1, path: 'translation' } }, { sampler: 1, target: { node: 2, path: 'weights' } }] }]
  mutate(json)
  return encode(json, Buffer.concat(parts))
}
for (const interpolation of ['LINEAR', 'STEP', 'CUBICSPLINE']) test(`one motion input with ${interpolation} preserves local morphs and geometry`, () => {
  const commonSource = fixture({ interpolation }), target = fixture({ dense: true, interpolation, morph: .8 })
  const snapshot = Buffer.from(target), bundle = extractLodMotion(commonSource), pack = parse(bundle)
  assert.equal(pack.json.meshes, undefined); assert.equal(pack.json.images, undefined)
  assert.equal(pack.json.bufferViews.length, 1)
  assert.equal(pack.json.bufferViews[0].byteStride, undefined)
  assert.equal(pack.json.bufferViews[0].target, undefined)
  assert.equal(pack.json.animations[0].samplers[0].interpolation, interpolation === 'LINEAR' ? undefined : interpolation)
  assert.ok(compactSkeletalMotionStorage(bundle).equals(bundle), 'Storage compaction is idempotent')
  assert.equal(pack.json.animations[0].channels.length, 1)
  const { output, report } = applyLodMotion(target, bundle), final = parse(output), before = parse(target)
  assert.ok(target.equals(snapshot)); assert.equal(report.sharedTracks, 1); assert.equal(report.preservedMorphTracks, 1)
  assert.equal(report.runtimeReleaseAllowed, false)
  const animation = final.json.animations[0]
  assert.deepEqual(Array.from(readAccessor(final.json, final.bin, animation.samplers[0].input)), [0, 1])
  assert.deepEqual(readAccessor(final.json, final.bin, animation.samplers[0].output), readAccessor(pack.json, pack.bin, pack.json.animations[0].samplers[0].output))
  assert.deepEqual(Array.from(readAccessor(final.json, final.bin, animation.samplers[1].output)), [0, Math.fround(.8)])
  for (const get of [j => j.meshes[0].primitives[0].attributes.POSITION, j => j.meshes[0].primitives[0].targets[0].POSITION])
    assert.deepEqual(readAccessor(final.json, final.bin, get(final.json)), readAccessor(before.json, before.bin, get(before.json)))
  assert.ok(applyLodMotion(target, bundle).output.equals(output), 'Deterministic build')
})

test('motion storage coalescing rejects metadata loss, strided data, geometry and unaligned offsets', () => {
  const bundle = extractLodMotion(fixture())
  const edit = change => { const { json, bin } = parse(bundle); change(json); return encode(json, bin) }
  for (const change of [j => { j.bufferViews[0].byteStride = 12 }, j => { j.bufferViews[0].target = 34962 }, j => { j.bufferViews[0].extras = { preserve: true } }])
    assert.throws(() => compactSkeletalMotionStorage(edit(change)), /metadata\/stride\/target/)
  assert.throws(() => compactSkeletalMotionStorage(edit(j => { j.accessors[0].byteOffset = 1 })), /Unaligned/)
  assert.throws(() => compactSkeletalMotionStorage(edit(j => { j.meshes = [{ primitives: [] }] })), /Only skeletal/)
  assert.throws(() => compactSkeletalMotionStorage(edit(j => { j.accessors[0].count = 100000 })), /exceeds/)
})
test('rejects a different body, hierarchy, clip set, interpolation and malformed tracks', () => {
  const bundle = extractLodMotion(fixture())
  for (const mutate of [j => { j.nodes[1].translation[1] = 1.1 }, j => { j.nodes[1].rotation = [0, 1, 0, 0] },
    j => { j.nodes[0].children = [1]; j.nodes[1].children = [2] }])
    assert.throws(() => applyLodMotion(fixture({ mutate }), bundle), /Rest rig differs/)
  assert.throws(() => applyLodMotion(fixture({ mutate: j => { j.animations[0].name = 'Other' } }), bundle), /Clip set differs/)
  assert.throws(() => applyLodMotion(fixture({ interpolation: 'STEP' }), bundle), /Interpolation differs/)
  assert.throws(() => extractLodMotion(fixture({ mutate: j => { j.nodes[2].name = 'Hips' } })), /Unique named rig/)
  assert.throws(() => extractLodMotion(fixture({ mutate: j => { j.nodes[1].children = [0] } })), /Cyclic/)
  assert.throws(() => extractLodMotion(fixture({ mutate: j => { j.animations[0].channels.push(j.animations[0].channels[0]) } })), /Duplicate motion track/)
})
test('resolves tracks by node name rather than incidental node or sampler index', () => {
  const bundle = extractLodMotion(fixture())
  const target = fixture({ dense: true, mutate: j => {
    [j.nodes[1], j.nodes[2]] = [j.nodes[2], j.nodes[1]]
    j.animations[0].channels[0].target.node = 2; j.animations[0].channels[1].target.node = 1
    j.animations[0].samplers.reverse(); j.animations[0].channels.forEach(c => { c.sampler = 1 - c.sampler })
  } })
  const final = parse(applyLodMotion(target, bundle).output)
  assert.equal(final.json.nodes[final.json.animations[0].channels[0].target.node].name, 'Hips')
  const s = final.json.animations[0].samplers[final.json.animations[0].channels[0].sampler]
  assert.deepEqual(Array.from(readAccessor(final.json, final.bin, s.input)), [0, 1])
})

test('motion version follows values, tangents, timing, interpolation and rig, not storage metadata', () => {
  const motion = extractLodMotion(fixture({ interpolation: 'CUBICSPLINE' }))
  const id = parse(motion).json.extras.alifeLodMotion.motionId
  assert.match(id, /^[a-f0-9]{64}$/)
  assert.ok(versionLodMotion(motion).equals(motion))
  const reversion = change => {
    const { json, bin } = parse(motion), copy = Buffer.from(bin)
    change(json, copy)
    return parse(versionLodMotion(encode(json, copy))).json.extras.alifeLodMotion.motionId
  }
  assert.equal(reversion(j => { j.asset.generator = 'Another packer'; j.extras.alifeLodMotion.sourceSha256 = 'a'.repeat(64) }), id)
  assert.notEqual(reversion((j, b) => {
    const accessor = j.accessors[j.animations[0].samplers[0].output]
    b.writeFloatLE(.2, (j.bufferViews[accessor.bufferView].byteOffset ?? 0) + (accessor.byteOffset ?? 0))
  }), id, 'a cubic tangent is part of the version')
  assert.notEqual(reversion((j, b) => {
    const accessor = j.accessors[j.animations[0].samplers[0].input]
    b.writeFloatLE(2, (j.bufferViews[accessor.bufferView].byteOffset ?? 0) + (accessor.byteOffset ?? 0) + 4)
  }), id, 'key timing is part of the version')
  assert.notEqual(reversion(j => { j.nodes[1].translation[1] += .01 }), id)
  const linear = extractLodMotion(fixture()), parsed = parse(linear)
  parsed.json.animations[0].samplers[0].interpolation = 'STEP'
  assert.notEqual(parse(versionLodMotion(encode(parsed.json, parsed.bin))).json.extras.alifeLodMotion.motionId,
    parse(linear).json.extras.alifeLodMotion.motionId)
  assert.throws(() => applyLodMotion(fixture(), encode(parsed.json, parsed.bin)), /Motion content ID differs/)
})

test('same source and rest rig cannot mix old split models with edited motion versions', async () => {
  const source = fixture(), motion = extractLodMotion(source)
  const split = stripLodSkeletalMotion(source, motion).output
  const edited = parse(motion), sampler = edited.json.animations[0].samplers[0]
  const accessor = edited.json.accessors[sampler.output], bin = Buffer.from(edited.bin)
  bin.writeFloatLE(.125, (edited.json.bufferViews[accessor.bufferView].byteOffset ?? 0) + (accessor.byteOffset ?? 0))
  const next = versionLodMotion(encode(edited.json, bin))
  assert.equal(parse(next).json.extras.alifeLodMotion.sourceSha256, parse(motion).json.extras.alifeLodMotion.sourceSha256)
  const load = b => new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), '')
  const [local, changed, matched] = await Promise.all([split, next, stripLodSkeletalMotion(source, next).output].map(load))
  assert.throws(() => composeVirtualChurchSharedMotion(local, changed), /content version differs/)
  assert.equal(composeVirtualChurchSharedMotion(matched, changed).length, 1)
  for (const invalid of [undefined, '', 'wrong', 'A'.repeat(64)]) {
    matched.parser.json.extras.alifeLodMotionBinding.motionId = invalid
    assert.throws(() => composeVirtualChurchSharedMotion(matched, changed), /content version differs/)
  }
  matched.parser.json.extras.alifeLodMotionBinding.version = 1
  assert.throws(() => composeVirtualChurchSharedMotion(matched, changed), /does not match/)
})

for (const interpolation of ['LINEAR', 'STEP', 'CUBICSPLINE']) test(`separate ${interpolation} package binds in real Three with local clothing retained`, async () => {
  const source = fixture({ dense: true, interpolation, morph: .8 })
  const motion = extractLodMotion(fixture({ interpolation }))
  const combined = applyLodMotion(source, motion).output
  const split = stripLodSkeletalMotion(source, motion).output
  const load = bytes => new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), '')
  const [local, baked, shared] = await Promise.all([split, combined, motion].map(load))
  const commonTracks = shared.animations[0].tracks
  const trackValues = commonTracks.map(t => Array.from(t.values))
  const clothing = local.animations[0].tracks.filter(t => t.name.endsWith('.morphTargetInfluences'))
  assert.equal(clothing.length, 1)
  // Keep the loader-created interpolant functions, including glTF cubic splines.
  const assembled = composeVirtualChurchSharedMotion(local, shared)[0]
  assert.ok(assembled instanceof AnimationClip)
  assert.equal(local.animations[0].tracks.length, 1, 'Runtime model contains only clothing, not duplicate skeletal animation')
  const mixers = [[local, assembled], [baked, baked.animations[0]]].map(([model, clip]) => {
    const mixer = new AnimationMixer(model.scene), action = mixer.clipAction(clip).setLoop(LoopOnce, 1)
    action.clampWhenFinished = true; action.play(); return mixer
  })
  for (let i = 0; i <= 60; i++) {
    mixers.forEach(m => m.setTime(i / 60))
    assert.deepEqual(local.scene.getObjectByName('Hips').position.toArray(), baked.scene.getObjectByName('Hips').position.toArray())
    assert.deepEqual(local.scene.getObjectByName('Body').morphTargetInfluences, baked.scene.getObjectByName('Body').morphTargetInfluences)
  }
  assert.deepEqual(commonTracks.map(t => Array.from(t.values)), trackValues, 'Shared source tracks immutable')
  const originalHash = local.parser.json.extras.alifeLodMotionBinding.sourceSha256
  local.parser.json.extras.alifeLodMotionBinding.sourceSha256 = '0'.repeat(64)
  assert.throws(() => composeVirtualChurchSharedMotion(local, shared), error => error instanceof VirtualChurchSharedMotionError && error.gltf === local)
  local.parser.json.extras.alifeLodMotionBinding.sourceSha256 = originalHash
  local.parser.json.nodes[1].translation[1] += .01
  assert.throws(() => composeVirtualChurchSharedMotion(local, shared), /rest rig differs/)
})
