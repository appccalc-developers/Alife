// Offline common skeletal-motion input for identical bind rigs across LODs.
// This does not retarget different bodies or change production loading/cache.
import assert from 'node:assert/strict'
import { readFile, writeFile, realpath } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { parseCharacterGlb as parse, encodeCharacterGlb as encode, readAccessor, compactCharacterCandidate } from './build-character-outfit-atlas-candidate.mjs'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const paths = new Set(['translation', 'rotation', 'scale'])
function rig(json) {
  const names = new Map(), parents = new Map()
  json.nodes.forEach((node, i) => {
    assert.ok(node.name && !names.has(node.name), 'Unique named rig nodes required')
    assert.ok(!node.matrix, 'Explicit TRS rig required')
    names.set(node.name, i)
    for (const child of node.children ?? []) {
      assert.ok(json.nodes[child] && !parents.has(child), 'Invalid or multiple-parent rig')
      parents.set(child, i)
    }
  })
  for (const i of names.values()) {
    const seen = new Set(); let at = i
    while (at !== undefined) {
      assert.ok(!seen.has(at), 'Cyclic rig'); seen.add(at); at = parents.get(at)
    }
  }
  const signature = json.nodes.map((n, i) => ({ name: n.name, parent: json.nodes[parents.get(i)]?.name ?? null,
    translation: n.translation ?? [0, 0, 0], rotation: n.rotation ?? [0, 0, 0, 1], scale: n.scale ?? [1, 1, 1] }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
  return { names, signature }
}
function tracks(json, bin, animation) {
  const result = new Map()
  for (const channel of animation.channels) {
    const { node, path } = channel.target
    assert.ok(json.nodes[node], 'Missing animation target')
    if (path === 'weights') continue
    assert.ok(paths.has(path), 'Unsupported motion target')
    const key = JSON.stringify([json.nodes[node].name, path])
    assert.ok(!result.has(key), 'Duplicate motion track')
    const sampler = animation.samplers[channel.sampler]
    assert.ok(sampler && ['LINEAR', 'STEP', 'CUBICSPLINE'].includes(sampler.interpolation ?? 'LINEAR'))
    const times = readAccessor(json, bin, sampler.input), values = readAccessor(json, bin, sampler.output)
    assert.equal(json.accessors[sampler.input].type, 'SCALAR')
    assert.equal(json.accessors[sampler.output].type, path === 'rotation' ? 'VEC4' : 'VEC3')
    assert.ok(times instanceof Float32Array && values instanceof Float32Array && times.length > 0)
    assert.ok(times.every((t, i) => Number.isFinite(t) && t >= 0 && (!i || t > times[i - 1])), 'Invalid key times')
    assert.ok(values.every(Number.isFinite), 'Nonfinite motion value')
    assert.equal(values.length, times.length * (path === 'rotation' ? 4 : 3) * (sampler.interpolation === 'CUBICSPLINE' ? 3 : 1))
    result.set(key, { channel, sampler, times, values })
  }
  return result
}
function clips(json) {
  const result = new Map()
  for (const clip of json.animations ?? []) {
    assert.ok(clip.name && !result.has(clip.name), 'Unique named clips required')
    result.set(clip.name, clip)
  }
  assert.ok(result.size, 'Motion clips required')
  return result
}
const pruneSamplers = animation => {
  const ids = [...new Set(animation.channels.map(c => c.sampler))]
  const mapping = new Map(ids.map((id, i) => [id, i]))
  animation.samplers = ids.map(i => animation.samplers[i])
  animation.channels.forEach(c => { c.sampler = mapping.get(c.sampler) })
}

// Identify rig and animation content, not its source file or accessor layout.
// Repacking bytes keeps the ID; changing a key, tangent or interpolation does not.
function motionContentId(json, bin) {
  assert.ok(!(json.meshes?.length || json.skins?.length), 'Motion package must not contain geometry')
  return hash(JSON.stringify(['alife-lod-motion-v2', rig(json).signature,
    [...clips(json)].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([name, clip]) => {
      assert.ok(clip.channels.every(c => paths.has(c.target.path)), 'Morphs must stay character-local')
      const content = [...tracks(json, bin, clip)].sort(([a], [b]) => a.localeCompare(b, 'en'))
      assert.ok(content.length, 'Empty skeletal clip')
      return [name, content.map(([key, t]) => [key, t.sampler.interpolation ?? 'LINEAR', Array.from(t.times), Array.from(t.values)])]
    })]))
}

/** Upgrade an unpublished package without touching its rig or animation data. */
export function versionLodMotion(source) {
  const { json, bin } = parse(source), manifest = json.extras?.alifeLodMotion
  assert.ok([1, 2].includes(manifest?.version) && /^[a-f0-9]{64}$/.test(manifest.sourceSha256), 'Versioned motion input required')
  assert.equal(manifest.scope, 'identical-rest-rig-skeletal-only')
  json.extras.alifeLodMotion = { ...manifest, version: 2, motionId: motionContentId(json, bin) }
  return encode(json, bin)
}

/** Animation accessors can address tightly packed regions of one buffer view.
 * Unlike vertex attributes, animation data must not declare byteStride/target.
 * See Khronos glTF 2.0, Buffers and Buffer Views / Accessor Data Alignment.
 * This edits storage descriptions only; no float or key is rounded/removed.
 */
export function compactSkeletalMotionStorage(source) {
  const { json, bin } = parse(source), original = structuredClone(json)
  assert.ok([1, 2].includes(json.extras?.alifeLodMotion?.version), 'Motion-only input required')
  assert.ok(!(json.meshes?.length || json.skins?.length || json.images?.length), 'Only skeletal animation storage may be coalesced')
  assert.ok(json.buffers.length === 1 && !json.buffers[0].uri && !json.extensions)
  const referenced = new Set(json.animations.flatMap(a => a.samplers.flatMap(s => [s.input, s.output])))
  assert.equal(referenced.size, json.accessors.length, 'Every accessor must belong to motion')
  for (const accessor of json.accessors) {
    const view = json.bufferViews[accessor.bufferView]
    assert.ok(view && view.buffer === 0 && Object.keys(view).every(k => ['buffer', 'byteOffset', 'byteLength'].includes(k)), 'Motion view metadata/stride/target cannot be discarded')
    assert.ok(accessor.componentType === 5126 && !accessor.sparse && !accessor.normalized && !accessor.extensions, 'Only dense float animation accessors supported')
    const width = { SCALAR: 1, VEC3: 3, VEC4: 4 }[accessor.type]
    const relative = accessor.byteOffset ?? 0, offset = (view.byteOffset ?? 0) + relative
    assert.ok(width && Number.isInteger(offset) && offset >= 0 && offset % 4 === 0, 'Unaligned motion accessor')
    assert.ok(relative >= 0 && relative + accessor.count * width * 4 <= view.byteLength && offset + accessor.count * width * 4 <= bin.length, 'Motion accessor exceeds its view')
    accessor.bufferView = 0
    if (offset) accessor.byteOffset = offset
    else delete accessor.byteOffset
  }
  json.bufferViews = [{ buffer: 0, byteLength: bin.length }]
  for (const animation of json.animations) for (const sampler of animation.samplers) {
    if (sampler.interpolation === 'LINEAR') delete sampler.interpolation
  }
  json.accessors.forEach((_, i) => assert.deepEqual(readAccessor(json, bin, i), readAccessor(original, bin, i)))
  return encode(json, bin)
}

export function extractLodMotion(source) {
  const { json, bin } = parse(source)
  rig(json); clips(json)
  for (const clip of json.animations) {
    assert.ok(tracks(json, bin, clip).size, 'Empty skeletal clip')
    clip.channels = clip.channels.filter(c => paths.has(c.target.path)); pruneSamplers(clip)
  }
  for (const node of json.nodes) { delete node.mesh; delete node.skin; delete node.weights; delete node.extensions }
  json.meshes = []; json.skins = []; json.images = []; json.textures = []; json.materials = []
  delete json.extensions; delete json.extensionsUsed; delete json.extensionsRequired
  json.extras = { alifeLodMotion: { version: 1, sourceSha256: hash(source), scope: 'identical-rest-rig-skeletal-only' } }
  const compacted = parse(compactCharacterCandidate(encode(json, bin)).output)
  // glTF optional arrays have minItems=1. Omit unused rendering tables rather
  // than shipping empty arrays (the package contains no renderable assets).
  for (const key of ['meshes', 'skins', 'images', 'textures', 'materials', 'samplers']) delete compacted.json[key]
  return versionLodMotion(compactSkeletalMotionStorage(encode(compacted.json, compacted.bin)))
}

export function applyLodMotion(source, motion) {
  const original = parse(source), pack = parse(motion), json = structuredClone(original.json)
  assert.equal(pack.json.extras?.alifeLodMotion?.version, 2, 'Content-versioned motion input required')
  assert.equal(pack.json.extras.alifeLodMotion.motionId, motionContentId(pack.json, pack.bin), 'Motion content ID differs; rebuild the package binding')
  assert.equal(pack.json.extras.alifeLodMotion.scope, 'identical-rest-rig-skeletal-only')
  assert.equal((pack.json.meshes ?? []).length, 0, 'Motion package must not contain geometry')
  assert.equal((pack.json.skins ?? []).length, 0)
  const targetRig = rig(json), motionRig = rig(pack.json)
  assert.deepEqual(targetRig.signature, motionRig.signature, 'Rest rig differs; body retargeting required')
  const targetClips = clips(json), motionClips = clips(pack.json)
  assert.deepEqual([...targetClips.keys()].sort(), [...motionClips.keys()].sort(), 'Clip set differs')
  const parts = [original.bin]; let length = original.bin.length, sharedTracks = 0, preservedMorphTracks = 0
  const append = (values, type, width) => {
    const padding = (4 - length % 4) % 4; parts.push(Buffer.alloc(padding)); length += padding
    const view = json.bufferViews.length, bytes = Buffer.from(values.buffer, values.byteOffset, values.byteLength)
    json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length }); parts.push(bytes); length += bytes.length
    const index = json.accessors.length
    json.accessors.push({ bufferView: view, componentType: 5126, type, count: values.length / width,
      ...(type === 'SCALAR' ? { min: [values[0]], max: [values[values.length - 1]] } : {}) })
    return index
  }
  for (const [name, clip] of targetClips) {
    const old = tracks(original.json, original.bin, clip), commonClip = motionClips.get(name)
    assert.ok(commonClip.channels.every(c => paths.has(c.target.path)), 'Morphs must stay character-local')
    const common = tracks(pack.json, pack.bin, commonClip)
    assert.deepEqual([...old.keys()].sort(), [...common.keys()].sort(), `Track set differs: ${name}`)
    for (const channel of clip.channels) {
      if (channel.target.path === 'weights') { preservedMorphTracks++; continue }
      const key = JSON.stringify([json.nodes[channel.target.node].name, channel.target.path])
      const next = common.get(key), previous = old.get(key)
      assert.equal(next.times[0], previous.times[0], 'Track start differs')
      assert.equal(next.times.at(-1), previous.times.at(-1), 'Track end differs')
      assert.equal(next.sampler.interpolation ?? 'LINEAR', previous.sampler.interpolation ?? 'LINEAR', 'Interpolation differs')
      channel.sampler = clip.samplers.length
      clip.samplers.push({ ...next.sampler, input: append(next.times, 'SCALAR', 1),
        output: append(next.values, channel.target.path === 'rotation' ? 'VEC4' : 'VEC3', channel.target.path === 'rotation' ? 4 : 3) })
      sharedTracks++
    }
    pruneSamplers(clip)
  }
  const output = compactCharacterCandidate(encode(json, Buffer.concat(parts))).output
  const final = parse(output)
  assert.deepEqual(final.json.nodes, original.json.nodes)
  for (const [i, clip] of final.json.animations.entries()) {
    const common = tracks(pack.json, pack.bin, motionClips.get(clip.name))
    for (const [key, track] of tracks(final.json, final.bin, clip)) {
      assert.deepEqual(track.times, common.get(key).times); assert.deepEqual(track.values, common.get(key).values)
    }
    // Preserve every target-local clothing/facial shape track, including tangents.
    clip.channels.forEach((channel, ci) => {
      if (channel.target.path !== 'weights') return
      const oldClip = original.json.animations[i], oldChannel = oldClip.channels[ci]
      assert.deepEqual(channel.target, oldChannel.target)
      const a = oldClip.samplers[oldChannel.sampler], b = clip.samplers[channel.sampler]
      assert.equal(a.interpolation, b.interpolation)
      for (const key of ['input', 'output']) assert.deepEqual(readAccessor(original.json, original.bin, a[key]), readAccessor(final.json, final.bin, b[key]))
    })
  }
  return { output, report: { sharedTracks, preservedMorphTracks, bytes: output.length,
    sourceSha256: hash(source), motionSha256: hash(motion), outputSha256: hash(output),
    scope: 'same-character-lod-skeletal-motion', crossCharacterRetargeted: false, runtimeReleaseAllowed: false } }
}

