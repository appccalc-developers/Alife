// Offline, opt-in candidates only. Skin batching is a separately labelled
// church-runtime experiment; it must not be treated as a release-equivalent asset.
// No installation, runtime wiring, source overwrite or release promotion.
import assert from 'node:assert/strict'
import { readFile, writeFile, realpath } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { decompressCharacterDraco } from './gate-a-character-geometry.mjs'
import { Quaternion, QuaternionKeyframeTrack, VectorKeyframeTrack } from '../../cloudflare/alife-app/node_modules/three/build/three.module.js'

const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }
const types = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }

// Opt-in motion candidate only: not the exact constant-key path. Tolerances are
// component-space, not a promise about the accumulated skinned vertex error.
export const ANIMATION_COMPONENT_TOLERANCES = Object.freeze({ rotation: .00002, translation: .00001, scale: .000001 })
export function selectBoundedAnimationKeys(times, values, path) {
  const tolerance = ANIMATION_COMPONENT_TOLERANCES[path] * .9
  assert.ok(tolerance, 'Only skeletal LINEAR tracks may be reduced; morph weights are retained')
  const stride = path === 'rotation' ? 4 : 3
  assert.equal(values.length, times.length * stride)
  assert.ok(values.every(Number.isFinite))
  for (let i = 0; i < times.length; i++) assert.ok(Number.isFinite(times[i]) && (i === 0 || times[i] > times[i - 1]), 'Animation times must strictly increase')
  if (times.length <= 4) return Array.from(times, (_, i) => i)
  // Preserve the first/last two keys for the established start/stop contacts.
  const keep = new Set([0, 1, times.length - 2, times.length - 1])
  const pending = [[1, times.length - 2]], expected = new Float64Array(stride), actual = new Float64Array(stride)
  const interpolate = (left, right, time, target) => {
    const alpha = (time - times[left]) / (times[right] - times[left])
    if (path === 'rotation') Quaternion.slerpFlat(target, 0, values, left * stride, values, right * stride, alpha)
    else for (let c = 0; c < stride; c++) target[c] = values[left * stride + c] * (1 - alpha) + values[right * stride + c] * alpha
  }
  while (pending.length) {
    const [left, right] = pending.pop()
    if (right - left <= 1) continue
    let maximum = 0, split = left + 1
    const compare = (time, index) => {
      interpolate(left, right, time, actual)
      for (let c = 0; c < stride; c++) {
        const error = Math.abs(expected[c] - actual[c])
        if (error > maximum) { maximum = error; split = Math.min(right - 1, Math.max(left + 1, index)) }
      }
    }
    for (let i = left; i < right; i++) {
      if (i > left) { expected.set(values.subarray(i * stride, (i + 1) * stride)); compare(times[i], i) }
      // Quaternion interpolation is nonlinear: also test the interior of each
      // original interval, not only its existing key positions.
      const midpoint = (times[i] + times[i + 1]) / 2
      interpolate(i, i + 1, midpoint, expected); compare(midpoint, i + 1)
    }
    if (maximum > tolerance) { keep.add(split); pending.push([left, split], [split, right]) }
  }
  return [...keep].sort((a, b) => a - b)
}
export const atlasBorderIndex = (index, size, wrap = 10497) => {
  if (wrap === 33071) return Math.max(0, Math.min(size - 1, index))
  if (wrap === 10497) return (index % size + size) % size
  assert.equal(wrap, 33648, 'Unsupported texture wrap')
  const mirrored = (index % (size * 2) + size * 2) % (size * 2)
  return mirrored < size ? mirrored : size * 2 - 1 - mirrored
}
const parse = raw => {
  assert.equal(raw.readUInt32LE(0), 0x46546c67)
  assert.equal(raw.readUInt32LE(8), raw.length)
  const n = raw.readUInt32LE(12)
  return { json: JSON.parse(raw.toString('utf8', 20, 20 + n)), bin: raw.subarray(28 + n) }
}

const encode = (json, binary) => {
  json.buffers[0].byteLength = binary.length
  const text = Buffer.from(JSON.stringify(json)), padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32)
  text.copy(padded)
  const bin = Buffer.alloc(Math.ceil(binary.length / 4) * 4); binary.copy(bin)
  const h = Buffer.alloc(20), bh = Buffer.alloc(8)
  h.writeUInt32LE(0x46546c67); h.writeUInt32LE(2, 4); h.writeUInt32LE(28 + padded.length + bin.length, 8)
  h.writeUInt32LE(padded.length, 12); h.writeUInt32LE(0x4e4f534a, 16)
  bh.writeUInt32LE(bin.length); bh.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([h, padded, bh, bin])
}
export { parse as parseCharacterGlb, encode as encodeCharacterGlb }

/** Remove only interior keys on exactly constant LINEAR plateaus. Never resample
 * changing motion, remove endpoints, or edit shared accessor storage in place. */
export function compactConstantAnimationKeys(raw) {
  return compactAnimationKeys(raw, false)
}

export function compactBoundedAnimationKeys(raw) {
  return compactAnimationKeys(raw, true)
}

