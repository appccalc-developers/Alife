import { Float32BufferAttribute, Material, MeshStandardMaterial, PropertyBinding, SkinnedMesh, Texture, type AnimationClip, type Object3D } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { gateAIsOutfitMaterial } from './virtualChurchCharacterWardrobe.ts'

export function virtualChurchShouldBatchOriginalOutfitMaps({
  visualVersion,
  characterReview,
  isDevelopment,
  reviewOverride,
}: {
  visualVersion: 'v2' | 'v3'
  characterReview: string | null
  isDevelopment: boolean
  reviewOverride: string | null
}) {
  if (visualVersion !== 'v3') return false
  // Released female and male Low/Medium retain their original maps. The male
  // V14 path is verified against every embedded motion and rendered poses;
  // other review candidates still need an explicit development-only opt-in.
  if (isDevelopment && reviewOverride === '1') return true
  if (characterReview !== null && characterReview !== 'female' && characterReview !== 'male') return false
  return !isDevelopment || reviewOverride !== '0'
}

// Conservative equality: secondary maps must actually be shared; unknown
// object types cannot silently lose a render state when materials are joined.
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (a instanceof Texture || b instanceof Texture || a.constructor !== b.constructor) return false
  if ('equals' in a && typeof a.equals === 'function') return a.equals(b)
  if (!Array.isArray(a) && a.constructor !== Object) return false
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>
  const keys = Object.keys(x)
  return keys.length === Object.keys(y).length && keys.every(key => Object.hasOwn(y, key) && same(x[key], y[key]))
}

