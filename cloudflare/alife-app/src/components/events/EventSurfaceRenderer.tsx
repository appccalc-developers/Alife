import type { ComponentType } from 'react'
import EventRegistrationWorkspace from './EventRegistrationWorkspace'
import type { Language } from '../../i18n/locale'
import type { EventSurfaceKey, EventWorkspaceItem } from '../../types/eventComposition'
import AppBadge from '../layout/AppBadge'
import AppEmptyState from '../layout/AppEmptyState'
import AppSectionCard from '../layout/AppSectionCard'
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
}

const localize = (item: EventWorkspaceItem, language: Language) =>
  item.label[language] || item.label.en || item.label.zh

const GenericSurface = ({ item, language }: EventSurfaceProps) => {
  const zh = language === 'zh'
  const title = localize(item, language)
  return (
    <AppSectionCard
      title={title}
      subtitle={zh
        ? '此功能已纳入活动安排，可在这里核对准备情况。'
        : 'This tool is included in event arrangements. Review its readiness here.'}
      action={<AppBadge variant={item.readiness === 'ready' ? 'success' : 'warning'}>{item.readiness}</AppBadge>}
    >
      {item.blockers.length ? (
        <ul className="space-y-2 text-sm text-amber-900" aria-label={zh ? '阻塞项' : 'Blockers'}>
          {item.blockers.map((blocker, index) => (
            <li key={`${blocker.en}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              {blocker[language] || blocker.en || blocker.zh}
            </li>
          ))}
        </ul>
      ) : (
        <AppEmptyState
          title={zh ? '模块已启用' : 'Module enabled'}
          description={zh
            ? '目前没有阻塞项。后续资料由现有工作流步骤与该模块的兼容整合逐步补齐。'
            : 'There are no current blockers. Existing workflow steps and the compatible module integration hold subsequent work.'}
        />
      )}
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