function compactAnimationKeys(raw, bounded) {
  const { json, bin } = parse(raw)
  const original = structuredClone(json)
  const chunks = [bin]
  let length = bin.length, removedKeys = 0, changedSamplers = 0
  const append = (values, original) => {
    const padding = (4 - length % 4) % 4
    chunks.push(Buffer.alloc(padding)); length += padding
    const bytes = Buffer.from(values.buffer, values.byteOffset, values.byteLength)
    const bufferView = json.bufferViews.length
    json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length })
    chunks.push(bytes); length += bytes.length
    const accessor = { ...original, bufferView, count: values.length / components[original.type] }
    delete accessor.byteOffset; delete accessor.sparse
    if (accessor.min || accessor.max) {
      const width = components[accessor.type]
      accessor.min = Array(width).fill(Infinity); accessor.max = Array(width).fill(-Infinity)
      values.forEach((v, i) => { accessor.min[i % width] = Math.min(accessor.min[i % width], v); accessor.max[i % width] = Math.max(accessor.max[i % width], v) })
    }
    json.accessors.push(accessor)
    return json.accessors.length - 1
  }
  for (const animation of json.animations ?? []) for (const sampler of animation.samplers) {
    if ((sampler.interpolation ?? 'LINEAR') !== 'LINEAR') continue
    const paths = animation.channels.filter(c => animation.samplers[c.sampler] === sampler).map(c => c.target.path)
    if (bounded && (!paths.length || paths.includes('weights'))) continue
    if (bounded) assert.ok(paths.every(p => p === paths[0]), 'Shared sampler targets different transform types')
    const input = json.accessors[sampler.input], output = json.accessors[sampler.output]
    assert.equal(input.type, 'SCALAR'); assert.equal(input.componentType, 5126)
    assert.equal(output.componentType, 5126)
    assert.ok(!input.extensions && !output.extensions)
    const times = readAccessor(json, bin, sampler.input), values = readAccessor(json, bin, sampler.output)
    const stride = values.length / times.length
    assert.ok(Number.isInteger(stride) && stride > 0)
    for (let i = 0; i < times.length; i++) {
      assert.ok(Number.isFinite(times[i]) && (i === 0 || times[i] > times[i - 1]), 'Animation times must strictly increase')
    }
    assert.ok(values.every(Number.isFinite), 'Animation values must be finite')
    const keep = bounded ? selectBoundedAnimationKeys(times, values, paths[0]) : []
    for (let i = 0; !bounded && i < times.length; i++) {
      let constant = i > 0 && i < times.length - 1
      for (let c = 0; constant && c < stride; c++) {
        constant = Object.is(values[i * stride + c], values[(i - 1) * stride + c])
          && Object.is(values[i * stride + c], values[(i + 1) * stride + c])
      }
      if (!constant) keep.push(i)
    }
    if (keep.length === times.length) continue
    const keptTimes = Float32Array.from(keep, i => times[i])
    const keptValues = new Float32Array(keep.length * stride)
    keep.forEach((i, k) => keptValues.set(values.subarray(i * stride, (i + 1) * stride), k * stride))
    sampler.input = append(keptTimes, input)
    sampler.output = append(keptValues, output)
    removedKeys += times.length - keep.length; changedSamplers++
  }
  const result = compactCharacterCandidate(encode(json, Buffer.concat(chunks)))
  let sampledVerification
  if (bounded) {
    const after = parse(result.output), maximumErrors = { rotation: 0, translation: 0, scale: 0 }
    let samples = 0, exactSamplers = 0
    assert.deepEqual(after.json.nodes, original.nodes)
    original.animations.forEach((animation, i) => {
      const other = after.json.animations[i]
      assert.deepEqual(other.channels, animation.channels); assert.equal(other.name, animation.name)
      animation.samplers.forEach((s, k) => {
        const t = other.samplers[k], path = animation.channels.find(c => c.sampler === k)?.target.path
        assert.equal(t.interpolation, s.interpolation)
        const a = readAccessor(original, bin, s.input), b = readAccessor(after.json, after.bin, t.input)
        const va = readAccessor(original, bin, s.output), vb = readAccessor(after.json, after.bin, t.output)
        if (!path || path === 'weights' || (s.interpolation ?? 'LINEAR') !== 'LINEAR') {
          assert.deepEqual(a, b); assert.deepEqual(va, vb); exactSamplers++; return
        }
        assert.equal(a[0], b[0]); assert.equal(a.at(-1), b.at(-1))
        const Track = path === 'rotation' ? QuaternionKeyframeTrack : VectorKeyframeTrack
        const beforeTrack = new Track('track', a, va).createInterpolant(), afterTrack = new Track('track', b, vb).createInterpolant()
        const probes = [...a, ...Array.from({ length: Math.ceil((a.at(-1) - a[0]) * 240) + 1 }, (_, i) => a[0] + i / 240)]
        for (const time of probes) {
          const expected = beforeTrack.evaluate(time), actual = afterTrack.evaluate(time)
          actual.forEach((value, c) => {
            const error = Math.abs(value - expected[c]); maximumErrors[path] = Math.max(maximumErrors[path], error)
            assert.ok(error <= ANIMATION_COMPONENT_TOLERANCES[path], `${animation.name}/${path} exceeded local component tolerance`)
          }); samples++
        }
      })
    })
    sampledVerification = { samples, exactSamplers, maximumErrors, sampleHz: 240, skinnedWorldSpaceVerified: false }
  }
  return { output: result.output, report: { originalBytes: raw.length, candidateBytes: result.output.length,
    removedKeys, changedSamplers, changingKeysAndEndpointsRetained: !bounded,
    ...(bounded ? { firstAndLastTwoKeysRetained: true, morphTracksExact: true, sampledVerification } : {}),
    runtimeReleaseAllowed: false, compaction: result.report } }
}

/** Remove only unreachable tables and duplicate storage from this tool's decoded
 * candidate. Keep every referenced accessor/image payload byte-for-byte. */
