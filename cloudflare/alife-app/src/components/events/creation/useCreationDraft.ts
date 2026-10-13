import { useEffect, useState } from 'react'
import type { EventArchetype } from '../../../types/eventComposition'
import { initialCreationDraft, retiredCreationDraftKeys, restoreCreationDraft, type CreationDraft } from '../../../utils/eventCreationDraft'

export const useCreationDraft = (key: string, archetypes: EventArchetype[], catalogueReady: boolean) => {
  const [draft, setDraft] = useState<CreationDraft>(initialCreationDraft)
  const [hydrated, setHydrated] = useState(false)
  const [storageWarning, setStorageWarning] = useState(false)
  useEffect(() => {
    if (!catalogueReady || hydrated) return
    try {
      const suffix = key.slice('alife:event-create:v3:'.length)
      const parts = suffix.split(':')
      if (key.startsWith('alife:event-create:v3:') && parts.length === 2) {
        retiredCreationDraftKeys(parts[0], parts[1]).forEach(retiredKey => localStorage.removeItem(retiredKey))
      }
      const raw = localStorage.getItem(key)
      if (raw) {
        const restored = restoreCreationDraft(raw, archetypes)
        if (restored) setDraft(restored)
        else setStorageWarning(true)
      }
    } catch { setStorageWarning(true) }
    setHydrated(true)
  }, [archetypes, catalogueReady, hydrated, key])
  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(key, JSON.stringify({ version: 5, draft })) }
    catch { setStorageWarning(true) }
  }, [draft, hydrated, key])
  return { draft, setDraft, hydrated, storageWarning }
}
