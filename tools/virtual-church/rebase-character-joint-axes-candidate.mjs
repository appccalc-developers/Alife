// Offline basis compatibility candidate, NOT shared motion or a release asset.
// G' = G C and inverseBind' = inverse(C) inverseBind preserve skinning.
// Local' = inverse(C_parent) Local C also compensates non-human descendants.
import assert from 'node:assert/strict'
import { readFile, writeFile, realpath } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { Quaternion, Vector3, Matrix4, AnimationMixer, LoopOnce } from '../../cloudflare/alife-app/node_modules/three/build/three.module.js'
import { GLTFLoader } from '../../cloudflare/alife-app/node_modules/three/examples/jsm/loaders/GLTFLoader.js'
import { decompressCharacterDraco } from './gate-a-character-geometry.mjs'
import { parseCharacterGlb, encodeCharacterGlb, readAccessor, compactCharacterCandidate, compactConstantAnimationKeys } from './build-character-outfit-atlas-candidate.mjs'

const identity = () => new Quaternion()
const rotation = node => new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1])
const isIdentity = q => q.angleTo(identity()) < 1e-10
const commonRigScenes = new WeakSet()

// glTF matrix nodes must be decomposable TRS. A general affine basis cannot
// simply be handed to GLTFLoader: decomposing shear would change the model.
// Offline SVD factors A = U S V^T into two ordinary, static TRS nodes.
export function factorCommonRigAffine(matrix) {
  const e = matrix.elements
  assert.ok(e.every(Number.isFinite) && Math.abs(matrix.determinant()) > 1e-8, 'Invalid affine basis')
  assert.ok(Math.abs(e[3]) + Math.abs(e[7]) + Math.abs(e[11]) + Math.abs(e[15] - 1) < 1e-12, 'Projective basis is unsupported')
  const position = new Vector3(), quaternion = new Quaternion(), scale = new Vector3()
  matrix.decompose(position, quaternion, scale)
  const simple = new Matrix4().compose(position, quaternion, scale)
  const residual = other => Math.max(...e.map((value, i) => Math.abs(value - other.elements[i])))
  if (residual(simple) < 1e-11) return [{ translation: position.toArray(), rotation: quaternion.toArray(), scale: scale.toArray() }]
  const a = Array.from({ length: 3 }, (_, row) => Array.from({ length: 3 }, (_, col) => e[col * 4 + row]))
  const b = Array.from({ length: 3 }, (_, row) => Array.from({ length: 3 }, (_, col) => a.reduce((sum, v) => sum + v[row] * v[col], 0)))
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
  for (let iteration = 0; iteration < 64; iteration++) {
    const [p, q] = [[0, 1], [0, 2], [1, 2]].sort((x, y) => Math.abs(b[y[0]][y[1]]) - Math.abs(b[x[0]][x[1]]))[0]
    if (Math.abs(b[p][q]) < 1e-14 * Math.max(1, ...b.map((row, i) => Math.abs(row[i])))) break
    const angle = .5 * Math.atan2(2 * b[p][q], b[q][q] - b[p][p]), c = Math.cos(angle), s = Math.sin(angle)
    const pp = b[p][p], qq = b[q][q], pq = b[p][q]
    b[p][p] = c * c * pp - 2 * s * c * pq + s * s * qq
    b[q][q] = s * s * pp + 2 * s * c * pq + c * c * qq
    b[p][q] = b[q][p] = 0
    for (let k = 0; k < 3; k++) {
      if (k !== p && k !== q) {
        const kp = b[k][p], kq = b[k][q]
        b[k][p] = b[p][k] = c * kp - s * kq
        b[k][q] = b[q][k] = s * kp + c * kq
      }
      const vp = v[k][p], vq = v[k][q]
      v[k][p] = c * vp - s * vq; v[k][q] = s * vp + c * vq
    }
  }
  const det = r => r[0][0] * (r[1][1] * r[2][2] - r[1][2] * r[2][1]) - r[0][1] * (r[1][0] * r[2][2] - r[1][2] * r[2][0]) + r[0][2] * (r[1][0] * r[2][1] - r[1][1] * r[2][0])
  if (det(v) < 0) v.forEach(row => { row[2] *= -1 })
  const singular = b.map((row, i) => Math.sqrt(row[i]))
  assert.ok(singular.every(value => Number.isFinite(value) && value > 1e-8), 'Singular affine factor')
  const u = a.map(row => v[0].map((_, col) => row.reduce((sum, value, k) => sum + value * v[k][col], 0) / singular[col]))
  if (det(u) < 0) { u.forEach(row => { row[2] *= -1 }); singular[2] *= -1 }
  const rotationMatrix = rows => new Matrix4().set(...rows[0], 0, ...rows[1], 0, ...rows[2], 0, 0, 0, 0, 1)
  const left = { translation: [e[12], e[13], e[14]], rotation: new Quaternion().setFromRotationMatrix(rotationMatrix(u)).normalize().toArray(), scale: singular }
  const right = { rotation: new Quaternion().setFromRotationMatrix(rotationMatrix(v[0].map((_, i) => v.map(row => row[i])))).normalize().toArray() }
  const compose = node => new Matrix4().compose(new Vector3().fromArray(node.translation ?? [0, 0, 0]), new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]), new Vector3().fromArray(node.scale ?? [1, 1, 1]))
  assert.ok(residual(compose(left).multiply(compose(right))) < 1e-9, 'Affine TRS factors failed reconstruction')
  return [left, right]
}

