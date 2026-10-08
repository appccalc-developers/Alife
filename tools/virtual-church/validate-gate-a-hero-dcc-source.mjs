import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '..', '..')
const characterDirectory = resolve(
  repositoryRoot,
  'cloudflare',
  'alife-app',
  'public',
  'virtual-church-assets',
  'v3',
  'releases',
  'gate-a-baseline-r9',
  'characters',
)
const manifestPath = resolve(characterDirectory, 'character-hero-female.manifest.json')
const sourceBlendPath = resolve(
  repositoryRoot,
  'tools',
  'blender',
  'virtual_church',
  'v3',
  'character-hero-female-beauty-source.blend',
)
const exportScriptPath = resolve(
  repositoryRoot,
  'tools',
  'blender',
  'virtual_church',
  'v3',
  'export_vroid_gate_a_female_hero.py',
)
const licensePath = resolve(
  repositoryRoot,
  'cloudflare',
  'alife-app',
  'public',
  'virtual-church-assets',
  'ASSET-LICENSES.md',
)
const blenderExecutable = 'C:/Developer/Blender/4.5/blender-4.5.12-windows-arm64/blender.exe'

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')
const componentByteSize = {
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4,
}
const componentCount = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
}
const parseGlb = (buffer) => {
  if (buffer.readUInt32LE(0) !== 0x46546c67
    || buffer.readUInt32LE(4) !== 2
    || buffer.readUInt32LE(8) !== buffer.byteLength) {
    throw new Error('invalid GLB 2.0 header')
  }
  const jsonLength = buffer.readUInt32LE(12)
  const jsonStart = 20
  const jsonEnd = jsonStart + jsonLength
  return {
    json: JSON.parse(buffer.subarray(jsonStart, jsonEnd).toString('utf8')),
    binaryStart: jsonEnd + 8,
  }
}
const packedAccessorHash = (buffer, document, accessorIndex) => {
  const accessor = document.json.accessors?.[accessorIndex]
  const view = document.json.bufferViews?.[accessor?.bufferView]
  const bytesPerComponent = componentByteSize[accessor?.componentType]
  const components = componentCount[accessor?.type]
  if (!accessor || !view || !bytesPerComponent || !components) {
    throw new Error(`animation accessor ${accessorIndex} is invalid`)
  }
  const elementBytes = bytesPerComponent * components
  const stride = view.byteStride ?? elementBytes
  const packed = Buffer.alloc(accessor.count * elementBytes)
  const viewStart = document.binaryStart + (view.byteOffset ?? 0)
  for (let index = 0; index < accessor.count; index += 1) {
    const sourceStart = viewStart + (accessor.byteOffset ?? 0) + index * stride
    buffer.copy(packed, index * elementBytes, sourceStart, sourceStart + elementBytes)
  }
  return {
    componentType: accessor.componentType,
    count: accessor.count,
    type: accessor.type,
    normalized: accessor.normalized ?? false,
    min: accessor.min ?? null,
    max: accessor.max ?? null,
    sha256: sha256(packed),
  }
}
const animationEvidence = (buffer, document) => (document.json.animations ?? []).map(
  (animation) => ({
    name: animation.name,
    channels: animation.channels,
    samplers: animation.samplers.map((sampler) => ({
      interpolation: sampler.interpolation ?? 'LINEAR',
      input: packedAccessorHash(buffer, document, sampler.input),
      output: packedAccessorHash(buffer, document, sampler.output),
    })),
  }),
)
const exists = async (path) => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const errors = []
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const [sourceBlend, exportScript, licenseText] = await Promise.all([
  readFile(sourceBlendPath),
  readFile(exportScriptPath),
  readFile(licensePath, 'utf8'),
])

