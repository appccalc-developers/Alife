import type { VirtualChurchVisualVersion } from '../services/virtualChurchService'

export type VirtualChurchRuntimeStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'degraded'

export const virtualChurchShouldCoverLoadingScene = (
  visualVersion: VirtualChurchVisualVersion,
  enabled: boolean,
  status: VirtualChurchRuntimeStatus,
): boolean => visualVersion === 'v3' && enabled && (status === 'idle' || status === 'loading')

// Match the visible loading cover: do not let V3 visitors move a hidden
// character. Compatibility mode remains explorable; V2 keeps its old behavior.
export const virtualChurchPlayerInputEnabled = (
  visualVersion: VirtualChurchVisualVersion,
  enabled: boolean,
  status: VirtualChurchRuntimeStatus,
  dialogOpen: boolean,
): boolean => enabled && !dialogOpen && !virtualChurchShouldCoverLoadingScene(visualVersion, enabled, status)

export type VirtualChurchRuntimeStatusSignals = {
  enabled: boolean
  visualVersion: VirtualChurchVisualVersion
  entranceReady: boolean
  characterReady: boolean
  churchFallback: boolean
  characterFallback: boolean
}

export const virtualChurchRuntimeStatus = ({
  enabled,
  entranceReady,
  characterReady,
  churchFallback,
  characterFallback,
}: VirtualChurchRuntimeStatusSignals): VirtualChurchRuntimeStatus => {
  if (!enabled) return 'idle'
  const heroReady = entranceReady && characterReady
  if (!heroReady) return 'loading'
  if (churchFallback || characterFallback) {
    return 'degraded'
  }
  return 'ready'
}
