import type { EventSafeguardingChild, EventSafeguardingReadiness } from '../types/eventSafeguarding'

export const safeguardingReadinessItems = (value: EventSafeguardingReadiness) => [
  { code: 'current-policy-loaded', ready: value.currentPolicyLoaded },
  { code: 'guardianship-complete', ready: value.guardianshipComplete },
  { code: 'eligible-workers-and-policy-ratios-satisfied', ready: value.eligibleWorkersSatisfied },
] as const

export const filterSafeguardingChildren = (children: EventSafeguardingChild[], query: string) => {
  const normalized = query.trim().toLocaleLowerCase()
  return normalized ? children.filter((child) => child.displayName.toLocaleLowerCase().includes(normalized)) : children
}

export const safeguardingChildState = (child: EventSafeguardingChild) =>
  child.attendance?.state === 'present' ? 'present' as const
    : child.attendance?.state === 'checkedOut' ? 'checked-out' as const
      : 'not-checked-in' as const

export const resolveSafeguardingLoadFailure = (status?: number) => status === 403 ? 'permission-denied' as const : 'error' as const
export const resolveSafeguardingMutationFailure = (status?: number) =>
  status === 412 ? 'stale' as const : status === 409 ? 'conflict' as const : 'error' as const
