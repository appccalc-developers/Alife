import { eventSurfaceRendererText } from '../../i18n/eventSurfaceRenderer.ts'
import type { ComponentType } from 'react'
import EventRegistrationWorkspace from './EventRegistrationWorkspace'
import type { Language } from '../../i18n/locale'
import type { EventSurfaceKey, EventWorkspaceItem } from '../../types/eventComposition'
import AppBadge from '../layout/AppBadge'
import { Link } from 'react-router-dom'
import EventCapabilityNotice, { capabilityStatusText, useEventCapabilities } from './EventCapabilityNotice'
import { EventToolSection as AppSectionCard } from './ArrangementTileDeck'
import { resolveEventSurface } from './eventSurfaceRegistry'
import { EventProgrammePanel, EventRosterWorkspace, EventTeamPanel } from './EventOperationsSurfaces'
import { EventVenueWorkspaceSurface } from './EventVenueWorkspace'
import { EventTravelWorkspaceSurface } from './EventTravelWorkspace'
import EventRamWorkspace from './EventRamWorkspace'
import { EventSafeguardingWorkspaceSurface } from './EventSafeguardingWorkspace'

export type EventSurfaceProps = {
  item: EventWorkspaceItem
  language: Language
  eventBasePath: string
  eventId: string
  groupId: string
  canManage: boolean
  onBusyChange?: (busy: boolean) => void
  onSaved?: () => Promise<void>
  setupFlow?: boolean
  moduleSelections?: Record<string, boolean>
  planRevision?: string
}

const localize = (item: EventWorkspaceItem, language: Language) =>
  item.label[language] || item.label.en || item.label.zh

const GenericSurface = ({ item, language, eventBasePath }: EventSurfaceProps) => {
  const zh = language === 'zh'
  const title = localize(item, language)
  const capability = useEventCapabilities().find(x => x.moduleCode === item.moduleCode)
  return (
    <AppSectionCard
      title={title}
      subtitle={zh
        ? eventSurfaceRendererText.reviewAvailableCapabilitiesAndOutstandingWork.zh
        : eventSurfaceRendererText.reviewAvailableCapabilitiesAndOutstandingWork.en}
      action={<AppBadge variant="warning">{capability ? capabilityStatusText(capability.status, zh) : (zh ? eventSurfaceRendererText.preparation.zh : eventSurfaceRendererText.preparation.en)}</AppBadge>}
    >
      <EventCapabilityNotice code={item.moduleCode || ''} zh={zh} />
      {item.blockers.length ? (
        <ul className="space-y-2 text-sm text-amber-900" aria-label={zh ? eventSurfaceRendererText.blockers.zh : eventSurfaceRendererText.blockers.en}>
          {item.blockers.map((blocker, index) => (
            <li key={`${blocker.en}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              {blocker[language] || blocker.en || blocker.zh}
            </li>
          ))}
        </ul>
      ) : null}
      {item.moduleCode === 'COMMS.FOLLOWUP' ? <p className="mt-3 text-sm"><Link className="inline-flex min-h-11 items-center text-[#176b5a] underline" to={`${eventBasePath}/workspace?flow=setup&stage=poster`}>{zh ? eventSurfaceRendererText.posterPreparationAfterApproval.zh : eventSurfaceRendererText.posterPreparationAfterApproval.en}</Link><br /><Link className="inline-flex min-h-11 items-center text-[#176b5a] underline" to={`${eventBasePath}/workspace?flow=setup&stage=publish`}>{zh ? eventSurfaceRendererText.publicationChecks.zh : eventSurfaceRendererText.publicationChecks.en}</Link></p> : null}
    </AppSectionCard>
  )
}

const RamSurface = ({ eventId, language }: EventSurfaceProps) => (
  <EventRamWorkspace key={eventId} eventId={eventId} language={language} />
)

// This map is deliberately closed at build time. Neither API data nor AI output
// can supply an import path, component name, URL or executable definition.
const surfaceComponentRegistry: Readonly<Record<EventSurfaceKey, ComponentType<EventSurfaceProps>>> = Object.freeze({
  'workspace.overview': GenericSurface,
  'workspace.governance': GenericSurface,
  'team.work': EventTeamPanel,
  'people.registration': EventRegistrationWorkspace,
  'service.roster': EventRosterWorkspace,
  'money.finance': GenericSurface,
  'safety.ram': RamSurface,
  'safeguarding.child': EventSafeguardingWorkspaceSurface,
  'program.production': EventProgrammePanel,
  'place.resource': EventVenueWorkspaceSurface,
  'move.stay': EventTravelWorkspaceSurface,
  'food.hospitality': GenericSurface,
  'festival.operations': GenericSurface,
  'comms.followup': GenericSurface,
})

export const resolveEventSurfaceComponent = (surfaceKey: string): ComponentType<EventSurfaceProps> | null => {
  const definition = resolveEventSurface(surfaceKey)
  return definition ? surfaceComponentRegistry[definition.surfaceKey] : null
}

export const EventSurfaceRenderer = (props: EventSurfaceProps) => {
  const Component = resolveEventSurfaceComponent(props.item.surfaceKey)
  if (!Component) {
    return null
  }
  return <Component {...props} />
}
