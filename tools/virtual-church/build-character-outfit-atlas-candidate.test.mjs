import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { decompressCharacterDraco } from './gate-a-character-geometry.mjs'
import { atlasBorderIndex, buildOutfitAtlasCandidate, compactCharacterCandidate, compactConstantAnimationKeys, compactBoundedAnimationKeys, selectBoundedAnimationKeys, readAccessor, verifyCharacterAtlasCompression } from './build-character-outfit-atlas-candidate.mjs'
import { QuaternionKeyframeTrack, NumberKeyframeTrack } from '../../cloudflare/alife-app/node_modules/three/build/three.module.js'

// Offline asset tests use the existing image toolchain, not a frontend dependency.
assert.ok(process.env.ALIFE_SHARP_MODULE, 'Set ALIFE_SHARP_MODULE to the installed sharp module')
const sharp = createRequire(import.meta.url)(process.env.ALIFE_SHARP_MODULE)
const parse = b => { const n = b.readUInt32LE(12); return { json: JSON.parse(b.toString('utf8', 20, 20 + n)), bin: b.subarray(n + 28) } }
const encode = (json, bin) => {
  const text = Buffer.from(JSON.stringify(json)), padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32)
  text.copy(padded)
  const h = Buffer.alloc(20), bh = Buffer.alloc(8)
  h.writeUInt32LE(0x46546c67); h.writeUInt32LE(2, 4); h.writeUInt32LE(28 + padded.length + bin.length, 8)
  h.writeUInt32LE(padded.length, 12); h.writeUInt32LE(0x4e4f534a, 16)
  bh.writeUInt32LE(bin.length); bh.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([h, padded, bh, bin])
}
async function fixture(change = () => {}, { count = 2, size = 4 } = {}) {
  const chunks = [], json = { asset: { version: '2.0' }, buffers: [{}], bufferViews: [], accessors: [], images: [], textures: [],
    materials: [], nodes: [{ mesh: 0, skin: 0, weights: [0] }, { name: 'Hips' }], skins: [{ joints: [1] }],
    animations: [], meshes: [{ weights: [0], primitives: [] }] }
  let length = 0
  const view = bytes => { const pad = (4 - length % 4) % 4; chunks.push(Buffer.alloc(pad)); length += pad
    json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length }); chunks.push(bytes); length += bytes.length; return json.bufferViews.length - 1 }
  const accessor = (values, type, componentType = 5126) => {
    const count = values.length / ({ VEC2: 2, VEC3: 3, VEC4: 4, SCALAR: 1 }[type])
    json.accessors.push({ bufferView: view(Buffer.from(values.buffer)), count, type, componentType }); return json.accessors.length - 1
  }
  for (let i = 0; i < count; i++) {
    const tileSize = Array.isArray(size) ? size[i] : size
    const png = await sharp({ create: { width: tileSize, height: tileSize, channels: 4, background: i ? '#123456' : '#fedcba' } }).png().toBuffer()
    json.images.push({ bufferView: view(png), mimeType: 'image/png' }); json.textures.push({ source: i })
    json.materials.push({ name: `Test_CLOTH_${i}`, alphaMode: 'MASK', doubleSided: true, pbrMetallicRoughness: { baseColorTexture: { index: i } } })
    const attributes = {
      POSITION: accessor(new Float32Array([i, 0, 0, i, 1, 0, i + 1, 0, 0]), 'VEC3'),
      NORMAL: accessor(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 'VEC3'),
      TEXCOORD_0: accessor(new Float32Array([0, 0, 0, 1, 1, 0]), 'VEC2'),
      JOINTS_0: accessor(new Uint16Array(12), 'VEC4', 5123),
      WEIGHTS_0: accessor(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]), 'VEC4'),
    }
    const target = json.accessors.length
    json.accessors.push({ count: 3, type: 'VEC3', componentType: 5126, sparse: { count: 1,
      indices: { bufferView: view(Buffer.from([1])), componentType: 5121 },
      values: { bufferView: view(Buffer.from(new Float32Array([0, .1 * (i + 1), 0]).buffer)) } } })
    json.meshes[0].primitives.push({ attributes, material: i, indices: accessor(new Uint16Array([0, 1, 2]), 'SCALAR', 5123), targets: [{ POSITION: target }] })
  }
  const time = accessor(new Float32Array([0, 1]), 'SCALAR'), weights = accessor(new Float32Array([0, 1]), 'SCALAR')
  json.animations.push({ name: 'Walk', samplers: [{ input: time, output: weights }], channels: [{ sampler: 0, target: { node: 0, path: 'weights' } }] })
  change(json, chunks)
  json.buffers[0].byteLength = length
  return encode(json, Buffer.concat(chunks))
}

