import { readFile, writeFile } from 'node:fs/promises'

import { createDeployConfig } from './deploy-config.mjs'

const namespaceId = process.env.CLOUDFLARE_API_CACHE_NAMESPACE_ID?.trim() ?? ''
if (!/^[0-9a-f]{32}$/i.test(namespaceId)) {
  throw new Error('CLOUDFLARE_API_CACHE_NAMESPACE_ID must be a 32-character Cloudflare KV namespace id.')
}

const sourcePath = new URL('../wrangler.jsonc', import.meta.url)
const outputPath = new URL('../.wrangler.deploy.jsonc', import.meta.url)
const source = JSON.parse(await readFile(sourcePath, 'utf8'))
const config = createDeployConfig(source, namespaceId, {
  requireEventResetSecret: process.env.EVENT_RESET_DO_SECRET_REQUIRED !== 'false',
})

await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`)
