import { access, readFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import ts from '../../cloudflare/alife-app/node_modules/typescript/lib/typescript.js'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const appRoot = resolve(repoRoot, 'cloudflare', 'alife-app')
const distRootOption = process.argv.find((argument) => argument.startsWith('--dist-root='))
const validateDist = process.argv.includes('--dist') || distRootOption !== undefined
const assetRoot = resolve(appRoot, 'public', 'virtual-church-assets')
const v3Root = resolve(assetRoot, 'v3')

const release = 'gate-a-baseline-r9'
const releasePrefix = `/v3/releases/${release}`
const cacheName = `alife-virtual-church-assets-${release}`
const codeCacheName = `alife-virtual-church-code-${release}`
const releaseRoot = resolve(v3Root, 'releases', release)
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const servicePath = resolve(appRoot, 'src', 'services', 'virtualChurchService.ts')
const viteConfigPath = resolve(appRoot, 'vite.config.ts')
const cacheMaintenancePath = resolve(
  appRoot,
  'public',
  'virtual-church-cache-maintenance.js',
)
const pwaContractPath = resolve(
  appRoot,
  'src',
  'views',
  'virtualChurchPwaContract.ts',
)
const heroDccValidatorPath = resolve(
  repoRoot,
  'tools',
  'virtual-church',
  'validate-gate-a-hero-dcc-source.mjs',
)
const heroReviewRendererPath = resolve(repoRoot, 'tools', 'virtual-church', 'render-gate-a-hero-review.mjs')
const textureBuilderPath = resolve(repoRoot, 'tools', 'virtual-church', 'build-gate-a-church-textures.mjs')
const wardrobeValidatorPath = resolve(repoRoot, 'tools', 'virtual-church', 'validate-gate-a-wardrobe-runtime.mjs')
const churchValidatorPath = resolve(repoRoot, 'tools', 'virtual-church', 'validate-gate-a-church-baseline.mjs')
const heroExportPath = resolve(
  repoRoot,
  'tools',
  'blender',
  'virtual_church',
  'v3',
  'export_vroid_gate_a_female_hero.py',
)
const licensePath = resolve(assetRoot, 'ASSET-LICENSES.md')

const [
  serviceSource,
  viteConfigSource,
  cacheMaintenanceSource,
  pwaContractSource,
  heroDccValidatorSource,
  heroReviewRendererSource,
  textureBuilderSource,
  wardrobeValidatorSource,
  churchValidatorSource,
  heroExportSource,
  licenseSource,
] = await Promise.all([
  readFile(servicePath, 'utf8'),
  readFile(viteConfigPath, 'utf8'),
  readFile(cacheMaintenancePath, 'utf8'),
  readFile(pwaContractPath, 'utf8'),
  readFile(heroDccValidatorPath, 'utf8'),
  readFile(heroReviewRendererPath, 'utf8'),
  readFile(textureBuilderPath, 'utf8'),
  readFile(wardrobeValidatorPath, 'utf8'),
  readFile(churchValidatorPath, 'utf8'),
  readFile(heroExportPath, 'utf8'),
  readFile(licensePath, 'utf8'),
])

const errors = []
const requireSource = (source, fragment, label) => {
  if (!source.includes(fragment)) errors.push(`${label}: missing ${JSON.stringify(fragment)}`)
}

requireSource(
  serviceSource,
  `const V3_ASSET_RELEASE = '${release}'`,
  'runtime asset service',
)
requireSource(
  serviceSource,
  'const V3_ASSET_PREFIX = `/v3/releases/${V3_ASSET_RELEASE}`',
  'runtime asset service',
)
if (serviceSource.includes("const V3_ASSET_PREFIX = '/v3'")) {
  errors.push('runtime asset service: bare /v3 prefix can reuse superseded CacheFirst URLs')
}

requireSource(
  viteConfigSource,
  `const VIRTUAL_CHURCH_ASSET_RELEASE = '${release}'`,
  'Vite PWA config',
)
requireSource(
  viteConfigSource,
  '`alife-virtual-church-assets-${VIRTUAL_CHURCH_ASSET_RELEASE}`',
  'Vite PWA config',
)
requireSource(
  viteConfigSource,
  '`alife-virtual-church-code-${VIRTUAL_CHURCH_ASSET_RELEASE}`',
  'Vite PWA config',
)
const viteAst = ts.createSourceFile(viteConfigPath, viteConfigSource, ts.ScriptTarget.Latest, true)
const configuredScripts = []
const configuredAppCaches = []
const inspectViteProperty = (node) => {
  if (ts.isPropertyAssignment(node)) {
    if (node.name.getText(viteAst) === 'importScripts' && ts.isArrayLiteralExpression(node.initializer)) {
      configuredScripts.push(...node.initializer.elements.filter(ts.isStringLiteralLike).map(value => value.text))
    }
    if (node.name.getText(viteAst) === 'cacheName' && ts.isStringLiteralLike(node.initializer)
      && node.initializer.text.startsWith('alife-app-cache')) configuredAppCaches.push(node.initializer.text)
  }
  ts.forEachChild(node, inspectViteProperty)
}
inspectViteProperty(viteAst)
for (const script of ['/sw-runtime-cache-migration.js', '/virtual-church-cache-maintenance.js']) {
  if (!configuredScripts.includes(script)) errors.push(`Vite PWA config does not import ${script}`)
}
if (configuredAppCaches.length !== 1 || !/^alife-app-cache-v\d+$/.test(configuredAppCaches[0])) {
  errors.push('Vite PWA config must use one versioned application cache after the privacy migration')
}
requireSource(
  viteConfigSource,
  'cacheName: VIRTUAL_CHURCH_CACHE_NAME',
  'Vite PWA config',
)
requireSource(
  pwaContractSource,
  "url.pathname.startsWith('/virtual-church-assets/')",
  'PWA asset cache contract',
)
requireSource(viteConfigSource, "handler: 'CacheFirst'", 'Vite PWA config')
for (const fragment of [
  'urlPattern: virtualChurchCodeChunkMatches',
  'cacheName: VIRTUAL_CHURCH_CODE_CACHE_NAME',
  'maxEntries: 16',
]) {
  requireSource(viteConfigSource, fragment, 'Vite PWA 3D code cache')
}
const codeCacheRouteIndex = viteConfigSource.indexOf(
  'urlPattern: virtualChurchCodeChunkMatches',
)
const genericScriptRouteIndex = viteConfigSource.indexOf(
  'urlPattern: virtualChurchAppShellRequestMatches',
)
if (
  codeCacheRouteIndex < 0
  || genericScriptRouteIndex < 0
  || codeCacheRouteIndex > genericScriptRouteIndex
) {
  errors.push('Vite PWA config: 3D CacheFirst route must precede the generic NetworkFirst script route')
}

const transpiledPwaContract = ts.transpileModule(pwaContractSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2023,
  },
  fileName: pwaContractPath,
  reportDiagnostics: true,
})
if ((transpiledPwaContract.diagnostics ?? []).length > 0) {
  const formatted = ts.formatDiagnosticsWithColorAndContext(
    transpiledPwaContract.diagnostics,
    {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => repoRoot,
      getNewLine: () => '\n',
    },
  )
  throw new Error(`Unable to transpile PWA contract:\n${formatted}`)
}
const pwaContractUrl =
  `data:text/javascript;base64,${Buffer.from(transpiledPwaContract.outputText).toString('base64')}`