async function animationFixture(interpolation = 'LINEAR', invalidTimes = false) {
  const { json, bin } = parse(await fixture())
  const chunks = [bin]; let length = bin.length
  const add = (array, type) => {
    const pad = (4 - length % 4) % 4; chunks.push(Buffer.alloc(pad)); length += pad
    const bytes = Buffer.from(array.buffer)
    json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length })
    chunks.push(bytes); length += bytes.length
    json.accessors.push({ type, count: array.length / (type === 'VEC4' ? 4 : 1), componentType: 5126, bufferView: json.bufferViews.length - 1 })
    return json.accessors.length - 1
  }
  const times = Float32Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8])
  if (invalidTimes) times[4] = times[3]
  const input = add(times, 'SCALAR')
  const values = [0, 0, 0, .5, 1, 1, 1, .5, 0]
  const weights = add(Float32Array.from(values.flatMap(x => [x, 1 - x])), 'SCALAR')
  const rotations = add(Float32Array.from(values.flatMap(x => [0, Math.sin(x / 2), 0, Math.cos(x / 2)])), 'VEC4')
  json.animations = [{ name: 'Plateaus', samplers: [
    { input, output: weights, interpolation }, { input, output: rotations, interpolation },
  ], channels: [{ sampler: 0, target: { node: 0, path: 'weights' } }, { sampler: 1, target: { node: 1, path: 'rotation' } }] }]
  json.buffers[0].byteLength = length
  return encode(json, Buffer.concat(chunks))
}

const skinFixture = (change = () => {}) => fixture(j => {
  j.materials[0].name = 'N00_000_00_Body_00_SKIN (Instance)'
  j.materials[0].doubleSided = false
  j.materials[1].name = 'N00_000_00_Face_00_SKIN (Instance)'
  const face = j.meshes[0].primitives.pop()
  delete face.targets
  j.materials.push({ ...structuredClone(j.materials[1]), name: 'ProtectedEyeHighlight', alphaMode: 'BLEND' })
  j.meshes.push({ primitives: [face, { ...structuredClone(face), material: 2 }] })
  j.nodes.push({ mesh: 1, skin: 0 })
  change(j)
})

test('optional mip-safe atlas keeps original texels and geometry while aligning tiles and outer mip dimensions', async () => {
  const original = await fixture()
  const normal = await buildOutfitAtlasCandidate(original, sharp)
  const aligned = await buildOutfitAtlasCandidate(original, sharp, { mipSafe: true })
  assert.equal(normal.report.atlas.gutter, 8, 'default candidates stay reproducible')
  assert.equal(normal.report.atlas.mipSafe, false)
  assert.equal(aligned.report.atlas.gutter, 32)
  assert.equal(aligned.report.atlas.mipSafe, true)
  for (const size of [aligned.report.atlas.width, aligned.report.atlas.height]) assert.equal(size & (size - 1), 0)
  const before = parse(original), after = parse(aligned.output)
  assert.deepEqual(after.json.animations, before.json.animations)
  assert.deepEqual(after.json.nodes, before.json.nodes)
  assert.deepEqual(after.json.skins, before.json.skins)
  const merged = after.json.meshes[0].primitives[0]
  const image = after.json.images.at(-1), view = after.json.bufferViews[image.bufferView]
  const pixels = await sharp(after.bin.subarray(view.byteOffset, view.byteOffset + view.byteLength)).raw().toBuffer()
  const uv = readAccessor(after.json, after.bin, merged.attributes.TEXCOORD_0)
  let offset = 0
  for (const part of before.json.meshes[0].primitives) {
    const oldImage = before.json.images[part.material], oldView = before.json.bufferViews[oldImage.bufferView]
    const originalPixels = await sharp(before.bin.subarray(oldView.byteOffset, oldView.byteOffset + oldView.byteLength)).raw().toBuffer()
    const x = Math.round(uv[offset * 2] * aligned.report.atlas.width), y = Math.round(uv[offset * 2 + 1] * aligned.report.atlas.height)
    assert.equal(x % 32, 0); assert.equal(y % 32, 0)
    for (let row = 0; row < 4; row++) {
      const begin = ((y + row) * aligned.report.atlas.width + x) * 4
      assert.deepEqual(pixels.subarray(begin, begin + 16), originalPixels.subarray(row * 16, row * 16 + 16))
    }
    for (const key of ['POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0']) {
      const expected = readAccessor(before.json, before.bin, part.attributes[key])
      const width = key === 'JOINTS_0' || key === 'WEIGHTS_0' ? 4 : 3
      assert.deepEqual(readAccessor(after.json, after.bin, merged.attributes[key]).subarray(offset * width, offset * width + expected.length), expected)
    }
    offset += before.json.accessors[part.attributes.POSITION].count
  }
})