/** Exported hierarchy proof only, not a shared motion/production asset.
 * Constant basis factors surround original animated TRS. AnimationMixer still
 * mixes the original keys, so LINEAR/STEP/CUBICSPLINE and partial action weights
 * stay in their accepted space without a custom post-mix runtime callback.
 */
export function exportCommonHumanRigCandidate(source, reference) {
  const { json, bin } = parseCharacterGlb(source), ref = parseCharacterGlb(reference).json
  const original = structuredClone(json), a = hierarchy(json), b = hierarchy(ref)
  assert.ok(a.human.size && !json.nodes.some(n => n.name?.startsWith('__VC_Common_')), 'Human source required; already exported/reserved helper name')
  assert.deepEqual([...a.human.keys()].sort(), [...b.human.keys()].sort(), 'Human foundation must cover every reference joint')
  const worlds = (doc, tree) => {
    const result = new Map()
    const at = i => {
      if (result.has(i)) return result.get(i)
      const node = doc.nodes[i], value = new Matrix4().compose(new Vector3().fromArray(node.translation ?? [0, 0, 0]), rotation(node), new Vector3().fromArray(node.scale ?? [1, 1, 1]))
      if (tree.parents.has(i)) value.premultiply(at(tree.parents.get(i)))
      assert.ok(value.elements.every(Number.isFinite) && Math.abs(value.determinant()) > 1e-8, 'Invalid source/reference rest')
      result.set(i, value); return value
    }
    doc.nodes.forEach((_, i) => at(i)); return result
  }
  const sw = worlds(json, a), rw = worlds(ref, b), bases = json.nodes.map(() => new Matrix4()), poseTargets = new Map(), heads = new Map()
  for (const [name, i] of a.human) {
    const j = b.human.get(name)
    assert.equal(json.nodes[a.parents.get(i)]?.name, ref.nodes[b.parents.get(j)]?.name, `Parent differs for ${name}`)
    bases[i].copy(sw.get(i)).invert().multiply(rw.get(j))
    assert.ok(json.nodes[i].mesh === undefined && json.nodes[i].camera === undefined && !json.nodes[i].extensions, 'Human joint payload needs separately mapped export')
  }
  const identityElements = new Matrix4().elements, changed = m => m.elements.some((value, i) => Math.abs(value - identityElements[i]) > 1e-12)
  let affineFactorPairs = 0
  const append = node => { const index = json.nodes.length; json.nodes.push(node); return index }
  const factors = (matrix, name) => {
    if (!changed(matrix)) return []
    const nodes = factorCommonRigAffine(matrix)
    if (nodes.length === 2) affineFactorPairs++
    return nodes.map((node, i) => ({ ...node, name: `__VC_Common_${name}_${i}` }))
  }
  for (let i = 0; i < original.nodes.length; i++) {
    const left = a.parents.has(i) ? bases[a.parents.get(i)].clone().invert() : new Matrix4(), right = bases[i]
    if (!changed(left) && !changed(right)) continue
    const old = original.nodes[i], chain = factors(left, `Left_${i}`)
    if (a.human.has(old.name)) {
      const pose = { name: `__VC_Common_Pose_${old.name}`, translation: old.translation, rotation: old.rotation, scale: old.scale }
      const rightFactors = factors(right, `Right_${i}`)
      // The original named skin joint remains the last factor and continues
      // owning its original children, skin index, collider refs and metadata.
      const final = rightFactors.pop() ?? {}
      delete final.name
      delete json.nodes[i].translation; delete json.nodes[i].rotation; delete json.nodes[i].scale
      Object.assign(json.nodes[i], final)
      chain.push(pose, ...rightFactors)
      poseTargets.set(i, null)
    }
    const indices = chain.map(append)
    indices.forEach((index, k) => { json.nodes[index].children = [indices[k + 1] ?? i] })
    heads.set(i, indices[0] ?? i)
    if (poseTargets.has(i)) poseTargets.set(i, indices[chain.findIndex(node => node.name.startsWith('__VC_Common_Pose_'))])
  }
  original.nodes.forEach((old, i) => { if (old.children) json.nodes[i].children = old.children.map(child => heads.get(child) ?? child) })
  for (const scene of json.scenes) scene.nodes = scene.nodes.map(node => heads.get(node) ?? node)
  for (const animation of json.animations) for (const channel of animation.channels) {
    assert.ok(['rotation', 'translation', 'scale', 'weights'].includes(channel.target.path), 'Unknown animation path')
    if (poseTargets.has(channel.target.node)) {
      assert.notEqual(channel.target.path, 'weights', 'Human joint morph target is unsupported')
      channel.target.node = poseTargets.get(channel.target.node)
    }
  }
  const referenceDoc = parseCharacterGlb(reference), referenceBinds = new Map()
  for (const skin of ref.skins) {
    assert.ok(skin.inverseBindMatrices !== undefined, 'Reference inverse binds required')
    const values = readAccessor(ref, referenceDoc.bin, skin.inverseBindMatrices)
    skin.joints.forEach((node, i) => {
      const name = ref.nodes[node].name
      if (!b.human.has(name)) return
      const matrix = new Matrix4().fromArray(values, i * 16)
      if (referenceBinds.has(name)) assert.ok(matrix.elements.every((value, k) => Math.abs(value - referenceBinds.get(name).elements[k]) < 1e-6), 'Reference binds differ')
      referenceBinds.set(name, matrix)
    })
  }
  let commonHumanInverseBindResidual = 0
  const chunks = [bin]; let length = bin.length
  for (const skin of json.skins) {
    assert.ok(skin.inverseBindMatrices !== undefined, 'Explicit inverse binds required')
    const old = readAccessor(original, bin, skin.inverseBindMatrices), next = new Float32Array(old.length)
    assert.equal(old.length, skin.joints.length * 16)
    skin.joints.forEach((node, i) => bases[node].clone().invert().multiply(new Matrix4().fromArray(old, i * 16)).toArray(next, i * 16))
    skin.joints.forEach((node, i) => {
      const name = original.nodes[node].name
      if (!a.human.has(name)) return
      assert.ok(referenceBinds.has(name), 'Missing reference inverse bind')
      commonHumanInverseBindResidual = Math.max(commonHumanInverseBindResidual, ...referenceBinds.get(name).elements.map((value, k) => Math.abs(value - next[i * 16 + k])))
    })
    const padding = (4 - length % 4) % 4; chunks.push(Buffer.alloc(padding)); length += padding
    const bytes = Buffer.from(next.buffer), view = json.bufferViews.length
    json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length }); chunks.push(bytes); length += bytes.length
    skin.inverseBindMatrices = json.accessors.length
    json.accessors.push({ bufferView: view, componentType: 5126, count: skin.joints.length, type: 'MAT4' })
  }
  assert.ok(commonHumanInverseBindResidual < 1e-5, 'Export inverse binds are not common')
  json.extras = { ...json.extras, commonHumanRestCandidate: { version: 1, sourceSha256: createHash('sha256').update(source).digest('hex'), referenceSha256: createHash('sha256').update(reference).digest('hex'), sharedMotionImplemented: false, runtimeReleaseAllowed: false } }
  const output = encodeCharacterGlb(json, Buffer.concat(chunks))
  // Retain original BIN prefix byte-for-byte: all keys, morphs, images and
  // compressed geometry remain exact; only appended inverse binds are new.
  assert.ok(parseCharacterGlb(output).bin.subarray(0, bin.length).equals(bin))
  assert.deepEqual(json.materials, original.materials); assert.deepEqual(json.meshes, original.meshes)
  return { output, report: { commonHumanJoints: a.human.size, addedNodes: json.nodes.length - original.nodes.length, affineFactorPairs, commonHumanInverseBindResidual,
    originalPayloadBytesPreserved: bin.length, originalAnimationSamplersPreserved: true, inverseBindsStoredAsFloat32: true,
    bytes: output.length, hashes: [source, reference, output].map(bytes => createHash('sha256').update(bytes).digest('hex')),
    commonHumanRestExported: true, sharedMotionImplemented: false, customPostMixCallbackRequired: false, skinnedWorldSpaceVerified: false, runtimeReleaseAllowed: false } }
}