const pwaContract = await import(pwaContractUrl)
const pwaRouteCases = [
  {
    name: 'Virtual Church route chunk',
    request: { destination: 'script' },
    url: {
      origin: 'https://app.example',
      pathname: '/assets/VirtualChurchView-abc123.js',
    },
    expected: true,
  },
  {
    name: 'shared 3D vendor chunk',
    request: { destination: 'script' },
    url: {
      origin: 'https://app.example',
      pathname: '/assets/vendor-3d-def456.js',
    },
    expected: true,
  },
  ...[
    'VirtualChurchStudyRoomView-study123.js',
    'VirtualChurchMainHallView-hall123.js',
    'virtualChurchAccessibility-access123.js',
    'virtualChurchMainHallPortal-portal123.js',
    'virtualChurchResourceLeaseContract-lease123.js',
  ].map((name) => ({
    name: `on-demand church helper ${name}`,
    request: { destination: 'script' },
    url: { origin: 'https://app.example', pathname: `/assets/${name}` },
    expected: true,
  })),
  {
    name: 'deferred surrounding facade chunk',
    request: { destination: 'script' },
    url: {
      origin: 'https://app.example',
      pathname: '/assets/VirtualChurchSurroundingFacades-detail123.js',
    },
    expected: true,
  },
  {
    name: 'deferred post-processing component',
    request: { destination: 'script' },
    url: {
      origin: 'https://app.example',
      pathname: '/assets/VirtualChurchPostProcessing-post123.js',
    },
    expected: true,
  },
  {
    name: 'deferred post-processing vendor chunk',
    request: { destination: 'script' },
    url: {
      origin: 'https://app.example',
      pathname: '/assets/vendor-postprocessing-vendor123.js',
    },
    expected: true,
  },
  {
    name: 'other application script',
    request: { destination: 'script' },
    url: {
      origin: 'https://app.example',
      pathname: '/assets/index-abc123.js',
    },
    expected: false,
  },
  {
    name: 'cross-origin lookalike',
    request: { destination: 'script' },
    url: {
      origin: 'https://cdn.example',
      pathname: '/assets/vendor-3d-def456.js',
    },
    expected: false,
  },
  {
    name: 'non-script request',
    request: { destination: 'style' },
    url: {
      origin: 'https://app.example',
      pathname: '/assets/VirtualChurchView-abc123.js',
    },
    expected: false,
  },
  {
    name: 'similar directory name',
    request: { destination: 'script' },
    url: {
      origin: 'https://app.example',
      pathname: '/assetsx/vendor-3d-def456.js',
    },
    expected: false,
  },
]
for (const testCase of pwaRouteCases) {
  const actual = pwaContract.virtualChurchCodeChunkMatches(
    {
      request: testCase.request,
      url: testCase.url,
    },
    'https://app.example',
  )
  if (actual !== testCase.expected) {
    errors.push(
      `PWA 3D code route ${testCase.name}: expected ${testCase.expected}, received ${actual}`,
    )
  }
}

