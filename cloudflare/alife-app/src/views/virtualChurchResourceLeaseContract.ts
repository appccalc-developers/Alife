import { PropertyBinding, type AnimationClip, type Bone, type Object3D, type Skeleton, type SkinnedMesh } from 'three'

/** Owned clone whose bone transforms are driven only by the supplied clips.
 * Static local matrices still inherit animated world transforms. Unknown or
 * indirect bindings leave the whole clone untouched rather than guessing. */
export const freezeVirtualChurchUnanimatedCloneBoneMatrices = (model: Object3D, clips: AnimationClip[]) => {
  const animated = new Set<Object3D>()
  for (const clip of clips) for (const track of clip.tracks) {
    let parsed
    try { parsed = PropertyBinding.parseTrackName(track.name) } catch {
      return { supported: false as const, reason: 'Unrecognized animation binding' }
    }
    if (parsed.propertyName === 'morphTargetInfluences') continue
    if (parsed.objectName !== undefined || parsed.propertyIndex !== undefined
      || !['position', 'quaternion', 'rotation', 'scale', 'matrix'].includes(parsed.propertyName)) {
      return { supported: false as const, reason: 'Indirect or unknown animation binding' }
    }
    const node = PropertyBinding.findNode(model, parsed.nodeName)
    if (!node || !('isObject3D' in node) || node.isObject3D !== true) {
      return { supported: false as const, reason: 'Animation target is missing' }
    }
    animated.add(node as Object3D)
  }
  const bones: Bone[] = []
  model.traverse(node => {
    if ('isBone' in node && node.isBone && node.matrixAutoUpdate && !animated.has(node)) {
      node.updateMatrix()
      node.matrixAutoUpdate = false
      bones.push(node as Bone)
    }
  })
  let restored = false
  return { supported: true as const, count: bones.length, restore: () => {
    if (restored) return
    restored = true
    bones.forEach(bone => { bone.matrixAutoUpdate = true })
  } }
}

/** SkeletonUtils creates a Skeleton per mesh even when all parts use the same
 * rig. Call only on an owned, unrendered clone: identical bone identities and
 * inverse bind matrices produce identical bone buffers. Mesh bind matrices,
 * morph targets and geometry remain independent; different people never merge.
 */
export const shareVirtualChurchOwnedCloneSkeletons = (model: Object3D) => {
  const canonical: Skeleton[] = []
  const remap = new Map<Skeleton, Skeleton>()
  let merged = 0
  model.traverse(node => {
    if (!('isSkinnedMesh' in node) || !node.isSkinnedMesh) return
    const mesh = node as SkinnedMesh
    const original = mesh.skeleton
    // Never retire an already rendered skeleton or its active bone texture.
    if (original.boneTexture !== null) return
    const previous = remap.get(original)
    if (previous) { mesh.skeleton = previous; return }
    const match = canonical.find(candidate =>
      candidate.bones.length === original.bones.length
      && candidate.boneInverses.length === original.boneInverses.length
      && candidate.bones.every((bone, index) => bone === original.bones[index])
      && candidate.boneInverses.every((matrix, index) => matrix.equals(original.boneInverses[index])))
    remap.set(original, match ?? original)
    if (match) {
      mesh.skeleton = match
      original.dispose()
      merged++
    } else canonical.push(original)
  })
  return merged
}

/** SkeletonUtils clones own their bone textures, unlike borrowed GLTF geometry
 * and material maps. R3F deliberately does not dispose primitive descendants. */
export const disposeVirtualChurchCharacterSkeletons = (model: Object3D) => {
  const skeletons = new Set<Skeleton>()
  model.traverse((node) => {
    if ('isSkinnedMesh' in node && node.isSkinnedMesh) {
      skeletons.add((node as SkinnedMesh).skeleton)
    }
  })
  skeletons.forEach((skeleton) => skeleton.dispose())
}

export type VirtualChurchResourceLeaseSnapshot = Readonly<{
  key: string
  users: number
}>

type VirtualChurchResourceLeaseEntry<Resource> = {
  resource: Resource
  users: number
  generation: number
}

type ScheduleRelease = (release: () => void) => void

export const createVirtualChurchStrictModeCleanupGuard = (
  scheduleCleanup: ScheduleRelease = queueMicrotask,
) => {
  let generation = 0

  return {
    activate: () => {
      generation += 1
    },
    release: (cleanup: () => void) => {
      generation += 1
      const releaseGeneration = generation
      scheduleCleanup(() => {
        if (generation === releaseGeneration) cleanup()
      })
    },
  }
}

/**
 * Keeps a decoded resource alive only while at least one rendered consumer uses it.
 *
 * Cleanup is deferred by one microtask so React StrictMode's development-only
 * effect replay, or an immediate switch back to the same character, can renew
 * the lease without disposing a resource that is about to be rendered again.
 */
export const createVirtualChurchResourceLeaseRegistry = <Resource>(
  releaseResource: (key: string, resource: Resource) => void,
  scheduleRelease: ScheduleRelease = queueMicrotask,
) => {
  // Suspense can finish a second decode for the same URL before the first
  // mounted consumer has released its instance. Keep both generations alive
  // rather than failing the whole Canvas during that brief overlap.
  const entries = new Map<string, Map<Resource, VirtualChurchResourceLeaseEntry<Resource>>>()

  const retain = (key: string, resource: Resource) => {
    let resources = entries.get(key)
    if (!resources) {
      resources = new Map()
      entries.set(key, resources)
    }
    const entry = resources.get(resource) ?? {
      resource,
      users: 0,
      generation: 0,
    }

    entry.users += 1
    entry.generation += 1
    resources.set(resource, entry)

    let released = false
    return () => {
      if (released) return
      released = true

      entry.users = Math.max(0, entry.users - 1)
      entry.generation += 1
      if (entry.users !== 0) return

      const releaseGeneration = entry.generation
      scheduleRelease(() => {
        const currentResources = entries.get(key)
        const current = currentResources?.get(resource)
        if (
          current !== entry
          || current.users !== 0
          || current.generation !== releaseGeneration
        ) {
          return
        }

        currentResources?.delete(resource)
        if (currentResources?.size === 0) entries.delete(key)
        releaseResource(key, current.resource)
      })
    }
  }

  const snapshot = (): VirtualChurchResourceLeaseSnapshot[] =>
    [...entries.entries()]
      .map(([key, resources]) => ({
        key,
        users: [...resources.values()].reduce((total, entry) => total + entry.users, 0),
      }))
      .sort((left, right) => left.key.localeCompare(right.key))

  return { retain, snapshot, has: (key: string) => entries.has(key) }
}
