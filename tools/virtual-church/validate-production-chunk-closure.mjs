import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..', '..')
const APP_ROOT = resolve(REPOSITORY_ROOT, 'cloudflare', 'alife-app')
const distRootOption = process.argv.find((argument) => argument.startsWith('--dist-root='))
const DIST_ROOT = resolve(distRootOption?.slice('--dist-root='.length) ?? resolve(APP_ROOT, 'dist'))
const DIST_ASSETS_ROOT = resolve(DIST_ROOT, 'assets')
const INDEX_PATH = resolve(DIST_ROOT, 'index.html')
const SERVICE_WORKER_PATH = resolve(DIST_ROOT, 'sw.js')
const AZURE_CONFIG_PATH = resolve(APP_ROOT, 'staticwebapp.config.json')
const CLOUDFLARE_CONFIG_PATH = resolve(
  REPOSITORY_ROOT,
  'cloudflare',
  'speed-layer',
  'wrangler.jsonc',
)
const CLOUDFLARE_WORKER_PATH = resolve(
  REPOSITORY_ROOT,
  'cloudflare',
  'speed-layer',
  'src',
  'index.ts',
)
const ROUTE_BOUNDARY_PATH = resolve(
  APP_ROOT,
  'src',
  'app',
  'routing',
  'VirtualChurchRouteBoundary.tsx',
)
const ROUTE_RECOVERY_CONTRACT_PATH = resolve(
  APP_ROOT, 'src', 'app', 'routing', 'virtualChurchRouteRecoveryContract.ts',
)

const normalizedRelativePath = (path) =>
  relative(DIST_ROOT, path).split(sep).join('/')

