import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authService } from '../services/authService'
import type { MeDto, MembershipRole } from '../types'

type Language = 'en' | 'zh'

type AuthContextValue = {
  me: MeDto | null
  loading: boolean
  initialized: boolean
  language: Language
  isGuest: boolean
  isRegistered: boolean
  isAdmin: boolean
  memberships: MeDto['memberships']
  fetchMe: () => Promise<MeDto>
  bootstrap: () => Promise<MeDto | undefined>
  logout: () => Promise<void>
  setLanguage: (value: Language) => void
  hasGroupRole: (groupId: string, role: MembershipRole) => boolean
  canManageGroup: (groupId: string) => boolean
  hasLeaderAccess: (groupId: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [me, setMe] = useState<MeDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [language, setLanguage] = useState<Language>('en')

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
    await bootstrap()
  }, [bootstrap])

  const memberships = me?.memberships ?? []

  const hasGroupRole = useCallback(
    (groupId: string, role: MembershipRole) =>
      memberships.some((membership) => membership.groupId === groupId && membership.status === 'Approved' && membership.role === role),
    [memberships],
  )

  const canManageGroup = useCallback(
    (groupId: string) => hasGroupRole(groupId, 'Leader') || hasGroupRole(groupId, 'CoLeader'),
    [hasGroupRole],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      me,
      loading,
      initialized,
      language,
      isGuest: !me || me.isGuest,
      isRegistered: Boolean(me?.isRegistered),
      isAdmin: Boolean(me?.isAdmin),
      memberships,
      fetchMe,
      bootstrap,
      logout,
      setLanguage,
      hasGroupRole,
      canManageGroup,
      hasLeaderAccess: canManageGroup,
    }),
    [bootstrap, canManageGroup, fetchMe, hasGroupRole, initialized, language, loading, logout, me, memberships],
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