test('mip-safe Medium grid halves padded area without resizing tiles or moving UV texel positions', async () => {
  const original = await fixture(() => {}, { count: 7, size: 384 })
  const { output, report } = await buildOutfitAtlasCandidate(original, sharp, { mipSafe: true })
  assert.deepEqual([report.atlas.width, report.atlas.height], [1024, 2048])
  assert.equal(report.atlas.gutter, 32)
  const before = parse(original), after = parse(output)
  assert.deepEqual(after.json.nodes, before.json.nodes)
  assert.deepEqual(after.json.animations, before.json.animations)
  const uv = readAccessor(after.json, after.bin, after.json.meshes[0].primitives[0].attributes.TEXCOORD_0)
  const view = after.json.bufferViews[after.json.images.at(-1).bufferView]
  const pixels = await sharp(after.bin.subarray(view.byteOffset, view.byteOffset + view.byteLength)).raw().toBuffer()
  for (let tile = 0; tile < 7; tile++) {
    const x = tile % 2 * 448 + 32, y = Math.floor(tile / 2) * 448 + 32
    assert.equal(uv[tile * 6] * 1024, x)
    assert.equal(uv[tile * 6 + 1] * 2048, y)
    assert.equal(uv[tile * 6 + 4] * 1024, x + 384)
    assert.equal(uv[tile * 6 + 3] * 2048, y + 384)
    const oldView = before.json.bufferViews[before.json.images[tile].bufferView]
    const expected = await sharp(before.bin.subarray(oldView.byteOffset, oldView.byteOffset + oldView.byteLength)).raw().toBuffer()
    for (let row = 0; row < 384; row++) {
      const start = ((y + row) * 1024 + x) * 4
      assert.deepEqual(pixels.subarray(start, start + 384 * 4), expected.subarray(row * 384 * 4, (row + 1) * 384 * 4))
    }
  }
})

test('mixed-size High outfit packs into half the padded area with exact texels, gutters and UVs', async () => {
  const sizes = [1024, 1024, 1024, 512]
  const original = await fixture(() => {}, { count: sizes.length, size: sizes })
  const { output, report } = await buildOutfitAtlasCandidate(original, sharp, { mipSafe: true })
  assert.equal(report.atlas.width * report.atlas.height, 4096 * 2048)
  const before = parse(original), after = parse(output), merged = after.json.meshes[0].primitives[0]
  const uv = readAccessor(after.json, after.bin, merged.attributes.TEXCOORD_0)
  const view = after.json.bufferViews[after.json.images.at(-1).bufferView]
  const pixels = await sharp(after.bin.subarray(view.byteOffset, view.byteOffset + view.byteLength)).raw().toBuffer()
  const boxes = sizes.map((size, i) => ({ x: uv[i * 6] * report.atlas.width, y: uv[i * 6 + 1] * report.atlas.height, size }))
  for (const [i, box] of boxes.entries()) {
    assert.equal(box.x % 32, 0); assert.equal(box.y % 32, 0)
    assert.ok(box.x >= 32 && box.y >= 32 && box.x + box.size + 32 <= report.atlas.width && box.y + box.size + 32 <= report.atlas.height)
    assert.equal(uv[i * 6 + 4] * report.atlas.width, box.x + box.size)
    assert.equal(uv[i * 6 + 3] * report.atlas.height, box.y + box.size)
    for (const other of boxes.slice(i + 1)) assert.ok(box.x + box.size + 64 <= other.x || other.x + other.size + 64 <= box.x || box.y + box.size + 64 <= other.y || other.y + other.size + 64 <= box.y)
    const oldView = before.json.bufferViews[before.json.images[i].bufferView]
    const expected = await sharp(before.bin.subarray(oldView.byteOffset, oldView.byteOffset + oldView.byteLength)).raw().toBuffer()
    for (let row = 0; row < box.size; row++) {
      const start = ((box.y + row) * report.atlas.width + box.x) * 4
      assert.deepEqual(pixels.subarray(start, start + box.size * 4), expected.subarray(row * box.size * 4, (row + 1) * box.size * 4))
    }
  }
  for (const key of ['nodes', 'skins', 'animations']) assert.deepEqual(after.json[key], before.json[key])
  assert.ok((await buildOutfitAtlasCandidate(original, sharp, { mipSafe: true })).output.equals(output))
})

test('mixed raw outfit and original Draco parts verify without weakening strict release decoding', async () => {
  const original = await readFile(new URL('../../cloudflare/alife-app/public/virtual-church-assets/v3/releases/gate-a-baseline-r9/characters/character-hero-female-low.glb', import.meta.url))
  const atlas = await buildOutfitAtlasCandidate(original, sharp, { mipSafe: true })
  assert.equal(atlas.report.originalUsedMaterials, 18)
  assert.equal(atlas.report.candidateUsedMaterials, 12)
  assert.equal(atlas.report.retainedDracoPrimitives, 11)
  const compacted = compactCharacterCandidate(atlas.output).output
  await assert.rejects(decompressCharacterDraco(compacted), /not Draco compressed/)
  const verified = await verifyCharacterAtlasCompression(atlas.output, compacted)
  assert.equal(verified.copiedPrimitives, 11)
  assert.equal(verified.decodedPrimitives, 1)
  assert.equal(verified.rigAndAnimationValuesExact, true)
  Object.values(verified.maximumComponentErrors).forEach(error => assert.equal(error, 0))
})

test('male outfit atlas preserves the accepted unmorphed wardrobe, rig and all animations', async () => {
  const original = await readFile(new URL('../../cloudflare/alife-app/public/virtual-church-assets/v3/releases/male-hero-v14-r1/characters/character-hero-male-medium.glb', import.meta.url))
  const atlas = await buildOutfitAtlasCandidate(original, sharp, { mipSafe: true })
  assert.equal(atlas.report.originalUsedMaterials, 13)
  assert.equal(atlas.report.candidateUsedMaterials, 10)
  assert.equal(atlas.report.mergedPartsBefore, 4)
  assert.equal(atlas.report.morphTargets, 0)
  assert.equal(atlas.report.retainedDracoPrimitives, 9)
  assert.equal(parse(atlas.output).json.animations.length, 14)
  const verified = await verifyCharacterAtlasCompression(atlas.output, compactCharacterCandidate(atlas.output).output)
  assert.equal(verified.copiedPrimitives, 9)
  assert.equal(verified.decodedPrimitives, 1)
  assert.equal(verified.rigAndAnimationValuesExact, true)
  Object.values(verified.maximumComponentErrors).forEach(error => assert.equal(error, 0))
})