const resolveDistUrl = (url, sourcePath = INDEX_PATH) => {
  const cleanUrl = url.split(/[?#]/u, 1)[0]
  if (cleanUrl.startsWith('/')) {
    return resolve(DIST_ROOT, cleanUrl.slice(1))
  }
  return resolve(dirname(sourcePath), cleanUrl)
}

const assertInsideDist = (path, label) => {
  const relativePath = relative(DIST_ROOT, path)
  assert.ok(
    relativePath !== '..'
      && !relativePath.startsWith(`..${sep}`)
      && !relativePath.startsWith('/'),
    `${label} resolves outside dist: ${path}`,
  )
}

const readExistingFile = async (path, label) => {
  assertInsideDist(path, label)
  const details = await stat(path)
  assert.ok(details.isFile(), `${label} is not a file: ${path}`)
  return readFile(path)
}

const extractIndexAssetUrls = (html) =>
  [...html.matchAll(/\b(?:src|href)="([^"]+)"/gu)]
    .map((match) => match[1])
    .filter((url) => url.startsWith('/assets/'))

const extractStaticModuleSpecifiers = (source) => {
  const specifiers = new Set()
  const patterns = [
    /\bfrom\s*["']([^"']+)["']/gu,
    /\bimport\s*["']([^"']+)["']/gu,
    /\bexport\s+[^"']*?\sfrom\s*["']([^"']+)["']/gu,
  ]
  patterns.forEach((pattern) => {
    for (const match of source.matchAll(pattern)) {
      specifiers.add(match[1])
    }
  })
  return [...specifiers]
}

const extractDynamicModuleSpecifiers = (source) =>
  [...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu)]
    .map((match) => match[1])

const collectStaticJsClosure = (roots, staticGraph) => {
  const closure = new Set()
  const pending = [...roots]
  while (pending.length > 0) {
    const current = pending.shift()
    if (closure.has(current)) continue
    closure.add(current)
    pending.push(...(staticGraph.get(current) ?? []).filter((edge) => edge.endsWith('.js')))
  }
  return closure
}

assert.deepEqual(
  extractStaticModuleSpecifiers('import "./base.js"; import { scene } from "./scene.js"; import("./later.js")').sort(),
  ['./base.js', './scene.js'],
  'static import parsing must not mistake a lazy route for initial code',
)
assert.deepEqual(
  extractDynamicModuleSpecifiers('import "./base.js"; import("./later.js")'),
  ['./later.js'],
  'dynamic import parsing must find lazy route code',
)
assert.ok(
  collectStaticJsClosure(['entry.js'], new Map([
    ['entry.js', ['base.js', 'route.js']],
    ['base.js', ['vendor.js']],
  ])).has('route.js'),
  'a route made statically reachable must fail the initial-code boundary',
)

const indexHtml = await readFile(INDEX_PATH, 'utf8')
const serviceWorkerSource = await readFile(SERVICE_WORKER_PATH, 'utf8')
const azureConfig = JSON.parse(await readFile(AZURE_CONFIG_PATH, 'utf8'))
const cloudflareConfig = JSON.parse(await readFile(CLOUDFLARE_CONFIG_PATH, 'utf8'))
const cloudflareWorkerSource = await readFile(CLOUDFLARE_WORKER_PATH, 'utf8')
const routeBoundarySource = await readFile(ROUTE_BOUNDARY_PATH, 'utf8')
const routeRecoveryContractSource = await readFile(ROUTE_RECOVERY_CONTRACT_PATH, 'utf8')
const indexAssetUrls = extractIndexAssetUrls(indexHtml)
assert.ok(indexAssetUrls.length >= 2, 'index.html must reference built JS/CSS assets')

const indexAssets = []
for (const url of indexAssetUrls) {
  const path = resolveDistUrl(url)
  const contents = await readExistingFile(path, `index asset ${url}`)
  assert.ok(contents.length > 0, `index asset is empty: ${url}`)
  indexAssets.push(normalizedRelativePath(path))
}

const entryCandidates = indexAssetUrls.filter((url) =>
  /^\/assets\/index-[^/]+\.js$/u.test(url))
assert.equal(
  entryCandidates.length,
  1,
  `index.html must reference exactly one hashed JS entry; received ${entryCandidates.length}`,
)
const entryPath = resolveDistUrl(entryCandidates[0])

const assetEntries = await readdir(DIST_ASSETS_ROOT, { withFileTypes: true })
const routeBundles = assetEntries
  .filter((entry) =>
    entry.isFile()
      && /^VirtualChurchView-[^/]+\.js$/u.test(entry.name))
  .map((entry) => resolve(DIST_ASSETS_ROOT, entry.name))
const vendorBundles = assetEntries
  .filter((entry) =>
    entry.isFile()
      && /^vendor-3d-[^/]+\.js$/u.test(entry.name))
  .map((entry) => resolve(DIST_ASSETS_ROOT, entry.name))
const surroundingFacadeBundles = assetEntries
  .filter((entry) =>
    entry.isFile()
      && /^VirtualChurchSurroundingFacades-[^/]+\.js$/u.test(entry.name))
  .map((entry) => resolve(DIST_ASSETS_ROOT, entry.name))
const postProcessingBundles = assetEntries
  .filter((entry) =>
    entry.isFile()
      && /^VirtualChurchPostProcessing-[^/]+\.js$/u.test(entry.name))
  .map((entry) => resolve(DIST_ASSETS_ROOT, entry.name))
const postProcessingVendorBundles = assetEntries
  .filter((entry) =>
    entry.isFile()
      && /^vendor-postprocessing-[^/]+\.js$/u.test(entry.name))
  .map((entry) => resolve(DIST_ASSETS_ROOT, entry.name))
const churchCodeChunks = assetEntries
  .filter((entry) => entry.isFile()
    && /^(?:[Vv]irtualChurch[^/]*|vendor-(?:3d|postprocessing))-[^/]+\.js$/u.test(entry.name))
  .map((entry) => normalizedRelativePath(resolve(DIST_ASSETS_ROOT, entry.name)))
const churchStyleChunks = assetEntries
  .filter((entry) => entry.isFile() && /^[Vv]irtualChurch[^/]*-[^/]+\.css$/u.test(entry.name))
  .map((entry) => normalizedRelativePath(resolve(DIST_ASSETS_ROOT, entry.name)))
assert.equal(routeBundles.length, 1, 'dist must contain exactly one VirtualChurchView bundle')
assert.equal(vendorBundles.length, 1, 'dist must contain exactly one vendor-3d bundle')
assert.equal(
  surroundingFacadeBundles.length,
  1,
  'dist must contain exactly one deferred surrounding-facade bundle',
)
assert.equal(postProcessingBundles.length, 1, 'dist must contain exactly one deferred post-processing component')
assert.equal(postProcessingVendorBundles.length, 1, 'dist must contain exactly one deferred post-processing vendor bundle')

const graph = new Map()
const staticGraph = new Map()
const dynamicGraph = new Map()
const queue = [entryPath]
const visited = new Set()
while (queue.length > 0) {
  const currentPath = queue.shift()
  const currentRelativePath = normalizedRelativePath(currentPath)
  if (visited.has(currentRelativePath)) continue
  visited.add(currentRelativePath)

  const sourceBuffer = await readExistingFile(
    currentPath,
    `module graph node ${currentRelativePath}`,
  )
  const source = sourceBuffer.toString('utf8')
  assert.ok(
    !source.trimStart().startsWith('<'),
    `JavaScript module contains HTML fallback content: ${currentRelativePath}`,
  )
  const staticSpecifiers = extractStaticModuleSpecifiers(source)
  const dynamicSpecifiers = extractDynamicModuleSpecifiers(source)
  const edges = []
  const staticEdges = []
  const dynamicEdges = []
  for (const [specifiers, selectedEdges] of [
    [staticSpecifiers, staticEdges],
    [dynamicSpecifiers, dynamicEdges],
  ]) {
    for (const specifier of specifiers) {
      if (!specifier.startsWith('.') && !specifier.startsWith('/')) continue
      const dependencyPath = resolveDistUrl(specifier, currentPath)
      const dependencyRelativePath = normalizedRelativePath(dependencyPath)
      await readExistingFile(
        dependencyPath,
        `${currentRelativePath} dependency ${specifier}`,
      )
      edges.push(dependencyRelativePath)
      selectedEdges.push(dependencyRelativePath)
      if (dependencyPath.endsWith('.js')) queue.push(dependencyPath)
    }
  }
  graph.set(currentRelativePath, edges.sort())
  staticGraph.set(currentRelativePath, staticEdges.sort())
  dynamicGraph.set(currentRelativePath, dynamicEdges.sort())
}

const entryRelativePath = normalizedRelativePath(entryPath)
const routeRelativePath = normalizedRelativePath(routeBundles[0])
const vendorRelativePath = normalizedRelativePath(vendorBundles[0])
const surroundingFacadeRelativePath = normalizedRelativePath(surroundingFacadeBundles[0])
const postProcessingRelativePath = normalizedRelativePath(postProcessingBundles[0])
const postProcessingVendorRelativePath = normalizedRelativePath(postProcessingVendorBundles[0])
assert.ok(
  visited.has(routeRelativePath),
  `${routeRelativePath} is not reachable from ${entryRelativePath}`,
)
assert.ok(
  visited.has(vendorRelativePath),
  `${vendorRelativePath} is not reachable from ${entryRelativePath}`,
)
assert.ok(
  dynamicGraph.get(entryRelativePath)?.includes(routeRelativePath),
  'the application entry must dynamically import the Virtual Church route bundle',
)
assert.ok(
  graph.get(routeRelativePath)?.includes(vendorRelativePath),
  'the Virtual Church route bundle must import the shared 3D vendor bundle',
)
assert.ok(
  dynamicGraph.get(routeRelativePath)?.includes(surroundingFacadeRelativePath),
  'the Virtual Church route bundle must defer the surrounding-facade bundle',
)
assert.ok(
  dynamicGraph.get(routeRelativePath)?.includes(postProcessingRelativePath),
  'the Virtual Church route bundle must defer the post-processing component',
)
assert.ok(
  graph.get(postProcessingRelativePath)?.includes(postProcessingVendorRelativePath),
  'the deferred post-processing component must import its isolated vendor bundle',
)

// A homepage link may point at the 3D route, but opening the homepage must
// not pull any 3D code through the entry or its modulepreload/static imports.
const initialJsModules = indexAssets.filter((asset) => asset.endsWith('.js'))
const initialStaticModules = collectStaticJsClosure(initialJsModules, staticGraph)
for (const deferredModule of churchCodeChunks) {
  assert.ok(
    !initialStaticModules.has(deferredModule),
    `${deferredModule} must not be in the homepage's initial static module closure`,
  )
}

for (const chunk of churchCodeChunks) {
  assert.ok(
    !serviceWorkerSource.includes(`url:"${chunk}"`),
    `${chunk} must remain outside the Service Worker precache`,
  )
}
for (const style of churchStyleChunks) {
  assert.ok(!indexAssets.includes(style), `${style} must not be linked by the homepage`)
  assert.ok(
    !serviceWorkerSource.includes(`url:"${style}"`),
    `${style} must remain outside the Service Worker precache`,
  )
}
assert.ok(
  serviceWorkerSource.includes('[Vv]irtualChurch')
    && serviceWorkerSource.includes('vendor-(?:3d|postprocessing)'),
  'built Service Worker must recognize every on-demand 3D code chunk',
)

const azureFallbackExclusions =
  azureConfig.navigationFallback?.exclude ?? []
assert.ok(
  azureFallbackExclusions.includes('/assets/*'),
  'Azure navigation fallback must exclude /assets/* so missing JS returns 404',
)
assert.ok(
  azureFallbackExclusions.includes('/virtual-church-assets/*'),
  'Azure navigation fallback must exclude /virtual-church-assets/*',
)
assert.equal(azureConfig.mimeTypes?.['.js'], 'application/javascript')
assert.equal(azureConfig.mimeTypes?.['.mjs'], 'application/javascript')

const cloudflareWorkerFirst = cloudflareConfig.assets?.run_worker_first ?? []
assert.equal(
  cloudflareConfig.assets?.binding,
  'ASSETS',
  'Cloudflare static assets must expose the ASSETS binding',
)
assert.ok(
  cloudflareWorkerFirst.includes('/assets/*'),
  'Cloudflare Worker must inspect /assets/* before SPA fallback',
)
assert.ok(
  cloudflareWorkerFirst.includes('/virtual-church-assets/*'),
  'Cloudflare Worker must inspect /virtual-church-assets/* before SPA fallback',
)
for (const sourceFragment of [
  "app.all('/assets/*'",
  "app.all('/virtual-church-assets/*'",
  "if (path.endsWith('.glb')) return mime === 'model/gltf-binary'",
  "if (path.endsWith('.js')) return mime === 'text/javascript' || mime === 'application/javascript'",
  "if (path.endsWith('.css')) return mime === 'text/css'",
  "return mime !== 'text/html'",
  'response.status === 200 && !staticAssetContentTypeMatchesPath(',
  "status: 404",
  "'cache-control': 'no-store'",
  "'x-content-type-options': 'nosniff'",
]) {
  assert.ok(
    cloudflareWorkerSource.includes(sourceFragment),
    `Cloudflare static-asset guard is missing: ${sourceFragment}`,
  )
}

for (const errorFragment of [
  'ChunkLoadError',
  'Failed to fetch dynamically imported module',
  'Importing a module script failed',
  'error loading dynamically imported module',
]) {
  assert.ok(
    routeRecoveryContractSource.includes(errorFragment),
    `route recovery contract is missing dynamic-import classifier: ${errorFragment}`,
  )
}
assert.ok(routeBoundarySource.includes('virtualChurchChunkLoadFailed(error)'),
  'route recovery boundary must call the shared dynamic-import classifier')

const report = {
  indexAssets,
  moduleGraph: {
    entry: entryRelativePath,
    virtualChurchRoute: routeRelativePath,
    vendor3d: vendorRelativePath,
    deferredSurroundingFacades: surroundingFacadeRelativePath,
    deferredPostProcessing: postProcessingRelativePath,
    deferredPostProcessingVendor: postProcessingVendorRelativePath,
    reachableJsModuleCount: visited.size,
    checkedEdges: [...graph.values()]
      .reduce((sum, edges) => sum + edges.length, 0),
    initialStaticJsModules: initialStaticModules.size,
    onDemandChurchCodeChunks: churchCodeChunks.length,
    staticImportBoundaryContractCases: 3,
    virtualChurchRouteDynamicallyImported: true,
    initialStaticClosureExcludes3dCode: true,
    everyReferencedModuleExists: true,
    htmlFallbackDetectedInJs: false,
  },
  pwa: {
    virtualChurchCodeRemainsOnDemand: true,
    virtualChurchStylesRemainOnDemand: true,
    onDemandChurchStyleChunks: churchStyleChunks.length,
    runtimeMatcherPresent: true,
  },
  azureFallback: {
    assetPathsExcluded: true,
    virtualChurchAssetPathsExcluded: true,
    javascriptMimeTypesExplicit: true,
  },
  cloudflareFallback: {
    assetPathsRunWorkerFirst: true,
    virtualChurchAssetPathsRunWorkerFirst: true,
    htmlFallbackRejectedWith404: true,
  },
  recoveryBoundaryClassifiesDynamicImportFailures: true,
  passed: true,
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
