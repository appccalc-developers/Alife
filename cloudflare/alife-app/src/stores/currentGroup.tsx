import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { isAuthOptionalLocation } from '../app/routing/publicRoutePolicy'
import { fetchFreshVisibleGroupsForViewer, fetchGroupForViewer } from '../db/collections/groupCollection'
import { useUiText } from '../i18n/uiText'
import { ACTIVE_ENTITY_CHANGED_EVENT, activeEntityService } from '../services/activeEntityService'
import { useAuthStore } from './auth'
import type { GroupDto } from '../types'
import { normalizeGroup } from '../utils/apiEnums'
import { hasApprovedMembership, selectPreferredCurrentGroup } from '../utils/currentGroupSelection'

type CurrentGroupContextValue = {
  CurrentGroup: GroupDto | null
  loading: boolean
  error: string
  setCurrentGroup: (group: GroupDto | null) => void
}

const CurrentGroupContext = createContext<CurrentGroupContextValue | null>(null)

export const CurrentGroupProvider = ({ children }: { children: ReactNode }) => {
  const t = useUiText()
  const auth = useAuthStore()
  const location = useLocation()
  const groupContextEnabled = !isAuthOptionalLocation(location)
  const [CurrentGroup, setCurrentGroup] = useState<GroupDto | null>(null)
  const [activeGroupId, setActiveGroupId] = useState(() => activeEntityService.getAll().groupId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const tRef = useRef(t)

  useEffect(() => {
    tRef.current = t
  }, [t])

  useEffect(() => {
    const syncActiveGroup = () => setActiveGroupId(activeEntityService.getAll().groupId)
    syncActiveGroup()
    window.addEventListener(ACTIVE_ENTITY_CHANGED_EVENT, syncActiveGroup)
    window.addEventListener('storage', syncActiveGroup)
    return () => {
      window.removeEventListener(ACTIVE_ENTITY_CHANGED_EVENT, syncActiveGroup)
      window.removeEventListener('storage', syncActiveGroup)
    }
  }, [])

  useEffect(() => {
    setActiveGroupId(activeEntityService.getAll().groupId)
  }, [auth.me?.id])

  useEffect(() => {
    if (!groupContextEnabled) {
      setCurrentGroup(null)
      setLoading(false)
      setError('')
      return
    }

    if (auth.isGuest) {
      setCurrentGroup(null)
      setLoading(false)
      setError('')
      return
    }

    const hasUsableMembership = Boolean(activeGroupId) &&
      hasApprovedMembership(auth.memberships, activeGroupId)
    if (!hasUsableMembership) {
      setCurrentGroup(null)
      setError('')

      if (activeGroupId) {
        setLoading(true)
        activeEntityService.setGroup('', { clearPage: true, clearEvent: true })
        return
      }

      if (!auth.memberships.some((membership) => membership.status === 'approved')) {
        setLoading(false)
        return
      }

      let cancelled = false

      const selectFallbackGroup = async () => {
        setLoading(true)

        try {
          const visibleGroups = await fetchFreshVisibleGroupsForViewer(auth.me?.id)
          const fallbackGroup = selectPreferredCurrentGroup(visibleGroups, auth.memberships)
          if (cancelled) return

          if (fallbackGroup) {
            activeEntityService.setGroup(fallbackGroup.id, { clearPage: true, clearEvent: true })
          } else {
            setLoading(false)
          }
        } catch {
          if (!cancelled) {
            setLoading(false)
            setError(tRef.current('groupLoadFailed'))
          }
        }
      }

      selectFallbackGroup().catch(() => undefined)

      return () => {
        cancelled = true
      }
    }

    let cancelled = false

    const loadActiveGroup = async () => {
      setLoading(true)
      setError('')

      try {
        const group = await fetchGroupForViewer(activeGroupId, auth.me?.id)
        if (!cancelled) {
          const normalized = normalizeGroup(group)
          if (normalized.isChurch) {
            activeEntityService.setGroup('', { clearPage: true, clearEvent: true })
            setCurrentGroup(null)
          } else {
            setCurrentGroup(normalized)
          }
        }
      } catch {
        if (!cancelled) {
          setCurrentGroup(null)
          setError(tRef.current('groupLoadFailed'))
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
  }, [activeGroupId, auth.isGuest, auth.me?.id, auth.memberships, groupContextEnabled])

  const setSelectableCurrentGroup = useCallback((group: GroupDto | null) => {
    if (group?.isChurch) {
      if (activeEntityService.getAll().groupId === group.id) {
        activeEntityService.setGroup('', { clearPage: true, clearEvent: true })
      }
      return
    }
    setCurrentGroup(group)
  }, [])

  const value = useMemo<CurrentGroupContextValue>(
    () => ({
      CurrentGroup,
      loading,
      error,
      setCurrentGroup: setSelectableCurrentGroup,
    }),
    [CurrentGroup, error, loading, setSelectableCurrentGroup],
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
