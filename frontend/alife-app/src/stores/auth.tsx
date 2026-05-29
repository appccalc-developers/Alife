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
  const [language, setLanguage] = useState<Language>('zh')

  const fetchMe = useCallback(async () => {
    const profile = await authService.getMe()
    setMe(profile)
    setLanguage(profile.language ?? 'zh')
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
    setLanguage('zh')
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

  const canManageGroup = useCallback(
    (groupId: string) => hasGroupRole(groupId, 'leader') || hasGroupRole(groupId, 'coLeader'),
    [hasGroupRole],
  )

  const updateLanguage = useCallback(async (value: Language) => {
    const previousLanguage = language
    setLanguage(value)

    if (!me || me.isGuest) {
      return
    }

    try {
      await authService.updateProfileLanguage(value)
      setMe((current) => (current ? { ...current, language: value } : current))
    } catch (error) {
      setLanguage(previousLanguage)
      throw error
    }
  }, [language, me])

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
      updateLanguage,
      hasGroupRole,
      canManageGroup,
      hasLeaderAccess: canManageGroup,
    }),
    [bootstrap, canManageGroup, fetchMe, hasGroupRole, initialized, language, loading, logout, me, memberships, updateLanguage],
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
