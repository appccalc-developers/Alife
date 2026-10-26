import { normalizeIdentityReturnPath } from '../../services/identityPathPolicy.ts'
import { isVirtualChurchSceneLocation } from './publicRoutePolicy.ts'

type VirtualChurchBuildEnvironment = {
  DEV: boolean
  VITE_VIRTUAL_CHURCH_PUBLIC_ACCESS?: string
  VITE_VIRTUAL_CHURCH_VISUAL_DEFAULT?: string
}

// A production guest route must never expose the still-default V2 experience.
// Keep publication opt-in until the V3 visual, device, performance and asset gates pass.
export const allowsVirtualChurchGuestVisit = (environment: VirtualChurchBuildEnvironment) =>
  environment.DEV || (
    environment.VITE_VIRTUAL_CHURCH_PUBLIC_ACCESS === 'enabled'
    && environment.VITE_VIRTUAL_CHURCH_VISUAL_DEFAULT === 'v3'
  )

export const isVirtualChurchStudyRoomReading = (search: string) =>
  new URLSearchParams(search).get('from') === 'virtual-church-study-room'

export const virtualChurchGuestVisitEnabled = () => allowsVirtualChurchGuestVisit(import.meta.env)

/** An old member-only PWA may already have redirected the visitor to
 * onboarding before a public release replaces its controller. Recover only
 * that now-public scene intent, never an identity flow or a private target. */
export const resolveVirtualChurchGuestReturn = (search: string, guestVisitEnabled: boolean) => {
  if (!guestVisitEnabled) return ''
  const params = new URLSearchParams(search)
  // Match buildOnboardingLocation's exact shape. Application IDs, LINE
  // callbacks and future identity parameters must stay in their own flow.
  if (params.getAll('returnTo').length !== 1 || Array.from(params.keys()).some(key => key !== 'returnTo')) return ''
  const target = normalizeIdentityReturnPath(params.get('returnTo'))
  const pathname = target.split(/[?#]/, 1)[0]
  return isVirtualChurchSceneLocation({ pathname, search: '' }) ? target : ''
}
