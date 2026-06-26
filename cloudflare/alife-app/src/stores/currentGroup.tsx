import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { conditionalGet } from '../db/httpCache'
import { churchQueryKey, groupQueryKey } from '../db/collections/groupCollection'
import { useUiText } from '../i18n/uiText'
import { activeEntityService } from '../services/activeEntityService'
import { useAuthStore } from './auth'
import type { GroupDto } from '../types'
import { normalizeGroup } from '../utils/apiEnums'

type CurrentGroupContextValue = {
  CurrentGroup: GroupDto | null
  loading: boolean
  error: string
  setCurrentGroup: (group: GroupDto | null) => void
  refreshChurchGroup: () => Promise<GroupDto | null>
}

const CurrentGroupContext = createContext<CurrentGroupContextValue | null>(null)

export const CurrentGroupProvider = ({ children }: { children: ReactNode }) => {
  const t = useUiText()
  const auth = useAuthStore()
  const [CurrentGroup, setCurrentGroup] = useState<GroupDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const tRef = useRef(t)

  useEffect(() => {
    tRef.current = t
  }, [t])

  const refreshChurchGroup = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const church = await conditionalGet<GroupDto>({
        queryKey: churchQueryKey,
        path: '/api/groups/church',
      })
      const normalized = normalizeGroup(church)
      setCurrentGroup(normalized)
      return normalized
    } catch {
      setError(tRef.current('churchGroupLoadError'))
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const activeGroupId = activeEntityService.getAll().groupId

    // Guest users should not attempt to fetch a cached group — it will 403.
    // Just load the church (public endpoint) instead.
    if (!activeGroupId || auth.isGuest) {
      refreshChurchGroup().catch(() => undefined)
      return
    }

    let cancelled = false

    const loadActiveGroup = async () => {
      setLoading(true)
      setError('')

      try {
        const group = await conditionalGet<GroupDto>({
          queryKey: groupQueryKey(activeGroupId),
          path: `/api/groups/${activeGroupId}`,
        })
        if (!cancelled) {
          setCurrentGroup(normalizeGroup(group))
        }
      } catch {
        if (!cancelled) {
          await refreshChurchGroup()
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadActiveGroup().catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [auth.isGuest, refreshChurchGroup])

  const value = useMemo<CurrentGroupContextValue>(
    () => ({
      CurrentGroup,
      loading,
      error,
      setCurrentGroup,
      refreshChurchGroup,
    }),
    [CurrentGroup, error, loading, refreshChurchGroup],
  )

  return <CurrentGroupContext.Provider value={value}>{children}</CurrentGroupContext.Provider>
}

export const useCurrentGroupStore = () => {
  const context = useContext(CurrentGroupContext)
  if (!context) {
    throw new Error('useCurrentGroupStore must be used within CurrentGroupProvider')
  }

  return context
}
