import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import type { Language } from '../../i18n/locale'
import type { EventSurfaceKey, EventWorkspaceItem } from '../../types/eventComposition'
import AppBadge from '../layout/AppBadge'
import AppEmptyState from '../layout/AppEmptyState'
import AppSectionCard from '../layout/AppSectionCard'
import { resolveEventSurface } from './eventSurfaceRegistry'
import { EventProgrammePanel, EventRosterWorkspace, EventTeamPanel } from './EventOperationsSurfaces'
import { EventVenueWorkspaceSurface } from './EventVenueWorkspace'
import { EventTravelWorkspaceSurface } from './EventTravelWorkspace'
import { EventSafeguardingWorkspaceSurface } from './EventSafeguardingWorkspace'

export type EventSurfaceProps = {
  item: EventWorkspaceItem
  language: Language
  eventBasePath: string
  eventId: string
  groupId: string
  canManage: boolean
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
        ? '此工作区由已接受的方案启用。只有注册表中的本地组件可以显示。'
        : 'This workspace is enabled by the accepted plan. Only locally registered components can render.'}
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

const RegistrationSurface = (props: EventSurfaceProps) => (
  <AppSectionCard
    title={localize(props.item, props.language)}
    subtitle={props.language === 'zh' ? '沿用现有报名、容量与参与者隐私控制。' : 'Uses the existing enrollment, capacity and participant privacy controls.'}
    action={<AppBadge variant={props.item.readiness === 'ready' ? 'success' : 'warning'}>{props.item.readiness}</AppBadge>}
  >
    <Link className="text-sm font-bold text-[#176b5a] underline-offset-4 hover:underline" to={`${props.eventBasePath}?section=enrollments`}>
      {props.language === 'zh' ? '打开报名管理' : 'Open enrollment management'}
    </Link>
  </AppSectionCard>
)

const RamSurface = (props: EventSurfaceProps) => (
  <AppSectionCard
    title={localize(props.item, props.language)}
    subtitle={props.language === 'zh' ? '沿用既有 RAM 草稿、提交与独立批准流程。' : 'Uses the existing RAM draft, submission and independent approval flow.'}
    action={<AppBadge variant={props.item.readiness === 'ready' ? 'success' : 'warning'}>{props.item.readiness}</AppBadge>}
  >
    <Link className="text-sm font-bold text-[#176b5a] underline-offset-4 hover:underline" to={`${props.eventBasePath}/edit?step=ram`}>
      {props.language === 'zh' ? '打开 RAM 工作区' : 'Open RAM workspace'}
    </Link>
  </AppSectionCard>
)

// This map is deliberately closed at build time. Neither API data nor AI output
// can supply an import path, component name, URL or executable definition.
const surfaceComponentRegistry: Readonly<Record<EventSurfaceKey, ComponentType<EventSurfaceProps>>> = Object.freeze({
  'workspace.overview': GenericSurface,
  'workspace.governance': GenericSurface,
  'team.work': EventTeamPanel,
  'people.registration': RegistrationSurface,
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