const pwaAssetRouteCases = [
  {
    name: 'current Gate A GLB',
    url: {
      origin: 'https://app.example',
      pathname: `/virtual-church-assets${releasePrefix}/characters/character-hero-female-medium.glb`,
    },
    expected: true,
  },
  {
    name: 'shared Draco decoder',
    url: {
      origin: 'https://app.example',
      pathname: '/virtual-church-assets/draco/draco_decoder.wasm',
    },
    expected: true,
  },
  ...[
    'foyer-courtyard-reference-01.jpg',
    'foyer-courtyard-reference-04.jpg',
    'foyer-oak-basecolor-v2.webp',
  ].map((file) => ({
    name: `V3 foyer preview ${file}`,
    url: {
      origin: 'https://app.example',
      pathname: `/virtual-church-assets/v3/${file}`,
    },
    expected: true,
  })),
  {
    name: 'cross-origin asset lookalike',
    url: {
      origin: 'https://cdn.example',
      pathname: '/virtual-church-assets/vehicles/sedan.glb',
    },
    expected: false,
  },
  {
    name: 'similar asset directory',
    url: {
      origin: 'https://app.example',
      pathname: '/virtual-church-assetsx/vehicles/sedan.glb',
    },
    expected: false,
  },
]
for (const testCase of pwaAssetRouteCases) {
  const actual = pwaContract.virtualChurchAssetRequestMatches(
    { url: testCase.url },
    'https://app.example',
  )
  if (actual !== testCase.expected) {
    errors.push(
      `PWA 3D asset route ${testCase.name}: expected ${testCase.expected}, received ${actual}`,
    )
  }
}

const pwaAppShellRouteCases = [
  {
    name: 'Virtual Church navigation',
    request: { destination: 'document', mode: 'navigate' },
    url: { origin: 'https://app.example', pathname: '/virtual-church' },
    expected: true,
  },
  {
    name: 'application entry script',
    request: { destination: 'script', mode: 'no-cors' },
    url: { origin: 'https://app.example', pathname: '/assets/index-abc123.js' },
    expected: true,
  },
  {
    name: 'protected API navigation',
    request: { destination: 'document', mode: 'navigate' },
    url: { origin: 'https://app.example', pathname: '/api/me' },
    expected: false,
  },
  {
    name: 'protected API request',
    request: { destination: '', mode: 'cors' },
    url: { origin: 'https://app.example', pathname: '/api/groups' },
    expected: false,
  },
  {
    name: 'private image service navigation',
    request: { destination: 'document', mode: 'navigate' },
    url: { origin: 'https://app.example', pathname: '/images/member-private/file' },
    expected: false,
  },
  {
    name: '3D asset script handled by dedicated cache',
    request: { destination: 'script', mode: 'no-cors' },
    url: {
      origin: 'https://app.example',
      pathname: '/virtual-church-assets/draco/draco_decoder.js',
    },
    expected: false,
  },
  {
    name: 'cross-origin application script',
    request: { destination: 'script', mode: 'no-cors' },
    url: { origin: 'https://cdn.example', pathname: '/assets/index-abc123.js' },
    expected: false,
  },
]
for (const testCase of pwaAppShellRouteCases) {
  const actual = pwaContract.virtualChurchAppShellRequestMatches(
    {
      request: testCase.request,
      url: testCase.url,
    },
    'https://app.example',
  )
  if (actual !== testCase.expected) {
    errors.push(
      `PWA application shell route ${testCase.name}: expected ${testCase.expected}, received ${actual}`,
    )
  }
}

const pwaPublicMediaRouteCases = [
  {
    name: 'public homepage video',
    matcher: 'virtualChurchPublicVideoRequestMatches',
    request: { destination: 'video' },
    url: { origin: 'https://app.example', pathname: '/media/homepage-hero.mp4' },
    expected: true,
  },
  {
    name: 'member image requested as video',
    matcher: 'virtualChurchPublicVideoRequestMatches',
    request: { destination: 'video' },
    url: { origin: 'https://app.example', pathname: '/images/member-private/clip.mp4' },
    expected: false,
  },
  {
    name: 'public bundled image',
    matcher: 'virtualChurchPublicImageOrFontRequestMatches',
    request: { destination: 'image' },
    url: { origin: 'https://app.example', pathname: '/assets/logo-abc123.png' },
    expected: true,
  },
  {
    name: 'public icon',
    matcher: 'virtualChurchPublicImageOrFontRequestMatches',
    request: { destination: 'image' },
    url: { origin: 'https://app.example', pathname: '/icons/icon-192x192.png' },
    expected: true,
  },
  {
    name: 'member image',
    matcher: 'virtualChurchPublicImageOrFontRequestMatches',
    request: { destination: 'image' },
    url: { origin: 'https://app.example', pathname: '/images/member-private/photo.jpg' },
    expected: false,
  },
  {
    name: 'protected API image',
    matcher: 'virtualChurchPublicImageOrFontRequestMatches',
    request: { destination: 'image' },
    url: { origin: 'https://app.example', pathname: '/api/files/private.jpg' },
    expected: false,
  },
]
for (const testCase of pwaPublicMediaRouteCases) {
  const actual = pwaContract[testCase.matcher](
    {
      request: testCase.request,
      url: testCase.url,
    },
    'https://app.example',
  )
  if (actual !== testCase.expected) {
    errors.push(
      `PWA public media route ${testCase.name}: expected ${testCase.expected}, received ${actual}`,
    )
  }
}

