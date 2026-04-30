import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { groupService } from '../services/groupService'
import type { GroupDto } from '../types'

type CurrentGroupContextValue = {
  CurrentGroup: GroupDto | null
  loading: boolean
  error: string
  setCurrentGroup: (group: GroupDto | null) => void
  refreshChurchGroup: () => Promise<GroupDto | null>
}

const CurrentGroupContext = createContext<CurrentGroupContextValue | null>(null)

export const CurrentGroupProvider = ({ children }: { children: ReactNode }) => {
  const [CurrentGroup, setCurrentGroup] = useState<GroupDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refreshChurchGroup = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const church = await groupService.getChurch()
      setCurrentGroup(church)
      return church
    } catch {
      setError('Failed to load the Church group.')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshChurchGroup().catch(() => undefined)
  }, [refreshChurchGroup])

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
