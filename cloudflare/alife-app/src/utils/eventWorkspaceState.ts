import type { EventFactInput } from '../types/eventComposition'

export type WorkspaceLoadState = 'ready' | 'error' | 'permission-denied'
export type WorkspaceMutationFailureState = 'stale' | 'conflict' | 'error'

const serverControlledFactCodes = new Set(['event.exists'])

export const omitServerControlledEventFacts = (
  facts: readonly EventFactInput[],
): EventFactInput[] => facts.filter((fact) => !serverControlledFactCodes.has(fact.code))

export const resolveWorkspaceLoadFailure = (status?: number): WorkspaceLoadState =>
  status === 403 ? 'permission-denied' : 'error'

export const resolveWorkspaceMutationFailure = (status?: number): WorkspaceMutationFailureState =>
  status === 412 ? 'stale' : status === 409 ? 'conflict' : 'error'