/** Approximate, offline rebake experiment. Removes helper layers by writing
 * normalized default TRS and rebaking each clip at 240Hz. This does NOT prove
 * mixed clips equivalent: translated basis compensation and quaternion mixing
 * do not commute. A failed blend comparison must prevent runtime promotion.
 */
export async function bakeCommonHumanRigCandidate(source, reference) {
  const basis = exportCommonHumanRigCandidate(source, reference)
  const original = parseCharacterGlb(source), bound = parseCharacterGlb(basis.output)
  const decoded = parseCharacterGlb(await decompressCharacterDraco(source))
  decoded.json.materials = decoded.json.materials.map(material => ({ name: material.name }))
  delete decoded.json.images; delete decoded.json.textures
  const stripped = encodeCharacterGlb(decoded.json, decoded.bin)
  const model = await new GLTFLoader().parseAsync(stripped.buffer.slice(stripped.byteOffset, stripped.byteOffset + stripped.length), '')
  const adapter = createCommonHumanRigAdapter(source, reference, model.scene), mixer = new AnimationMixer(model.scene)
  const json = structuredClone(original.json), names = new Map(json.nodes.map((node, i) => [node.name, i]))
  assert.equal(names.size, json.nodes.length, 'Unique source node names required for rebake')
  json.skins = bound.json.skins; json.accessors = bound.json.accessors; json.bufferViews = bound.json.bufferViews
  const chunks = [bound.bin]; let length = bound.bin.length, maximumTrsMatrixResidual = 0, samples = 0
  const append = (values, type, width) => {
    const padding = (4 - length % 4) % 4; chunks.push(Buffer.alloc(padding)); length += padding
    const bytes = Buffer.from(values.buffer, values.byteOffset, values.byteLength), view = json.bufferViews.length
    json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length }); chunks.push(bytes); length += bytes.length
    const index = json.accessors.length
    json.accessors.push({ bufferView: view, componentType: 5126, type, count: values.length / width })
    return index
  }
  const decompose = matrix => {
    const p = new Vector3(), q = new Quaternion(), s = new Vector3()
    matrix.decompose(p, q, s); q.normalize()
    const represented = new Matrix4().compose(p, q, s)
    const residual = Math.max(...matrix.elements.map((value, i) => Math.abs(value - represented.elements[i])))
    assert.ok(Number.isFinite(residual) && residual < 1e-4, 'Rebake would discard significant shear')
    maximumTrsMatrixResidual = Math.max(maximumTrsMatrixResidual, residual)
    return { translation: p.toArray(), rotation: q.toArray(), scale: s.toArray() }
  }
  let affectedNames
  try {
    adapter.update()
    const rest = adapter.poseMatrices()
    affectedNames = [...rest.keys()]
    for (const [name, matrix] of rest) {
      assert.ok(names.has(name), 'Rebake pose must address an original node')
      Object.assign(json.nodes[names.get(name)], decompose(matrix))
    }
    const affectedIndices = new Set(affectedNames.map(name => names.get(name)))
    json.animations = original.json.animations.map((animation, index) => {
      mixer.stopAllAction()
      const clip = model.animations[index]
      assert.equal(clip.name, animation.name)
      const action = mixer.clipAction(clip).reset().setLoop(LoopOnce, 1)
      action.clampWhenFinished = true; action.play()
      const times = [...new Set(Array.from({ length: Math.ceil(clip.duration * 240) + 1 }, (_, i) => Math.fround(Math.min(i / 240, clip.duration))))]
      assert.ok(times.length > 1 && times.every((t, i) => i === 0 || t > times[i - 1]))
      const tracks = new Map(affectedNames.map(name => [name, { translation: [], rotation: [], scale: [] }]))
      for (const time of times) {
        mixer.setTime(time); adapter.update(); samples++
        for (const [name, matrix] of adapter.poseMatrices()) {
          const pose = decompose(matrix), target = tracks.get(name)
          const prev = target.rotation.slice(-4)
          if (prev.length && pose.rotation.reduce((sum, value, i) => sum + value * prev[i], 0) < 0) pose.rotation = pose.rotation.map(value => -value)
          for (const path of ['translation', 'rotation', 'scale']) target[path].push(...pose[path])
        }
      }
      const result = structuredClone(animation)
      result.channels = result.channels.filter(channel => channel.target.path === 'weights' || !affectedIndices.has(channel.target.node))
      const input = append(Float32Array.from(times), 'SCALAR', 1)
      json.accessors[input].min = [times[0]]; json.accessors[input].max = [times.at(-1)]
      for (const [name, track] of tracks) for (const path of ['translation', 'rotation', 'scale']) {
        const sampler = result.samplers.length, width = path === 'rotation' ? 4 : 3
        result.samplers.push({ input, output: append(Float32Array.from(track[path]), path === 'rotation' ? 'VEC4' : 'VEC3', width), interpolation: 'LINEAR' })
        result.channels.push({ sampler, target: { node: names.get(name), path } })
      }
      const used = [...new Set(result.channels.map(channel => channel.sampler))], remap = new Map(used.map((value, i) => [value, i]))
      result.channels.forEach(channel => { channel.sampler = remap.get(channel.sampler) })
      result.samplers = used.map(value => result.samplers[value])
      return result
    })
  } finally { mixer.stopAllAction(); adapter.dispose(); mixer.uncacheRoot(model.scene) }
  json.extras = { ...json.extras, commonHumanRestCandidate: { ...bound.json.extras.commonHumanRestCandidate,
    strategy: 'approximate-240hz-local-trs-rebake', sampleHz: 240, blendEquivalenceUnverified: true, runtimeReleaseAllowed: false } }
  const rebaked = encodeCharacterGlb(json, Buffer.concat(chunks))
  // Only exact constant plateaus are removed; no bounded reduction here.
  const compacted = compactCharacterCandidate(compactConstantAnimationKeys(rebaked).output)
  const final = parseCharacterGlb(compacted.output), payload = (doc, index) => {
    const view = doc.json.bufferViews[index]
    return doc.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
  }
  assert.deepEqual(final.json.materials, original.json.materials)
  assert.deepEqual(final.json.textures ?? [], original.json.textures ?? [])
  assert.equal(final.json.images?.length ?? 0, original.json.images?.length ?? 0)
  for (const [i, image] of (original.json.images ?? []).entries()) assert.ok(payload(original, image.bufferView).equals(payload(final, final.json.images[i].bufferView)))
  for (const [i, mesh] of original.json.meshes.entries()) for (const [k, primitive] of mesh.primitives.entries()) {
    const other = final.json.meshes[i].primitives[k]
    if (primitive.extensions?.KHR_draco_mesh_compression) assert.ok(payload(original, primitive.extensions.KHR_draco_mesh_compression.bufferView).equals(payload(final, other.extensions.KHR_draco_mesh_compression.bufferView)))
    else for (const semantic of Object.keys(primitive.attributes)) assert.deepEqual(readAccessor(original.json, original.bin, primitive.attributes[semantic]), readAccessor(final.json, final.bin, other.attributes[semantic]))
    for (const [m, target] of (primitive.targets ?? []).entries()) for (const semantic of Object.keys(target)) assert.deepEqual(readAccessor(original.json, original.bin, target[semantic]), readAccessor(final.json, final.bin, other.targets[m][semantic]))
  }
  for (const [i, clip] of original.json.animations.entries()) {
    const other = final.json.animations[i]
    for (const channel of clip.channels.filter(channel => channel.target.path === 'weights')) {
      const match = other.channels.find(c => c.target.node === channel.target.node && c.target.path === 'weights')
      assert.ok(match, 'Original morph channel required')
      const a = clip.samplers[channel.sampler], b = other.samplers[match.sampler]
      assert.equal(a.interpolation, b.interpolation)
      for (const key of ['input', 'output']) assert.deepEqual(readAccessor(original.json, original.bin, a[key]), readAccessor(final.json, final.bin, b[key]))
    }
  }
  return { output: compacted.output, report: { commonHumanJoints: basis.report.commonHumanJoints,
    commonHumanInverseBindResidual: basis.report.commonHumanInverseBindResidual, bytes: compacted.output.length,
    hashes: [source, reference, compacted.output].map(bytes => createHash('sha256').update(bytes).digest('hex')),
    addedNodes: 0, affectedNodes: affectedNames.length, bakedSamples: samples, sampleHz: 240, maximumTrsMatrixResidual,
    originalAnimationSamplersPreserved: false, originalGeometryAndImagesPreserved: true,
    commonHumanRestExported: true, sharedMotionImplemented: false, customPostMixCallbackRequired: false,
    singleAndMixedMotionVerified: false, approximation: 'Sampled local TRS with small discarded shear; single-clip equivalence does not prove post-mix equivalence.', runtimeReleaseAllowed: false } }
}

