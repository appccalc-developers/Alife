import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, extname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from '../../cloudflare/alife-app/node_modules/typescript/lib/typescript.js'
import { productionHeroMappings } from './gate-a-character-delivery.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const appRoot = resolve(repoRoot, 'cloudflare', 'alife-app')
const publicRoot = resolve(appRoot, 'public')
const assetRoot = resolve(publicRoot, 'virtual-church-assets')
const servicePath = resolve(appRoot, 'src', 'services', 'virtualChurchService.ts')
const viewPath = resolve(appRoot, 'src', 'views', 'VirtualChurchView.tsx')

const [serviceSource, viewSource] = await Promise.all([
  readFile(servicePath, 'utf8'),
  readFile(viewPath, 'utf8'),
])
const serviceFile = ts.createSourceFile(
  servicePath,
  serviceSource,
  ts.ScriptTarget.ESNext,
  true,
  ts.ScriptKind.TS,
)
const viewFile = ts.createSourceFile(
  viewPath,
  viewSource,
  ts.ScriptTarget.ESNext,
  true,
  ts.ScriptKind.TSX,
)

const errors = []
const runtimeRootUrls = new Set()
// Evaluate the production mapping as well as the AST's legacy URL calls, so a
// separately versioned hero release cannot be silently omitted from closure.
for (const url of Object.values(productionHeroMappings(serviceSource))) runtimeRootUrls.add(url)
let releaseId = null

const stringArgument = (node) =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null

const visitService = (node) => {
  if (
    ts.isVariableDeclaration(node)
    && ts.isIdentifier(node.name)
    && node.name.text === 'V3_ASSET_RELEASE'
  ) {
    releaseId = stringArgument(node.initializer)
  }

  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
    if (node.expression.text === 'selectedAssetUrl') {
      const v2Path = stringArgument(node.arguments[0])
      const v3Path = stringArgument(node.arguments[2])
      if (v2Path) runtimeRootUrls.add(`/virtual-church-assets${v2Path}`)
      if (v3Path && releaseId) {
        runtimeRootUrls.add(
          `/virtual-church-assets/v3/releases/${releaseId}${v3Path}`,
        )
      }
    }

    if (node.expression.text === 'assetUrl') {
      const path = stringArgument(node.arguments[0])
      const version = stringArgument(node.arguments[1])
      if (path && version === 'v2') {
        runtimeRootUrls.add(`/virtual-church-assets${path}`)
      }
      if (path && version === 'v3' && releaseId) {
        runtimeRootUrls.add(
          `/virtual-church-assets/v3/releases/${releaseId}${path}`,
        )
      }
    }
  }

  ts.forEachChild(node, visitService)
}
visitService(serviceFile)

const visitView = (node) => {
  if (
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    && node.text.startsWith('/virtual-church-assets/')
    && !node.text.endsWith('.missing')
  ) {
    runtimeRootUrls.add(node.text)
  }
  ts.forEachChild(node, visitView)
}
visitView(viewFile)

if (!releaseId) {
  errors.push('V3_ASSET_RELEASE must be a static string literal')
}

if (/\.map\.needsUpdate\s*=\s*true/u.test(viewSource)) {
  errors.push(
    'GLTF textures must not be forced to upload before their image data is ready',
  )
}

if (runtimeRootUrls.has('/virtual-church-assets/draco/')) {
  runtimeRootUrls.delete('/virtual-church-assets/draco/')
  for (const file of [
    'draco_decoder.js',
    'draco_decoder.wasm',
    'draco_wasm_wrapper.js',
  ]) {
    runtimeRootUrls.add(`/virtual-church-assets/draco/${file}`)
  }
}

const publicPathFromUrl = (url) => {
  const decodedPath = decodeURIComponent(new URL(url, 'https://alife.invalid').pathname)
  const path = resolve(publicRoot, `.${decodedPath}`)
  const relativePath = relative(publicRoot, path)
  if (
    relativePath === '..'
    || relativePath.startsWith(`..${sep}`)
    || resolve(path) === publicRoot
  ) {
    errors.push(`runtime asset escapes public root: ${url}`)
    return null
  }
  return path
}

const runtimeFiles = new Set()
const queuedFiles = []
const queueFile = (path) => {
  if (!path || runtimeFiles.has(path)) return
  runtimeFiles.add(path)
  queuedFiles.push(path)
}
for (const url of runtimeRootUrls) queueFile(publicPathFromUrl(url))

const dependencyUris = (gltf) => [
  ...(gltf.buffers ?? []),
  ...(gltf.images ?? []),
].map((item) => item?.uri)
  .filter((uri) => typeof uri === 'string' && !uri.startsWith('data:'))

const parseGltfJson = (raw, label) => {
  let gltf
  try {
    gltf = JSON.parse(raw)
  } catch (error) {
    errors.push(`${label}: invalid JSON (${error instanceof Error ? error.message : error})`)
    return null
  }
  if (typeof gltf?.asset?.version !== 'string' || !gltf.asset.version.startsWith('2')) {
    errors.push(`${label}: expected glTF 2.x asset metadata`)
  }
  return gltf
}

