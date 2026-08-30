export type WorkspaceLocation = {
  pathname: string
  search?: string
  hash?: string
}

const STORAGE_KEY_PREFIX = 'alife:last-workspace-location'

const storageKey = (viewerId: string) =>
  `${STORAGE_KEY_PREFIX}:${encodeURIComponent(viewerId.trim())}`

const isNonResumableLocation = (pathname: string) =>
  pathname === '/' ||
  pathname === '/home' ||
  pathname === '/articles' ||
  pathname.startsWith('/articles/') ||
  pathname.startsWith('/public/pages/') ||
  pathname === '/enter' ||
  pathname === '/onboarding' ||
  pathname === '/internal/alpha-login' ||
  /^\/(activate|join|application)\/[^/]+$/.test(pathname) ||
  pathname === '/groups/select' ||
  pathname === '/groups/select/tree' ||
  pathname === '/groups/join' ||
  /^\/groups\/[^/]+\/join$/.test(pathname)

const isSafeInternalPath = (value: string) =>
  value.startsWith('/') &&
  !value.startsWith('//') &&
  !value.includes('\\') &&
  !/[\u0000-\u001f\u007f]/.test(value)

export const toWorkspaceLocation = ({ pathname, search = '', hash = '' }: WorkspaceLocation) => {
  if (!isSafeInternalPath(pathname) || isNonResumableLocation(pathname)) {
    return ''
  }

  return `${pathname}${search}${hash}`
}

export const resolveWorkspaceEntryLocation = (rememberedLocation: string, activeGroupId: string) =>
  rememberedLocation || (activeGroupId.trim() ? '/groups?view=overview' : '/church')

export const resolveWorkspaceFallbackLocation = (isGuest: boolean) =>
  isGuest ? '/' : '/church'

export const workspaceResumeService = {
  remember(viewerId: string | null | undefined, location: WorkspaceLocation) {
    const normalizedViewerId = viewerId?.trim()
    const value = toWorkspaceLocation(location)
    if (!normalizedViewerId || !value || typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(storageKey(normalizedViewerId), value)
    } catch {
      // Resume is a convenience only; navigation remains usable when storage is blocked.
    }
  },

  get(viewerId: string | null | undefined) {
    const normalizedViewerId = viewerId?.trim()
    if (!normalizedViewerId || typeof window === 'undefined') {
      return ''
    }

    try {
      const value = window.localStorage.getItem(storageKey(normalizedViewerId)) ?? ''
      const pathname = value.split(/[?#]/, 1)[0]
      if (!isSafeInternalPath(value) || isNonResumableLocation(pathname)) {
        return ''
      }
      return value
    } catch {
      return ''
    }
  },
}
