import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from '../../cloudflare/alife-app/node_modules/typescript/lib/typescript.js'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const appRoot = resolve(repoRoot, 'cloudflare', 'alife-app')
const assetRoot = resolve(appRoot, 'public', 'virtual-church-assets')
const v3ReleaseRoot = resolve(
  assetRoot,
  'v3',
  'releases',
  'gate-a-baseline-r9',
)
const themePath = resolve(appRoot, 'src', 'views', 'alifeVisualTheme.ts')
const viewPath = resolve(appRoot, 'src', 'views', 'VirtualChurchView.tsx')
const postProcessingPath = resolve(appRoot, 'src', 'views', 'VirtualChurchPostProcessing.tsx')
const servicePath = resolve(appRoot, 'src', 'services', 'virtualChurchService.ts')
const textureBuilderPath = resolve(
  repoRoot,
  'tools',
  'virtual-church',
  'build-gate-a-church-textures.mjs',
)

const [themeSource, viewSource, serviceSource, postProcessingSource] = await Promise.all([
  readFile(themePath, 'utf8').then((source) => source.replace(/\r\n/g, '\n')),
  readFile(viewPath, 'utf8').then((source) => source.replace(/\r\n/g, '\n')),
  readFile(servicePath, 'utf8').then((source) => source.replace(/\r\n/g, '\n')),
  readFile(postProcessingPath, 'utf8').then((source) => source.replace(/\r\n/g, '\n')),
])
const transpiled = ts.transpileModule(themeSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2023,
  },
  fileName: themePath,
  reportDiagnostics: true,
})
const diagnostics = transpiled.diagnostics ?? []
if (diagnostics.length > 0) {
  const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => repoRoot,
    getNewLine: () => '\n',
  })
  throw new Error(`Unable to transpile Alife visual theme:\n${formatted}`)
}
const themeUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`
const theme = await import(themeUrl)
const errors = []
const expectedSceneBaseline = {
  scene: {
    background: '#8da8bc',
    fog: { color: '#c58e62', near: 50, far: 130 },
    exposure: 1.15,
  },
  lighting: {
    ambient: { intensity: 0.7 },
    hemisphere: { skyColor: '#bfd9e8', groundColor: '#705a45', intensity: 0.95 },
    directional: { color: '#ffd091', intensity: 3.2, position: [38, 24, 30] },
    accentLights: { color: '#ffb84d', intensity: 2.5 },
    entrance: { color: '#ffc878', intensity: 2.8, distance: 6 },
  },
  bloom: {
    luminanceThreshold: 1.05,
    luminanceSmoothing: 0.35,
    intensity: 0.45,
    radius: 0.28,
  },
  n8ao: {
    aoRadius: 1,
    intensity: 0.9,
    distanceFalloff: 1.2,
    screenSpaceRadius: false,
  },
  pbr: {
    envMapIntensity: 1.25,
    asphaltRoughness: 0.65,
    asphaltMetalness: 0.15,
    grassRoughness: 0.85,
    buildingRoughness: 0.35,
    buildingMetalness: 0.25,
    glassRoughness: 0.05,
    glassMetalness: 0.9,
  },
  emissive: {
    streetLight: { emissiveIntensity: 0.85 },
    vehicleLight: { emissiveIntensity: 0.65 },
    cross: { emissive: '#ffa500', emissiveIntensity: 0.3 },
    entranceMarker: { emissive: '#ffa500', emissiveIntensity: 0.8 },
    entranceRing: { color: '#ffd070', emissiveIntensity: 0.7 },
  },
}
const actualSceneBaseline = {
  scene: theme.ALIFE_SCENE,
  lighting: theme.ALIFE_LIGHTING,
  bloom: theme.ALIFE_BLOOM,
  n8ao: theme.ALIFE_N8AO,
  pbr: theme.ALIFE_PBR,
  emissive: theme.ALIFE_EMISSIVE,
}
if (JSON.stringify(actualSceneBaseline) !== JSON.stringify(expectedSceneBaseline)) {
  errors.push('scene-level theme differs from the frozen v2 production baseline')
}
const expectedV3SceneTreatment = {
  scene: {
    background: '#9fc7df',
    fog: { color: '#c8d8d5', near: 80, far: 175 },
    exposure: 1.08,
    backgroundIntensity: { desktop: 0.94, mobile: 0.9 },
    visibleSky: {
      horizonGlow: 'rgba(255, 238, 200, 0.13)',
      cloudCore: 'rgba(255, 255, 250, 0.17)',
      cloudEdge: 'rgba(236, 246, 250, 0)',
    },
  },
  lighting: {
    ambient: { intensity: 0.82 },
    hemisphere: { skyColor: '#d7ecf4', groundColor: '#7b7568', intensity: 1.05 },
    directional: { color: '#fff0d0', intensity: 2.5, position: [34, 32, 18] },
  },
  accent: {
    cross: {
      emissive: '#ffe1aa',
      emissiveIntensity: 0.42,
      lightIntensity: 1.15,
      distance: 4.8,
    },
    entrance: {
      color: '#fff0d4',
      intensity: 1.35,
      distance: 5.4,
    },
  },
}
if (JSON.stringify(theme.ALIFE_V3_SCENE_TREATMENT) !== JSON.stringify(expectedV3SceneTreatment)) {
  errors.push('V3 clear-morning scene treatment differs from the reviewed contract')
}
for (const prohibitedSource of [
  'getVisualVersion',
  'useV3Preview',
  'warm-faithful',
  'soft-storybook',
]) {
  if (themeSource.includes(prohibitedSource)) {
    errors.push(`theme still contains unapproved visual branch ${prohibitedSource}`)
  }
}
for (const requiredConsumer of [
  '<PbrEnvironmentMap visualVersion={visualVersion} />',
  "visualVersion === 'v3'\n    ? ALIFE_V3_SCENE_TREATMENT.scene",
  "visualVersion === 'v3'\n    ? ALIFE_V3_SCENE_TREATMENT.lighting",
  "gl.toneMappingExposure = config3D.visualVersion === 'v3'",
  ': ALIFE_SCENE.exposure',
  '<SiteScene visualVersion={config3D.visualVersion}',
]) {
  if (!viewSource.includes(requiredConsumer)) {
    errors.push(`VirtualChurchView is missing versioned theme consumer ${requiredConsumer}`)
  }
}

function validatePostProcessingConsumers(viewSource, postProcessingSource) {
  const errors = []
  for (const consumer of [
    "const DeferredPostProcessing = lazy(() => import('./VirtualChurchPostProcessing'))",
    '{postProcessingReady ? (',
    '<DeferredPostProcessing />',
  ]) {
    if (!viewSource.includes(consumer)) errors.push(`VirtualChurchView is missing deferred post-processing wiring ${consumer}`)
  }
  for (const consumer of [
    "import { ALIFE_BLOOM, ALIFE_N8AO } from './alifeVisualTheme'",
    'intensity={ALIFE_N8AO.intensity}',
    'intensity={ALIFE_BLOOM.intensity}',
    'export default VirtualChurchPostProcessing',
  ]) {
    if (!postProcessingSource.includes(consumer)) errors.push(`VirtualChurchPostProcessing is missing versioned theme consumer ${consumer}`)
  }
  return errors
}

errors.push(...validatePostProcessingConsumers(viewSource, postProcessingSource))

const buildingSection = serviceSource.slice(
  serviceSource.indexOf('buildings: {'),
  serviceSource.indexOf('\n  },\n})', serviceSource.indexOf('buildings: {')),
)
const expectedBuildingMappings = [
  "churchHeroHigh: selectedAssetUrl(",
  "churchHeroMedium: selectedAssetUrl(",
  "churchHeroLow: selectedAssetUrl(",
  "churchProps: assetUrl('/buildings/church-props.glb', 'v2')",
]
for (const mapping of expectedBuildingMappings) {
  if (!buildingSection.includes(mapping)) errors.push(`service is missing frozen building mapping ${mapping}`)
}
if ((buildingSection.match(/selectedAssetUrl\(/g) ?? []).length !== 3) {
  errors.push('exactly three church Hero LODs must use the reviewed v3 lossless path')
}
for (const file of [
  'church-hero.glb',
  'church-hero-medium.glb',
  'church-hero-low.glb',
]) {
  if ((buildingSection.match(new RegExp(file.replaceAll('.', '\\.'), 'g')) ?? []).length !== 2) {
    errors.push(`${file}: service must map both v2 and v3 to the same relative GLB name`)
  }
}
const configuredVersionBlock = serviceSource.match(
  /const configuredVisualVersion:[\s\S]*?(?=\r?\n\r?\n\/\*\*)/,
)?.[0] ?? ''
if (
  !configuredVersionBlock.includes(
    "import.meta.env.VITE_VIRTUAL_CHURCH_VISUAL_DEFAULT === 'v3'",
  )
  || !configuredVersionBlock.includes(
    "import.meta.env.VITE_VIRTUAL_CHURCH_VISUAL_DEFAULT === 'v2'",
  )
  || !/:\s*import\.meta\.env\.DEV\s*\?\s*'v3'\s*:\s*'v2'/.test(
    configuredVersionBlock,
  )
) {
  errors.push('production-safe v2 default expression changed')
}

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')
const parseGlbJson = (buffer, label) => {
  if (buffer.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${label}: invalid GLB magic`)
  const jsonLength = buffer.readUInt32LE(12)
  const jsonType = buffer.toString('ascii', 16, 20)
  if (jsonType !== 'JSON') throw new Error(`${label}: first GLB chunk is not JSON`)
  return JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength).trimEnd())
}
const buildingFiles = [
  'church-hero.glb',
  'church-hero-medium.glb',
  'church-hero-low.glb',
]
const buildingEvidence = []
for (const file of buildingFiles) {
  const [v2Buffer, dormantV3Buffer] = await Promise.all([
    readFile(resolve(assetRoot, 'buildings', file)),
    readFile(resolve(v3ReleaseRoot, 'buildings', file)),
  ])
  const v2Hash = sha256(v2Buffer)
  const v3Hash = sha256(dormantV3Buffer)
  const glb = parseGlbJson(v2Buffer, file)
  const textureUris = (glb.images ?? []).map((image) => image.uri).filter(Boolean)
  if (v2Hash !== v3Hash) errors.push(`${file}: dormant v3 copy differs from production v2 GLB`)
  if (textureUris.some((uri) => !uri.startsWith('../textures/'))) {
    errors.push(`${file}: texture URI is outside the production texture directory`)
  }
  buildingEvidence.push({
    file,
    v2Sha256: v2Hash,
    v3RuntimeSha256: v3Hash,
    byteIdentical: v2Hash === v3Hash,
    textureUris,
  })
}