/** Offline full-rest-pose proof, not a public runtime adapter or shared clip.
 * AnimationMixer continues to evaluate the accepted character-local TRS.
 * After mixing, L' = inverse(C_parent) L C and IBM' = inverse(C) IBM
 * preserve skinning. Transforming only clip keys is not blend-equivalent when
 * C contains translation; this explicit post-mix boundary is intentional.
 * Hair/coat joints retain their own world motion, not the other hero's hair.
 */
export function createCommonHumanRigAdapter(source, reference, scene) {
  assert.ok(!commonRigScenes.has(scene), 'Scene already owns a common-rig candidate')
  const json = parseCharacterGlb(source).json, referenceDoc = parseCharacterGlb(reference), target = referenceDoc.json
  const a = hierarchy(json), b = hierarchy(target)
  assert.ok(a.human.size > 0, 'Human joints required')
  assert.deepEqual([...a.human.keys()].sort(), [...b.human.keys()].sort(), 'Human foundation must cover every reference joint')
  const worldMatrices = (doc, tree) => {
    const result = new Map()
    const at = i => {
      if (result.has(i)) return result.get(i)
      const node = doc.nodes[i]
      const matrix = new Matrix4().compose(new Vector3().fromArray(node.translation ?? [0, 0, 0]),
        rotation(node), new Vector3().fromArray(node.scale ?? [1, 1, 1]))
      if (tree.parents.has(i)) matrix.premultiply(at(tree.parents.get(i)))
      assert.ok(matrix.elements.every(Number.isFinite) && Math.abs(matrix.determinant()) > 1e-8, 'Singular/nonfinite rest transform')
      result.set(i, matrix); return matrix
    }
    doc.nodes.forEach((_, i) => at(i)); return result
  }
  const sourceWorld = worldMatrices(json, a), referenceWorld = worldMatrices(target, b)
  const bases = json.nodes.map(() => new Matrix4()), byName = new Map()
  for (const [name, i] of a.human) {
    const j = b.human.get(name)
    assert.equal(json.nodes[a.parents.get(i)]?.name, target.nodes[b.parents.get(j)]?.name, `Parent differs for ${name}`)
    bases[i].copy(sourceWorld.get(i)).invert().multiply(referenceWorld.get(j))
    byName.set(name, bases[i])
  }
  const identityElements = new Matrix4().elements
  const changed = matrix => matrix.elements.some((value, i) => Math.abs(value - identityElements[i]) > 1e-12)
  const objects = new Map()
  scene.traverse(object => {
    // GLTFLoader sanitizes animation-facing names but retains the glTF name.
    const name = object.userData.name ?? object.name
    if (!name) return
    if (!objects.has(name)) objects.set(name, [])
    objects.get(name).push(object)
  })
  const affected = []
  json.nodes.forEach((node, i) => {
    const left = a.parents.has(i) ? bases[a.parents.get(i)].clone().invert() : new Matrix4()
    if (!changed(left) && !changed(bases[i])) return
    assert.equal(objects.get(node.name)?.length, 1, `Missing/ambiguous scene node ${node.name}`)
    const object = objects.get(node.name)[0]
    const rest = new Matrix4().compose(new Vector3().fromArray(node.translation ?? [0, 0, 0]),
      rotation(node), new Vector3().fromArray(node.scale ?? [1, 1, 1]))
    const actual = new Matrix4().compose(object.position, object.quaternion, object.scale)
    assert.ok(actual.elements.every((v, k) => Math.abs(v - rest.elements[k]) < 1e-6), `Scene is not at source rest: ${node.name}`)
    affected.push({ object, left, right: bases[i], autoUpdate: object.matrixAutoUpdate, matrix: object.matrix.clone() })
  })
  const skeletons = new Set()
  scene.traverse(object => { if (object.isSkinnedMesh) skeletons.add(object.skeleton) })
  assert.ok(skeletons.size, 'Skinned scene required')
  const loadedHuman = new Set([...skeletons].flatMap(s => s.bones.map(bone => bone.name)).filter(name => byName.has(name)))
  assert.deepEqual([...loadedHuman].sort(), [...a.human.keys()].sort(), 'Skinned human coverage differs')
  const inverseBinds = [...skeletons].map(skeleton => {
    assert.equal(skeleton.bones.length, skeleton.boneInverses.length)
    return { skeleton, original: skeleton.boneInverses.map(m => m.clone()),
      next: skeleton.boneInverses.map((matrix, i) => byName.has(skeleton.bones[i].name)
        ? byName.get(skeleton.bones[i].name).clone().invert().multiply(matrix)
        : matrix.clone()) }
  })
  const referenceBinds = new Map()
  for (const skin of target.skins) {
    const values = readAccessor(target, referenceDoc.bin, skin.inverseBindMatrices)
    skin.joints.forEach((node, i) => {
      const name = target.nodes[node].name
      if (!b.human.has(name)) return
      const matrix = new Matrix4().fromArray(values, i * 16)
      if (referenceBinds.has(name)) assert.ok(matrix.elements.every((v, k) => Math.abs(v - referenceBinds.get(name).elements[k]) < 1e-6), `Reference inverse binds differ: ${name}`)
      referenceBinds.set(name, matrix)
    })
  }
  let commonHumanInverseBindResidual = 0
  for (const { skeleton, next } of inverseBinds) skeleton.bones.forEach((bone, i) => {
    if (!byName.has(bone.name)) return
    assert.ok(referenceBinds.has(bone.name), `Missing reference inverse bind ${bone.name}`)
    commonHumanInverseBindResidual = Math.max(commonHumanInverseBindResidual,
      ...next[i].elements.map((value, k) => Math.abs(value - referenceBinds.get(bone.name).elements[k])))
  })
  assert.ok(commonHumanInverseBindResidual < 1e-5, `Human inverse binds are not common: ${commonHumanInverseBindResidual}`)
  // All validation precedes the first mutation. A refused input stays intact.
  inverseBinds.forEach(({ skeleton, next }) => next.forEach((matrix, i) => skeleton.boneInverses[i].copy(matrix)))
  commonRigScenes.add(scene)
  let disposed = false
  const applyPose = () => {
    assert.ok(!disposed, 'Disposed common-rig candidate')
    affected.forEach(({ object, left, right }) => {
      // Always compose fresh source TRS. Repeated updates cannot accumulate C.
      object.matrix.compose(object.position, object.quaternion, object.scale).premultiply(left).multiply(right)
      object.matrixAutoUpdate = false
      object.matrixWorldNeedsUpdate = true
    })
  }
  const update = () => {
    applyPose()
    scene.updateMatrixWorld(true)
    skeletons.forEach(skeleton => skeleton.update())
  }
  const dispose = () => {
    if (disposed) return
    inverseBinds.forEach(({ skeleton, original }) => original.forEach((matrix, i) => skeleton.boneInverses[i].copy(matrix)))
    affected.forEach(({ object, autoUpdate, matrix }) => {
      object.matrixAutoUpdate = autoUpdate
      if (autoUpdate) object.updateMatrix()
      else object.matrix.copy(matrix)
      object.matrixWorldNeedsUpdate = true
    })
    scene.updateMatrixWorld(true); skeletons.forEach(skeleton => skeleton.update())
    commonRigScenes.delete(scene)
    disposed = true
  }
  const verifyRest = () => {
    let maximumWorldMatrixResidual = 0
    for (const [name, i] of a.human) {
      const object = objects.get(name)[0], wanted = referenceWorld.get(b.human.get(name))
      maximumWorldMatrixResidual = Math.max(maximumWorldMatrixResidual,
        ...object.matrixWorld.elements.map((value, k) => Math.abs(value - wanted.elements[k])))
    }
    return maximumWorldMatrixResidual
  }
  const poseMatrices = () => {
    assert.ok(!disposed, 'Disposed common-rig candidate')
    return new Map(affected.map(({ object }) => [object.userData.name ?? object.name, object.matrix.clone()]))
  }
  return { applyPose, update, dispose, verifyRest, poseMatrices, report: {
    commonHumanJoints: a.human.size, adaptedNodes: affected.length, skinSkeletons: skeletons.size,
    commonHumanInverseBindResidual,
    fullSkinJointCountsUnchanged: true, sourceAnimationKeysUnchanged: true,
    sharedMotionImplemented: false, productionIntegrationAllowed: false,
  } }
}

