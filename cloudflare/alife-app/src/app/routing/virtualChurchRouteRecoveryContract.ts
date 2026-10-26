export const VIRTUAL_CHURCH_RECOVERY_QUERY_KEY = 'vcRecovery'
export const VIRTUAL_CHURCH_RECOVERY_CLEANUP_TIMEOUT_MS = 2500
export const VIRTUAL_CHURCH_RECOVERY_NAVIGATION_GRACE_MS = 1200

export const virtualChurchChunkLoadFailed = (error: unknown) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return [
    'ChunkLoadError',
    'Failed to fetch dynamically imported module',
    'Importing a module script failed',
    'error loading dynamically imported module',
  ].some(fragment => message.includes(fragment))
    // Vite rejects the lazy import when one of its CSS dependencies fails too.
    // Do not turn unrelated styles, model failures or runtime errors into a
    // cache-clearing retry; these are the two current church-owned CSS chunks.
    || /Unable to preload CSS for \/assets\/(?:VirtualChurchView|virtualChurchMainHallBudget)-[\w-]+\.css$/.test(message)
}

export const virtualChurchRecoveryCacheIsAffected = (cacheName: string) =>
  cacheName.startsWith('workbox-precache-')
  || cacheName.startsWith('alife-virtual-church-code-')
  || cacheName === 'alife-app-cache'
  || cacheName === 'alife-runtime-cache'

export const virtualChurchRecoveryServiceWorkerIsAffected = (
  registrationScope: string,
  currentUrl: string,
) => {
  try {
    return new URL(currentUrl).href.startsWith(new URL(registrationScope).href)
  } catch {
    return false
  }
}

export const virtualChurchRecoveryNavigationUrl = (
  currentUrl: string,
  attemptToken: string,
) => {
  const url = new URL(currentUrl)
  url.searchParams.set(VIRTUAL_CHURCH_RECOVERY_QUERY_KEY, attemptToken)
  return url.toString()
}

export const virtualChurchRecoveryMarkerIsPresent = (currentUrl: string) =>
  new URL(currentUrl).searchParams.has(VIRTUAL_CHURCH_RECOVERY_QUERY_KEY)

export const virtualChurchRecoveryShouldStart = ({
  force,
  markerPresent,
  storageAttempted,
  online,
}: {
  force: boolean
  markerPresent: boolean
  storageAttempted: boolean | null
  online: boolean
}) => online && (force || (!markerPresent && storageAttempted !== true))

export const virtualChurchUrlWithoutRecoveryMarker = (currentUrl: string) => {
  const url = new URL(currentUrl)
  if (!url.searchParams.has(VIRTUAL_CHURCH_RECOVERY_QUERY_KEY)) return null
  url.searchParams.delete(VIRTUAL_CHURCH_RECOVERY_QUERY_KEY)
  return url.toString()
}
