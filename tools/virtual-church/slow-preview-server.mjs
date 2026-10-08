import { existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'

const options = Object.fromEntries(
  process.argv.slice(2).map((argument) => {
    const [name, value = 'true'] = argument.replace(/^--/, '').split('=')
    return [name, value]
  }),
)

const root = resolve(options.root ?? 'cloudflare/alife-app/dist')
const port = Number(options.port ?? 4183)
const host = options.host ?? '0.0.0.0'
const latencyMs = Number(options['latency-ms'] ?? 250)
const kilobitsPerSecond = Number(options.kbps ?? 4096)
const useMemberFixture = options['member-fixture'] === 'true'
// Opt-in transport observations include worker-originated requests, unlike a
// document's resource list. Never retain queries, headers or API paths.
const logStaticRequests = options['log-static-requests'] === 'true'
const failedJsChunk = options['fail-js-chunk'] ?? ''
// Exact, local-only one-shot failure to exercise a dependency arriving after
// its Canvas disappears. HEAD checks must not consume the browser's fault.
const failedAssetOnce = options['fail-asset-once'] ?? ''
if (failedAssetOnce && !failedAssetOnce.startsWith('/virtual-church-assets/')) {
  throw new Error('--fail-asset-once must name an exact public 3D asset path')
}
let assetFaultConsumed = false
const failedCssOnce = options['fail-css-once'] ?? ''
if (failedCssOnce && !/^\/assets\/(?:VirtualChurchView|virtualChurchMainHallBudget)-[\w-]+\.css$/.test(failedCssOnce)) {
  throw new Error('--fail-css-once must name an exact church-owned CSS chunk path')
}
let cssFaultConsumed = false
const bytesPerTick = Math.max(1024, Math.floor((kilobitsPerSecond * 1000 / 8) / 10))
const activeResponses = []
let roundRobinIndex = 0

const removeActiveResponse = (target) => {
  const index = activeResponses.indexOf(target)
  if (index < 0) return
  activeResponses.splice(index, 1)
  if (index < roundRobinIndex) roundRobinIndex -= 1
  roundRobinIndex = Math.max(0, roundRobinIndex)
}

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
}

const scheduler = setInterval(() => {
  let budget = bytesPerTick
  while (budget > 0 && activeResponses.length > 0) {
    roundRobinIndex %= activeResponses.length
    const response = activeResponses[roundRobinIndex]
    if (response.res.destroyed || response.res.writableEnded) {
      removeActiveResponse(response)
      continue
    }
    const remaining = response.body.length - response.offset
    const fairShare = Math.max(1024, Math.floor(budget / activeResponses.length))
    const chunkSize = Math.min(remaining, fairShare, budget)

    response.res.write(response.body.subarray(response.offset, response.offset + chunkSize))
    response.offset += chunkSize
    budget -= chunkSize

    if (response.offset >= response.body.length) {
      response.res.end()
      activeResponses.splice(roundRobinIndex, 1)
    } else {
      roundRobinIndex += 1
    }
  }
}, 100)

const server = createServer(async (request, response) => {
  let staticContentLength = 0
  try {
    const requestPath = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
    if (logStaticRequests && /^(?:\/assets\/|\/virtual-church-assets\/|\/(?:sw\.js|workbox-[\w-]+\.js|virtual-church-cache-maintenance\.js)$)/u.test(requestPath)) {
      response.once('close', () => {
        console.log(`Static request: ${JSON.stringify({
          time: new Date().toISOString(),
          method: request.method,
          path: requestPath,
          status: response.statusCode,
          completed: response.writableFinished,
          contentLength: staticContentLength,
        })}`)
      })
    }

    if (request.method === 'GET' && requestPath === '/__alife_profile_network.json') {
      const body = Buffer.from(JSON.stringify({
        kilobitsPerSecond,
        latencyMs,
      }))
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Length': body.length,
        'Content-Type': 'application/json; charset=utf-8',
      })
      response.end(body)
      return
    }

    if (useMemberFixture && request.method === 'GET' && requestPath === '/api/me') {
      const body = Buffer.from(JSON.stringify({
        id: 'virtual-church-regression-member',
        displayName: 'Virtual Church Regression',
        isGuest: false,
        isRegistered: true,
        isAdmin: false,
        platformRole: 'user',
        permissions: [],
        memberships: [],
      }))
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Length': body.length,
        'Content-Type': 'application/json; charset=utf-8',
      })
      response.end(body)
      return
    }

    const requestedFile = resolve(root, `.${requestPath}`)
    if (requestedFile !== root && !requestedFile.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end('Forbidden')
      return
    }

    // Local-only fault injection: reproduce a stale app shell requesting a
    // removed lazy scene module, without touching the build or PWA caches.
    if (failedJsChunk && requestPath.startsWith('/assets/')
      && requestPath.endsWith('.js') && requestPath.includes(failedJsChunk)) {
      response.writeHead(404, {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
      })
      response.end('Injected missing JS chunk')
      return
    }

    const assetFault = !assetFaultConsumed && failedAssetOnce && requestPath === failedAssetOnce
    const cssFault = !cssFaultConsumed && failedCssOnce && requestPath === failedCssOnce
    if (request.method === 'GET' && (assetFault || cssFault)) {
      if (assetFault) assetFaultConsumed = true
      if (cssFault) cssFaultConsumed = true
      console.log(`Injected one-shot missing asset: ${requestPath}`)
      response.writeHead(404, {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Type': 'text/plain; charset=utf-8',
      })
      response.end(cssFault ? 'Injected one-shot missing CSS chunk' : 'Injected one-shot missing 3D asset')
      return
    }

    const requestedFileExists = existsSync(requestedFile) && statSync(requestedFile).isFile()
    const isNavigationRequest = request.method === 'GET'
      && (request.headers.accept ?? '').includes('text/html')

    const isStaticAssetRequest = requestPath.startsWith('/assets/')
      || requestPath.startsWith('/virtual-church-assets/')
    if (!requestedFileExists && (isStaticAssetRequest || !isNavigationRequest)) {
      response.writeHead(404, {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      })
      response.end('Not found')
      return
    }

    const file = requestedFileExists ? requestedFile : resolve(root, 'index.html')
    const body = await readFile(file)
    staticContentLength = body.length
    const headers = {
      'Cache-Control': 'no-store',
      'Content-Length': body.length,
      'Content-Type': contentTypes[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'X-Alife-Test-Bandwidth-Kbps': String(kilobitsPerSecond),
      'X-Alife-Test-Latency-Ms': String(latencyMs),
    }

    response.writeHead(200, headers)
    if (request.method === 'HEAD') {
      response.end()
      return
    }

    setTimeout(() => {
      if (response.destroyed || response.writableEnded) return
      const activeResponse = { body, offset: 0, res: response }
      activeResponses.push(activeResponse)
      const removeClosedResponse = () => removeActiveResponse(activeResponse)
      response.once('close', removeClosedResponse)
      response.once('error', removeClosedResponse)
    }, latencyMs)
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end(error instanceof Error ? error.message : 'Unknown preview server error')
  }
})

server.listen(port, host, () => {
  console.log(`Alife slow preview: http://${host === '0.0.0.0' ? 'localhost' : host}:${server.address().port}`)
  console.log(`Root: ${root}`)
  console.log(`Global bandwidth: ${kilobitsPerSecond} kbps; latency: ${latencyMs} ms`)
})

const close = () => {
  clearInterval(scheduler)
  activeResponses.splice(0).forEach(({ res }) => res.destroy())
  server.close(() => process.exit(0))
}

process.on('SIGINT', close)
process.on('SIGTERM', close)
