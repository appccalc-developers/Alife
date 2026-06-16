let activeMessage = ''

export const setUnsavedChangesGuard = (active: boolean, message = '') => {
  activeMessage = active ? message : ''
}

export const hasUnsavedChangesGuard = () => activeMessage.length > 0

export const confirmUnsavedChangesNavigation = (target?: string) => {
  if (!activeMessage) {
    return true
  }

  if (target) {
    const nextUrl = new URL(target, window.location.href)
    const currentUrl = new URL(window.location.href)
    if (
      nextUrl.pathname === currentUrl.pathname &&
      nextUrl.search === currentUrl.search &&
      nextUrl.hash === currentUrl.hash
    ) {
      return true
    }
  }

  window.alert(activeMessage)
  return false
}
