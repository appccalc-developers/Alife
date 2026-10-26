import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDeployConfig } from './deploy-config.mjs'

export const createDeploymentConfig = (source, cacheNamespaceId, options) => {
  const namespaceId = typeof cacheNamespaceId === 'string' ? cacheNamespaceId.trim() : ''
  if (!/^[0-9a-f]{32}$/i.test(namespaceId)) {
    throw new Error('CLOUDFLARE_API_CACHE_NAMESPACE_ID must be a 32-character Cloudflare KV namespace id.')
  }

  // The source Worker rejects SPA HTML for missing code/models. That guard is
  // ineffective when static assets bypass it or the ASSETS binding is absent.
  if (source?.assets?.binding !== 'ASSETS') {
    throw new Error('assets.binding must be ASSETS.')
  }
  const workerFirst = source.assets.run_worker_first
  if (!Array.isArray(workerFirst) || workerFirst.includes('*') || workerFirst.includes('/*')) {
    throw new Error('assets.run_worker_first must be a scoped array.')
  }
  for (const path of ['/api/*', '/images/*', '/assets/*', '/virtual-church-assets/*']) {
    if (!workerFirst.includes(path)) {
      throw new Error(`assets.run_worker_first must include ${path}.`)
    }
  }

  return createDeployConfig(source, namespaceId, options)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  if (args.length > 1 || (args.length === 1 && !args[0].startsWith('--output='))
    || args[0] === '--output=') {
    throw new Error('Usage: create-deploy-config.mjs [--output=<config path>]')
  }
  const sourcePath = new URL('../wrangler.jsonc', import.meta.url)
  // Read-only/local release checks can generate a candidate under the approved
  // data root without replacing the user's actual generated deployment file.
  const outputPath = args.length
    ? resolve(args[0].slice('--output='.length))
    : new URL('../.wrangler.deploy.jsonc', import.meta.url)
  const source = JSON.parse(await readFile(sourcePath, 'utf8'))
  const config = createDeploymentConfig(source, process.env.CLOUDFLARE_API_CACHE_NAMESPACE_ID, {
    requireEventResetSecret: process.env.EVENT_RESET_DO_SECRET_REQUIRED !== 'false',
  })
  await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`)
}