const pwaPublicRuntimeRouteCases = [
  {
    name: 'public application asset',
    url: { origin: 'https://app.example', pathname: '/assets/index-abc123.js' },
    expected: true,
  },
  {
    name: 'public manifest',
    url: { origin: 'https://app.example', pathname: '/manifest.json' },
    expected: true,
  },
  {
    name: 'protected API response',
    url: { origin: 'https://app.example', pathname: '/api/me' },
    expected: false,
  },
  {
    name: 'member image response',
    url: { origin: 'https://app.example', pathname: '/images/member-private/photo.jpg' },
    expected: false,
  },
  {
    name: 'unknown same-origin response',
    url: { origin: 'https://app.example', pathname: '/downloads/member-file.pdf' },
    expected: false,
  },
  {
    name: 'cross-origin public-looking asset',
    url: { origin: 'https://cdn.example', pathname: '/assets/index-abc123.js' },
    expected: false,
  },
]
for (const testCase of pwaPublicRuntimeRouteCases) {
  const actual = pwaContract.virtualChurchPublicRuntimeRequestMatches(
    { url: testCase.url },
    'https://app.example',
  )
  if (actual !== testCase.expected) {
    errors.push(
      `PWA public runtime route ${testCase.name}: expected ${testCase.expected}, received ${actual}`,
    )
  }
}

for (const fragment of [
  "navigateFallback: '/index.html'",
  'navigateFallbackDenylist:',
  '/^\\/api\\//',
  '/^\\/images\\//',
  '/^\\/assets\\//',
  '/^\\/virtual-church-assets\\//',
  'urlPattern: virtualChurchAssetRequestMatches',
  'urlPattern: virtualChurchAppShellRequestMatches',
  'urlPattern: virtualChurchPublicVideoRequestMatches',
  'urlPattern: virtualChurchPublicImageOrFontRequestMatches',
  'urlPattern: virtualChurchPublicRuntimeRequestMatches',
]) {
  requireSource(viteConfigSource, fragment, 'Vite PWA offline shell/privacy boundary')
}

requireSource(
  cacheMaintenanceSource,
  `'${cacheName}'`,
  'cache maintenance worker',
)
requireSource(
  cacheMaintenanceSource,
  "const VIRTUAL_CHURCH_LEGACY_CACHE = 'alife-virtual-church-assets'",
  'cache maintenance worker',
)
requireSource(
  cacheMaintenanceSource,
  'const VIRTUAL_CHURCH_CACHE_PREFIX = `${VIRTUAL_CHURCH_LEGACY_CACHE}-`',
  'cache maintenance worker',
)
requireSource(
  cacheMaintenanceSource,
  `'${codeCacheName}'`,
  'cache maintenance worker',
)
requireSource(
  cacheMaintenanceSource,
  "const VIRTUAL_CHURCH_CODE_LEGACY_CACHE = 'alife-virtual-church-code'",
  'cache maintenance worker',
)
requireSource(
  cacheMaintenanceSource,
  'const VIRTUAL_CHURCH_CODE_CACHE_PREFIX =',
  'cache maintenance worker',
)
requireSource(
  cacheMaintenanceSource,
  'cacheName === VIRTUAL_CHURCH_LEGACY_CACHE',
  'cache maintenance worker',
)
requireSource(
  cacheMaintenanceSource,
  'cacheName.startsWith(VIRTUAL_CHURCH_CACHE_PREFIX)',
  'cache maintenance worker',
)
requireSource(
  cacheMaintenanceSource,
  'cacheName !== CURRENT_VIRTUAL_CHURCH_CACHE',
  'cache maintenance worker',
)
requireSource(
  cacheMaintenanceSource,
  '.map((cacheName) => caches.delete(cacheName))',
  'cache maintenance worker',
)
for (const fragment of [
  'cache.match(request)',
  'cache.delete(request)',
  '/^text\\/html\\b/i.test',
  "const APP_SHELL_CACHE = 'alife-app-cache'",
  '/\\.js$/i.test(pathname)',
  '/\\.css$/i.test(pathname)',
]) {
  requireSource(cacheMaintenanceSource, fragment, 'cached HTML repair')
}

