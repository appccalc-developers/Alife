import { useCallback, useEffect, useState } from 'react'

export type LeaderUiPreferences = {
  exerciseGroupManagement: boolean
  exercisePageEditing: boolean
}

const DEFAULT_PREFERENCES: LeaderUiPreferences = {
  exerciseGroupManagement: true,
  exercisePageEditing: true,
}

const STORAGE_KEY_PREFIX = 'alife:leader-ui-preferences:'
const PREFERENCES_CHANGED_EVENT = 'alife-leader-ui-preferences-changed'

const storageKey = (memberId: string) => `${STORAGE_KEY_PREFIX}${memberId}`

const readPreferences = (memberId?: string | null): LeaderUiPreferences => {
  if (!memberId || typeof window === 'undefined') {
    return DEFAULT_PREFERENCES
  }

  try {
    const raw = window.localStorage.getItem(storageKey(memberId))
    if (!raw) {
      return DEFAULT_PREFERENCES
    }

    const parsed = JSON.parse(raw) as Partial<LeaderUiPreferences>

    return {
      exerciseGroupManagement: typeof parsed.exerciseGroupManagement === 'boolean'
        ? parsed.exerciseGroupManagement
        : DEFAULT_PREFERENCES.exerciseGroupManagement,
      exercisePageEditing: typeof parsed.exercisePageEditing === 'boolean'
        ? parsed.exercisePageEditing
        : DEFAULT_PREFERENCES.exercisePageEditing,
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

const writePreferences = (memberId: string, preferences: LeaderUiPreferences) => {
  window.localStorage.setItem(storageKey(memberId), JSON.stringify(preferences))
  window.dispatchEvent(new CustomEvent(PREFERENCES_CHANGED_EVENT, { detail: { memberId } }))
}

export const useLeaderUiPreferences = (memberId?: string | null) => {
  const [preferences, setPreferences] = useState<LeaderUiPreferences>(() => readPreferences(memberId))

  useEffect(() => {
    setPreferences(readPreferences(memberId))
  }, [memberId])

  useEffect(() => {
    if (!memberId || typeof window === 'undefined') {
      return
    }

    const refresh = (event?: Event) => {
      const customEvent = event as CustomEvent<{ memberId?: string }> | undefined
      if (customEvent?.detail?.memberId && customEvent.detail.memberId !== memberId) {
        return
      }

      setPreferences(readPreferences(memberId))
    }

    window.addEventListener(PREFERENCES_CHANGED_EVENT, refresh)
    window.addEventListener('storage', refresh)

    return () => {
      window.removeEventListener(PREFERENCES_CHANGED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [memberId])

  const updatePreferences = useCallback(
    (next: LeaderUiPreferences | ((current: LeaderUiPreferences) => LeaderUiPreferences)) => {
      if (!memberId || typeof window === 'undefined') {
        return
      }

      const nextPreferences = typeof next === 'function' ? next(readPreferences(memberId)) : next
      writePreferences(memberId, nextPreferences)
      setPreferences(nextPreferences)
    },
    [memberId],
  )

  return {
    preferences,
    setPreferences: updatePreferences,
  }
}