test('skin candidate joins identically bound sibling geometry without moving face vertices with clothes', async () => {
  const raw = await skinFixture(), before = parse(raw)
  const { output, report } = await buildOutfitAtlasCandidate(raw, sharp, { group: 'skin' })
  const after = parse(output), p = after.json.meshes[0].primitives[0]
  assert.equal(report.originalUsedMaterials, 3)
  assert.equal(report.candidateUsedMaterials, 2)
  assert.equal(report.bodyBackfacesEnabled, true)
  assert.equal(report.churchUnlitSkinRuntimeOnly, true)
  assert.equal(report.visualEquivalenceVerified, false)
  assert.deepEqual(after.json.nodes, before.json.nodes)
  assert.deepEqual(after.json.skins, before.json.skins)
  assert.deepEqual(after.json.animations, before.json.animations)
  assert.deepEqual(after.json.meshes[1].primitives, before.json.meshes[1].primitives.slice(1))
  assert.deepEqual(after.json.materials[2], before.json.materials[2])
  const deltas = [...readAccessor(after.json, after.bin, p.targets[0].POSITION)]
  assert.deepEqual(deltas.slice(0, 9), [...readAccessor(before.json, before.bin, before.json.meshes[0].primitives[0].targets[0].POSITION)])
  assert.deepEqual(deltas.slice(9), Array(9).fill(0))
  for (const key of ['POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0']) {
    assert.deepEqual([...readAccessor(after.json, after.bin, p.attributes[key])],
      [before.json.meshes[0].primitives[0], before.json.meshes[1].primitives[0]].flatMap(p => [...readAccessor(before.json, before.bin, p.attributes[key])]))
  }
  assert.ok((await buildOutfitAtlasCandidate(raw, sharp, { group: 'skin' })).output.equals(output))
})

test('skin candidate rejects different transforms/bindings, face motion and unsupported alpha', async () => {
  for (const [change, error] of [
    [j => { j.nodes[2].translation = [0, .1, 0] }, /transforms differ/],
    [j => { j.nodes[2].skin = 1 }, /bindings differ/],
    [j => { j.nodes[1].children = [2] }, /parents differ/],
    [j => { j.animations[0].channels[0].target.node = 2 }, /Animated face node/],
    [j => { j.animations[0].channels[0].target.path = 'translation' }, /Animated body transform/],
    [j => { j.meshes[1].primitives[0].targets = j.meshes[0].primitives[0].targets }, /Animated face morphs/],
    [j => { j.materials[1].alphaMode = 'BLEND' }, /accepted cutout skin/],
    [j => { j.nodes.push({ mesh: 1, skin: 0 }) }, /Instanced skin mesh/],
  ]) await assert.rejects(buildOutfitAtlasCandidate(await skinFixture(change), sharp, { group: 'skin' }), error)
})

test('skin atlas bakes only the runtime-opaque face alpha, never changes RGB or body cutouts', async () => {
  const { json, bin } = parse(await skinFixture())
  const rgba = Buffer.from(Array.from({ length: 16 }, (_, i) => [17 + i, 40, 80, i * 17]).flat())
  const png = await sharp(rgba, { raw: { width: 4, height: 4, channels: 4 } }).png().toBuffer()
  json.bufferViews.push({ buffer: 0, byteOffset: bin.length, byteLength: png.length })
  json.images.forEach(im => { im.bufferView = json.bufferViews.length - 1 })
  const input = encode(json, Buffer.concat([bin, png]))
  const { output, report } = await buildOutfitAtlasCandidate(input, sharp, { group: 'skin' })
  const after = parse(output), image = after.json.images.at(-1), view = after.json.bufferViews[image.bufferView]
  const pixels = await sharp(after.bin.subarray(view.byteOffset, view.byteOffset + view.byteLength)).ensureAlpha().raw().toBuffer()
  assert.equal(report.atlas.pixelExact, false, 'source alpha changed deliberately; never claim all source pixels exact')
  for (let part = 0; part < 2; part++) for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const start = ((8 + y) * report.atlas.width + 8 + part * 20 + x) * 4
    const source = rgba.subarray((y * 4 + x) * 4, (y * 4 + x) * 4 + 4)
    assert.deepEqual(pixels.subarray(start, start + 3), source.subarray(0, 3))
    assert.equal(pixels[start + 3], part ? 255 : source[3])
  }
})

