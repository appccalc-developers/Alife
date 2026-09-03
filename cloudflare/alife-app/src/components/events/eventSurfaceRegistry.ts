import type { EventSurfaceKey } from '../../types/eventComposition'

export type EventSurfaceRegistryEntry = {
  surfaceKey: EventSurfaceKey
  presentation: 'tab' | 'page'
  sectionKey?: string
  pathSegment?: string
  componentContract: string
}

const entries = [
  ['workspace.overview', 'tab', 'overview', undefined, 'EventWorkspaceOverview'],
  ['workspace.governance', 'tab', 'governance', undefined, 'EventPackageGovernanceWorkspace'],
  ['team.work', 'tab', 'team', undefined, 'EventTeamPanel'],
  ['people.registration', 'page', undefined, 'registration', 'EventRegistrationWorkspace'],
  ['service.roster', 'page', undefined, 'roster', 'EventRosterWorkspace'],
  ['money.finance', 'page', undefined, 'finance', 'EventFinanceWorkspace'],
  ['safety.ram', 'page', undefined, 'ram', 'EventRamWorkspace'],
  ['safeguarding.child', 'page', undefined, 'safeguarding', 'EventSafeguardingWorkspace'],
  ['program.production', 'tab', 'programme', undefined, 'EventProgrammePanel'],
  ['place.resource', 'tab', 'resources', undefined, 'EventVenueWorkspaceSurface'],
  ['move.stay', 'page', undefined, 'travel', 'EventTravelWorkspace'],
  ['food.hospitality', 'tab', 'hospitality', undefined, 'EventHospitalityPanel'],
  ['festival.operations', 'page', undefined, 'operations', 'EventOperationsWorkspace'],
  ['comms.followup', 'page', undefined, 'follow-up', 'EventFollowupWorkspace'],
] as const satisfies ReadonlyArray<readonly [EventSurfaceKey, 'tab' | 'page', string | undefined, string | undefined, string]>

export const eventSurfaceRegistry = Object.freeze(Object.fromEntries(entries.map(([
  surfaceKey,
  presentation,
  sectionKey,
  pathSegment,
  componentContract,
]) => [surfaceKey, Object.freeze({ surfaceKey, presentation, sectionKey, pathSegment, componentContract })])) as Record<EventSurfaceKey, EventSurfaceRegistryEntry>)

export const resolveEventSurface = (surfaceKey: string): EventSurfaceRegistryEntry | null =>
  Object.prototype.hasOwnProperty.call(eventSurfaceRegistry, surfaceKey)
    ? eventSurfaceRegistry[surfaceKey as EventSurfaceKey]
    : null

export const resolveEventSurfacePath = (pathSegment: string): EventSurfaceRegistryEntry | null =>
  Object.values(eventSurfaceRegistry).find((entry) => entry.pathSegment === pathSegment) ?? null
