const NON_RETURNABLE = [
  '/onboarding',
  '/internal/alpha-login',
]

export const normalizeIdentityReturnPath = (value: string | null | undefined) => {
  const candidate = value?.trim() ?? ''
  if (
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return ''
  }

  const pathname = candidate.split(/[?#]/, 1)[0].toLowerCase()
  if (
    NON_RETURNABLE.includes(pathname) ||
    pathname.startsWith('/onboarding/') ||
    pathname.startsWith('/activate/') ||
    pathname.startsWith('/join/') ||
    pathname.startsWith('/application/')
  ) {
    return ''
  }

  return candidate
}

export const buildOnboardingLocation = (returnPath: string) => {
  const safe = normalizeIdentityReturnPath(returnPath)
  return safe ? `/onboarding?returnTo=${encodeURIComponent(safe)}` : '/onboarding'
}
