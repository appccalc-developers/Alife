import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from '../../cloudflare/alife-app/node_modules/typescript/lib/typescript.js'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const appRoot = resolve(repoRoot, 'cloudflare', 'alife-app')
const distRootOption = process.argv.find((argument) => argument.startsWith('--dist-root='))
const distRoot = resolve(distRootOption?.slice('--dist-root='.length) ?? resolve(appRoot, 'dist'))
const distAssetsRoot = resolve(distRoot, 'assets')
const servicePath = resolve(appRoot, 'src', 'services', 'virtualChurchService.ts')
const criticalAssetsPath = resolve(
  appRoot,
  'src',
  'views',
  'virtualChurchCriticalAssets.ts',
)
const viewPath = resolve(appRoot, 'src', 'views', 'VirtualChurchView.tsx')
const probePath = resolve(appRoot, 'src', 'views', 'VirtualChurchPerformanceProbe.tsx')
const performanceContractPath = resolve(
  appRoot,
  'src',
  'views',
  'virtualChurchPerformanceContract.ts',
)
const budgetPath = resolve(scriptDir, 'performance-budgets.json')

const [
  serviceSource,
  criticalAssetsSource,
  viewSource,
  probeSource,
  performanceContractSource,
  budgetSource,
] = await Promise.all([
  readFile(servicePath, 'utf8'),
  readFile(criticalAssetsPath, 'utf8'),
  readFile(viewPath, 'utf8'),
  readFile(probePath, 'utf8'),
  readFile(performanceContractPath, 'utf8'),
  readFile(budgetPath, 'utf8'),
])

const errors = []
const requireSource = (source, fragment, label) => {
  if (!source.includes(fragment)) errors.push(`${label}: missing ${JSON.stringify(fragment)}`)
}

const releaseMatch = serviceSource.match(
  /const V3_ASSET_RELEASE = '([a-z0-9-]+)'/,
)
if (!releaseMatch) {
  throw new Error('Unable to read V3_ASSET_RELEASE from virtualChurchService.ts')
}
const release = releaseMatch[1]
const releaseUrlRoot = `/virtual-church-assets/v3/releases/${release}`

requireSource(
  viewSource,
  'const HERO_READY_ASSETS = selectVirtualChurchHeroReadyAssets(',
  'Virtual Church view',
)
requireSource(
  viewSource,
  "const CHURCH_HERO_ASSET_PATH = profile3DFailureMode === 'church-glb'",
  'Virtual Church view',
)
requireSource(
  viewSource,
  "return profile3DFailureMode === 'character-glb'",
  'Virtual Church view',
)
requireSource(
  viewSource,
  'useLoader(GLTFLoader, CHURCH_HERO_ASSET_PATH',
  'Virtual Church view',
)
requireSource(
  viewSource,
  'useLoader(GLTFLoader, assetPath, (loader) =>',
  'Virtual Church view',
)
requireSource(
  viewSource,
  "lazy(() => import('./VirtualChurchSurroundingFacades'))",
  'Virtual Church view',
)
requireSource(
  viewSource,
  "lazy(() => import('./VirtualChurchPostProcessing'))",
  'Virtual Church view',
)
requireSource(
  performanceContractSource,
  '/VirtualChurchView-|vendor-3d-|virtual-church-assets\\/|draco/',
  'performance session contract',
)
requireSource(
  probeSource,
  'virtualChurchResourceBelongsToProfile(entry, routeStartedAt)',
  'performance probe',
)

const transpiled = ts.transpileModule(criticalAssetsSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2023,
  },
  fileName: criticalAssetsPath,
  reportDiagnostics: true,
})
if ((transpiled.diagnostics ?? []).length > 0) {
  const formatted = ts.formatDiagnosticsWithColorAndContext(
    transpiled.diagnostics,
    {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => repoRoot,
      getNewLine: () => '\n',
    },
  )
  throw new Error(`Unable to transpile critical asset selector:\n${formatted}`)
}
const selectorUrl =
  `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`
const { selectVirtualChurchHeroReadyAssets } = await import(selectorUrl)