export function stripLodSkeletalMotion(source, motion) {
  // Validate the complete compatibility contract before removing any tracks.
  const checked = applyLodMotion(source, motion)
  const { json, bin } = parse(checked.output), pack = parse(motion)
  for (const clip of json.animations) {
    clip.channels = clip.channels.filter(c => c.target.path === 'weights')
    assert.ok(clip.channels.length, 'Runtime split requires local morph tracks for every clip')
    pruneSamplers(clip)
  }
  json.extras = { ...json.extras, alifeLodMotionBinding: { version: 2,
    sourceSha256: pack.json.extras.alifeLodMotion.sourceSha256,
    motionId: pack.json.extras.alifeLodMotion.motionId } }
  const output = compactCharacterCandidate(encode(json, bin)).output
  return { output, report: { ...checked.report, bytes: output.length, outputSha256: hash(output),
    embeddedSkeletalTracks: 0, requiresMotionPackage: true } }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, input, second, third] = process.argv.slice(2)
  assert.ok(['extract', 'version', 'apply', 'strip'].includes(mode), 'Usage: extract|version source.glb motion.glb | apply|strip source.glb motion.glb output.glb')
  const standalone = mode === 'extract' || mode === 'version'
  const sourcePath = await realpath(input), output = resolve(standalone ? second : third)
  const parent = await realpath(dirname(output))
  assert.ok(parent.toLowerCase().startsWith('c:\\data\\alife\\temp\\'), 'Use a task directory under the data root')
  const motionPath = !standalone ? await realpath(second) : null
  assert.ok(![sourcePath, motionPath].filter(Boolean).some(p => p.toLowerCase() === output.toLowerCase()))
  const source = await readFile(sourcePath)
  const result = standalone ? { output: (mode === 'extract' ? extractLodMotion : versionLodMotion)(source) }
    : (mode === 'strip' ? stripLodSkeletalMotion : applyLodMotion)(source, await readFile(motionPath))
  await writeFile(output, result.output, { flag: 'wx' })
  console.log(JSON.stringify({ output, bytes: result.output.length, sha256: hash(result.output), ...result.report }, null, 2))
}