export function compactCharacterCandidate(raw) {
  const { json, bin } = parse(raw)
  const originalJson = structuredClone(json)
  assert.equal(json.buffers.length, 1)
  assert.ok(!json.buffers[0].uri && !json.extensions)
  const allowed = new Set(['KHR_draco_mesh_compression', 'EXT_texture_webp', 'KHR_materials_clearcoat', 'KHR_materials_specular'])
  for (const name of json.extensionsUsed ?? []) assert.ok(allowed.has(name), `Unmapped extension ${name}`)
  const accessorRefs = [], materialRefs = [], textureRefs = [], imageRefs = [], viewRefs = []
  const compressedAccessorIds = new Set()
  const ref = (list, object, key) => { if (object[key] !== undefined) list.push([object, key]) }
  for (const m of json.meshes) for (const p of m.primitives) {
    for (const [name, extension] of Object.entries(p.extensions ?? {})) {
      assert.equal(name, 'KHR_draco_mesh_compression'); ref(viewRefs, extension, 'bufferView')
      for (const key of Object.keys(extension.attributes)) compressedAccessorIds.add(p.attributes[key])
      compressedAccessorIds.add(p.indices)
    }
    ref(materialRefs, p, 'material'); ref(accessorRefs, p, 'indices')
    for (const attrs of [p.attributes, ...(p.targets ?? [])]) for (const key of Object.keys(attrs)) ref(accessorRefs, attrs, key)
  }
  for (const s of json.skins ?? []) ref(accessorRefs, s, 'inverseBindMatrices')
  for (const a of json.animations ?? []) for (const s of a.samplers) { ref(accessorRefs, s, 'input'); ref(accessorRefs, s, 'output') }
  const prune = (name, refs) => {
    const source = json[name] ?? [], ids = [...new Set(refs.map(([o, k]) => o[k]))].sort((a, b) => a - b)
    ids.forEach(i => assert.ok(Number.isInteger(i) && source[i], `Invalid ${name} index ${i}`))
    const remap = new Map(ids.map((old, i) => [old, i]))
    refs.forEach(([o, k]) => { o[k] = remap.get(o[k]) })
    json[name] = ids.map(i => source[i])
    return ids
  }
  const oldAccessorIds = prune('accessors', accessorRefs)
  prune('materials', materialRefs)
  const visitTextures = object => {
    for (const [key, value] of Object.entries(object)) {
      if (!value || typeof value !== 'object') continue
      if (/Texture$/.test(key)) ref(textureRefs, value, 'index')
      else visitTextures(value)
    }
  }
  json.materials.forEach(visitTextures)
  prune('textures', textureRefs)
  for (const t of json.textures) {
    ref(imageRefs, t, 'source')
    for (const [name, value] of Object.entries(t.extensions ?? {})) {
      assert.equal(name, 'EXT_texture_webp'); ref(imageRefs, value, 'source')
    }
  }
  prune('images', imageRefs)
  for (const a of json.accessors) {
    assert.ok(!a.extensions)
    ref(viewRefs, a, 'bufferView')
    if (a.sparse) { ref(viewRefs, a.sparse.indices, 'bufferView'); ref(viewRefs, a.sparse.values, 'bufferView') }
  }
  for (const image of json.images) { assert.ok(!image.uri && !image.extensions); ref(viewRefs, image, 'bufferView') }
  prune('bufferViews', viewRefs)
  const parts = [], seen = new Map()
  let length = 0, duplicates = 0
  for (const v of json.bufferViews) {
    assert.equal(v.buffer, 0); assert.ok(!v.extensions)
    const bytes = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength)
    assert.equal(bytes.length, v.byteLength)
    const hash = createHash('sha256').update(bytes).digest('hex'), previous = seen.get(hash)
    if (previous) { assert.ok(previous.bytes.equals(bytes)); v.byteOffset = previous.offset; duplicates++ }
    else {
      const padding = (4 - length % 4) % 4
      if (padding) { parts.push(Buffer.alloc(padding)); length += padding }
      v.byteOffset = length; seen.set(hash, { offset: length, bytes }); parts.push(bytes); length += bytes.length
    }
  }
  const binary = Buffer.concat(parts)
  // Byte-identical views can also share the same descriptor when every field
  // (stride, GPU target, names/extras included) agrees.
  const uniqueViews = [], viewIds = [], descriptorIds = new Map()
  for (const view of json.bufferViews) {
    const signature = JSON.stringify(view)
    if (!descriptorIds.has(signature)) { descriptorIds.set(signature, uniqueViews.length); uniqueViews.push(view) }
    viewIds.push(descriptorIds.get(signature))
  }
  const deduplicatedViewDescriptors = json.bufferViews.length - uniqueViews.length
  viewRefs.forEach(([object, key]) => { object[key] = viewIds[object[key]] })
  json.bufferViews = uniqueViews
  // Equal readable accessor descriptors now point at the same immutable data.
  // Draco accessors are different: their data is implicit in each primitive,
  // so identical descriptors do NOT establish that the values are identical.
  const uniqueAccessors = [], accessorIds = [], accessorDescriptors = new Map()
  json.accessors.forEach((accessor, i) => {
    const compressed = compressedAccessorIds.has(oldAccessorIds[i])
    const signature = JSON.stringify(accessor)
    if (compressed || !accessorDescriptors.has(signature)) {
      const index = uniqueAccessors.length
      uniqueAccessors.push(accessor); accessorIds.push(index)
      if (!compressed) accessorDescriptors.set(signature, index)
    } else accessorIds.push(accessorDescriptors.get(signature))
  })
  const deduplicatedAccessorDescriptors = json.accessors.length - uniqueAccessors.length
  accessorRefs.forEach(([object, key]) => { object[key] = accessorIds[object[key]] })
  json.accessors = uniqueAccessors
  // Verify values after all index remapping, including sparse morphs and binds.
  let decodedAccessorValuesVerified = 0, compressedAccessorMetadataVerified = 0
  oldAccessorIds.forEach((old, i) => {
    if (compressedAccessorIds.has(old) && originalJson.accessors[old].bufferView === undefined) {
      // The retained Draco buffer is copied verbatim; do not call an absent
      // fallback buffer "verified decoded zeros".
      assert.deepEqual(json.accessors[accessorIds[i]], originalJson.accessors[old])
      compressedAccessorMetadataVerified++
    } else {
      assert.deepEqual(readAccessor(json, binary, accessorIds[i]), readAccessor(originalJson, bin, old), `Accessor ${old} changed during compaction`)
      decodedAccessorValuesVerified++
    }
  })
  return { output: encode(json, binary), report: { accessorsVerified: oldAccessorIds.length,
    decodedAccessorValuesVerified, compressedAccessorMetadataVerified,
    referencedViews: json.bufferViews.length, duplicateViews: duplicates, deduplicatedViewDescriptors, deduplicatedAccessorDescriptors, images: json.images.length,
    materials: json.materials.length, beforeBytes: raw.length } }
}