test('constant-key compaction preserves endpoints, shared inputs and real Three interpolants', async () => {
  const raw = await animationFixture(), copy = Buffer.from(raw), before = parse(raw)
  const { output, report } = compactConstantAnimationKeys(raw), after = parse(output)
  assert.ok(raw.equals(copy), 'Source must not be mutated')
  assert.equal(report.removedKeys, 4)
  assert.equal(report.changedSamplers, 2)
  assert.deepEqual(after.json.nodes, before.json.nodes)
  assert.deepEqual(after.json.skins.map(s => s.joints), before.json.skins.map(s => s.joints))
  assert.deepEqual(after.json.animations[0].channels, before.json.animations[0].channels)
  for (let i = 0; i < 2; i++) {
    const make = data => {
      const s = data.json.animations[0].samplers[i]
      const time = readAccessor(data.json, data.bin, s.input), values = readAccessor(data.json, data.bin, s.output)
      assert.equal(time[0], 0); assert.equal(time.at(-1), 8)
      return new (i ? QuaternionKeyframeTrack : NumberKeyframeTrack)('track', time, values).createInterpolant()
    }
    const a = make(before), b = make(after)
    for (let n = -10; n <= 1610; n++) {
      const actual = b.evaluate(n / 200), expected = a.evaluate(n / 200)
      actual.forEach((v, c) => assert.ok(Math.abs(v - expected[c]) <= 1e-7, `Track ${i}, sample ${n}, component ${c}`))
    }
  }
  assert.ok(compactConstantAnimationKeys(output).output.equals(output), 'Repeated compaction must be idempotent')
})

test('constant-key compaction skips STEP/CUBICSPLINE and rejects duplicate input times', async () => {
  for (const interpolation of ['STEP', 'CUBICSPLINE']) {
    const raw = await animationFixture(interpolation)
    assert.equal(compactConstantAnimationKeys(raw).report.removedKeys, 0)
  }
  const invalid = await animationFixture('LINEAR', true)
  assert.throws(() => compactConstantAnimationKeys(invalid), /strictly increase/)
})

test('constant-key compaction retains signed-zero changes instead of treating them as equal', async () => {
  const { json, bin } = parse(await animationFixture())
  const accessor = json.accessors[json.animations[0].samplers[0].output]
  const view = json.bufferViews[accessor.bufferView]
  bin.writeFloatLE(-0, view.byteOffset + 2 * 4)
  const { output, report } = compactConstantAnimationKeys(encode(json, bin)), after = parse(output)
  assert.equal(report.removedKeys, 3)
  const values = readAccessor(after.json, after.bin, after.json.animations[0].samplers[0].output)
  assert.ok(Object.is(values[2], -0))
})

test('bounded skeletal candidate preserves morph tracks, endpoint timing and source data', async () => {
  const raw = await animationFixture(), sourceCopy = Buffer.from(raw), before = parse(raw)
  const { output, report } = compactBoundedAnimationKeys(raw), after = parse(output)
  assert.ok(raw.equals(sourceCopy))
  assert.ok(report.removedKeys > 0)
  assert.equal(report.morphTracksExact, true)
  assert.equal(report.runtimeReleaseAllowed, false)
  assert.equal(report.sampledVerification.skinnedWorldSpaceVerified, false)
  const originalWeights = before.json.animations[0].samplers[0], actualWeights = after.json.animations[0].samplers[0]
  for (const key of ['input', 'output']) assert.deepEqual(readAccessor(before.json, before.bin, originalWeights[key]), readAccessor(after.json, after.bin, actualWeights[key]))
  const originalRot = before.json.animations[0].samplers[1], actualRot = after.json.animations[0].samplers[1]
  const a = readAccessor(before.json, before.bin, originalRot.input), b = readAccessor(after.json, after.bin, actualRot.input)
  assert.deepEqual(b.slice(0, 2), a.slice(0, 2)); assert.deepEqual(b.slice(-2), a.slice(-2))
})

test('bounded reducer keeps an interior movement spike and refuses non-skeletal or invalid data', () => {
  const times = Float32Array.from({ length: 9 }, (_, i) => i / 30)
  const straight = new Float32Array(27)
  assert.deepEqual(selectBoundedAnimationKeys(times, straight, 'translation'), [0,1,7,8])
  straight[4 * 3] = .1
  assert.ok(selectBoundedAnimationKeys(times, straight, 'translation').includes(4))
  assert.throws(() => selectBoundedAnimationKeys(times, straight, 'weights'), /skeletal/)
  times[4] = times[3]
  assert.throws(() => selectBoundedAnimationKeys(times, straight, 'translation'), /strictly increase/)
})