const simulatedCaches = [
  cacheName,
  codeCacheName,
  'alife-virtual-church-assets',
  'alife-virtual-church-assets-v2-production',
  'alife-virtual-church-assets-gate-a-rejected-r0',
  'alife-virtual-church-assets-gate-a-baseline-r1',
  'alife-virtual-church-assets-gate-a-baseline-r2',
  'alife-virtual-church-assets-gate-a-baseline-r3',
  'alife-virtual-church-assets-gate-a-baseline-r4',
  'alife-virtual-church-assets-gate-a-baseline-r5',
  'alife-virtual-church-assets-gate-a-baseline-r6',
  'alife-virtual-church-assets-gate-a-baseline-r7',
  'alife-virtual-church-assetsx-similar-name',
  'alife-virtual-church-code',
  'alife-virtual-church-code-v2-production',
  'alife-virtual-church-code-gate-a-rejected-r0',
  'alife-virtual-church-code-gate-a-baseline-r1',
  'alife-virtual-church-code-gate-a-baseline-r2',
  'alife-virtual-church-code-gate-a-baseline-r3',
  'alife-virtual-church-code-gate-a-baseline-r4',
  'alife-virtual-church-code-gate-a-baseline-r5',
  'alife-virtual-church-code-gate-a-baseline-r6',
  'alife-virtual-church-code-gate-a-baseline-r7',
  'alife-virtual-church-codex-similar-name',
  'alife-app-cache',
  'alife-video-cache',
]
const expectedDeletedCaches = [
  'alife-virtual-church-assets',
  'alife-virtual-church-assets-v2-production',
  'alife-virtual-church-assets-gate-a-rejected-r0',
  'alife-virtual-church-assets-gate-a-baseline-r1',
  'alife-virtual-church-assets-gate-a-baseline-r2',
  'alife-virtual-church-assets-gate-a-baseline-r3',
  'alife-virtual-church-assets-gate-a-baseline-r4',
  'alife-virtual-church-assets-gate-a-baseline-r5',
  'alife-virtual-church-assets-gate-a-baseline-r6',
  'alife-virtual-church-assets-gate-a-baseline-r7',
  'alife-virtual-church-code',
  'alife-virtual-church-code-v2-production',
  'alife-virtual-church-code-gate-a-rejected-r0',
  'alife-virtual-church-code-gate-a-baseline-r1',
  'alife-virtual-church-code-gate-a-baseline-r2',
  'alife-virtual-church-code-gate-a-baseline-r3',
  'alife-virtual-church-code-gate-a-baseline-r4',
  'alife-virtual-church-code-gate-a-baseline-r5',
  'alife-virtual-church-code-gate-a-baseline-r6',
  'alife-virtual-church-code-gate-a-baseline-r7',
].sort()
const deletedCaches = []
let activateListener = null
runInNewContext(cacheMaintenanceSource, {
  Promise,
  caches: {
    keys: async () => simulatedCaches,
    delete: async (name) => {
      deletedCaches.push(name)
      return true
    },
    open: async (name) => {
      if (name !== cacheName && name !== codeCacheName && name !== 'alife-app-cache') {
        throw new Error(`cache maintenance unexpectedly opened ${name}`)
      }
      return { keys: async () => [] }
    },
  },
  self: {
    addEventListener: (type, listener) => {
      if (type === 'activate') activateListener = listener
    },
  },
  URL,
})
if (activateListener === null) {
  errors.push('cache maintenance worker: activate listener was not registered')
} else {
  let activationWork = null
  activateListener({
    waitUntil: (work) => {
      activationWork = work
    },
  })
  if (activationWork === null) {
    errors.push('cache maintenance worker: activate cleanup was not passed to waitUntil')
  } else {
    await activationWork
  }
}
deletedCaches.sort()
if (JSON.stringify(deletedCaches) !== JSON.stringify(expectedDeletedCaches)) {
  errors.push(
    `cache maintenance worker: expected simulated deletion ${JSON.stringify(expectedDeletedCaches)}, received ${JSON.stringify(deletedCaches)}`,
  )
}
const preservedCaches = simulatedCaches
  .filter((name) => !deletedCaches.includes(name))
  .sort()

for (const [label, source] of [
  ['female Hero DCC validator', heroDccValidatorSource],
  ['female Hero review renderer', heroReviewRendererSource],
  ['church texture builder', textureBuilderSource],
  ['wardrobe validator', wardrobeValidatorSource],
  ['church baseline validator', churchValidatorSource],
]) {
  requireSource(source, release, label)
}
requireSource(
  heroDccValidatorSource,
  'character-hero-female-beauty-source.blend',
  'female Hero DCC validator',
)
requireSource(heroDccValidatorSource, 'vroid-fair-v1', 'female Hero DCC validator')
requireSource(heroExportSource, 'author_action("Walk"', 'VRoid Hero export pipeline')
requireSource(heroExportSource, 'export_image_format="WEBP"', 'VRoid Hero export pipeline')
requireSource(licenseSource, `v3/releases/${release}/characters/`, 'asset license inventory')

const expectedFiles = [
  'buildings/church-hero-low.glb',
  'buildings/church-hero-medium.glb',
  'buildings/church-hero.glb',
  'characters/character-hero-female-high.glb',
  'characters/character-hero-female-low.glb',
  'characters/character-hero-female-medium.glb',
  'characters/character-hero-female-picker.webp',
  'characters/character-hero-female.manifest.json',
  'textures/church-material-atlas-basecolor.png',
  'textures/church-material-atlas-normal.png',
  'textures/church-material-atlas-orm.png',
]

const listFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = resolve(directory, entry.name)
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath]
  }))
  return nested.flat()
}

let actualFiles = []
try {
  actualFiles = (await listFiles(releaseRoot))
    .map((file) => relative(releaseRoot, file).split(sep).join('/'))
    .sort()
} catch (error) {
  errors.push(`release directory is not readable: ${error.message}`)
}

if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
  errors.push(
    `release inventory mismatch: expected ${JSON.stringify(expectedFiles)}, received ${JSON.stringify(actualFiles)}`,
  )
}

