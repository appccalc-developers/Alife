import { readFile, writeFile } from 'node:fs/promises'

const namespaceId = process.env.CLOUDFLARE_API_CACHE_NAMESPACE_ID?.trim() ?? ''
if (!/^[0-9a-f]{32}$/i.test(namespaceId)) {
  throw new Error('CLOUDFLARE_API_CACHE_NAMESPACE_ID must be a 32-character Cloudflare KV namespace id.')
}

const sourcePath = new URL('../wrangler.jsonc', import.meta.url)
const outputPath = new URL('../.wrangler.deploy.jsonc', import.meta.url)
const config = JSON.parse(await readFile(sourcePath, 'utf8'))
config.kv_namespaces = [
  {
    binding: 'API_CACHE',
    id: namespaceId,
  },
]

await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`)
