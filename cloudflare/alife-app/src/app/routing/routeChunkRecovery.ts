const DYNAMIC_IMPORT_URL_PATTERN =
  /(?:Failed to fetch dynamically imported module|error loading dynamically imported module):\s*(https?:\/\/[^\s]+)/i

type RefreshRouteChunkOptions = {
  fetcher?: typeof fetch
  origin?: string
}

export function getFailedRouteModuleUrl(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return message.match(DYNAMIC_IMPORT_URL_PATTERN)?.[1]
}

export function isRouteChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return DYNAMIC_IMPORT_URL_PATTERN.test(message) || /Importing a module script failed/i.test(message)
}

export async function refreshFailedRouteModule(
  error: unknown,
  options: RefreshRouteChunkOptions = {},
): Promise<boolean> {
  const moduleUrl = getFailedRouteModuleUrl(error)
  if (!moduleUrl) {
    return false
  }

  const origin = options.origin ?? window.location.origin
  const parsedUrl = new URL(moduleUrl, origin)
  if (parsedUrl.origin !== origin) {
    return false
  }

  const fetcher = options.fetcher ?? fetch
  const response = await fetcher(parsedUrl, {
    cache: 'reload',
    credentials: 'same-origin',
    headers: {
      'cache-control': 'no-cache',
    },
  })
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''

  return response.ok && (contentType.includes('javascript') || contentType.includes('ecmascript'))
}