// The photo-backed foyer preview has three additional runtime assets outside
// the immutable Gate A release. Keep this an exact inventory, not a wildcard.
const expectedV3TopLevelEntries = [
  'foyer-courtyard-reference-01.jpg',
  'foyer-courtyard-reference-04.jpg',
  'foyer-oak-basecolor-v2.webp',
  'releases',
]
const v3TopLevelEntries = (await readdir(v3Root, { withFileTypes: true }))
  .map((entry) => `${entry.name}:${entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other'}`)
  .sort()
const expectedTypedV3Entries = expectedV3TopLevelEntries.map((name) => `${name}:${name === 'releases' ? 'directory' : 'file'}`)
if (JSON.stringify(v3TopLevelEntries) !== JSON.stringify(expectedTypedV3Entries)) {
  errors.push(
    `v3 root inventory mismatch: ${JSON.stringify(v3TopLevelEntries)}`,
  )
}

// The second hero is an additive immutable release, not an edit to r9.
const maleReleaseRoot = resolve(v3Root, 'releases', 'male-hero-v14-r1')
const maleFiles = ['characters/character-hero-male-high.glb', 'characters/character-hero-male-low.glb',
  'characters/character-hero-male-medium.glb', 'characters/character-hero-male-picker.webp',
  'characters/character-hero-male.manifest.json']
const checkMaleRelease = async (root, label) => {
  const names = (await listFiles(root)).map(file => relative(root, file).split(sep).join('/')).sort()
  if (JSON.stringify(names) !== JSON.stringify(maleFiles)) errors.push(`${label}: male release inventory differs`)
  const manifest = JSON.parse(await readFile(resolve(root, maleFiles.at(-1)), 'utf8'))
  if (manifest.license?.cc0 !== false || manifest.deploymentApproved !== false || manifest.rig?.sharedWithFemale !== false) {
    errors.push(`${label}: male candidate lost provenance or remaining-gate boundaries`)
  }
  for (const asset of Object.values(manifest.assets ?? {})) {
    const path = resolve(root, 'characters', asset.path)
    if (!path.startsWith(`${resolve(root, 'characters')}${sep}`)) throw new Error('Male manifest asset escapes release')
    const bytes = await readFile(path)
    if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) errors.push(`${label}: male hash mismatch ${asset.path}`)
  }
}
await checkMaleRelease(maleReleaseRoot, 'public source')
if (validateDist) await checkMaleRelease(resolve(distRootOption?.slice('--dist-root='.length) ?? resolve(appRoot, 'dist'),
  'virtual-church-assets/v3/releases/male-hero-v14-r1'), 'built artifact')
for (const file of expectedV3TopLevelEntries.filter((name) => name !== 'releases')) {
  requireSource(licenseSource, `v3/${file}`, 'foyer preview asset license inventory')
}