function sameProperties(a: object, b: object, ignored: string[]) {
  const omit = new Set(ignored), keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].every(key => omit.has(key) || same((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
}

/** Only for an owned scene clone, before first render. Textures, clips and
 * source geometries stay untouched. Unsupported GPUs/materials keep originals. */
export function createVirtualChurchOutfitBatch(root: Object3D, clips: AnimationClip[], maxTextures: number) {
  const parts: SkinnedMesh[] = []
  root.traverse(node => {
    if (node instanceof SkinnedMesh && node.material instanceof MeshStandardMaterial && gateAIsOutfitMaterial(node.material.name)) parts.push(node)
  })
  const reject = (reason: string) => ({ supported: false as const, reason })
  if (parts.length < 2 || parts.length > 8) return reject('Need two to eight outfit parts')
  // Reserve texture units for skinning/morphs, normal/light/environment/shadow
  // inputs. No atlas, texture array or additional image allocation is used.
  if (!Number.isFinite(maxTextures) || maxTextures < parts.length + 8) return reject('Insufficient texture units')
  const first = parts[0], base = first.material as MeshStandardMaterial
  if (!first.parent || base.transparent || !base.map || first.castShadow) return reject('Unsupported opacity, texture or shadow path')
  const maps: Texture[] = []
  for (const part of parts) {
    const material = part.material as MeshStandardMaterial, map = material.map
    if (part.parent !== first.parent || !part.visible || part.castShadow || part.receiveShadow !== first.receiveShadow
      || part.renderOrder !== first.renderOrder || part.layers.mask !== first.layers.mask
      || part.frustumCulled !== first.frustumCulled
      || part.bindMode !== first.bindMode || !part.bindMatrix.equals(first.bindMatrix) || !part.bindMatrixInverse.equals(first.bindMatrixInverse)
      || !part.position.equals(first.position) || !part.quaternion.equals(first.quaternion) || !part.scale.equals(first.scale)
      || !part.matrix.equals(first.matrix) || part.matrixAutoUpdate !== first.matrixAutoUpdate) return reject('Part transforms or render paths differ')
    if (part.skeleton.bones.length !== first.skeleton.bones.length || part.skeleton.boneInverses.length !== first.skeleton.boneInverses.length
      || part.skeleton.bones.some((bone, i) => bone !== first.skeleton.bones[i])
      || part.skeleton.boneInverses.some((matrix, i) => !matrix.equals(first.skeleton.boneInverses[i]))) return reject('Skin bindings differ')
    if (material.onBeforeCompile !== Material.prototype.onBeforeCompile || material.customProgramCacheKey !== Material.prototype.customProgramCacheKey
      || !sameProperties(base, material, ['id', 'uuid', 'name', 'map', 'version', '_listeners', 'userData'])) return reject('Material states differ')
    if (!map || map.constructor !== Texture || map.mipmaps.length || !sameProperties(base.map, map,
      ['id', 'uuid', 'name', 'source', 'version', '_listeners', 'userData'])) return reject('Texture sampling states differ')
    if (!same(first.morphTargetDictionary, part.morphTargetDictionary) || !same(first.morphTargetInfluences, part.morphTargetInfluences)) return reject('Local morph state differs')
    if (part.geometry.groups.length || part.geometry.drawRange.start !== 0 || part.geometry.drawRange.count !== Infinity
      || part.geometry.getAttribute('alifeMapSlot')) return reject('Geometry uses custom groups or draw ranges')
    maps.push(map)
  }
  // The original animation targets remain in the hierarchy. Sharing their
  // weight array is valid only when EVERY clip drives all parts identically.
  for (const clip of clips) {
    const tracks = parts.map(part => clip.tracks.filter(track => {
      const parsed = PropertyBinding.parseTrackName(track.name)
      return parsed.nodeName === part.name || parsed.nodeName === part.uuid
    }))
    if (tracks.some(list => list.length > 1 || list.some(track => {
      const parsed = PropertyBinding.parseTrackName(track.name)
      return parsed.propertyName !== 'morphTargetInfluences' || parsed.propertyIndex !== undefined
    }))) return reject('Individual part animation cannot be shared')
    for (const list of tracks) {
      if (list.length !== tracks[0].length) return reject('Morph animation targets differ')
      if (!list.length) continue
      const a = tracks[0][0], b = list[0]
      const cubic = (track: typeof a) => Object.getOwnPropertyDescriptor(track, 'createInterpolant')?.value?.isInterpolantFactoryMethodGLTFCubicSpline === true
      if (a.constructor !== b.constructor || a.getInterpolation() !== b.getInterpolation()
        || (a.getInterpolation() === undefined && (!cubic(a) || !cubic(b)))
        || a.times.length !== b.times.length || a.values.length !== b.values.length
        || !a.times.every((v, i) => v === b.times[i]) || !a.values.every((v, i) => v === b.values[i])) return reject('Morph animation values differ')
    }
  }
  const inputs = parts.map((part, index) => {
    const geometry = part.geometry.clone()
    geometry.setAttribute('alifeMapSlot', new Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count).fill(index), 1))
    return geometry
  })
  let geometry
  try { geometry = mergeGeometries(inputs, false) } finally { inputs.forEach(input => input.dispose()) }
  if (!geometry) return reject('Geometry layouts differ')
  // The installed merge utility validates this flag but does not copy it.
  geometry.morphTargetsRelative = first.geometry.morphTargetsRelative
  const material = base.clone()
  // Keep custom samplers discoverable by the existing texture/memory probe.
  // Otherwise visible-texture accounting would omit all but the first map.
  maps.slice(1).forEach((map, index) => Object.defineProperty(material, `alifeOutfitMap${index + 1}`, { value: map, enumerable: true }))
  material.onBeforeCompile = shader => {
    maps.slice(1).forEach((map, index) => { shader.uniforms[`alifeOutfitMap${index + 1}`] = { value: map } })
    shader.vertexShader = `attribute float alifeMapSlot; varying float vAlifeMapSlot;\n${shader.vertexShader}`
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvAlifeMapSlot = alifeMapSlot;')
    shader.fragmentShader = `varying float vAlifeMapSlot;\n${maps.slice(1).map((_, i) => `uniform sampler2D alifeOutfitMap${i + 1};`).join('\n')}\n${shader.fragmentShader}`
      .replace('#include <map_fragment>', `#ifdef USE_MAP\nvec4 sampledDiffuseColor;\n${maps.map((_, i) =>
        `${i ? 'else ' : ''}${i < maps.length - 1 ? `if (vAlifeMapSlot < ${i + .5}) ` : ''}sampledDiffuseColor = texture2D(${i ? `alifeOutfitMap${i}` : 'map'}, vMapUv);`).join('\n')}\ndiffuseColor *= sampledDiffuseColor;\n#endif`)
  }
  material.customProgramCacheKey = () => `alife-original-outfit-maps-v1-${maps.length}`
  const mesh = new SkinnedMesh(geometry, material)
  mesh.name = 'Alife_OriginalTexture_OutfitBatch'
  mesh.position.copy(first.position); mesh.quaternion.copy(first.quaternion); mesh.scale.copy(first.scale)
  mesh.matrix.copy(first.matrix); mesh.matrixAutoUpdate = first.matrixAutoUpdate
  mesh.bindMode = first.bindMode; mesh.bind(first.skeleton, first.bindMatrix)
  mesh.bindMatrixInverse.copy(first.bindMatrixInverse)
  mesh.morphTargetInfluences = first.morphTargetInfluences
  mesh.morphTargetDictionary = first.morphTargetDictionary
  mesh.receiveShadow = first.receiveShadow; mesh.renderOrder = first.renderOrder; mesh.layers.mask = first.layers.mask
  mesh.frustumCulled = first.frustumCulled
  parts.forEach(part => { part.visible = false })
  first.parent.add(mesh)
  let disposed = false
  return { supported: true as const, mesh, parts, maps, dispose: () => {
    if (disposed) return
    disposed = true; mesh.removeFromParent(); geometry.dispose(); material.dispose()
    parts.forEach(part => { part.visible = true })
    // The skeleton and original maps/geometries are borrowed, never disposed.
  } }
}
