import { useEffect, useState } from 'react'
import type { VirtualChurchVisualVersion } from '../services/virtualChurchService'
import {
  VIRTUAL_CHURCH_CHARACTER_FALLBACK_ATTRIBUTE,
  VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE,
  VIRTUAL_CHURCH_CHURCH_FALLBACK_ATTRIBUTE,
  VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE,
} from './virtualChurchRuntimeSignals'
import {
  virtualChurchRuntimeStatus,
  type VirtualChurchRuntimeStatus,
} from './virtualChurchStatusContract'

const readyAttributeIsFinite = (root: Element, attribute: string) => {
  const value = root.getAttribute(attribute)
  return value !== null && Number.isFinite(Number(value))
}

export const useVirtualChurchRuntimeStatus = (
  enabled: boolean,
  visualVersion: VirtualChurchVisualVersion,
) => {
  const [state, setState] = useState<{
    status: VirtualChurchRuntimeStatus; characterFallback: boolean; characterReady: boolean
  }>({ status: 'idle', characterFallback: false, characterReady: false })

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle', characterFallback: false, characterReady: false })
      return
    }

    const root = document.documentElement
    const updateStatus = () => {
      const characterFallback = root.getAttribute(VIRTUAL_CHURCH_CHARACTER_FALLBACK_ATTRIBUTE) === 'true'
      const characterReady = readyAttributeIsFinite(root, VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE)
      const status = virtualChurchRuntimeStatus({
        enabled: true,
        visualVersion,
        entranceReady: readyAttributeIsFinite(
          root,
          VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE,
        ),
        characterReady,
        churchFallback:
          root.getAttribute(VIRTUAL_CHURCH_CHURCH_FALLBACK_ATTRIBUTE) === 'true',
        characterFallback,
      })
      setState(previous => previous.status === status
        && previous.characterFallback === characterFallback && previous.characterReady === characterReady
        ? previous : { status, characterFallback, characterReady })
    }
    const observer = new MutationObserver(updateStatus)
    observer.observe(root, {
      attributes: true,
      attributeFilter: [
        VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE,
        VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE,
        VIRTUAL_CHURCH_CHURCH_FALLBACK_ATTRIBUTE,
        VIRTUAL_CHURCH_CHARACTER_FALLBACK_ATTRIBUTE,
      ],
    })
    updateStatus()

    return () => observer.disconnect()
  }, [enabled, visualVersion])

  return state
}
