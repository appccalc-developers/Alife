import { AnimationClip } from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

type RigNode = { name?: string; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }
type MotionJson = { nodes: RigNode[]; meshes?: unknown[]; animations?: Array<{ channels: Array<{ target: { path: string } }> }>;
  extras?: { alifeLodMotion?: { version: number; sourceSha256: string; motionId?: string; scope: string }; alifeLodMotionBinding?: { version: number; sourceSha256: string; motionId?: string } } }

export class VirtualChurchSharedMotionError extends Error {
  readonly gltf: GLTF
  constructor(message: string, gltf: GLTF) { super(message); this.name = 'VirtualChurchSharedMotionError'; this.gltf = gltf }
}

/** Only identical rest rigs may share absolute tracks. This is not retargeting. */
export function composeVirtualChurchSharedMotion(character: GLTF, motion: GLTF): AnimationClip[] {
  const require = (condition: unknown, message: string) => {
    if (!condition) throw new VirtualChurchSharedMotionError(message, character)
  }
  const local = character.parser.json as MotionJson, common = motion.parser.json as MotionJson
  const binding = local.extras?.alifeLodMotionBinding, manifest = common.extras?.alifeLodMotion
  require(binding?.version === 2 && manifest?.version === 2 && binding.sourceSha256 === manifest.sourceSha256
    && /^[a-f0-9]{64}$/.test(manifest.sourceSha256)
    && manifest.scope === 'identical-rest-rig-skeletal-only', 'Shared motion package does not match this character')
  // The source hash alone cannot distinguish two edits of the same motion input.
  // This is a version binding, not an authenticity check for untrusted assets.
  require(binding?.motionId === manifest?.motionId && /^[a-f0-9]{64}$/.test(manifest?.motionId ?? ''),
    'Shared motion content version differs; load the matching character and motion package')
  require(!common.meshes?.length, 'Shared motion package must contain no geometry')
  const signature = (nodes: RigNode[]) => {
    require(Array.isArray(nodes) && nodes.length > 0, 'Shared motion rig nodes missing')
    const names = new Set<string>(), parents = new Map<number, number>()
    nodes.forEach((node, i) => {
      require(node.name && !names.has(node.name) && !node.matrix, 'Shared motion requires unique named TRS nodes')
      names.add(node.name!)
      for (const child of node.children ?? []) {
        require(nodes[child] && !parents.has(child), 'Invalid shared motion hierarchy'); parents.set(child, i)
      }
    })
    nodes.forEach((_, i) => {
      const seen = new Set<number>(); let at: number | undefined = i
      while (at !== undefined) { require(!seen.has(at), 'Cyclic shared motion hierarchy'); seen.add(at); at = parents.get(at) }
    })
    return JSON.stringify(nodes.map((node, i) => ({ name: node.name, parent: nodes[parents.get(i)!]?.name ?? null,
      translation: node.translation ?? [0, 0, 0], rotation: node.rotation ?? [0, 0, 0, 1], scale: node.scale ?? [1, 1, 1] }))
      .sort((a, b) => a.name!.localeCompare(b.name!, 'en')))
  }
  require(signature(local.nodes) === signature(common.nodes), 'Shared motion rest rig differs; retargeting required')
  require(local.animations?.every(a => a.channels.every(c => c.target.path === 'weights')), 'Split character must only embed local morph tracks')
  require(common.animations?.every(a => a.channels.every(c => ['rotation', 'translation', 'scale'].includes(c.target.path))), 'Shared motion contains non-skeletal tracks')
  const clips = new Map(motion.animations.map(clip => [clip.name, clip]))
  require(clips.size === motion.animations.length && clips.size === character.animations.length
    && new Set(character.animations.map(c => c.name)).size === clips.size && clips.size > 0, 'Shared motion clip set differs')
  return character.animations.map(localClip => {
    const clip = clips.get(localClip.name)
    require(clip && clip.duration > 0 && Number.isFinite(clip.duration) && localClip.duration <= clip.duration, 'Shared motion duration or clip name differs')
    require(localClip.tracks.every(t => t.name.endsWith('.morphTargetInfluences')), 'Invalid local morph binding')
    require(clip!.tracks.length && clip!.tracks.every(t => /\.(position|quaternion|scale)$/.test(t.name)), 'Invalid shared skeletal binding')
    // Reuse immutable loader-created tracks, retaining custom cubic interpolants.
    return new AnimationClip(localClip.name, clip!.duration, [...clip!.tracks, ...localClip.tracks], clip!.blendMode)
  })
}