const fakeConfig = {
  buildings: {
    churchHeroHigh: `${releaseUrlRoot}/buildings/church-hero.glb`,
    churchHeroMedium: `${releaseUrlRoot}/buildings/church-hero-medium.glb`,
    churchHeroLow: `${releaseUrlRoot}/buildings/church-hero-low.glb`,
    churchProps: '/virtual-church-assets/buildings/church-props.glb',
  },
  characters: {
    gateAFemaleHigh: `${releaseUrlRoot}/characters/character-hero-female-high.glb`,
    gateAFemaleMedium: `${releaseUrlRoot}/characters/character-hero-female-medium.glb`,
    gateAFemaleLow: `${releaseUrlRoot}/characters/character-hero-female-low.glb`,
    gateAMaleHigh: '/virtual-church-assets/v3/releases/male-hero-v14-r1/characters/character-hero-male-high.glb',
    gateAMaleMedium: '/virtual-church-assets/v3/releases/male-hero-v14-r1/characters/character-hero-male-medium.glb',
    gateAMaleLow: '/virtual-church-assets/v3/releases/male-hero-v14-r1/characters/character-hero-male-low.glb',
  },
}

const parseGlbJson = (buffer, label) => {
  if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error(`${label}: expected a binary glTF 2.0 file`)
  }
  if (buffer.readUInt32LE(4) !== 2) {
    throw new Error(`${label}: expected glTF version 2`)
  }
  const declaredLength = buffer.readUInt32LE(8)
  const jsonLength = buffer.readUInt32LE(12)
  const jsonType = buffer.readUInt32LE(16)
  if (declaredLength !== buffer.length || jsonType !== 0x4e4f534a) {
    throw new Error(`${label}: invalid GLB header or JSON chunk`)
  }
  return JSON.parse(
    buffer.toString('utf8', 20, 20 + jsonLength).replace(/\0+$/u, '').trim(),
  )
}

