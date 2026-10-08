import assert from 'node:assert/strict'
import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '..', '..')
const APP_ROOT = resolve(REPOSITORY_ROOT, 'cloudflare', 'alife-app')
const ASSET_SERVICE_SOURCE_PATH = resolve(
  APP_ROOT,
  'src',
  'services',
  'virtualChurchService.ts',
)

const readArgument = (name, fallback) => {
  const prefix = `--${name}=`
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix))
  return argument ? argument.slice(prefix.length) : fallback
}

const allowedArguments = new Set(['base-url', 'dist-root', 'timeout-ms'])
const missingOnly = process.argv.includes('--missing-only')
for (const argument of process.argv.slice(2)) {
  if (argument === '--missing-only') continue
  const optionName = argument.match(/^--([^=]+)=/u)?.[1]
  assert.ok(
    optionName && allowedArguments.has(optionName),
    `Unsupported argument: ${argument}`,
  )
}

const DIST_ROOT = resolve(readArgument('dist-root', resolve(APP_ROOT, 'dist')))
const DIST_ASSETS_ROOT = resolve(DIST_ROOT, 'assets')
const baseUrl = new URL(readArgument('base-url', 'http://127.0.0.1:8787'))
assert.ok(
  baseUrl.protocol === 'http:' || baseUrl.protocol === 'https:',
  `--base-url must use http or https: ${baseUrl}`,
)
baseUrl.pathname = baseUrl.pathname.replace(/\/?$/u, '/')
baseUrl.search = ''
baseUrl.hash = ''

const timeoutMs = Number(readArgument('timeout-ms', '15000'))
assert.ok(
  Number.isInteger(timeoutMs) && timeoutMs >= 1000 && timeoutMs <= 120000,
  '--timeout-ms must be an integer between 1000 and 120000',
)

const findSingleDistAsset = async (pattern, label) => {
  const matches = (await readdir(DIST_ASSETS_ROOT, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => entry.name)
  assert.equal(
    matches.length,
    1,
    `Expected exactly one ${label} in dist/assets; received ${matches.join(', ') || 'none'}`,
  )
  return matches[0]
}

const fetchPath = async (pathname) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const url = new URL(pathname.replace(/^\//u, ''), baseUrl)

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'manual',
      signal: controller.signal,
    })
    const body = Buffer.from(await response.arrayBuffer())
    return {
      body,
      cacheControl: response.headers.get('cache-control') ?? '',
      contentType: response.headers.get('content-type') ?? '',
      status: response.status,
      url: url.toString(),
      xContentTypeOptions: response.headers.get('x-content-type-options') ?? '',
    }
  } catch (error) {
    throw new Error(`Unable to fetch ${url}: ${error instanceof Error ? error.message : error}`)
  } finally {
    clearTimeout(timeout)
  }
}

const assertJavascriptResponse = (result, label, expectedBytes) => {
  assert.equal(result.status, 200, `${label} must return 200: ${result.url}`)
  assert.match(
    result.contentType,
    /^(?:application|text)\/javascript\b/iu,
    `${label} must use a JavaScript MIME type: ${result.contentType}`,
  )
  assert.ok(
    !result.body.toString('utf8', 0, 64).trimStart().startsWith('<'),
    `${label} returned HTML instead of JavaScript`,
  )
  assert.equal(
    result.body.length,
    expectedBytes,
    `${label} byte length differs from the current dist file`,
  )
  assert.match(
    result.cacheControl,
    /(?:^|,\s*)public(?:,|$)/iu,
    `${label} must keep public hashed-asset caching`,
  )
  assert.match(
    result.cacheControl,
    /(?:^|,\s*)max-age=0(?:,|$)/iu,
    `${label} must require browser revalidation before reuse`,
  )
  assert.match(
    result.cacheControl,
    /(?:^|,\s*)must-revalidate(?:,|$)/iu,
    `${label} must not reuse stale JavaScript without revalidation`,
  )
  assert.doesNotMatch(
    result.cacheControl,
    /(?:^|,\s*)immutable(?:,|$)/iu,
    `${label} must not bypass the configured browser revalidation`,
  )
}

const assertMissingStaticResponse = (result, label) => {
  assert.equal(result.status, 404, `${label} must return 404: ${result.url}`)
  assert.ok(
    !/^text\/html\b/iu.test(result.contentType),
    `${label} must not return the SPA HTML shell`,
  )
  assert.match(
    result.cacheControl,
    /(?:^|,\s*)no-store(?:,|$)/iu,
    `${label} must prevent caching`,
  )
  assert.equal(
    result.xContentTypeOptions.toLowerCase(),
    'nosniff',
    `${label} must disable MIME sniffing`,
  )
}

