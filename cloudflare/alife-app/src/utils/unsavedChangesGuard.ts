let activeMessage = ''
let activeMode: UnsavedChangesGuardMode = 'alert'

export type UnsavedChangesGuardMode = 'alert' | 'confirm'

export type UnsavedChangesPrompt = {
  message: string
  mode: UnsavedChangesGuardMode
  onConfirm?: () => void
}

type UnsavedChangesPromptListener = (prompt: UnsavedChangesPrompt) => void

const promptListeners = new Set<UnsavedChangesPromptListener>()

export const setUnsavedChangesGuard = (active: boolean, message = '', mode: UnsavedChangesGuardMode = 'alert') => {
  activeMessage = active ? message : ''
  activeMode = active ? mode : 'alert'
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
