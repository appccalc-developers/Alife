import type { GLTF, GLTFParser } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Material, Texture } from 'three'

type TextureData = {
  data?: ArrayBufferView | null
  width?: number
  height?: number
  naturalWidth?: number
  naturalHeight?: number
}

const textureDataIsRenderable = (texture: Texture) => {
  const data = texture.source?.data as TextureData | TextureData[] | null | undefined
  if (!data) return false
  if (Array.isArray(data)) return data.length > 0 && data.every((item) => {
    const width = item.naturalWidth ?? item.width ?? 0
    const height = item.naturalHeight ?? item.height ?? 0
    return width > 0 && height > 0
  })
  const width = data.naturalWidth ?? data.width ?? 0
  const height = data.naturalHeight ?? data.height ?? 0
  return width > 0 && height > 0
}

const collectMaterialTextureIndices = (value: unknown, key = '', result = new Set<number>()) => {
  if (!value || typeof value !== 'object') return result
  if (
    key.endsWith('Texture')
    && 'index' in value
    && Number.isInteger((value as { index?: number }).index)
  ) {
    result.add((value as { index: number }).index)
  }
  Object.entries(value).forEach(([childKey, child]) =>
    collectMaterialTextureIndices(child, childKey, result))
  return result
}

export type VirtualChurchGltfTextureIssue = {
  textureIndex: number
  imageIndex: number | null
  uri: string | null
  reason: 'missing-definition' | 'not-loaded' | 'empty-image'
}

/** GLTFLoader deliberately converts a failed texture dependency to null while
 * still resolving the GLTF. Check only materials that reached the real scene,
 * so unused authoring slots cannot make a valid runtime asset fail.
 */
export function inspectVirtualChurchGltfTextures(gltf: GLTF) {
  const json = gltf.parser.json as {
    materials?: unknown[]
    textures?: Array<{ source?: number; extensions?: Record<string, { source?: number }> }>
    images?: Array<{ uri?: string }>
  }
  const usedMaterials = new Map<number, Material>()
  gltf.parser.associations.forEach((reference, object) => {
    if (reference.materials !== undefined && 'isMaterial' in object && object.isMaterial) {
      usedMaterials.set(reference.materials, object as Material)
    }
  })
  const requiredTextures = new Set<number>()
  usedMaterials.forEach((_material, index) =>
    collectMaterialTextureIndices(json.materials?.[index], '', requiredTextures))
  const issues: VirtualChurchGltfTextureIssue[] = []
  const issueKeys = new Set<string>()
  const addIssue = (textureIndex: number, reason: VirtualChurchGltfTextureIssue['reason']) => {
    const definition = json.textures?.[textureIndex]
    const extensionSource = definition?.extensions
      ? Object.values(definition.extensions).map((value) => value?.source)
        .find((source) => Number.isInteger(source))
      : undefined
    const imageIndex = definition?.source ?? extensionSource ?? null
    const uri = imageIndex === null ? null : json.images?.[imageIndex]?.uri ?? null
    const key = `${textureIndex}:${reason}`
    if (!issueKeys.has(key)) {
      issueKeys.add(key)
      issues.push({ textureIndex, imageIndex, uri, reason })
    }
  }
  ;[...requiredTextures].filter(index => !json.textures?.[index])
    .forEach(index => addIssue(index, 'missing-definition'))
  usedMaterials.forEach((material, materialIndex) => {
    const expected = [...collectMaterialTextureIndices(json.materials?.[materialIndex])]
      .filter(index => !!json.textures?.[index])
    const actual = [...new Set(Object.values(material).filter((value): value is Texture =>
      !!value && typeof value === 'object' && 'isTexture' in value && value.isTexture))]
    const empty = actual.filter(texture => !textureDataIsRenderable(texture))
    empty.forEach((_texture, index) => addIssue(expected[index] ?? expected[0], 'empty-image'))
    const missingCount = Math.max(0, expected.length - actual.length)
    expected.slice(0, missingCount).forEach(index => addIssue(index, 'not-loaded'))
  })
  issues.sort((a, b) => a.textureIndex - b.textureIndex || a.reason.localeCompare(b.reason))
  return {
    requiredTextureIndices: [...requiredTextures].sort((a, b) => a - b),
    issues,
  }
}

export class VirtualChurchGltfTextureIntegrityError extends Error {
  readonly gltf: GLTF
  readonly issues: VirtualChurchGltfTextureIssue[]

  constructor(
    gltf: GLTF,
    issues: VirtualChurchGltfTextureIssue[],
  ) {
    super(`GLTF texture integrity failed: ${issues.map(issue =>
      `texture ${issue.textureIndex} (${issue.uri ?? 'unknown image'}): ${issue.reason}`).join('; ')}`)
    this.name = 'VirtualChurchGltfTextureIntegrityError'
    this.gltf = gltf
    this.issues = issues
  }
}

export function assertVirtualChurchGltfTextures(gltf: GLTF) {
  const result = inspectVirtualChurchGltfTextures(gltf)
  if (result.issues.length > 0) {
    throw new VirtualChurchGltfTextureIntegrityError(gltf, result.issues)
  }
  return result
}

/** Reject incomplete church results before GLTFLoader's success callback can
 * publish them into the Suspense cache. The shared loader also parses vehicles
 * and avatars: limit this hook to the selected church asset directory.
 */
export function createVirtualChurchGltfIntegrityPlugin(
  parser: GLTFParser,
  assetPath: string,
  baseUrl: string,
) {
  const churchDirectory = new URL('.', new URL(assetPath, baseUrl)).href
  const matchesChurch = new URL(parser.options.path, baseUrl).href === churchDirectory
  return {
    name: 'ALIFE_church_texture_integrity',
    async afterRoot(gltf: GLTF) {
      if (matchesChurch) assertVirtualChurchGltfTextures(gltf)
    },
  }
}
