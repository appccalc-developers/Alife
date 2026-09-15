let activeMessage = ''
let activeMode: UnsavedChangesGuardMode = 'alert'
const guards = new Map<string, { message: string; mode: UnsavedChangesGuardMode }>()

export type UnsavedChangesGuardMode = 'alert' | 'confirm'

export type UnsavedChangesPrompt = {
  message: string
  mode: UnsavedChangesGuardMode
  onConfirm?: () => void
}

type UnsavedChangesPromptListener = (prompt: UnsavedChangesPrompt) => void

const promptListeners = new Set<UnsavedChangesPromptListener>()

export const setUnsavedChangesGuard = (active: boolean, message = '', mode: UnsavedChangesGuardMode = 'alert', scope = 'default') => {
  if (active) guards.set(scope, { message, mode }); else guards.delete(scope)
  const current = [...guards.values()]
  activeMessage = current.map(g => g.message).filter(Boolean).join('\n')
  activeMode = current.some(g => g.mode === 'alert') ? 'alert' : 'confirm'
}

export const hasUnsavedChangesGuard = () => activeMessage.length > 0

const isCurrentLocationTarget = (target?: string) => {
  if (target) {
    try {
      const nextUrl = new URL(target, window.location.href)
      const currentUrl = new URL(window.location.href)
      if (
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search &&
        nextUrl.hash === currentUrl.hash
      ) {
        return true
      }
    } catch {
      // Invalid navigation targets should still fall through to the confirmation.
    }
  }

  return false
}

export const subscribeUnsavedChangesPrompt = (listener: UnsavedChangesPromptListener) => {
  promptListeners.add(listener)
  return () => {
    promptListeners.delete(listener)
  }
}

export const confirmUnsavedChangesNavigation = (target?: string, onConfirm?: () => void) => {
  if (!activeMessage || isCurrentLocationTarget(target)) {
    return true
  }

  const prompt = { message: activeMessage, mode: activeMode, onConfirm }
  promptListeners.forEach((listener) => listener(prompt))
  return false
}