test('outfit atlas preserves skinning, indices, sparse morphs, animation bytes and source pixels', async () => {
  const raw = await fixture(), original = Buffer.from(raw), before = parse(raw)
  const { output, report } = await buildOutfitAtlasCandidate(raw, sharp), after = parse(output)
  assert.ok(raw.equals(original))
  assert.equal(report.candidateUsedMaterials, 1)
  assert.equal(report.runtimeReleaseAllowed, false)
  for (const key of ['nodes', 'skins', 'animations']) assert.deepEqual(after.json[key], before.json[key])
  assert.ok(after.bin.subarray(0, before.bin.length).equals(before.bin))
  const merged = after.json.meshes[0].primitives[0], parts = before.json.meshes[0].primitives
  for (const semantic of ['POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0']) {
    assert.deepEqual([...readAccessor(after.json, after.bin, merged.attributes[semantic])], parts.flatMap(p => [...readAccessor(before.json, before.bin, p.attributes[semantic])]))
  }
  assert.deepEqual([...readAccessor(after.json, after.bin, merged.indices)], [0, 1, 2, 3, 4, 5])
  assert.deepEqual([...readAccessor(after.json, after.bin, merged.targets[0].POSITION)], parts.flatMap(p => [...readAccessor(before.json, before.bin, p.targets[0].POSITION)]))
  const image = after.json.images.at(-1), v = after.json.bufferViews[image.bufferView]
  const atlas = await sharp(after.bin.subarray(v.byteOffset, v.byteOffset + v.byteLength)).raw().toBuffer()
  const uv = readAccessor(after.json, after.bin, merged.attributes.TEXCOORD_0)
  for (let i = 0; i < 2; i++) {
    // Original (0,0) maps to the first texel of its own tile, not its neighbor.
    const x = Math.round(uv[i * 6] * report.atlas.width), y = Math.round(uv[i * 6 + 1] * report.atlas.height)
    const start = (y * report.atlas.width + x) * 4
    assert.deepEqual([...atlas.subarray(start, start + 4)], i ? [18, 52, 86, 255] : [254, 220, 186, 255])
  }
})

test('different tint/render states are rejected instead of silently changing the outfit', async () => {
  await assert.rejects(buildOutfitAtlasCandidate(await fixture(j => { j.materials[1].pbrMetallicRoughness.baseColorFactor = [.5, 1, 1, 1] }), sharp), /render states differ/)
})

test('face line atlas preserves transparent parameters and leaves skin and eye highlights independent', async () => {
  const raw = await fixture(j => {
    const names = ['EyeHighlight_00_EYE', 'FaceBrow_00_FACE', 'FaceEyeline_00_FACE']
    j.materials.push(structuredClone(j.materials[1]))
    j.materials.forEach((m, i) => { m.name = `N00_000_00_${names[i]} (Instance)`; m.alphaMode = 'BLEND' })
    const mesh = j.meshes[0]
    mesh.primitives.push({ ...structuredClone(mesh.primitives[1]), material: 2 })
    mesh.primitives.forEach(p => { delete p.targets })
    delete mesh.weights
    // An unselected skin surface must remain a separate primitive and material.
    j.materials.push({ name: 'N00_000_00_Face_00_SKIN (Instance)', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } })
    mesh.primitives.push({ ...structuredClone(mesh.primitives[0]), material: 3 })
  })
  const before = parse(raw), { output, report } = await buildOutfitAtlasCandidate(raw, sharp, { group: 'face-lines' }), after = parse(output)
  assert.equal(report.candidateUsedMaterials, 3)
  assert.equal(report.mergedPartsBefore, 2)
  assert.equal(after.json.meshes[0].primitives.length, 3)
  assert.deepEqual(after.json.materials[3], before.json.materials[3])
  assert.deepEqual(after.json.meshes[0].primitives[2], before.json.meshes[0].primitives[3])
  assert.deepEqual(after.json.meshes[0].primitives[0], before.json.meshes[0].primitives[0])
  assert.deepEqual(after.json.materials[0], before.json.materials[0])
  assert.equal(after.json.materials[1].alphaMode, 'BLEND')
  assert.equal(after.json.materials[1].doubleSided, true)
  const p = after.json.meshes[0].primitives[1]
  assert.deepEqual([...readAccessor(after.json, after.bin, p.indices)], [0,1,2,3,4,5])
  assert.deepEqual([...readAccessor(after.json, after.bin, p.attributes.POSITION)], before.json.meshes[0].primitives.slice(1,3).flatMap(p => [...readAccessor(before.json, before.bin, p.attributes.POSITION)]))
  const mismatch = parse(raw); mismatch.json.materials[1].doubleSided = false
  await assert.rejects(buildOutfitAtlasCandidate(encode(mismatch.json, mismatch.bin), sharp, { group: 'face-lines' }), /false|render states differ/)
  await assert.rejects(buildOutfitAtlasCandidate(raw, sharp, { group: 'face-overlay' }), /Unknown atlas group/)
  await assert.rejects(buildOutfitAtlasCandidate(raw, sharp, { group: 'all' }), /Unknown atlas group/)
})