export function readAccessor(json, bin, index) {
  const a = json.accessors[index], Type = types[a.componentType], size = components[a.type]
  assert.ok(Type && size && !a.normalized, `Unsupported accessor ${index}`)
  const values = new Type(a.count * size)
  const copy = (viewIndex, byteOffset, target, count, width, Target) => {
    const view = json.bufferViews[viewIndex]
    const stride = view.byteStride ?? width * Target.BYTES_PER_ELEMENT
    for (let i = 0; i < count; i++) {
      const offset = (view.byteOffset ?? 0) + byteOffset + i * stride
      const raw = Uint8Array.from(bin.subarray(offset, offset + width * Target.BYTES_PER_ELEMENT))
      assert.equal(raw.length, width * Target.BYTES_PER_ELEMENT)
      target.set(new Target(raw.buffer), i * width)
    }
  }
  if (a.bufferView !== undefined) copy(a.bufferView, a.byteOffset ?? 0, values, a.count, size, Type)
  if (a.sparse) {
    const s = a.sparse, IndexType = types[s.indices.componentType]
    assert.ok(IndexType && IndexType !== Float32Array)
    const indices = new IndexType(s.count), replacements = new Type(s.count * size)
    copy(s.indices.bufferView, s.indices.byteOffset ?? 0, indices, s.count, 1, IndexType)
    copy(s.values.bufferView, s.values.byteOffset ?? 0, replacements, s.count, size, Type)
    indices.forEach((index, i) => {
      assert.ok(index < a.count)
      values.set(replacements.subarray(i * size, (i + 1) * size), index * size)
    })
  }
  return values
}

/** Independent JS/WASM decode of the native encoder result. The reference is
 * this tool's pre-Draco atlas candidate, not an arbitrary differently shaped rig. */
export async function verifyCharacterAtlasCompression(reference, compressed) {
  const before = parse(reference), packed = parse(compressed)
  const after = parse(await decompressCharacterDraco(compressed, { allowUncompressed: true }))
  assert.deepEqual(after.json.nodes, before.json.nodes, 'Rig nodes changed')
  assert.equal(after.json.skins.length, before.json.skins.length)
  for (const [i, skin] of before.json.skins.entries()) {
    assert.deepEqual(after.json.skins[i].joints, skin.joints)
    if (skin.inverseBindMatrices === undefined) assert.equal(after.json.skins[i].inverseBindMatrices, undefined)
    else assert.deepEqual(readAccessor(after.json, after.bin, after.json.skins[i].inverseBindMatrices), readAccessor(before.json, before.bin, skin.inverseBindMatrices))
  }
  assert.equal(after.json.animations.length, before.json.animations.length)
  for (const [i, animation] of before.json.animations.entries()) {
    const other = after.json.animations[i]
    assert.equal(other.name, animation.name)
    assert.deepEqual(other.channels, animation.channels)
    assert.equal(other.samplers.length, animation.samplers.length)
    for (const [j, sampler] of animation.samplers.entries()) {
      assert.equal(other.samplers[j].interpolation ?? 'LINEAR', sampler.interpolation ?? 'LINEAR')
      for (const key of ['input', 'output']) assert.deepEqual(readAccessor(after.json, after.bin, other.samplers[j][key]), readAccessor(before.json, before.bin, sampler[key]))
    }
  }
  const limits = { POSITION: 0.000002, NORMAL: 0.00001, TEXCOORD_0: 0.000001, TEXCOORD_1: 0.000001, JOINTS_0: 0, WEIGHTS_0: 0.0000002 }
  const errors = {}
  let copiedPrimitives = 0, decodedPrimitives = 0, morphAccessorsVerified = 0
  assert.equal(after.json.meshes.length, before.json.meshes.length)
  const payload = (source, view) => {
    const v = source.json.bufferViews[view]
    return source.bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength)
  }
  for (const [i, mesh] of before.json.meshes.entries()) {
    assert.equal(after.json.meshes[i].primitives.length, mesh.primitives.length)
    assert.deepEqual(after.json.meshes[i].weights, mesh.weights)
    for (const [j, p] of mesh.primitives.entries()) {
      const q = after.json.meshes[i].primitives[j]
      assert.equal(after.json.materials[q.material].name, before.json.materials[p.material].name)
      assert.deepEqual(Object.keys(q.attributes).sort(), Object.keys(p.attributes).sort())
      if (p.extensions?.KHR_draco_mesh_compression) {
        assert.ok(payload(before, p.extensions.KHR_draco_mesh_compression.bufferView).equals(
          payload(packed, packed.json.meshes[i].primitives[j].extensions.KHR_draco_mesh_compression.bufferView)), 'Untouched primitive was recompressed')
        copiedPrimitives++
      } else {
        assert.deepEqual([...readAccessor(after.json, after.bin, q.indices)], [...readAccessor(before.json, before.bin, p.indices)], 'Morph vertex/triangle order changed')
        for (const semantic of Object.keys(p.attributes)) {
          assert.ok(semantic in limits, `No verified tolerance for ${semantic}`)
          const x = readAccessor(before.json, before.bin, p.attributes[semantic]), y = readAccessor(after.json, after.bin, q.attributes[semantic])
          assert.equal(x.length, y.length)
          let max = 0
          x.forEach((v, k) => { assert.ok(Number.isFinite(y[k])); max = Math.max(max, Math.abs(v - y[k])) })
          assert.ok(max <= limits[semantic], `${semantic} exceeds candidate tolerance: ${max}`)
          errors[semantic] = Math.max(errors[semantic] ?? 0, max)
        }
        decodedPrimitives++
      }
      assert.equal(q.targets?.length ?? 0, p.targets?.length ?? 0)
      for (const [k, target] of (p.targets ?? []).entries()) for (const semantic of Object.keys(target)) {
        assert.deepEqual(readAccessor(after.json, after.bin, q.targets[k][semantic]), readAccessor(before.json, before.bin, target[semantic]), 'Morph deltas changed')
        morphAccessorsVerified++
      }
    }
  }
  return { copiedPrimitives, decodedPrimitives, morphAccessorsVerified, maximumComponentErrors: errors,
    rigAndAnimationValuesExact: true, runtimeReleaseAllowed: false }
}

