import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')
const assetDir = path.join(repoRoot, 'cloudflare', 'alife-app', 'public', 'virtual-church-assets', 'buildings')
const textureDir = path.join(repoRoot, 'cloudflare', 'alife-app', 'public', 'virtual-church-assets', 'textures')
const reportDir = process.env.ALIFE_VC_REPORT_DIR
  ? path.resolve(process.env.ALIFE_VC_REPORT_DIR)
  : process.platform === 'win32'
    ? 'C:\\Data\\Alife\\Temp\\virtual-church'
    : path.join(os.tmpdir(), 'Alife', 'virtual-church')
const reportPath = path.join(reportDir, 'vc-04-asset-report.json')

const expectedImages = [
  '../textures/church-material-atlas-normal.png',
  '../textures/church-material-atlas-basecolor.png',
  '../textures/church-material-atlas-orm.png',
]
const atlasMaterialNames = new Set([
  'M_CedarDark',
  'M_CedarLight',
  'M_Charcoal',
  'M_Concrete',
  'M_SilverMetal',
])

const targets = [
  { file: 'church-hero.glb', lod: 'high', maxTriangles: 300_000, maxBytes: 15 * 1024 * 1024, maxMaterials: 8 },
  { file: 'church-hero-medium.glb', lod: 'medium', maxTriangles: 150_000, maxBytes: 10 * 1024 * 1024, maxMaterials: 8 },
  { file: 'church-hero-low.glb', lod: 'low', maxTriangles: 80_000, maxBytes: 8 * 1024 * 1024, maxMaterials: 3 },
  { file: 'church-props.glb', lod: 'props', maxTriangles: 20_000, maxBytes: 2 * 1024 * 1024, maxMaterials: 9 },
]

function readGlb(filePath) {
  const buffer = fs.readFileSync(filePath)
  if (buffer.toString('utf8', 0, 4) !== 'glTF') throw new Error(`${filePath}: invalid GLB magic`)
  if (buffer.readUInt32LE(4) !== 2) throw new Error(`${filePath}: expected glTF 2`)
  if (buffer.readUInt32LE(8) !== buffer.byteLength) throw new Error(`${filePath}: length header mismatch`)

  const jsonLength = buffer.readUInt32LE(12)
  const jsonType = buffer.readUInt32LE(16)
  if (jsonType !== 0x4e4f534a) throw new Error(`${filePath}: first GLB chunk is not JSON`)
  const json = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength).trim())
  return { buffer, json }
}

function primitiveTriangleCount(json, primitive) {
  const accessorIndex = primitive.indices ?? primitive.attributes?.POSITION
  if (accessorIndex == null) return 0
  const count = json.accessors?.[accessorIndex]?.count ?? 0
  const mode = primitive.mode ?? 4
  if (mode === 4) return Math.floor(count / 3)
  if (mode === 5 || mode === 6) return Math.max(0, count - 2)
  return 0
}

function mergeBounds(bounds, accessor) {
  if (!accessor?.min || !accessor?.max) return
  for (let axis = 0; axis < 3; axis += 1) {
    bounds.min[axis] = Math.min(bounds.min[axis], accessor.min[axis])
    bounds.max[axis] = Math.max(bounds.max[axis], accessor.max[axis])
  }
}