function hierarchy(json) {
  const parents = new Map(), world = new Map(), visiting = new Set()
  json.nodes.forEach((node, i) => {
    assert.ok(!node.matrix, 'Matrix nodes need a separately verified TRS conversion')
    for (const child of node.children ?? []) {
      assert.ok(json.nodes[child] && !parents.has(child), 'Invalid or multiple-parent node')
      parents.set(child, i)
    }
  })
  const at = i => {
    if (world.has(i)) return world.get(i)
    assert.ok(!visiting.has(i), 'Cyclic node hierarchy')
    visiting.add(i)
    const q = rotation(json.nodes[i]).normalize()
    if (parents.has(i)) q.premultiply(at(parents.get(i)))
    visiting.delete(i); world.set(i, q)
    return q
  }
  json.nodes.forEach((_, i) => at(i))
  const joints = [...new Set(json.skins.flatMap(s => s.joints))]
  const human = new Map()
  for (const i of joints) if (/^J_Bip_/.test(json.nodes[i].name)) {
    const name = json.nodes[i].name
    assert.ok(!human.has(name), `Ambiguous joint ${name}`)
    human.set(name, i)
  }
  return { parents, world, human }
}

export function rebaseCharacterJointAxes(source, reference) {
  const { json, bin } = parseCharacterGlb(source), target = parseCharacterGlb(reference).json
  const original = structuredClone(json), a = hierarchy(json), b = hierarchy(target)
  assert.ok(a.human.size > 0)
  const bases = json.nodes.map(identity)
  for (const [name, i] of a.human) {
    assert.ok(b.human.has(name), `Missing reference joint ${name}`)
    const j = b.human.get(name)
    assert.equal(json.nodes[a.parents.get(i)]?.name, target.nodes[b.parents.get(j)]?.name, `Parent differs for ${name}`)
    bases[i] = a.world.get(i).clone().invert().multiply(b.world.get(j)).normalize()
  }
  const parentInverse = i => (a.parents.has(i) ? bases[a.parents.get(i)] : identity()).clone().invert()
  let maximumLocalMatrixResidual = 0
  json.nodes.forEach((node, i) => {
    const left = parentInverse(i), right = bases[i]
    if (isIdentity(left) && isIdentity(right)) return
    const position = new Vector3().fromArray(node.translation ?? [0, 0, 0])
    const scale = new Vector3().fromArray(node.scale ?? [1, 1, 1])
    const q = rotation(node)
    const wanted = new Matrix4().makeRotationFromQuaternion(left)
      .multiply(new Matrix4().compose(position, q, scale))
      .multiply(new Matrix4().makeRotationFromQuaternion(right))
    position.applyQuaternion(left); q.premultiply(left).multiply(right)
    const represented = new Matrix4().compose(position, q, scale)
    const residual = Math.max(...wanted.elements.map((v, k) => Math.abs(v - represented.elements[k])))
    // Imported nearly-unit scale has float noise. Real nonuniform scale/shear
    // must fail, not be baked away. World-space verification remains required.
    assert.ok(residual <= 1e-5, `Nonuniform scale/shear on ${node.name}: ${residual}`)
    maximumLocalMatrixResidual = Math.max(maximumLocalMatrixResidual, residual)
    node.translation = position.toArray(); node.rotation = q.toArray()
  })
  const chunks = [bin]; let length = bin.length
  const append = (values, type, width) => {
    const padding = (4 - length % 4) % 4
    chunks.push(Buffer.alloc(padding)); length += padding
    const bytes = Buffer.from(values.buffer, values.byteOffset, values.byteLength)
    const view = json.bufferViews.length
    json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length })
    chunks.push(bytes); length += bytes.length
    const accessor = json.accessors.length
    json.accessors.push({ bufferView: view, componentType: 5126, count: values.length / width, type })
    return accessor
  }
  for (const skin of json.skins) {
    assert.ok(skin.inverseBindMatrices !== undefined, 'Explicit inverse binds required')
    const old = readAccessor(original, bin, skin.inverseBindMatrices)
    assert.equal(old.length, skin.joints.length * 16)
    const next = new Float32Array(old.length)
    skin.joints.forEach((node, index) => {
      const matrix = new Matrix4().makeRotationFromQuaternion(bases[node].clone().invert())
        .multiply(new Matrix4().fromArray(old, index * 16))
      matrix.toArray(next, index * 16)
    })
    skin.inverseBindMatrices = append(next, 'MAT4', 16)
  }
  let transformedChannels = 0, cubicChannels = 0
  for (const animation of json.animations) {
    const sourceSamplers = animation.samplers.slice()
    // One original sampler may target multiple nodes with different bases.
    // Never edit it in place; preserve exact morph/untouched channels.
    for (const channel of animation.channels) {
      const { node, path } = channel.target
      if (path === 'weights') continue
      const left = parentInverse(node), right = bases[node]
      if ((path === 'translation' && isIdentity(left)) || (isIdentity(left) && isIdentity(right))) continue
      const sampler = sourceSamplers[channel.sampler]
      assert.ok(['LINEAR', 'STEP', 'CUBICSPLINE'].includes(sampler.interpolation ?? 'LINEAR'))
      const values = readAccessor(original, bin, sampler.output)
      if (path === 'scale') {
        if (!isIdentity(right)) for (let k = 0; k < values.length; k += 3) {
          assert.ok(Math.abs(values[k] - values[k + 1]) < 1e-7 && Math.abs(values[k] - values[k + 2]) < 1e-7, 'Animated nonuniform scale needs shear-aware rebaking')
        }
        continue
      }
      assert.ok(path === 'rotation' || path === 'translation')
      const width = path === 'rotation' ? 4 : 3, next = new Float32Array(values.length)
      for (let k = 0; k < values.length; k += width) {
        if (path === 'rotation') {
          // The same linear left/right multiplication applies to cubic tangents.
          // Normalizing tangents would destroy cubic interpolation.
          new Quaternion().fromArray(values, k).premultiply(left).multiply(right).toArray(next, k)
        } else new Vector3().fromArray(values, k).applyQuaternion(left).toArray(next, k)
      }
      channel.sampler = animation.samplers.length
      animation.samplers.push({ ...sampler, output: append(next, path === 'rotation' ? 'VEC4' : 'VEC3', width) })
      transformedChannels++
      if (sampler.interpolation === 'CUBICSPLINE') cubicChannels++
    }
    // Remove newly unreferenced samplers before accessor compaction.
    const ids = [...new Set(animation.channels.map(c => c.sampler))].sort((a, b) => a - b)
    const remap = new Map(ids.map((id, index) => [id, index]))
    animation.channels.forEach(c => { c.sampler = remap.get(c.sampler) })
    animation.samplers = ids.map(i => animation.samplers[i])
  }
  const result = compactCharacterCandidate(encodeCharacterGlb(json, Buffer.concat(chunks)))
  const final = parseCharacterGlb(result.output), finalHierarchy = hierarchy(final.json)
  let maximumRestAxisErrorRadians = 0, copiedGeometryPayloads = 0, exactMorphAccessors = 0
  for (const [name, i] of a.human) {
    const error = finalHierarchy.world.get(i).angleTo(b.world.get(b.human.get(name)))
    maximumRestAxisErrorRadians = Math.max(maximumRestAxisErrorRadians, error)
    assert.ok(error < 1e-5, `Reference axis mismatch: ${name}`)
  }
  const payload = (doc, binary, index) => {
    const view = doc.bufferViews[index]
    return binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
  }
  assert.deepEqual(final.json.materials, original.materials)
  assert.deepEqual(final.json.textures ?? [], original.textures ?? [])
  assert.equal(final.json.skins.length, original.skins.length)
  final.json.skins.forEach((skin, i) => {
    assert.deepEqual(skin.joints, original.skins[i].joints)
    assert.equal(skin.skeleton, original.skins[i].skeleton)
  })
  final.json.nodes.forEach((node, i) => {
    assert.equal(node.name, original.nodes[i].name)
    assert.deepEqual(node.children, original.nodes[i].children)
    assert.deepEqual(node.weights, original.nodes[i].weights)
  })
  for (const [i, image] of (original.images ?? []).entries()) {
    assert.ok(payload(original, bin, image.bufferView).equals(payload(final.json, final.bin, final.json.images[i].bufferView)))
  }
  for (const [i, mesh] of original.meshes.entries()) for (const [k, primitive] of mesh.primitives.entries()) {
    const other = final.json.meshes[i].primitives[k]
    if (primitive.extensions?.KHR_draco_mesh_compression) {
      assert.ok(payload(original, bin, primitive.extensions.KHR_draco_mesh_compression.bufferView)
        .equals(payload(final.json, final.bin, other.extensions.KHR_draco_mesh_compression.bufferView)))
      copiedGeometryPayloads++
    } else for (const key of Object.keys(primitive.attributes)) {
      assert.deepEqual(readAccessor(original, bin, primitive.attributes[key]), readAccessor(final.json, final.bin, other.attributes[key]))
    }
    for (const [n, morph] of (primitive.targets ?? []).entries()) for (const semantic of Object.keys(morph)) {
      assert.deepEqual(readAccessor(original, bin, morph[semantic]), readAccessor(final.json, final.bin, other.targets[n][semantic]))
      exactMorphAccessors++
    }
  }
  for (const [i, animation] of original.animations.entries()) {
    const other = final.json.animations[i]
    assert.equal(other.name, animation.name); assert.equal(other.channels.length, animation.channels.length)
    animation.channels.forEach((channel, k) => {
      assert.deepEqual(other.channels[k].target, channel.target)
      const old = animation.samplers[channel.sampler], next = other.samplers[other.channels[k].sampler]
      assert.equal(next.interpolation, old.interpolation)
      assert.deepEqual(readAccessor(original, bin, old.input), readAccessor(final.json, final.bin, next.input))
      if (channel.target.path === 'weights') assert.deepEqual(readAccessor(original, bin, old.output), readAccessor(final.json, final.bin, next.output))
    })
  }
  return { output: result.output, report: { sharedHumanAxes: a.human.size, transformedChannels, cubicChannels,
    maximumLocalMatrixResidual, maximumRestAxisErrorRadians, copiedGeometryPayloads, exactMorphAccessors,
    hashes: [source, reference, result.output].map(v => createHash('sha256').update(v).digest('hex')),
    bytes: result.output.length, compaction: result.report,
    sharedMotionImplemented: false, skinnedWorldSpaceVerified: false, runtimeReleaseAllowed: false } }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const commonExport = args.includes('--common-human-export')
  const commonBake = args.includes('--common-human-bake')
  assert.ok(!(commonExport && commonBake), 'Static export and approximate bake are different scopes')
  assert.ok(args.filter(arg => arg.startsWith('--')).every(arg => arg === '--common-human-export' || arg === '--common-human-bake'), 'Unknown export option')
  const [input, reference, output] = args.filter(arg => !arg.startsWith('--'))
  assert.equal(args.filter(arg => !arg.startsWith('--')).length, 3, 'Exactly three paths required')
  assert.ok(input && reference && output, 'Usage: node <script> input.glb reference.glb output.glb')
  const source = await realpath(input), referencePath = await realpath(reference)
  const destination = resolve(output), parent = await realpath(dirname(destination))
  assert.ok(parent.toLowerCase().startsWith('c:\\data\\alife\\temp\\'))
  assert.ok(![source, referencePath].some(p => p.toLowerCase() === destination.toLowerCase()))
  const result = await (commonBake ? bakeCommonHumanRigCandidate : commonExport ? exportCommonHumanRigCandidate : rebaseCharacterJointAxes)(await readFile(source), await readFile(referencePath))
  await writeFile(destination, result.output, { flag: 'wx' })
  console.log(JSON.stringify({ output: destination, ...result.report }, null, 2))
}