if (manifest.schemaVersion !== 2
  || manifest.visualVariant !== 'vroid-fair-v1'
  || manifest.animationVariant !== 'vroid-fair-motion-v14') {
  errors.push('runtime manifest is not the approved VRoid fair hero contract')
}
if (manifest.provenance?.sourceModel !== 'AvatarSample_Q'
  || manifest.provenance?.sourceCreator !== 'pixiv VRoid Project'
  || manifest.provenance?.adaptation !== 'Alife project') {
  errors.push('VRoid source provenance changed')
}
if (manifest.appearance?.skinTone !== 'fair-warm'
  || manifest.appearance?.skinBaseColor?.toUpperCase() !== '#DFAB94'
  || manifest.appearance?.skinShadowColor?.toUpperCase() !== '#A06656'
  || manifest.appearance?.skinHighlightColor?.toUpperCase() !== '#F0C9B0') {
  errors.push('approved fair warm skin palette changed')
}
if (manifest.license?.url !== 'https://vroid.pixiv.help/hc/en-us/articles/4402394424089-VRoidPreset-A-Z'
  || manifest.license?.modificationAllowed !== true
  || manifest.license?.redistributionAllowed !== true
  || manifest.license?.cc0 !== false) {
  errors.push('VRoid sample-model licence contract changed')
}
if (!licenseText.includes('VRoidPreset_A-Z')
  || !licenseText.includes('pixiv VRoid Project')
  || !licenseText.includes(manifest.license.url)) {
  errors.push('asset licence register does not describe the VRoid derivative')
}
if (manifest.compression?.geometry
    !== 'KHR_draco_mesh_compression using the decoder already required by the church hero'
  || JSON.stringify(manifest.compression?.draco) !== JSON.stringify({
    level: 7,
    positionQuantizationBits: 16,
    normalQuantizationBits: 12,
    texcoordQuantizationBits: 14,
    colorQuantizationBits: 12,
    genericQuantizationBits: 14,
  })) {
  errors.push('high-precision character Draco compression contract changed')
}
if (manifest.animation?.contract?.locomotionQuality?.parentBeforeChildArmEvaluation !== true
  || JSON.stringify(manifest.animation?.contract?.locomotionQuality?.interpolationPolicy)
    !== JSON.stringify({
      groundingBones: 'LINEAR',
      upperBodyAndSecondaryBones: 'AUTO_CLAMPED_BEZIER_BAKED_TO_GLTF_LINEAR_SAMPLES',
    })
  || JSON.stringify(manifest.animation?.contract?.locomotionQuality?.elbowFlexionDegrees)
    !== JSON.stringify({
      Walk: { minimum: 148.81, maximum: 162.28 },
      Run: { minimum: 113.65, maximum: 117.74 },
    })
  || manifest.animation?.contract?.locomotionQuality?.compactStride !== true
  || manifest.animation?.contract?.locomotionQuality?.recoveredRunHeel !== true
  || manifest.animation?.contract?.locomotionQuality?.layeredSecondaryMotion !== true
  || manifest.animation?.contract?.locomotionQuality?.runFlightPhase !== true
  || JSON.stringify(
    manifest.animation?.contract?.locomotionQuality?.controllerTranslationSpeedMetresPerSecond,
  ) !== JSON.stringify({ Walk: 1.5497, Run: 4.1015 })
  || JSON.stringify(
    manifest.animation?.contract?.locomotionQuality?.playbackScaleAtFullInput,
  ) !== JSON.stringify({ Walk: 1, Run: 1 })) {
  errors.push('Walk/Run elbow-flexion quality contract changed')
}

const requiredScriptFragments = [
  'def author_action(',
  'author_action("Idle_A"',
  'author_action("Walk"',
  'author_action("Run"',
  'author_action("Jump_Start"',
  'author_action("Jump_Loop"',
  'author_action("Jump_Land"',
  'author_action("Turn_L"',
  'author_action("Turn_R"',
  'author_action("Greet"',
  'export_image_format="WEBP"',
  'keyed_names = tuple(sorted({',
  '# Lower-arm rotations must be evaluated after their upper-arm parents.',
  'bpy.context.view_layer.update()',
  'smooth_bone_keys: frozenset[str] = frozenset()',
  'interpolation = "MIXED_LINEAR_BEZIER" if smooth_bone_names else "LINEAR"',
  'keyframe.handle_left_type = "AUTO_CLAMPED"',
  'export_draco_mesh_compression_enable=True',
  'export_draco_mesh_compression_level=7',
  'export_draco_position_quantization=16',
  'export_draco_normal_quantization=12',
  'export_draco_texcoord_quantization=14',
  'export_draco_color_quantization=12',
  'export_draco_generic_quantization=14',
]
const exportSource = exportScript.toString('utf8')
for (const fragment of requiredScriptFragments) {
  if (!exportSource.includes(fragment)) errors.push(`export script lost ${fragment}`)
}