const pngDimensions = (buffer, label) => {
  if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
    throw new Error(`${label}: invalid PNG signature`)
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}
const textureFiles = [
  'church-material-atlas-basecolor.png',
  'church-material-atlas-normal.png',
  'church-material-atlas-orm.png',
]
const losslessTextureValidation = JSON.parse(execFileSync(
  process.execPath,
  [textureBuilderPath, '--validate'],
  { encoding: 'utf8' },
))
const textureEvidence = []
for (const file of textureFiles) {
  const [v2Texture, v3RuntimeTexture] = await Promise.all([
    readFile(resolve(assetRoot, 'textures', file)),
    readFile(resolve(v3ReleaseRoot, 'textures', file)),
  ])
  const v2Dimensions = pngDimensions(v2Texture, file)
  const v3Dimensions = pngDimensions(v3RuntimeTexture, `v3/${file}`)
  const losslessEvidence = losslessTextureValidation.textures.find((item) => item.file === file)
  if (
    v2Dimensions.width !== 1024
    || v2Dimensions.height !== 1024
    || v3Dimensions.width !== 1024
    || v3Dimensions.height !== 1024
  ) {
    errors.push(`${file}: v2 and v3 runtime textures must both be 1024x1024`)
  }
  if (!losslessEvidence?.decodedPixelsIdentical) {
    errors.push(`${file}: v3 runtime texture is not decoded-pixel-identical to v2`)
  }
  textureEvidence.push({
    file,
    v2: { ...v2Dimensions, bytes: v2Texture.byteLength, sha256: sha256(v2Texture) },
    v3Runtime: {
      ...v3Dimensions,
      bytes: v3RuntimeTexture.byteLength,
      sha256: sha256(v3RuntimeTexture),
      decodedPixelsIdentical: losslessEvidence?.decodedPixelsIdentical ?? false,
      decodedRgbaSha256: losslessEvidence?.decodedRgbaSha256,
    },
  })
}

if (errors.length > 0) {
  console.error(JSON.stringify({ passed: false, errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    productionDefault: 'v2',
    v3ChurchRuntimePath: 'v3-byte-identical-glb-lossless-1024-textures',
    sharedSceneTheme: 'v2-production-baseline',
    sceneBaseline: actualSceneBaseline,
    v3SceneTreatment: theme.ALIFE_V3_SCENE_TREATMENT,
    buildings: buildingEvidence,
    textures: textureEvidence,
    v3TextureOutputsUsedAtRuntime: true,
    passed: true,
  }, null, 2))
}
