import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authService } from '../services/authService'
import type { MeDto, MembershipRole } from '../types'

type Language = 'en' | 'zh'
const LANGUAGE_STORAGE_KEY = 'alife.language'

const readStoredLanguage = (): Language => {
  if (typeof window === 'undefined') {
    return 'en'
  }

  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'zh' ? 'zh' : 'en'
}

const writeStoredLanguage = (language: Language) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  }
}

type AuthContextValue = {
  me: MeDto | null
  loading: boolean
  initialized: boolean
  language: Language
  isGuest: boolean
  isRegistered: boolean
  isAdmin: boolean
  canReviewPages: boolean
  memberships: MeDto['memberships']
  hasAdminPermission: (permissionCode: string) => boolean
  fetchMe: () => Promise<MeDto>
  bootstrap: () => Promise<MeDto | undefined>
  logout: () => Promise<void>
  updateLanguage: (value: Language) => Promise<void>
  hasGroupRole: (groupId: string, role: MembershipRole) => boolean
  canManageGroup: (groupId: string) => boolean
  hasLeaderAccess: (groupId: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [me, setMe] = useState<MeDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [language, setLanguage] = useState<Language>(() => readStoredLanguage())

  const fetchMe = useCallback(async () => {
    const profile = await authService.getMe()
    setMe(profile)
    return profile
  }, [])

  const bootstrap = useCallback(async () => {
    if (me) {
      setInitialized(true)
      return me
    }

    setLoading(true)
    try {
      await fetchMe()
    } finally {
      setLoading(false)
      setInitialized(true)
    }
  }, [fetchMe, me])

  useEffect(() => {
    bootstrap().catch(() => setInitialized(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setMe(null)
    try {
      await fetchMe()
    } catch {
      setMe(null)
    } finally {
      setInitialized(true)
    }
  }, [fetchMe])

  const memberships = me?.memberships ?? []

  const hasGroupRole = useCallback(
    (groupId: string, role: MembershipRole) =>
      memberships.some((membership) => membership.groupId === groupId && membership.status === 'approved' && membership.role === role),
    [memberships],
  )

  const isPlatformAdmin = Boolean(me?.isAdmin || me?.platformRole === 'admin' || me?.platformRole === 'superadmin')
  const permissions = useMemo(() => new Set(me?.permissions ?? []), [me?.permissions])
  const hasAdminPermission = useCallback(
    (permissionCode: string) => Boolean(me?.platformRole === 'superadmin' || permissions.has(permissionCode)),
    [me?.platformRole, permissions],
  )
  const canReviewPages = Boolean(isPlatformAdmin || me?.platformRole === 'page_reviewer' || hasAdminPermission('admin.pages.review'))

  const canManageGroup = useCallback(
    (groupId: string) => isPlatformAdmin || hasGroupRole(groupId, 'leader') || hasGroupRole(groupId, 'coLeader'),
    [hasGroupRole, isPlatformAdmin],
  )

  const updateLanguage = useCallback(async (value: Language) => {
    setLanguage(value)
    writeStoredLanguage(value)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      me,
      loading,
      initialized,
      language,
      isGuest: !me || me.isGuest,
      isRegistered: Boolean(me?.isRegistered),
      isAdmin: isPlatformAdmin,
      canReviewPages,
      memberships,
      hasAdminPermission,
      fetchMe,
      bootstrap,
      logout,
      updateLanguage,
      hasGroupRole,
      canManageGroup,
      hasLeaderAccess: canManageGroup,
    }),
    [bootstrap, canManageGroup, canReviewPages, fetchMe, hasAdminPermission, hasGroupRole, initialized, isPlatformAdmin, language, loading, logout, me, memberships, updateLanguage],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuthStore = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthStore must be used within AuthProvider')
  }

  return context
}