const selectedV3Paths = [
  ...serviceSource.matchAll(
    /selectedAssetUrl\(\s*'[^']+'\s*,\s*visualVersion,\s*'([^']+)'\s*,?\s*\)/g,
  ),
].map((match) => match[1])

if (selectedV3Paths.length !== 6) {
  errors.push(`runtime service must select exactly six Gate A v3 GLBs, received ${selectedV3Paths.length}`)
}

for (const selectedPath of selectedV3Paths) {
  const resolvedPath = resolve(releaseRoot, `.${selectedPath}`)
  try {
    await access(resolvedPath)
  } catch {
    errors.push(`runtime-selected release asset does not exist: ${selectedPath}`)
  }
}

// Execute the generated registration against inert Workbox constructors. This
// exercises the actual serialized callbacks without depending on minifier names,
// argument grouping or a browser/network/cache implementation.
const inspectBuiltCacheGuards = async (source) => {
  const importedScripts = [], routes = []
  const workbox = {
    clientsClaim() {}, precacheAndRoute() {}, cleanupOutdatedCaches() {},
    createHandlerBoundToURL: url => url,
    registerRoute: (match, strategy) => routes.push({ match, strategy }),
  }
  for (const kind of ['CacheFirst', 'NetworkFirst', 'NetworkOnly', 'StaleWhileRevalidate',
    'ExpirationPlugin', 'CacheableResponsePlugin', 'RangeRequestsPlugin', 'BackgroundSyncPlugin', 'NavigationRoute']) {
    workbox[kind] = function (options) { this.kind = kind; this.options = options }
  }
  const define = (dependencies, factory) => {
    if (dependencies.length !== 1 || !/^\.\/workbox-/.test(dependencies[0])) {
      throw new Error('Unexpected built Service Worker dependency')
    }
    factory(workbox)
  }
  const origin = 'https://fixture.invalid'
  runInNewContext(source, {
    define, URL,
    self: { define, skipWaiting() {}, location: { origin } },
    importScripts: (...scripts) => importedScripts.push(...scripts),
  }, { timeout: 5000 })
  for (const script of configuredScripts) {
    if (!importedScripts.includes(script)) errors.push(`built Service Worker does not import ${script}`)
  }
  const cache = (name, kind) => {
    const matches = routes.filter(route => route.strategy?.options?.cacheName === name)
    if (matches.length !== 1 || matches[0].strategy.kind !== kind) throw new Error(`Expected one ${kind} route for ${name}`)
    return matches[0].strategy.options
  }
  const code = cache(codeCacheName, 'CacheFirst')
  const assets = cache(cacheName, 'CacheFirst')
  const application = cache(configuredAppCaches[0], 'NetworkFirst')
  for (const options of [code, assets]) {
    const statuses = options.plugins.find(plugin => plugin.kind === 'CacheableResponsePlugin')?.options?.statuses
    if (!statuses || statuses.length !== 1 || statuses[0] !== 200) errors.push(`built ${options.cacheName} must cache only successful responses`)
  }
  const verifyResponse = async (options, pathname, destination, mime, expected, status = 200) => {
    const guards = options.plugins.filter(plugin => typeof plugin.cacheWillUpdate === 'function')
    if (!guards.length) throw new Error(`Missing MIME guard on ${options.cacheName}`)
    const request = { url: `${origin}${pathname}`, destination, mode: destination === 'document' ? 'navigate' : 'cors' }
    const response = { status, headers: { get: name => name.toLowerCase() === 'content-type' ? mime : null } }
    let candidate = response
    for (const guard of guards) {
      candidate = await guard.cacheWillUpdate({ request, response: candidate })
      if (!candidate) break
    }
    if ((candidate === response) !== expected) errors.push(`built ${options.cacheName} MIME/status guard failed: ${pathname}, ${mime}, ${status}`)
  }
  for (const mime of ['text/javascript', 'application/javascript', 'application/ecmascript', 'text/html', 'text/css', '']) {
    await verifyResponse(code, '/assets/VirtualChurchView-fixture.js', 'script', mime, /javascript|ecmascript/.test(mime))
  }
  await verifyResponse(assets, '/virtual-church-assets/fixture.glb', '', 'model/gltf-binary', true)
  await verifyResponse(assets, '/virtual-church-assets/fixture.glb', '', 'text/html; charset=utf-8', false)
  for (const [path, destination, mime] of [['/assets/index.js', 'script', 'application/javascript'],
    ['/assets/index.css', 'style', 'text/css'], ['/', 'document', 'text/html']]) {
    await verifyResponse(application, path, destination, mime, true)
    await verifyResponse(application, path, destination, 'application/octet-stream', false)
    await verifyResponse(application, path, destination, mime, false, 404)
    if (destination !== 'document') await verifyResponse(application, path, destination, 'text/html', false)
  }
  for (const path of ['/api/me', '/api/private-file.js', '/images/api/private-file.png', '/images/groups/g/albums/a/photo.jpg']) {
    const url = new URL(path, origin)
    const route = routes.find(({ match }) => typeof match === 'function'
      && match({ url, request: { url: url.href, destination: 'script', mode: 'cors' } }))
    if (route?.strategy?.kind !== 'NetworkOnly') errors.push(`built Service Worker can cache protected response: ${path}`)
  }
}

let distEvidence = null
if (validateDist) {
  const distRoot = resolve(distRootOption?.slice('--dist-root='.length) ?? resolve(appRoot, 'dist'))
  const distReleaseRoot = resolve(
    distRoot,
    'virtual-church-assets',
    'v3',
    'releases',
    release,
  )
  const distV3Root = resolve(distRoot, 'virtual-church-assets', 'v3')
  const distMaintenancePath = resolve(distRoot, 'virtual-church-cache-maintenance.js')
  const distSwPath = resolve(distRoot, 'sw.js')
  const distAssetsRoot = resolve(distRoot, 'assets')

  try {
    const [distSwSource, distMaintenanceSource, distFiles, distV3Entries, distAssetEntries] =
      await Promise.all([
        readFile(distSwPath, 'utf8'),
        readFile(distMaintenancePath, 'utf8'),
        listFiles(distReleaseRoot),
        readdir(distV3Root, { withFileTypes: true }),
        readdir(distAssetsRoot, { withFileTypes: true }),
      ])

    const normalizedDistFiles = distFiles
      .map((file) => relative(distReleaseRoot, file).split(sep).join('/'))
      .sort()
    if (JSON.stringify(normalizedDistFiles) !== JSON.stringify(expectedFiles)) {
      errors.push(
        `built release inventory mismatch: expected ${JSON.stringify(expectedFiles)}, received ${JSON.stringify(normalizedDistFiles)}`,
      )
    }
    for (const file of expectedFiles) {
      const [publicBuffer, distBuffer] = await Promise.all([
        readFile(resolve(releaseRoot, file)),
        readFile(resolve(distReleaseRoot, file)),
      ])
      if (sha256(publicBuffer) !== sha256(distBuffer)) {
        errors.push(`built release file differs from public source: ${file}`)
      }
    }

    const normalizedDistV3Entries = distV3Entries
      .map((entry) => `${entry.name}:${entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other'}`)
      .sort()
    if (JSON.stringify(normalizedDistV3Entries) !== JSON.stringify(expectedTypedV3Entries)) {
      errors.push(
        `built v3 root inventory mismatch: ${JSON.stringify(normalizedDistV3Entries)}`,
      )
    }
    await inspectBuiltCacheGuards(distSwSource)
    if (!distSwSource.includes('createHandlerBoundToURL("/index.html")')) {
      errors.push('built Service Worker does not provide the precached SPA navigation fallback')
    }
    if (
      !distSwSource.includes('NavigationRoute')
      || !distSwSource.includes('/^\\/api\\//')
      || !distSwSource.includes('/^\\/virtual-church-assets\\//')
    ) {
      errors.push('built Service Worker does not preserve the offline fallback denylist')
    }
    if (!distSwSource.includes('url:"index.html"')) {
      errors.push('built Service Worker does not precache index.html for offline navigation')
    }
    for (const publicPath of ['/assets/', '/icons/', '/media/']) {
      if (!distSwSource.includes(`pathname.startsWith("${publicPath}")`)) {
        errors.push(`built Service Worker lost public-static allowlist prefix ${publicPath}`)
      }
    }
    if (distSwSource.includes('=>virtualChurchCodeChunkMatches(')) {
      errors.push('built Service Worker contains a dangling virtualChurchCodeChunkMatches reference')
    }
    if (
      !distSwSource.includes('[Vv]irtualChurch')
      || !distSwSource.includes('vendor-(?:3d|postprocessing)')
      || !distSwSource.includes('/\\/assets\\/')
      || !distSwSource.includes('self.location.origin')
    ) {
      errors.push('built Service Worker does not inline the 3D code chunk matcher')
    }
    if (distMaintenanceSource !== cacheMaintenanceSource) {
      errors.push('built cache maintenance script differs from the public source')
    }

    const churchBundles = distAssetEntries
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.startsWith('VirtualChurchView-') &&
          entry.name.endsWith('.js'),
      )
      .map((entry) => entry.name)
    let releaseBundle = null
    if (churchBundles.length !== 1) {
      errors.push(
        `production build must contain exactly one VirtualChurchView bundle, received ${churchBundles.length}`,
      )
    } else {
      const churchBundleSource = await readFile(
        resolve(distAssetsRoot, churchBundles[0]),
        'utf8',
      )
      // Vite may put the release URL constant in a statically imported shared
      // module instead of the view chunk. Only accept a chunk referenced by
      // this view; an unrelated stale file in dist must not satisfy the check.
      const releaseCandidates = distAssetEntries.filter((entry) =>
        entry.isFile()
        && entry.name.endsWith('.js')
        && (entry.name === churchBundles[0]
          || churchBundleSource.includes(`./${entry.name}`)),
      )
      for (const entry of releaseCandidates) {
        const source = entry.name === churchBundles[0]
          ? churchBundleSource
          : await readFile(resolve(distAssetsRoot, entry.name), 'utf8')
        if (source.includes(release) && source.includes('/v3/releases/')) {
          releaseBundle = entry.name
          break
        }
      }
      if (!releaseBundle) {
        errors.push('production VirtualChurchView and its referenced chunks do not contain the current release prefix')
      }
    }

    distEvidence = {
      serviceWorkerImportsMaintenance: true,
      serviceWorkerCacheName: cacheName,
      serviceWorkerCodeCacheName: codeCacheName,
      releaseFiles: normalizedDistFiles.length,
      releaseBytesIdenticalToPublic: true,
      v3TopLevelInventoryControlled: true,
      virtualChurchBundles: churchBundles,
      releaseBundle,
      offlineRepeatSimulation: {
        precachedPublicShell: 'index.html',
        navigationFallback: '/index.html',
        protectedApiCached: false,
        applicationCacheRouteCases: pwaAppShellRouteCases.length,
        assetCacheRouteCases: pwaAssetRouteCases.length,
        publicMediaRouteCases: pwaPublicMediaRouteCases.length,
        publicRuntimeRouteCases: pwaPublicRuntimeRouteCases.length,
      },
    }
  } catch (error) {
    errors.push(`production dist validation failed: ${error.message}`)
  }
}