const externalGlbDependencies = async (glbPath) => {
  const json = parseGlbJson(await readFile(glbPath), glbPath)
  const uris = [
    ...(json.buffers ?? []).map((item) => item.uri),
    ...(json.images ?? []).map((item) => item.uri),
  ].filter(
    (uri) =>
      typeof uri === 'string' &&
      !uri.startsWith('data:'),
  )
  return [...new Set(uris)].map((uri) =>
    resolve(dirname(glbPath), decodeURIComponent(uri.split(/[?#]/u)[0])),
  )
}

const normalizePath = (path) => relative(distRoot, path).split(sep).join('/')
const addResource = async (resources, path, category) => {
  const details = await stat(path)
  if (!details.isFile()) throw new Error(`${path}: expected a file`)
  const key = resolve(path)
  const previous = resources.get(key)
  resources.set(key, {
    path: normalizePath(key),
    bytes: details.size,
    categories: previous
      ? [...new Set([...previous.categories, category])].sort()
      : [category],
  })
}

const distAssetEntries = await readdir(distAssetsRoot, { withFileTypes: true })
const findSingleChunk = (prefix, extension = '.js') => {
  const matches = distAssetEntries.filter(
    (entry) =>
      entry.isFile() &&
      entry.name.startsWith(prefix) &&
      entry.name.endsWith(extension),
  )
  if (matches.length !== 1) {
    errors.push(`production dist must contain exactly one ${prefix}*${extension}, received ${matches.length}`)
    return null
  }
  return resolve(distAssetsRoot, matches[0].name)
}
const criticalChunks = [
  findSingleChunk('VirtualChurchView-'),
  findSingleChunk('vendor-3d-'),
].filter(Boolean)
// The route's deferred stylesheet is required before its first render too.
// Do not let a JS-only ceiling hide the cost of newly extracted tour controls.
const criticalStyles = viewSource.includes("import './virtualChurchTourControls.css'")
  ? [findSingleChunk('VirtualChurchView-', '.css')].filter(Boolean)
  : []
const deferredFacadeChunk = findSingleChunk('VirtualChurchSurroundingFacades-')
const deferredPostProcessingChunk = findSingleChunk('VirtualChurchPostProcessing-')
const deferredPostProcessingVendorChunk = findSingleChunk('vendor-postprocessing-')

const decoderRoot = resolve(distRoot, 'virtual-church-assets', 'draco')
const decoderEntries = (await readdir(decoderRoot, { withFileTypes: true }))
  // Redistribution notices ship with the decoder but are not requested by it.
  .filter((entry) => entry.isFile() && !['LICENSE', 'NOTICE'].includes(entry.name))
  .map((entry) => resolve(decoderRoot, entry.name))
  .sort()
if (decoderEntries.length !== 3) {
  errors.push(`Draco compatibility ceiling must include three decoder files, received ${decoderEntries.length}`)
}

const budgets = JSON.parse(budgetSource)
const profiles = []

for (const [profileName, isMobile, heroId] of [
  ['desktop', false, 'female'],
  ['mobile', true, 'female'],
  ['desktop', false, 'male'],
  ['mobile', true, 'male'],
]) {
  const selected = selectVirtualChurchHeroReadyAssets(fakeConfig, isMobile, heroId)
  const resources = new Map()

  for (const chunk of criticalChunks) {
    await addResource(resources, chunk, 'production-3d-code')
  }
  for (const style of criticalStyles) {
    await addResource(resources, style, 'production-3d-style')
  }
  for (const decoder of decoderEntries) {
    await addResource(resources, decoder, 'draco-compatibility-ceiling')
  }

  const churchPath = resolve(distRoot, `.${selected.churchHero}`)
  const characterPath = resolve(distRoot, `.${selected.characterHero}`)
  await addResource(resources, churchPath, 'church-glb')
  await addResource(resources, characterPath, 'character-glb')

  for (const dependency of await externalGlbDependencies(churchPath)) {
    await addResource(resources, dependency, 'church-external-dependency')
  }
  for (const dependency of await externalGlbDependencies(characterPath)) {
    await addResource(resources, dependency, 'character-external-dependency')
  }

  const resourceList = [...resources.values()].sort((left, right) =>
    left.path.localeCompare(right.path),
  )
  const rawBytes = resourceList.reduce((sum, item) => sum + item.bytes, 0)
  const characterBytes =
    resources.get(resolve(characterPath))?.bytes ?? Number.POSITIVE_INFINITY
  const target = budgets[profileName]
  const payloadPassed =
    rawBytes <= target.initialCriticalEncodedBodySizeBytesMax
  const characterPassed =
    characterBytes <= target.characterEncodedBodySizeBytesMax
  if (!payloadPassed) {
    errors.push(
      `${profileName}: declared critical raw bytes ${rawBytes} exceed encoded-body target ${target.initialCriticalEncodedBodySizeBytesMax}`,
    )
  }
  if (!characterPassed) {
    errors.push(
      `${profileName}: character GLB ${characterBytes} exceeds character transfer target ${target.characterEncodedBodySizeBytesMax}`,
    )
  }

  const categoryBytes = {}
  for (const item of resourceList) {
    for (const category of item.categories) {
      categoryBytes[category] = (categoryBytes[category] ?? 0) + item.bytes
    }
  }

  profiles.push({
    profile: profileName,
    heroId,
    selected,
    rawByteCeiling: rawBytes,
    encodedBodyBudgetBytes: target.initialCriticalEncodedBodySizeBytesMax,
    headroomBytes: target.initialCriticalEncodedBodySizeBytesMax - rawBytes,
    budgetUsedPercent: Number(
      ((rawBytes / target.initialCriticalEncodedBodySizeBytesMax) * 100).toFixed(1),
    ),
    characterBytes,
    characterBudgetBytes: target.characterEncodedBodySizeBytesMax,
    transferFloorAtProfileBandwidthMs: Number(
      ((rawBytes * 8) / (target.network.kilobitsPerSecond * 1000) * 1000).toFixed(1),
    ),
    categoryBytes,
    resources: resourceList,
    passed: payloadPassed && characterPassed,
  })
}

if (errors.length > 0) {
  throw new Error(`Virtual Church static critical payload validation failed:\n- ${errors.join('\n- ')}`)
}

console.log(JSON.stringify({
  release,
  deferredDesktopAfterHero: deferredFacadeChunk
    ? {
        path: normalizePath(deferredFacadeChunk),
        bytes: (await stat(deferredFacadeChunk)).size,
        includedInHeroReadyBudget: false,
      }
    : null,
  deferredDesktopPostProcessing: deferredPostProcessingChunk && deferredPostProcessingVendorChunk
    ? {
        component: {
          path: normalizePath(deferredPostProcessingChunk),
          bytes: (await stat(deferredPostProcessingChunk)).size,
        },
        vendor: {
          path: normalizePath(deferredPostProcessingVendorChunk),
          bytes: (await stat(deferredPostProcessingVendorChunk)).size,
        },
        includedInHeroReadyBudget: false,
      }
    : null,
  measurement: {
    name: 'declared Hero-ready raw-byte ceiling',
    scope: [
      'production VirtualChurchView and vendor-3d chunks',
      'all three bundled Draco compatibility files',
      'selected church GLB and every external dependency',
      'each selected female/male Hero GLB and every external dependency (separate visits, not preloaded together)',
    ],
    interpretation:
      'Raw files conservatively bound encoded transfer size, but do not prove request timing, parsing, FPS, GPU memory, deferred-load behavior, or real-device performance.',
  },
  profiles,
  passed: true,
}, null, 2))