const missingRoutePath = '/assets/VirtualChurchView-http-boundary-missing.js'
const assetServiceSource = await readFile(ASSET_SERVICE_SOURCE_PATH, 'utf8')
const release = assetServiceSource.match(
  /const V3_ASSET_RELEASE = '([^']+)'/u,
)?.[1]
assert.ok(release, 'Unable to read V3_ASSET_RELEASE from virtualChurchService.ts')
const missingChurchPath =
  `/virtual-church-assets/v3/releases/${release}/buildings/http-boundary-missing.glb`

if (missingOnly) {
  const [missingRoute, missingChurch] = await Promise.all([
    fetchPath(missingRoutePath),
    fetchPath(missingChurchPath),
  ])
  assertMissingStaticResponse(missingRoute, 'Missing VirtualChurchView bundle')
  assertMissingStaticResponse(missingChurch, 'Missing church Hero GLB')
  console.log(JSON.stringify({ baseUrl: baseUrl.toString(), missingAssets: [missingRoutePath, missingChurchPath], passed: true }, null, 2))
} else {

const routeBundle = await findSingleDistAsset(
  /^VirtualChurchView-[^/]+\.js$/u,
  'VirtualChurchView bundle',
)
const vendorBundle = await findSingleDistAsset(
  /^vendor-3d-[^/]+\.js$/u,
  'vendor-3d bundle',
)
const routePath = `/assets/${routeBundle}`
const vendorPath = `/assets/${vendorBundle}`
await assert.rejects(
  stat(resolve(DIST_ROOT, missingRoutePath.slice(1))),
  { code: 'ENOENT' },
  'The synthetic missing JS path unexpectedly exists in dist',
)

const churchPath =
  `/virtual-church-assets/v3/releases/${release}/buildings/church-hero.glb`
const churchDistPath = resolve(DIST_ROOT, churchPath.slice(1))
const churchBytes = (await stat(churchDistPath)).size
await assert.rejects(
  stat(resolve(DIST_ROOT, missingChurchPath.slice(1))),
  { code: 'ENOENT' },
  'The synthetic missing GLB path unexpectedly exists in dist',
)

const [
  shell,
  route,
  vendor,
  missingRoute,
  church,
  missingChurch,
] = await Promise.all([
  fetchPath('/'),
  fetchPath(routePath),
  fetchPath(vendorPath),
  fetchPath(missingRoutePath),
  fetchPath(churchPath),
  fetchPath(missingChurchPath),
])

assert.equal(shell.status, 200, 'SPA shell must return 200')
assert.match(shell.contentType, /^text\/html\b/iu, 'SPA shell must return HTML')
assert.ok(
  shell.body.toString('utf8', 0, 64).trimStart().startsWith('<!doctype html>'),
  'SPA shell body must begin with the HTML doctype',
)

assertJavascriptResponse(
  route,
  'Current VirtualChurchView bundle',
  (await stat(resolve(DIST_ASSETS_ROOT, routeBundle))).size,
)
assertJavascriptResponse(
  vendor,
  'Current vendor-3d bundle',
  (await stat(resolve(DIST_ASSETS_ROOT, vendorBundle))).size,
)
assertMissingStaticResponse(missingRoute, 'Missing VirtualChurchView bundle')

assert.equal(church.status, 200, 'Current church Hero GLB must return 200')
assert.equal(
  church.contentType.toLowerCase(),
  'model/gltf-binary',
  'Current church Hero GLB must use model/gltf-binary',
)
assert.equal(
  church.body.toString('ascii', 0, 4),
  'glTF',
  'Current church Hero response must begin with the GLB magic bytes',
)
assert.equal(
  church.body.length,
  churchBytes,
  'Current church Hero byte length differs from dist',
)
assertMissingStaticResponse(missingChurch, 'Missing church Hero GLB')

console.log(JSON.stringify({
  baseUrl: baseUrl.toString(),
  shell: {
    status: shell.status,
    contentType: shell.contentType,
    bytes: shell.body.length,
  },
  currentAssets: [
    {
      path: routePath,
      status: route.status,
      contentType: route.contentType,
      cacheControl: route.cacheControl,
      bytes: route.body.length,
    },
    {
      path: vendorPath,
      status: vendor.status,
      contentType: vendor.contentType,
      cacheControl: vendor.cacheControl,
      bytes: vendor.body.length,
    },
    {
      path: churchPath,
      status: church.status,
      contentType: church.contentType,
      cacheControl: church.cacheControl,
      bytes: church.body.length,
    },
  ],
  missingAssets: [
    {
      path: missingRoutePath,
      status: missingRoute.status,
      contentType: missingRoute.contentType,
      cacheControl: missingRoute.cacheControl,
      xContentTypeOptions: missingRoute.xContentTypeOptions,
    },
    {
      path: missingChurchPath,
      status: missingChurch.status,
      contentType: missingChurch.contentType,
      cacheControl: missingChurch.cacheControl,
      xContentTypeOptions: missingChurch.xContentTypeOptions,
    },
  ],
  passed: true,
}, null, 2))
}
