export const dutyReturnPath = (value: string | null | undefined) => {
  if (!value) return '/tasks?type=urgent'
  return /^\/tasks(?:\?[^#]*)?$/.test(value) || value === '/profile' ? value : '/tasks?type=urgent'
}

export const withDutyReturn = (url: string, returnTo: string) =>
  `${url}${url.includes('?') ? '&' : '?'}returnTo=${encodeURIComponent(dutyReturnPath(returnTo))}`
