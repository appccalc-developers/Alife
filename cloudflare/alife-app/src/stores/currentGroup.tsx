import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { isAuthOptionalLocation } from '../app/routing/publicRoutePolicy'
import { fetchGroupForViewer } from '../db/collections/groupCollection'
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
}

const CurrentGroupContext = createContext<CurrentGroupContextValue | null>(null)

export const CurrentGroupProvider = ({ children }: { children: ReactNode }) => {
  const t = useUiText()
  const auth = useAuthStore()
  const location = useLocation()
  const groupContextEnabled = !isAuthOptionalLocation(location)
  const [CurrentGroup, setCurrentGroup] = useState<GroupDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const tRef = useRef(t)

  useEffect(() => {
    tRef.current = t
  }, [t])

  useEffect(() => {
    if (!groupContextEnabled) {
      setCurrentGroup(null)
      setLoading(false)
      setError('')
      return
    }

    const activeGroupId = activeEntityService.getAll().groupId

    if (!activeGroupId || auth.isGuest) {
      setCurrentGroup(null)
      setLoading(false)
      setError('')
      return
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
  }, [auth.isGuest, auth.me?.id, groupContextEnabled])

  const value = useMemo<CurrentGroupContextValue>(
    () => ({
      CurrentGroup,
      loading,
      error,
      setCurrentGroup,
    }),
    [CurrentGroup, error, loading],
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