if (errors.length > 0) {
  throw new Error(`Virtual Church asset release/cache validation failed:\n- ${errors.join('\n- ')}`)
}

console.log(JSON.stringify({
  release,
  releasePrefix,
  runtimeCache: {
    current: cacheName,
    code: codeCacheName,
    strategy: 'CacheFirst',
    legacyCacheCleanup: true,
    scope: 'same-origin public 3D assets and immutable hashed 3D code only',
    codeRouteCases: pwaRouteCases.map(({ name, expected }) => ({
      name,
      expected,
    })),
    assetRouteCases: pwaAssetRouteCases.map(({ name, expected }) => ({
      name,
      expected,
    })),
    applicationShellRouteCases: pwaAppShellRouteCases.map(({ name, expected }) => ({
      name,
      expected,
    })),
    publicMediaRouteCases: pwaPublicMediaRouteCases.map(({ name, expected }) => ({
      name,
      expected,
    })),
    publicRuntimeRouteCases: pwaPublicRuntimeRouteCases.map(({ name, expected }) => ({
      name,
      expected,
    })),
    simulatedUpgrade: {
      deleted: deletedCaches,
      preserved: preservedCaches,
    },
  },
  releaseInventory: actualFiles,
  selectedV3Glbs: selectedV3Paths,
  v3TopLevelInventoryControlled: true,
  productionDist: distEvidence,
  passed: true,
}, null, 2))