export async function buildOutfitAtlasCandidate(raw, sharp, { group = 'outfit', mipSafe = false } = {}) {
  assert.ok(['outfit', 'face-lines', 'face-opaque', 'skin'].includes(group), 'Unknown atlas group')
  // Eye highlights must remain independent: merging their draw object with the
  // brows changes transparent sorting against the iris and loses catchlights.
  const selectedMaterial = group === 'outfit' ? /_CLOTH(?:_| \()/
    : group === 'face-lines' ? /_(?:FaceBrow_00_FACE|FaceEyeline_00_FACE) \(Instance\)$/
      : group === 'skin' ? /_(?:Body_00_SKIN|Face_00_SKIN) \(Instance\)$/
        : /_(?:FaceMouth_00_FACE|EyeWhite_00_EYE) \(Instance\)$/
  const sourceJson = parse(raw).json
  const { json, bin } = parse(await decompressCharacterDraco(raw))
  const originalPrimitives = json.meshes.flatMap((mesh, i) => mesh.primitives.map((p, j) => [p, sourceJson.meshes[i].primitives[j]]))
  const before = structuredClone(json)
  if (group === 'skin') {
    // Explicit church-runtime candidate, not an authored-PBR equivalent: the
    // accepted runtime ignores skin normal/emissive maps and renders fair unlit
    // colour. Face alpha is also ignored there; body cutouts must remain intact.
    const skinParts = json.meshes.flatMap((mesh, meshIndex) => mesh.primitives
      .filter(p => selectedMaterial.test(json.materials[p.material].name))
      .map(part => ({ mesh, meshIndex, part })))
    assert.equal(skinParts.length, 2, 'Skin atlas requires one body and one face')
    skinParts.sort((a, b) => Number(json.materials[a.part.material].name.includes('Face_')) - Number(json.materials[b.part.material].name.includes('Face_')))
    const [body, face] = skinParts
    assert.match(json.materials[body.part.material].name, /Body_00_SKIN/)
    assert.match(json.materials[face.part.material].name, /Face_00_SKIN/)
    assert.notEqual(body.meshIndex, face.meshIndex, 'Skin source meshes must be distinct')
    const owners = skinParts.map(({ meshIndex }) => json.nodes.flatMap((node, i) => node.mesh === meshIndex ? [{ node, i }] : []))
    owners.forEach(nodes => assert.equal(nodes.length, 1, 'Instanced skin mesh is not supported'))
    const [bodyOwner, faceOwner] = owners.map(nodes => nodes[0])
    assert.equal(bodyOwner.node.skin, faceOwner.node.skin, 'Skin bindings differ')
    assert.ok(Number.isInteger(bodyOwner.node.skin), 'Both parts must be skinned')
    const parent = i => json.nodes.flatMap((n, p) => n.children?.includes(i) ? [p] : [])
    assert.deepEqual(parent(bodyOwner.i), parent(faceOwner.i), 'Skin mesh parents differ')
    for (const key of ['translation', 'rotation', 'scale', 'matrix']) assert.deepEqual(bodyOwner.node[key], faceOwner.node[key], 'Skin mesh transforms differ')
    assert.ok(!face.part.targets?.length && !face.mesh.weights?.length && !faceOwner.node.weights?.length, 'Animated face morphs require explicit remapping')
    assert.ok(!json.animations.some(a => a.channels.some(c => c.target.node === faceOwner.i)), 'Animated face node cannot move into the body')
    assert.ok(!json.animations.some(a => a.channels.some(c => c.target.node === bodyOwner.i && c.target.path !== 'weights')), 'Animated body transform would also move the face')
    assert.ok(face.mesh.primitives.length > 1, 'Must retain a nonempty face mesh')
    for (const { part } of skinParts) {
      const material = json.materials[part.material]
      assert.equal(material.alphaMode, 'MASK', 'Skin atlas only supports accepted cutout skin')
      assert.equal(material.pbrMetallicRoughness.baseColorFactor?.[3] ?? 1, 1, 'Skin opacity differs')
      delete material.normalTexture
      delete material.emissiveTexture
      delete material.emissiveFactor
      material.doubleSided = true
    }
    // Keep all node identities and clothing morph channels. Only face geometry
    // moves between two identically bound sibling nodes; its morph deltas are 0.
    face.mesh.primitives = face.mesh.primitives.filter(p => p !== face.part)
    body.mesh.primitives.splice(body.mesh.primitives.indexOf(body.part) + 1, 0, face.part)
  }
  const groups = json.meshes.map(mesh => ({ mesh, parts: mesh.primitives.filter(p => selectedMaterial.test(json.materials[p.material].name)) }))
    .filter(group => group.parts.length > 1)
  assert.equal(groups.length, 1, 'Candidate requires exactly one multi-slot outfit mesh')
  const { mesh, parts } = groups[0]
  if (group === 'face-lines') assert.equal(parts.length, 2, 'Face lines require brow and eyeline together')
  if (group === 'face-opaque') assert.equal(parts.length, 2, 'Opaque face atlas requires mouth and eye whites together')
  const signature = material => {
    const copy = structuredClone(material)
    delete copy.name
    delete copy.pbrMetallicRoughness.baseColorTexture
    // Texture indices may alias the same immutable image + sampler.
    for (const key of ['normalTexture', 'emissiveTexture']) {
      if (copy[key]) copy[key].index = json.textures[copy[key].index]
    }
    return copy
  }
  const firstMaterial = json.materials[parts[0].material]
  if (group === 'face-lines') {
    assert.equal(firstMaterial.alphaMode, 'BLEND')
    assert.equal(firstMaterial.doubleSided, true)
  }
  if (group === 'face-opaque') {
    // Both names already use the same standard-PBR/opaque runtime path.
    // Do not include fair unlit skin, iris, catchlights or transparent lines.
    assert.equal(firstMaterial.alphaMode, 'MASK')
    assert.equal(firstMaterial.doubleSided ?? false, false)
  }
  const targetCount = parts[0].targets?.length ?? 0
  const channels = Object.keys(parts[0].attributes).sort()
  for (const p of parts) {
    assert.deepEqual(signature(json.materials[p.material]), signature(firstMaterial), 'Outfit render states differ')
    assert.deepEqual(Object.keys(p.attributes).sort(), channels)
    if (group !== 'skin' || p === parts[0]) assert.equal(p.targets?.length ?? 0, targetCount, 'Morph channel count differs')
    assert.equal(p.mode ?? 4, 4)
    assert.ok(!p.extensions)
  }
  const images = []
  // Preserve the original coordinates for shared secondary maps. Even a
  // nominally flat WebP normal image can contain nonuniform quantization noise.
  assert.ok(!channels.includes('TEXCOORD_1'), 'Secondary UV is already authored')
  for (const key of ['normalTexture', 'emissiveTexture']) {
    const info = firstMaterial[key]
    if (!info) continue
    assert.equal(info.texCoord ?? 0, 0)
    assert.ok(!info.extensions)
  }
  assert.ok(!firstMaterial.occlusionTexture && !firstMaterial.pbrMetallicRoughness.metallicRoughnessTexture)
  for (const extension of Object.values(firstMaterial.extensions ?? {})) {
    assert.ok(!Object.keys(extension).some(key => /Texture$/.test(key)), 'Extension map needs its own atlas')
  }
  for (const p of parts) {
    const info = json.materials[p.material].pbrMetallicRoughness.baseColorTexture
    assert.equal(info.texCoord ?? 0, 0)
    assert.ok(!info.extensions, 'UV transforms require separate baking')
    const texture = json.textures[info.index]
    assert.equal(texture.sampler, json.textures[firstMaterial.pbrMetallicRoughness.baseColorTexture.index].sampler)
    const image = json.images[texture.extensions?.EXT_texture_webp?.source ?? texture.source]
    assert.ok(image.bufferView !== undefined && !image.uri)
    const view = json.bufferViews[image.bufferView]
    const { data, info: meta } = await sharp(bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    if (group === 'skin' && json.materials[p.material].name.includes('Face_00_SKIN')) {
      // Reproduce the existing opaque-face runtime path inside a MASK atlas.
      for (let i = 3; i < data.length; i += 4) data[i] = 255
    }
    if (group === 'face-opaque') {
      for (let i = 3; i < data.length; i += 4) assert.equal(data[i], 255, 'Opaque face atlas must not remove visible alpha')
    }
    images.push({ data, width: meta.width, height: meta.height })
  }
  // Opt-in larger gutters keep tile starts aligned through mip level 5.
  // Power-of-two outer dimensions avoid odd-size mip rounding changing UV
  // placement. This mitigates, but cannot prove elimination of, sampling drift.
  // Keep the historical default reproducible for existing candidates.
  const gutter = mipSafe ? 32 : 8
  let columns = Math.ceil(Math.sqrt(images.length))
  const cellSize = Math.max(...images.flatMap(i => [i.width, i.height])) + gutter * 2
  const cell = mipSafe ? Math.ceil(cellSize / 32) * 32 : cellSize
  const outerSize = value => mipSafe ? 2 ** Math.ceil(Math.log2(value)) : value
  let width = outerSize(columns * cell), height = outerSize(Math.ceil(images.length / columns) * cell)
  if (mipSafe) {
    // Square grids can waste a full power-of-two row/column (seven 384px
    // tiles were 2048²). Select a smaller padded grid, never resize texels,
    // shrink gutters or give up integer mip alignment. Keep existing layouts
    // when tied so already reviewed Low/High candidates remain reproducible.
    for (let candidateColumns = 1; candidateColumns <= images.length; candidateColumns++) {
      const w = outerSize(candidateColumns * cell), h = outerSize(Math.ceil(images.length / candidateColumns) * cell)
      if (w > 4096 || h > 4096) continue
      if (w * h < width * height || (w * h === width * height && Math.max(w, h) < Math.max(width, height))) {
        columns = candidateColumns; width = w; height = h
      }
    }
  }
  let placements = images.map((_, index) => ({ x: index % columns * cell + gutter, y: Math.floor(index / columns) * cell + gutter }))
  if (mipSafe) {
    // Mixed-resolution parts need not reserve the largest tile's empty area.
    // Try deterministic shelves without rotating/resampling images. Only adopt
    // a strictly smaller outer area, keeping reviewed equal-size grids stable.
    const rectangles = images.map((im, index) => ({ index,
      width: Math.ceil((im.width + 2 * gutter) / 32) * 32,
      height: Math.ceil((im.height + 2 * gutter) / 32) * 32,
    })).sort((a, b) => b.height - a.height || b.width - a.width || a.index - b.index)
    for (let candidateWidth = 32; candidateWidth <= 4096; candidateWidth *= 2) {
      if (rectangles.some(rect => rect.width > candidateWidth)) continue
      const shelves = [], positions = []
      let usedHeight = 0
      for (const rect of rectangles) {
        let shelf = shelves.find(row => row.height >= rect.height && row.used + rect.width <= candidateWidth)
        if (!shelf) {
          shelf = { y: usedHeight, height: rect.height, used: 0 }
          shelves.push(shelf); usedHeight += rect.height
        }
        positions[rect.index] = { x: shelf.used + gutter, y: shelf.y + gutter }
        shelf.used += rect.width
      }
      const candidateHeight = outerSize(usedHeight)
      if (candidateHeight <= 4096 && candidateWidth * candidateHeight < width * height) {
        width = candidateWidth; height = candidateHeight; placements = positions
      }
    }
  }
  assert.ok(width <= 4096 && height <= 4096, 'Atlas exceeds candidate texture budget')
  const pixels = Buffer.alloc(width * height * 4)
  const sampler = json.samplers?.[json.textures[firstMaterial.pbrMetallicRoughness.baseColorTexture.index].sampler] ?? {}
  images.forEach((im, index) => {
    im.x = placements[index].x
    im.y = placements[index].y
    // Match the original sampler at the tile boundary, including repeat seams.
    for (let y = -gutter; y < im.height + gutter; y++) {
      for (let x = -gutter; x < im.width + gutter; x++) {
        const from = (atlasBorderIndex(y, im.height, sampler.wrapT) * im.width + atlasBorderIndex(x, im.width, sampler.wrapS)) * 4
        const to = ((im.y + y) * width + im.x + x) * 4
        im.data.copy(pixels, to, from, from + 4)
      }
    }
  })
  const png = await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer()
  const roundTrip = await sharp(png).raw().toBuffer()
  assert.ok(roundTrip.equals(pixels), 'Atlas pixels changed in encoding')
  const chunks = [bin]
  let length = bin.length
  const appendView = (data, target) => {
    const pad = (4 - length % 4) % 4
    if (pad) { chunks.push(Buffer.alloc(pad)); length += pad }
    const index = json.bufferViews.length
    json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: data.length, ...(target ? { target } : {}) })
    chunks.push(data); length += data.length
    return index
  }
  const appendAccessor = (values, template, target, sparse = false) => {
    const type = Object.entries(types).find(([, Type]) => values instanceof Type)[0]
    const index = json.accessors.length, size = components[template.type]
    const a = { componentType: Number(type), count: values.length / size, type: template.type }
    let sparseEncoded = false
    if (sparse && values instanceof Float32Array) {
      const ids = [], nonzero = []
      for (let i = 0; i < a.count; i++) {
        const vector = values.subarray(i * size, (i + 1) * size)
        if (vector.some(v => v !== 0 || Object.is(v, -0))) { ids.push(i); nonzero.push(...vector) }
      }
      const Index = a.count <= 65536 ? Uint16Array : Uint32Array
      if (ids.length * (Index.BYTES_PER_ELEMENT + size * 4) < values.byteLength) {
        sparseEncoded = true
        if (ids.length) {
          const indices = Index.from(ids), payload = Float32Array.from(nonzero)
          a.sparse = { count: ids.length,
            indices: { bufferView: appendView(Buffer.from(indices.buffer)), componentType: Index === Uint16Array ? 5123 : 5125 },
            values: { bufferView: appendView(Buffer.from(payload.buffer)) } }
        }
      }
    }
    if (!sparseEncoded) a.bufferView = appendView(Buffer.from(values.buffer, values.byteOffset, values.byteLength), target)
    if (template.min || template.max) {
      a.min = Array(size).fill(Infinity); a.max = Array(size).fill(-Infinity)
      values.forEach((v, i) => { a.min[i % size] = Math.min(a.min[i % size], v); a.max[i % size] = Math.max(a.max[i % size], v) })
    }
    json.accessors.push(a)
    return index
  }
  const merged = { attributes: {}, material: parts[0].material }
  const combine = (indices, semantic, remapUv = false) => {
    const arrays = indices.map((i, partIndex) => i === undefined && group === 'skin' && semantic.startsWith('morph ')
      ? new Float32Array(json.accessors[parts[partIndex].attributes.POSITION].count * components[json.accessors[indices[0]].type])
      : readAccessor(json, bin, i))
    const Type = arrays[0].constructor
    assert.ok(arrays.every(a => a.constructor === Type))
    const result = new Type(arrays.reduce((n, a) => n + a.length, 0))
    let offset = 0
    arrays.forEach((a, index) => {
      result.set(a, offset)
      if (remapUv) {
        const im = images[index]
        for (let i = 0; i < a.length; i += 2) {
          assert.ok(a[i] >= -1e-5 && a[i] <= 1.00001 && a[i + 1] >= -1e-5 && a[i + 1] <= 1.00001, 'Repeating UV needs triangle splitting')
          result[offset + i] = (im.x + a[i] * im.width) / width
          result[offset + i + 1] = (im.y + a[i + 1] * im.height) / height
        }
      } else assert.deepEqual(result.subarray(offset, offset + a.length), a, `${semantic} changed`)
      offset += a.length
    })
    return appendAccessor(result, json.accessors[indices[0]], 34962, semantic.startsWith('morph '))
  }
  for (const semantic of channels) merged.attributes[semantic] = combine(parts.map(p => p.attributes[semantic]), semantic, semantic === 'TEXCOORD_0')
  if (firstMaterial.normalTexture || firstMaterial.emissiveTexture) {
    merged.attributes.TEXCOORD_1 = combine(parts.map(p => p.attributes.TEXCOORD_0), 'original map UV')
    for (const key of ['normalTexture', 'emissiveTexture']) {
      if (firstMaterial[key]) firstMaterial[key].texCoord = 1
    }
  }
  if (targetCount) merged.targets = Array.from({ length: targetCount }, (_, index) => {
    const semantics = Object.keys(parts[0].targets[index]).sort()
    parts.forEach(p => { if (p.targets) assert.deepEqual(Object.keys(p.targets[index]).sort(), semantics) })
    return Object.fromEntries(semantics.map(semantic => [semantic, combine(parts.map(p => p.targets?.[index][semantic]), `morph ${index} ${semantic}`)]))
  })
  const indices = [], vertexCounts = parts.map(p => json.accessors[p.attributes.POSITION].count)
  let vertexOffset = 0
  parts.forEach((p, i) => {
    for (const v of readAccessor(json, bin, p.indices)) { assert.ok(v < vertexCounts[i]); indices.push(v + vertexOffset) }
    vertexOffset += vertexCounts[i]
  })
  merged.indices = appendAccessor(Uint32Array.from(indices), { type: 'SCALAR' }, 34963)
  mesh.primitives = mesh.primitives.flatMap(p => p === parts[0] ? [merged] : parts.includes(p) ? [] : [p])
  const textureIndex = json.textures.length, imageIndex = json.images.length
  const atlasName = { outfit: 'Alife_Outfit_Atlas_Candidate', 'face-lines': 'Alife_FaceLines_Atlas_Candidate', 'face-opaque': 'Alife_FaceOpaque_Atlas_Candidate', skin: 'Alife_Skin_Atlas_Candidate' }[group]
  json.images.push({ name: atlasName, mimeType: 'image/png', bufferView: appendView(png) })
  json.textures.push({ source: imageIndex, sampler: json.textures[firstMaterial.pbrMetallicRoughness.baseColorTexture.index].sampler })
  firstMaterial.pbrMetallicRoughness.baseColorTexture = { index: textureIndex }
  // Decode only what was edited in the deliverable. Unchanged skin/face/hair
  // keep their original Draco payload and accessor metadata; no new quantization.
  let retainedDracoPrimitives = 0
  for (const [p, original] of originalPrimitives) {
    if (parts.includes(p) || !original.extensions?.KHR_draco_mesh_compression) continue
    p.extensions = structuredClone(original.extensions)
    for (const index of [...Object.values(p.attributes), p.indices]) json.accessors[index] = structuredClone(sourceJson.accessors[index])
    retainedDracoPrimitives++
  }
  if (retainedDracoPrimitives) {
    json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), 'KHR_draco_mesh_compression'])]
    json.extensionsRequired = [...new Set([...(json.extensionsRequired ?? []), 'KHR_draco_mesh_compression'])]
  }
  // Every untouched binary view remains byte-identical. Retain original BIN for
  // this proof candidate; release compaction/compression is a separate step.
  assert.deepEqual(json.animations, before.animations)
  assert.deepEqual(json.nodes, before.nodes)
  assert.deepEqual(json.skins, before.skins)
  assert.deepEqual(mesh.weights, before.meshes[json.meshes.indexOf(mesh)].weights)
  const pad = (4 - length % 4) % 4
  if (pad) { chunks.push(Buffer.alloc(pad)); length += pad }
  json.buffers[0].byteLength = length
  const content = Buffer.from(JSON.stringify(json)), text = Buffer.alloc(Math.ceil(content.length / 4) * 4, 32)
  content.copy(text)
  const header = Buffer.alloc(20), bh = Buffer.alloc(8)
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + text.length + length, 8)
  header.writeUInt32LE(text.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
  bh.writeUInt32LE(length); bh.writeUInt32LE(0x004e4942, 4)
  const output = Buffer.concat([header, text, bh, ...chunks])
  const after = parse(output)
  assert.ok(after.bin.subarray(0, bin.length).equals(bin))
  const used = g => new Set(g.meshes.flatMap(m => m.primitives.map(p => p.material))).size
  return { output, report: { group, originalBytes: raw.length, candidateBytes: output.length,
    originalUsedMaterials: used(before), candidateUsedMaterials: used(json), mergedPartsBefore: parts.length,
    mergedPartsAfter: 1, vertices: vertexOffset, triangles: indices.length / 3, morphTargets: targetCount,
    atlas: { width, height, pixelExact: group !== 'skin', encodedPixelsExact: true, gutter, mipSafe }, rigAndAnimationsUnchanged: true, retainedDracoPrimitives,
    ...(group === 'skin' ? { churchUnlitSkinRuntimeOnly: true, opaqueFaceAlphaBaked: true, bodyBackfacesEnabled: true, visualEquivalenceVerified: false } : {}),
    runtimeReleaseAllowed: false, remaining: 'Full character 2–3 materials, shared rig, mip/distance visual review and release compression are not complete.' } }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output, option, groupOption, layoutOption, ...extra] = process.argv.slice(2)
  assert.ok(groupOption === undefined || ['--outfit', '--face-lines', '--face-opaque', '--skin'].includes(groupOption), 'Unknown atlas group option')
  assert.ok(extra.length === 0 && (layoutOption === undefined || layoutOption === '--mip-safe'), 'Unknown atlas layout option')
  assert.ok(layoutOption === undefined || (option === '--compact' && groupOption), 'Explicit atlas group required for alternate layout')
  assert.ok(groupOption === undefined || option === '--compact', 'Grouped atlas must use the compact atlas path')
  assert.ok(input && output, 'Usage: node <script> input.glb output.glb [--compact|--compact-existing|--compact-constant-animation|--compact-bounded-animation] [--outfit|--face-lines|--face-opaque|--skin] [--mip-safe]')
  assert.ok(option === undefined || option === '--compact' || option === '--compact-existing' || option === '--compact-constant-animation' || option === '--compact-bounded-animation', 'Unknown candidate option')
  const source = await realpath(input), destination = resolve(output), parent = await realpath(dirname(destination))
  assert.ok(parent.toLowerCase().startsWith('c:\\data\\alife\\temp\\'), 'Candidate must be in a task folder under C:\\Data\\Alife\\Temp')
  assert.notEqual(source.toLowerCase(), destination.toLowerCase())
  let result
  if (option === '--compact-bounded-animation') result = compactBoundedAnimationKeys(await readFile(source))
  else if (option === '--compact-constant-animation') result = compactConstantAnimationKeys(await readFile(source))
  else if (option === '--compact-existing') result = compactCharacterCandidate(await readFile(source))
  else {
    assert.ok(process.env.ALIFE_SHARP_MODULE, 'Set ALIFE_SHARP_MODULE to the installed image toolchain')
    const sharp = createRequire(import.meta.url)(process.env.ALIFE_SHARP_MODULE)
    result = await buildOutfitAtlasCandidate(await readFile(source), sharp, { group: groupOption?.slice(2) ?? 'outfit', mipSafe: layoutOption === '--mip-safe' })
  }
  if (option === '--compact') {
    const compacted = compactCharacterCandidate(result.output)
    result.output = compacted.output
    result.report.compaction = compacted.report
    result.report.candidateBytes = compacted.output.length
  }
  await writeFile(destination, result.output, { flag: 'wx' })
  console.log(JSON.stringify({ output: destination, ...result.report }, null, 2))
}
