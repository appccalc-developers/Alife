const EVENT_SESSION_STORAGE_KEY = 'alife-event-planning-session-id'

const hasWindow = () => typeof window !== 'undefined'

export const eventPlanningSessionService = {
  getSessionId(memberId?: string) {
    if (memberId) {
      return `member-${memberId}-event-draft`
    }

    if (!hasWindow()) {
      return crypto.randomUUID()
    }

    const existing = window.localStorage.getItem(EVENT_SESSION_STORAGE_KEY)
    if (existing) {
      return existing
    }

    const next = crypto.randomUUID()
    window.localStorage.setItem(EVENT_SESSION_STORAGE_KEY, next)
    return next
  },
}