function inspectTarget(target) {
  const filePath = path.join(assetDir, target.file)
  const { buffer, json } = readGlb(filePath)
  const materials = new Set()
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
  let triangles = 0
  let primitives = 0
  let dracoPrimitives = 0

  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      primitives += 1
      if (primitive.extensions?.KHR_draco_mesh_compression) dracoPrimitives += 1
      triangles += primitiveTriangleCount(json, primitive)
      if (primitive.material != null) materials.add(primitive.material)
      const positionAccessor = json.accessors?.[primitive.attributes?.POSITION]
      mergeBounds(bounds, positionAccessor)
    }
  }

  const dimensions = bounds.min.every(Number.isFinite)
    ? bounds.max.map((value, axis) => value - bounds.min[axis])
    : [0, 0, 0]
  const errors = []
  if (triangles <= 0) errors.push('contains no triangles')
  if (triangles > target.maxTriangles) errors.push(`triangles ${triangles} > ${target.maxTriangles}`)
  if (buffer.byteLength > target.maxBytes) errors.push(`bytes ${buffer.byteLength} > ${target.maxBytes}`)
  if (materials.size > target.maxMaterials) errors.push(`materials ${materials.size} > ${target.maxMaterials}`)
  if ((json.animations?.length ?? 0) > 0) errors.push('unexpected animations')
  if (dracoPrimitives !== primitives) errors.push(`Draco primitives ${dracoPrimitives} != ${primitives}`)
  if (!(json.extensionsRequired ?? []).includes('KHR_draco_mesh_compression')) {
    errors.push('KHR_draco_mesh_compression is not required')
  }

  const externalImages = (json.images ?? []).map((image) => image.uri)
  const embeddedImages = (json.images ?? []).filter((image) => image.bufferView != null).length
  if (embeddedImages > 0) errors.push(`contains ${embeddedImages} embedded images`)
  if (JSON.stringify(externalImages) !== JSON.stringify(expectedImages)) {
    errors.push(`unexpected shared texture URIs: ${externalImages.join(', ')}`)
  }
  for (const uri of externalImages) {
    const resolved = path.resolve(assetDir, uri)
    if (!resolved.startsWith(textureDir) || !fs.existsSync(resolved)) {
      errors.push(`missing or out-of-scope shared texture: ${uri}`)
    }
  }

  for (const material of json.materials ?? []) {
    if (!atlasMaterialNames.has(material.name)) continue
    const pbr = material.pbrMetallicRoughness ?? {}
    if (!pbr.baseColorTexture) errors.push(`${material.name} missing base-color atlas`)
    if (!pbr.metallicRoughnessTexture) errors.push(`${material.name} missing ORM atlas`)
    if (!material.normalTexture) errors.push(`${material.name} missing normal atlas`)
  }

  const assetRoot = (json.nodes ?? []).find(
    (node) => node.extras?.alifeAsset === 'virtual-church',
  )
  const interior = assetRoot?.extras
  if (target.lod !== 'props') {
    if (!assetRoot) errors.push('missing virtual-church asset root extras')
    if (interior?.interiorRepresentation !== 'photo-backed-shallow-foyer-v2') {
      errors.push('missing photo-backed shallow foyer contract')
    }
    if (interior?.containsWalkableInterior !== false) {
      errors.push('shallow foyer must explicitly remain non-walkable')
    }
    if (!(interior?.interiorDepthMetres >= 6.8 && interior?.interiorDepthMetres <= 7.0)) {
      errors.push(`unexpected shallow foyer depth ${interior?.interiorDepthMetres}`)
    }
    if (interior?.interiorPrimaryReference !== 'user-supplied-10-photo-set') {
      errors.push('missing user-photo primary-reference contract')
    }
    for (const reference of ['Structex', 'Alloyfold', 'Leighs Construction']) {
      if (!interior?.interiorSecondaryReferences?.includes(reference)) {
        errors.push(`missing same-site secondary reference: ${reference}`)
      }
    }
    for (const verifiedFunction of ['auditorium', 'hall', 'meeting spaces', 'library', 'kitchen', 'parent room', 'community spaces']) {
      if (!interior?.interiorVerifiedFunctions?.includes(verifiedFunction)) {
        errors.push(`missing verified interior function: ${verifiedFunction}`)
      }
    }
    if (interior?.interiorEventDressingPolicy !== 'temporary-runtime-layer-only') {
      errors.push('event dressing must remain a temporary runtime layer')
    }
    for (const deferred of ['stairs', 'service window', 'corridor doors', 'auditorium connection']) {
      if (!interior?.interiorDeferredUntilMeasured?.includes(deferred)) {
        errors.push(`shallow foyer must defer unmeasured ${deferred}`)
      }
    }
  }

  return {
    file: target.file,
    lod: target.lod,
    bytes: buffer.byteLength,
    triangles,
    primitives,
    meshes: json.meshes?.length ?? 0,
    nodes: json.nodes?.length ?? 0,
    materials: materials.size,
    images: json.images?.length ?? 0,
    embeddedImages,
    externalImages,
    dracoPrimitives,
    animations: json.animations?.length ?? 0,
    bounds,
    dimensions,
    generator: json.asset?.generator ?? null,
    interior: target.lod === 'props'
      ? null
      : {
          representation: interior?.interiorRepresentation ?? null,
          depthMetres: interior?.interiorDepthMetres ?? null,
          containsWalkableInterior: interior?.containsWalkableInterior ?? null,
          primaryReference: interior?.interiorPrimaryReference ?? null,
          secondaryReferences: interior?.interiorSecondaryReferences ?? null,
          verifiedFunctions: interior?.interiorVerifiedFunctions ?? null,
          eventDressingPolicy: interior?.interiorEventDressingPolicy ?? null,
          deferredUntilMeasured: interior?.interiorDeferredUntilMeasured ?? null,
        },
    errors,
  }
}

function inspectPng(file) {
  const filePath = path.join(textureDir, file)
  const buffer = fs.readFileSync(filePath)
  const pngSignature = '89504e470d0a1a0a'
  const errors = []
  if (buffer.subarray(0, 8).toString('hex') !== pngSignature) errors.push('invalid PNG signature')
  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  if (width > 1024 || height > 1024) errors.push(`dimensions ${width}x${height} exceed 1024`)
  return { file, bytes: buffer.byteLength, width, height, errors }
}

const assets = targets.map(inspectTarget)
const hero = assets.filter((asset) => asset.lod !== 'props')
if (!(hero[0].triangles > hero[1].triangles && hero[1].triangles > hero[2].triangles)) {
  hero.forEach((asset) => asset.errors.push('LOD triangle counts are not strictly descending'))
}

const textures = [
  'church-material-atlas-basecolor.png',
  'church-material-atlas-orm.png',
  'church-material-atlas-normal.png',
].map(inspectPng)

const report = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  coordinateContract: {
    metresPerUnit: 1,
    axes: 'X facade, Y up, Z depth; negative Z faces car park',
    canonicalWorldPosition: [-0.265, 0, -20.285],
    canonicalRotationY: 0.887,
  },
  assets,
  textures,
  passed:
    assets.every((asset) => asset.errors.length === 0) &&
    textures.every((texture) => texture.errors.length === 0),
}

fs.mkdirSync(reportDir, { recursive: true })
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
if (!report.passed) process.exitCode = 1
