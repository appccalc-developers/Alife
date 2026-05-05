export interface Env {
  SYNC_VERSIONS: KVNamespace
  SYNC_API_TOKEN: string
}

type VersionPayload = {
  version?: number
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!isAuthorized(request, env)) {
      return json({ message: 'Unauthorized' }, 401)
    }

    const url = new URL(request.url)

    if (request.method === 'PUT' && url.pathname.startsWith('/kv/')) {
      const key = decodeURIComponent(url.pathname.slice('/kv/'.length))
      if (!isValidKey(key)) {
        return json({ message: 'Invalid key.' }, 400)
      }

      const payload = (await request.json().catch(() => null)) as VersionPayload | null
      const version = Number(payload?.version ?? Date.now())
      if (!Number.isFinite(version) || version <= 0) {
        return json({ message: 'Invalid version.' }, 400)
      }

      await env.SYNC_VERSIONS.put(key, String(Math.trunc(version)))
      return json({ key, version: Math.trunc(version) })
    }

    if (request.method === 'GET' && url.pathname === '/kv/bulk') {
      const keys = (url.searchParams.get('keys') ?? '')
        .split(',')
        .map((key) => key.trim())
        .filter(isValidKey)
        .slice(0, 100)

      const versions: Record<string, number> = {}
      await Promise.all(
        [...new Set(keys)].map(async (key) => {
          const value = await env.SYNC_VERSIONS.get(key)
          if (value) {
            const version = Number(value)
            if (Number.isFinite(version)) {
              versions[key] = version
            }
          }
        }),
      )

      return json({ versions })
    }

    return json({ message: 'Not found.' }, 404)
  },
}

function isAuthorized(request: Request, env: Env) {
  const expected = `Bearer ${env.SYNC_API_TOKEN}`
  return Boolean(env.SYNC_API_TOKEN) && request.headers.get('Authorization') === expected
}

function isValidKey(key: string) {
  return key.length > 0 && key.length <= 250 && /^[a-zA-Z0-9:_./-]+$/.test(key)
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}
