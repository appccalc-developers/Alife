export const VIRTUAL_CHURCH_PROFILE_ATTRIBUTE = 'data-virtual-church-profile'
export const VIRTUAL_CHURCH_SAMPLING_ATTRIBUTE = 'data-virtual-church-sampling'
export const VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE = 'data-virtual-church-hero-ready-ms'
export const VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE = 'data-virtual-church-character-ready-ms'
export const VIRTUAL_CHURCH_CHARACTER_ACTION_ATTRIBUTE = 'data-virtual-church-character-action'
export const VIRTUAL_CHURCH_INPUT_DIAGNOSTIC_PHASE_ATTRIBUTE = 'data-virtual-church-input-diagnostic-phase'
export const VIRTUAL_CHURCH_CONTINUOUS_TIMING_ATTRIBUTE = 'data-virtual-church-continuous-timing'
export const VIRTUAL_CHURCH_PLAYER_POSE_ATTRIBUTE = 'data-virtual-church-player-pose'
export const VIRTUAL_CHURCH_CHURCH_FALLBACK_ATTRIBUTE = 'data-virtual-church-church-fallback'
export const VIRTUAL_CHURCH_CHARACTER_FALLBACK_ATTRIBUTE = 'data-virtual-church-character-fallback'
export const VIRTUAL_CHURCH_CHARACTER_ASSET_ATTRIBUTE = 'data-virtual-church-character-asset'
export const VIRTUAL_CHURCH_CHARACTER_RESOURCE_ATTRIBUTE = 'data-virtual-church-character-resource'

export const VIRTUAL_CHURCH_TRANSIENT_ATTRIBUTES = [
  VIRTUAL_CHURCH_PROFILE_ATTRIBUTE,
  VIRTUAL_CHURCH_SAMPLING_ATTRIBUTE,
  VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE,
  VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE,
  VIRTUAL_CHURCH_CHARACTER_ACTION_ATTRIBUTE,
  VIRTUAL_CHURCH_INPUT_DIAGNOSTIC_PHASE_ATTRIBUTE,
  VIRTUAL_CHURCH_CONTINUOUS_TIMING_ATTRIBUTE,
  VIRTUAL_CHURCH_PLAYER_POSE_ATTRIBUTE,
  VIRTUAL_CHURCH_CHURCH_FALLBACK_ATTRIBUTE,
  VIRTUAL_CHURCH_CHARACTER_FALLBACK_ATTRIBUTE,
  VIRTUAL_CHURCH_CHARACTER_ASSET_ATTRIBUTE,
  VIRTUAL_CHURCH_CHARACTER_RESOURCE_ATTRIBUTE,
] as const

type RuntimeSignalRoot = Pick<Element, 'getAttribute' | 'removeAttribute'>

const defaultRuntimeSignalRoot = () => document.documentElement

type DiagnosticRoot = RuntimeSignalRoot & Pick<Element, 'setAttribute'>
const characterDiagnosticOwners = new WeakMap<DiagnosticRoot, object>()

/** Deferred resource releases must not recreate diagnostics after Canvas exit. */
export const beginVirtualChurchCharacterDiagnosticScope = (
  root: DiagnosticRoot = defaultRuntimeSignalRoot(),
) => {
  const owner = {}
  characterDiagnosticOwners.set(root, owner)
  return {
    write: (update: (root: DiagnosticRoot) => void) => {
      if (characterDiagnosticOwners.get(root) !== owner) return
      update(root)
    },
    dispose: () => {
      // A late cleanup from an old Canvas cannot erase its replacement's data.
      if (characterDiagnosticOwners.get(root) !== owner) return
      characterDiagnosticOwners.delete(root)
      root.removeAttribute(VIRTUAL_CHURCH_CHARACTER_ASSET_ATTRIBUTE)
      root.removeAttribute(VIRTUAL_CHURCH_CHARACTER_RESOURCE_ATTRIBUTE)
    },
  }
}

/** User-triggered only: the missing ready signal also guards double activation. */
export const beginVirtualChurchCharacterRetry = (
  root: RuntimeSignalRoot = defaultRuntimeSignalRoot(),
) => {
  const ready = root.getAttribute(VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE)
  if (root.getAttribute(VIRTUAL_CHURCH_CHARACTER_FALLBACK_ATTRIBUTE) !== 'true'
    || ready === null || !Number.isFinite(Number(ready))) return false
  root.removeAttribute(VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE)
  root.removeAttribute(VIRTUAL_CHURCH_CHARACTER_ACTION_ATTRIBUTE)
  return true
}

/** Call only after the real asset has submitted a visible, successful frame. */
export const markVirtualChurchRenderedAssetReady = (
  attribute: string,
  readyMs: number,
  root: Pick<Element, 'setAttribute' | 'removeAttribute'> = defaultRuntimeSignalRoot(),
) => {
  if (!Number.isFinite(readyMs) || readyMs < 0) throw new Error('Invalid rendered asset readiness time')
  root.setAttribute(attribute, readyMs.toFixed(1))
  // A recovered character must not erase an unrelated church failure (or vice
  // versa). Mounting/loading alone is not evidence that compatibility ended.
  if (attribute === VIRTUAL_CHURCH_CHARACTER_READY_ATTRIBUTE) root.removeAttribute(VIRTUAL_CHURCH_CHARACTER_FALLBACK_ATTRIBUTE)
  if (attribute === VIRTUAL_CHURCH_HERO_READY_ATTRIBUTE) root.removeAttribute(VIRTUAL_CHURCH_CHURCH_FALLBACK_ATTRIBUTE)
}

export const clearVirtualChurchRuntimeSignals = (
  root: RuntimeSignalRoot = defaultRuntimeSignalRoot(),
) => {
  VIRTUAL_CHURCH_TRANSIENT_ATTRIBUTES.forEach((attribute) => {
    root.removeAttribute(attribute)
  })
}

export const readVirtualChurchFallbackSignals = (
  root: RuntimeSignalRoot = defaultRuntimeSignalRoot(),
) => ({
  church: root.getAttribute(VIRTUAL_CHURCH_CHURCH_FALLBACK_ATTRIBUTE) === 'true',
  character: root.getAttribute(VIRTUAL_CHURCH_CHARACTER_FALLBACK_ATTRIBUTE) === 'true',
})