test('opaque face atlas merges only mouth/eye whites and preserves skin and transparent eyes', async () => {
  const make = async change => fixture(j => {
    j.materials.forEach((m, i) => {
      m.name = `N00_000_00_${i ? 'EyeWhite_00_EYE' : 'FaceMouth_00_FACE'} (Instance)`
      delete m.doubleSided
    })
    const mesh = j.meshes[0]
    mesh.primitives.forEach(p => { delete p.targets })
    delete mesh.weights; delete j.nodes[0].weights; j.animations = []
    for (const name of ['Face_00_SKIN', 'EyeIris_00_EYE', 'EyeHighlight_00_EYE', 'FaceBrow_00_FACE']) {
      j.materials.push({ name: `N00_000_00_${name} (Instance)`, alphaMode: 'BLEND', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } })
      mesh.primitives.push({ ...structuredClone(mesh.primitives[0]), material: j.materials.length - 1 })
    }
    change?.(j)
  })
  const raw = await make(), source = Buffer.from(raw), before = parse(raw)
  const { output, report } = await buildOutfitAtlasCandidate(raw, sharp, { group: 'face-opaque' }), after = parse(output)
  assert.ok(raw.equals(source))
  assert.equal(report.mergedPartsBefore, 2)
  assert.equal(report.candidateUsedMaterials, 5)
  assert.equal(report.morphTargets, 0)
  const merged = after.json.meshes[0].primitives[0]
  for (const key of ['POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0']) {
    assert.deepEqual([...readAccessor(after.json, after.bin, merged.attributes[key])],
      before.json.meshes[0].primitives.slice(0, 2).flatMap(p => [...readAccessor(before.json, before.bin, p.attributes[key])]))
  }
  assert.deepEqual(after.json.meshes[0].primitives.slice(1), before.json.meshes[0].primitives.slice(2))
  assert.deepEqual(after.json.materials.slice(2), before.json.materials.slice(2))
  assert.equal(after.json.images.at(-1).name, 'Alife_FaceOpaque_Atlas_Candidate')
  await assert.rejects(buildOutfitAtlasCandidate(await make(j => { j.materials[0].alphaMode = 'BLEND' }), sharp, { group: 'face-opaque' }), /MASK/)
  await assert.rejects(buildOutfitAtlasCandidate(await make(j => { j.materials[1].doubleSided = true }), sharp, { group: 'face-opaque' }), /render states differ/)
  const alphaSource = parse(raw)
  const translucent = await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 254, g: 220, b: 186, alpha: .5 } } }).png().toBuffer()
  const alphaView = alphaSource.json.bufferViews[alphaSource.json.images[0].bufferView]
  alphaView.byteOffset = alphaSource.bin.length; alphaView.byteLength = translucent.length
  alphaSource.json.buffers[0].byteLength = alphaSource.bin.length + translucent.length
  await assert.rejects(buildOutfitAtlasCandidate(encode(alphaSource.json, Buffer.concat([alphaSource.bin, translucent])), sharp, { group: 'face-opaque' }), /must not remove visible alpha/)
})

test('atlas gutters preserve repeat, clamp and mirrored source sampler boundaries', () => {
  assert.deepEqual([-2, -1, 0, 3, 4, 5].map(i => atlasBorderIndex(i, 4)), [2, 3, 0, 3, 0, 1])
  assert.deepEqual([-2, -1, 0, 3, 4, 5].map(i => atlasBorderIndex(i, 4, 33071)), [0, 0, 0, 3, 3, 3])
  assert.deepEqual([-2, -1, 0, 3, 4, 5].map(i => atlasBorderIndex(i, 4, 33648)), [1, 0, 0, 3, 3, 2])
})

test('mismatched morph channels cannot drop the accepted cloth motion', async () => {
  await assert.rejects(buildOutfitAtlasCandidate(await fixture(j => { delete j.meshes[0].primitives[1].targets }), sharp), /Morph channel count differs/)
})

test('compaction removes unreachable data, remaps animation accessors and preserves rendered values', async () => {
  const { output: candidate } = await buildOutfitAtlasCandidate(await fixture(), sharp)
  const before = parse(candidate), { output, report } = compactCharacterCandidate(candidate), after = parse(output)
  assert.ok(output.length < candidate.length)
  assert.equal(after.json.materials.length, 1)
  assert.equal(after.json.images.length, 1)
  assert.ok(report.accessorsVerified > 0)
  assert.deepEqual(after.json.nodes, before.json.nodes)
  assert.deepEqual(after.json.skins, before.json.skins)
  for (const [i, m] of before.json.meshes.entries()) for (const [j, p] of m.primitives.entries()) {
    const q = after.json.meshes[i].primitives[j]
    for (const semantic of Object.keys(p.attributes)) assert.deepEqual(readAccessor(after.json, after.bin, q.attributes[semantic]), readAccessor(before.json, before.bin, p.attributes[semantic]))
    assert.deepEqual(readAccessor(after.json, after.bin, q.indices), readAccessor(before.json, before.bin, p.indices))
  }
  for (const [i, a] of before.json.animations.entries()) for (const [j, s] of a.samplers.entries()) for (const key of ['input', 'output']) {
    assert.deepEqual(readAccessor(after.json, after.bin, after.json.animations[i].samplers[j][key]), readAccessor(before.json, before.bin, s[key]))
  }
  assert.ok(compactCharacterCandidate(output).output.equals(output), 'Compaction must be idempotent')
})

test('compaction refuses unknown extension references instead of pruning potentially live data', async () => {
  const { output } = await buildOutfitAtlasCandidate(await fixture(), sharp), data = parse(output)
  data.json.extensionsUsed = ['UNKNOWN_accessor_extension']
  assert.throws(() => compactCharacterCandidate(encode(data.json, data.bin)), /Unmapped extension/)
})