const lodEvidence = []
let expectedAnimationDigest = null
for (const lod of manifest.lods ?? []) {
  const filePath = resolve(characterDirectory, lod.file)
  const buffer = await readFile(filePath)
  const digest = sha256(buffer)
  if (buffer.byteLength !== lod.bytes || digest !== lod.sha256) {
    errors.push(`${lod.lod} GLB no longer matches its manifest hash and byte count`)
  }
  const document = parseGlb(buffer)
  const primitives = (document.json.meshes ?? []).flatMap((mesh) => mesh.primitives ?? [])
  const dracoPrimitives = primitives.filter(
    (primitive) => primitive.extensions?.KHR_draco_mesh_compression,
  ).length
  if (dracoPrimitives !== primitives.length
    || !(document.json.extensionsRequired ?? []).includes('KHR_draco_mesh_compression')) {
    errors.push(`${lod.lod} GLB does not Draco-compress every character primitive`)
  }
  const animationContract = animationEvidence(buffer, document)
  const animationDigest = sha256(Buffer.from(JSON.stringify(animationContract)))
  if (expectedAnimationDigest === null) expectedAnimationDigest = animationDigest
  else if (animationDigest !== expectedAnimationDigest) {
    errors.push(`${lod.lod} animation channels differ from the other exported LODs`)
  }
  lodEvidence.push({
    lod: lod.lod,
    bytes: buffer.byteLength,
    sha256: digest,
    triangles: lod.triangles,
    skinnedMeshes: lod.skinnedMeshes,
    materials: lod.materials,
    bones: lod.bones,
    animations: lod.animations,
    primitives: primitives.length,
    dracoPrimitives,
    animationDigest,
  })
}
if (lodEvidence.length !== 3
  || lodEvidence.some((lod) => lod.skinnedMeshes !== 3
    || lod.materials !== 18
    || lod.bones !== 187
    || lod.animations !== 14)) {
  errors.push('VRoid LOD topology, material, rig, or animation contract changed')
}

const sourceVroidWorkspace = manifest.provenance?.sourceVroidWorkspace
const sourceVroidExists = typeof sourceVroidWorkspace === 'string'
  && await exists(sourceVroidWorkspace)
if (!sourceVroidExists) errors.push('editable VRoid workspace is missing')

let blenderEvidence = null
if (!await exists(blenderExecutable)) {
  errors.push('approved Blender executable is missing')
} else {
  const expression = [
    'import bpy,json',
    'rig=next((o for o in bpy.context.scene.objects if o.type=="ARMATURE"),None)',
    'meshes=[o for o in bpy.context.scene.objects if o.type=="MESH"]',
    'triangles=sum(sum(max(0,len(p.vertices)-2) for p in o.data.polygons) for o in meshes)',
    'result={"meshCount":len(meshes),"armatureCount":sum(1 for o in bpy.context.scene.objects if o.type=="ARMATURE"),"bones":len(rig.data.bones) if rig else 0,"triangles":triangles}',
    'print("ALIFE_VROID_SOURCE="+json.dumps(result))',
  ].join(';')
  const blender = spawnSync(
    blenderExecutable,
    ['--background', sourceBlendPath, '--python-expr', expression],
    { cwd: repositoryRoot, encoding: 'utf8', timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
  )
  const match = blender.stdout?.match(/ALIFE_VROID_SOURCE=(\{[^\r\n]+\})/u)
  if (blender.status !== 0 || !match) {
    errors.push('Blender could not inspect the tracked VRoid source blend')
  } else {
    blenderEvidence = JSON.parse(match[1])
    if (blenderEvidence.meshCount !== 3
      || blenderEvidence.armatureCount !== 1
      || blenderEvidence.bones !== 187
      || blenderEvidence.triangles !== 42397) {
      errors.push('tracked VRoid source blend geometry or rig changed')
    }
  }
}

const report = {
  schemaVersion: 2,
  contract: 'vroid-fair-hero-source',
  status: errors.length === 0 ? 'runtime-integrated-awaiting-motion-review' : 'invalid',
  visualVariant: manifest.visualVariant,
  animationVariant: manifest.animationVariant,
  appearance: manifest.appearance,
  provenance: manifest.provenance,
  license: manifest.license,
  authoring: {
    sourceBlend: manifest.provenance?.sourceBlend,
    sourceBlendBytes: (await stat(sourceBlendPath)).size,
    sourceBlendSha256: sha256(sourceBlend),
    sourceVroidWorkspace,
    sourceVroidExists,
    exportScript: manifest.provenance?.generator?.path,
    exportScriptSha256: sha256(exportScript),
    blenderExecutable,
    blenderEvidence,
  },
  lods: lodEvidence,
  requiredAnimations: manifest.animation?.clips,
  errors,
  passed: errors.length === 0,
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
if (!report.passed) process.exitCode = 1