const parseGlb = (buffer, label) => {
  if (buffer.length < 20) {
    errors.push(`${label}: GLB is shorter than its header and JSON chunk`)
    return null
  }
  if (buffer.readUInt32LE(0) !== 0x46546c67) {
    errors.push(`${label}: invalid GLB magic`)
    return null
  }
  if (buffer.readUInt32LE(4) !== 2) {
    errors.push(`${label}: expected GLB version 2`)
  }
  if (buffer.readUInt32LE(8) !== buffer.length) {
    errors.push(
      `${label}: declared GLB length ${buffer.readUInt32LE(8)} does not match ${buffer.length}`,
    )
  }
  const jsonLength = buffer.readUInt32LE(12)
  if (
    buffer.readUInt32LE(16) !== 0x4e4f534a
    || 20 + jsonLength > buffer.length
  ) {
    errors.push(`${label}: invalid GLB JSON chunk`)
    return null
  }
  return parseGltfJson(
    buffer
      .subarray(20, 20 + jsonLength)
      .toString('utf8')
      .replace(/[\0 ]+$/u, ''),
    label,
  )
}

for (let index = 0; index < queuedFiles.length; index += 1) {
  const path = queuedFiles[index]
  const label = relative(publicRoot, path).replaceAll('\\', '/')
  let fileStat
  try {
    fileStat = await stat(path)
  } catch {
    errors.push(`${label}: referenced runtime asset is missing`)
    continue
  }
  if (!fileStat.isFile() || fileStat.size <= 0) {
    errors.push(`${label}: runtime asset must be a non-empty file`)
    continue
  }

  const extension = extname(path).toLowerCase()
  let gltf = null
  if (extension === '.gltf') {
    gltf = parseGltfJson(await readFile(path, 'utf8'), label)
  } else if (extension === '.glb') {
    gltf = parseGlb(await readFile(path), label)
  }
  if (!gltf) continue

  for (const uri of dependencyUris(gltf)) {
    if (/^[a-z][a-z0-9+.-]*:/iu.test(uri) || uri.startsWith('//')) {
      errors.push(`${label}: external dependency must be same-origin (${uri})`)
      continue
    }
    const dependencyPath = resolve(dirname(path), decodeURIComponent(uri))
    const relativeDependency = relative(assetRoot, dependencyPath)
    if (
      relativeDependency === '..'
      || relativeDependency.startsWith(`..${sep}`)
    ) {
      errors.push(`${label}: dependency escapes asset root (${uri})`)
      continue
    }
    queueFile(dependencyPath)
  }
}

const walkFiles = async (directory) => {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walkFiles(path))
    else if (entry.isFile()) files.push(path)
  }
  return files
}
const publicAssetFiles = await walkFiles(assetRoot)
const nonRuntimeFiles = publicAssetFiles
  .filter((path) => !runtimeFiles.has(path))
  .map((path) => relative(assetRoot, path).replaceAll('\\', '/'))
  .sort()
const historicalReleaseIds = ['gate-a-baseline-r8']
const historicalReleaseFiles = (
  await Promise.all(historicalReleaseIds.map(async (historicalReleaseId) => {
    const historicalReleaseRoot = resolve(
      assetRoot,
      'v3',
      'releases',
      historicalReleaseId,
    )
    return (await walkFiles(historicalReleaseRoot)).map(
      (path) => relative(assetRoot, path).replaceAll('\\', '/'),
    )
  }))
).flat()
const expectedNonRuntimeFiles = [
  'ASSET-LICENSES.md',
  `v3/releases/${releaseId}/characters/character-hero-female.manifest.json`,
  'v3/releases/male-hero-v14-r1/characters/character-hero-male.manifest.json',
  ...historicalReleaseFiles,
].sort()
if (JSON.stringify(nonRuntimeFiles) !== JSON.stringify(expectedNonRuntimeFiles)) {
  errors.push(
    `unexpected non-runtime asset inventory: ${JSON.stringify(nonRuntimeFiles)}`,
  )
}

const extensionCounts = Object.fromEntries(
  [...runtimeFiles]
    .map((path) => extname(path).toLowerCase())
    .sort()
    .reduce((counts, extension) => {
      counts.set(extension, (counts.get(extension) ?? 0) + 1)
      return counts
    }, new Map()),
)
const expectedExtensionCounts = {
  '.bin': 1,
  '.glb': 25,
  '.gltf': 8,
  '.jpg': 4,
  '.js': 2,
  '.png': 8,
  '.wasm': 1,
  '.webp': 3,
}
if (JSON.stringify(extensionCounts) !== JSON.stringify(expectedExtensionCounts)) {
  errors.push(
    `runtime asset extension inventory changed: ${JSON.stringify(extensionCounts)}`,
  )
}

if (errors.length > 0) {
  throw new Error(
    `Virtual Church runtime-asset integrity validation failed:\n- ${errors.join('\n- ')}`,
  )
}

console.log(JSON.stringify({
  release: releaseId,
  runtimeRootUrls: runtimeRootUrls.size,
  runtimeClosureFiles: runtimeFiles.size,
  extensionCounts,
  gltf2Documents: extensionCounts['.gltf'],
  glb2Documents: extensionCounts['.glb'],
  externalDependenciesResolved: runtimeFiles.size - runtimeRootUrls.size,
  nonRuntimeFiles,
  allRuntimeAssetsNonEmpty: true,
  allExternalDependenciesSameOrigin: true,
  allGlbHeadersAndLengthsValid: true,
  passed: true,
}, null, 2))