test('descriptor deduplication merges exact views but preserves different stride metadata', async () => {
  const raw = await fixture(), { output, report } = compactCharacterCandidate(raw), after = parse(output)
  assert.ok(report.deduplicatedViewDescriptors > 0)
  assert.equal(new Set(after.json.bufferViews.map(v => JSON.stringify(v))).size, after.json.bufferViews.length)
  const source = parse(raw), normal = source.json.meshes[0].primitives.map(p => p.attributes.NORMAL)
  source.json.bufferViews[source.json.accessors[normal[1]].bufferView].byteStride = 12
  const differing = parse(compactCharacterCandidate(encode(source.json, source.bin)).output)
  const normalViews = differing.json.meshes[0].primitives.map(p => differing.json.accessors[p.attributes.NORMAL].bufferView)
  assert.notEqual(normalViews[0], normalViews[1])
  assert.equal(differing.json.bufferViews[normalViews[1]].byteStride, 12)
  assert.ok(compactCharacterCandidate(output).output.equals(output))
})

test('accessor deduplication preserves metadata and never aliases implicit Draco attributes', async () => {
  const raw = await fixture(), { output, report } = compactCharacterCandidate(raw), after = parse(output)
  assert.ok(report.deduplicatedAccessorDescriptors > 0)
  const normals = after.json.meshes[0].primitives.map(p => p.attributes.NORMAL)
  assert.equal(normals[0], normals[1], 'equal readable descriptors share an accessor')
  assert.ok(compactCharacterCandidate(output).output.equals(output))

  const labelled = await fixture(j => {
    j.meshes[0].primitives.forEach((p, i) => { j.accessors[p.attributes.NORMAL].extras = { label: `normal ${i}` } })
  })
  const named = parse(compactCharacterCandidate(labelled).output)
  const names = named.json.meshes[0].primitives.map(p => p.attributes.NORMAL)
  assert.notEqual(names[0], names[1], 'same values do not permit metadata loss')

  // Structural compactor fixture; no claim that this dummy payload is Draco.
  const implicit = await fixture(j => {
    for (const p of j.meshes[0].primitives) {
      const a = j.accessors[p.attributes.NORMAL], view = a.bufferView
      delete a.bufferView
      p.extensions = { KHR_draco_mesh_compression: { bufferView: view, attributes: { NORMAL: 0 } } }
    }
    j.extensionsUsed = ['KHR_draco_mesh_compression']
  })
  const kept = parse(compactCharacterCandidate(implicit).output)
  const ids = kept.json.meshes[0].primitives.map(p => p.attributes.NORMAL)
  assert.notEqual(ids[0], ids[1], 'per-primitive compressed values cannot be inferred from descriptors')
  assert.deepEqual(kept.json.accessors[ids[0]], kept.json.accessors[ids[1]])
})

test('nonuniform shared normal maps keep their original UV channel and image bytes', async () => {
  const raw = await fixture(j => { j.materials.forEach(m => { m.normalTexture = { index: 0 } }) })
  const { json, bin } = parse(raw), v = json.bufferViews[json.images[0].bufferView]
  const replacement = await sharp({ create: { width: 2, height: 1, channels: 4, background: '#ffffff' } })
    .composite([{ input: Buffer.from([0, 0, 0, 255]), raw: { width: 1, height: 1, channels: 4 }, left: 0, top: 0 }]).png().toBuffer()
  v.byteOffset = bin.length; v.byteLength = replacement.length
  json.buffers[0].byteLength = bin.length + replacement.length
  const input = encode(json, Buffer.concat([bin, replacement]))
  const { output } = await buildOutfitAtlasCandidate(input, sharp), after = parse(output)
  const p = after.json.meshes[0].primitives[0]
  assert.equal(after.json.materials[p.material].normalTexture.texCoord, 1)
  assert.deepEqual([...readAccessor(after.json, after.bin, p.attributes.TEXCOORD_1)], json.meshes[0].primitives.flatMap(p => [...readAccessor(json, bin, p.attributes.TEXCOORD_0)]))
  const afterView = after.json.bufferViews[after.json.images[0].bufferView]
  assert.ok(after.bin.subarray(afterView.byteOffset, afterView.byteOffset + afterView.byteLength).equals(replacement))
})

test('independent packaging verifier accepts equivalent storage and rejects changed rig or positions', async () => {
  const { output: reference } = await buildOutfitAtlasCandidate(await fixture(), sharp)
  const compacted = compactCharacterCandidate(reference).output
  const verified = await verifyCharacterAtlasCompression(reference, compacted)
  assert.equal(verified.rigAndAnimationValuesExact, true)
  assert.equal(verified.maximumComponentErrors.POSITION, 0)
  const changedRig = parse(compacted)
  changedRig.json.nodes[1].name = 'DifferentBone'
  await assert.rejects(verifyCharacterAtlasCompression(reference, encode(changedRig.json, changedRig.bin)), /Rig nodes changed/)
  const changedPosition = parse(Buffer.from(compacted))
  const p = changedPosition.json.meshes[0].primitives[0]
  const a = changedPosition.json.accessors[p.attributes.POSITION]
  const v = changedPosition.json.bufferViews[a.bufferView]
  changedPosition.bin.writeFloatLE(.01, (v.byteOffset ?? 0) + (a.byteOffset ?? 0))
  await assert.rejects(verifyCharacterAtlasCompression(reference, encode(changedPosition.json, changedPosition.bin)), /POSITION exceeds candidate tolerance/)
})
