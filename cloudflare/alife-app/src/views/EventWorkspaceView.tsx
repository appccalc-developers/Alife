import EventSetupPipeline from '../components/events/EventSetupPipeline'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { EventSurfaceRenderer } from '../components/events/EventSurfaceRenderer'
import { EventPackageFoundationPanel } from '../components/events/EventPackageFoundationPanel'
import { resolveEventSurface, resolveEventSurfacePath } from '../components/events/eventSurfaceRegistry'
import AppBadge from '../components/layout/AppBadge'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { eventCompositionService } from '../services/eventCompositionService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import type {
  EventArchetype,
  EventPlanSnapshot,
  EventWorkspace,
  LocalizedText,
} from '../types/eventComposition'
import { buildScopedEventDetailPath } from '../utils/eventRoutes'
import {
  resolveWorkspaceLoadFailure,
} from '../utils/eventWorkspaceState'

type LoadState = 'loading' | 'ready' | 'error' | 'permission-denied'
const copy = {
  en: {
    title: 'Event workspace',
    subtitle: 'Review readiness, enabled capabilities and the next accountable action.',
    loading: 'Loading event workspace…',
    retry: 'Try again',
    unavailable: 'Workspace unavailable',
    permissionTitle: 'Workspace access required',
    permissionDescription: 'You need approved group membership or an event-team role to view this workspace.',
    back: 'Back to event',
    readiness: 'Readiness',
    nextSteps: 'Next steps',
    enabledPages: 'Enabled workspaces',
    noPages: 'No independent module workspaces are enabled.',
    planTitle: 'Compose event plan',
    planSubtitle: 'Confirmed facts drive policy. Unknown values are never treated as false.',
    archetype: 'Composition preset',
    unknown: 'Unknown',
    yes: 'Yes',
    no: 'No',
    compose: 'Build proposal',
    recomposing: 'Building proposal…',
    review: 'Plan review',
    activeModules: 'Active modules',
    proposedChanges: 'Proposed changes',
    accept: 'Accept this plan',
    accepting: 'Accepting…',
    accepted: 'Plan accepted. The workspace now uses the new immutable snapshot.',
    stale: 'This proposal is stale. Refresh the workspace and review a new proposal.',
    conflict: 'The plan conflicts with existing operational data. Resolve the listed retirements before accepting.',
    proposalFailed: 'The proposal could not be completed.',
    secureRegistry: 'Unknown surface keys are ignored; API data never selects executable UI code.',
    currentPlan: 'Current plan',
    noPlan: 'No accepted plan yet',
    sponsorship: 'Sponsorship',
    reviewLegacy: 'This event uses a legacy backfill snapshot. Confirm its facts before relying on readiness.',
    independentPage: 'Independent workspace',
    backWorkspace: 'Back to event workspace',
    unknownSurface: 'Workspace not available',
    unknownSurfaceDescription: 'This surface is not in the local registry or is not enabled for your role.',
  },
  zh: {
    title: '活动工作区',
    subtitle: '查看准备度、已启用能力与下一项负责人行动。',
    loading: '正在加载活动工作区…',
    retry: '重试',
    unavailable: '无法使用工作区',
    permissionTitle: '需要工作区权限',
    permissionDescription: '你必须是获批小组成员或活动团队成员，才能查看此工作区。',
    back: '返回活动',
    readiness: '准备度',
    nextSteps: '下一步',
    enabledPages: '已启用工作区',
    noPages: '目前没有启用独立模块工作区。',
    planTitle: '组合活动方案',
    planSubtitle: '已确认事实驱动政策；未知值绝不会被当作否定。',
    archetype: '组合预设',
    unknown: '未知',
    yes: '是',
    no: '否',
    compose: '生成 proposal',
    recomposing: '正在生成 proposal…',
    review: '方案审查',
    activeModules: '启用模块',
    proposedChanges: '建议变更',
    accept: '接受此方案',
    accepting: '正在接受…',
    accepted: '方案已接受；工作区现在使用新的不可变快照。',
    stale: '此 proposal 已过期。请刷新工作区并审查新的 proposal。',
    conflict: '方案与既有运营资料冲突；接受前请先处理列出的停用项。',
    proposalFailed: '无法完成 proposal。',
    secureRegistry: '未知 surface key 会被忽略；API 数据绝不会选择可执行的 UI 代码。',
    currentPlan: '当前方案',
    noPlan: '尚无已接受方案',
    sponsorship: '教会身份批准',
    reviewLegacy: '此活动使用旧资料回填快照；依赖准备度前请先确认事实。',
    independentPage: '独立工作区',
    backWorkspace: '返回活动工作区',
    unknownSurface: '工作区不可用',
    unknownSurfaceDescription: '此 surface 不在本地注册表中，或未对你的角色启用。',
  },
} as const

const localize = (value: LocalizedText, language: 'en' | 'zh') =>
  value[language] || value.en || value.zh

const readinessVariant = (status: string) =>
  status === 'ready' ? 'success' as const : status === 'blocked' ? 'danger' as const : 'warning' as const

const EventWorkspaceView = () => {
  const { groupId: routeGroupId, eventId: routeEventId, surfacePath } = useParams<{
    groupId: string
    eventId: string
    surfacePath: string
  }>()
  const { groupId, eventId } = useActiveEntityIds({ groupId: routeGroupId, eventId: routeEventId })
  const { language } = useAuthStore()
  const text = copy[language]
  const [searchParams] = useSearchParams()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState('')
  const [workspace, setWorkspace] = useState<EventWorkspace | null>(null)
  const [plan, setPlan] = useState<EventPlanSnapshot | null>(null)
  const [archetypes, setArchetypes] = useState<EventArchetype[]>([])
  const explicitGroupRoute = Boolean(routeGroupId)
  const eventBasePath = groupId && eventId
    ? buildScopedEventDetailPath(groupId, eventId, explicitGroupRoute)
    : ''
  const workspaceBasePath = `${eventBasePath}/workspace`

  const load = useCallback(async () => {
    if (!eventId) return
    setLoadState('loading')
    setError('')
    try {
      const nextWorkspace = await eventCompositionService.getWorkspace(eventId)
      setWorkspace(nextWorkspace)
      if (nextWorkspace.canManage) {
        const [nextPlan, nextArchetypes] = await Promise.all([
          eventCompositionService.getPlan(eventId),
          eventCompositionService.listArchetypes(nextWorkspace.owningGroupId),
        ])
        setPlan(nextPlan)
        setArchetypes(nextArchetypes)
      }
      setLoadState('ready')
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setLoadState(resolveWorkspaceLoadFailure(apiError.status))
      setError(apiError.message)
    }
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  const resolvedItems = useMemo(() => (workspace?.items ?? [])
    .filter((item) => resolveEventSurface(item.surfaceKey) !== null)
    .sort((left, right) => left.order - right.order), [workspace?.items])
  const tabItems = resolvedItems.filter((item) => item.presentation === 'tab')
  const pageItems = resolvedItems.filter((item) => item.presentation === 'page')
  const selectedSection = searchParams.get('tab') || 'overview'
  const returnToRamSetup = surfacePath === 'ram' && searchParams.get('flow') === 'setup'
  const selectedTab = tabItems.find((item) => item.sectionKey === selectedSection) ?? tabItems[0]
  const selectedPageDefinition = surfacePath ? resolveEventSurfacePath(surfacePath) : null
  const selectedPageItem = selectedPageDefinition
    ? resolvedItems.find((item) => item.surfaceKey === selectedPageDefinition.surfaceKey)
    : undefined

  if (!groupId || !eventId) return <Navigate to="/" replace />

  if (loadState === 'loading') {
    return <AppPageShell><AppSectionCard dense><p className="text-sm text-[#66766f]" role="status">{text.loading}</p></AppSectionCard></AppPageShell>
  }

  if (loadState === 'permission-denied') {
    return <AppPageShell><AppEmptyState title={text.permissionTitle} description={text.permissionDescription} /></AppPageShell>
  }

  if (loadState === 'error' || !workspace) {
    return <AppPageShell><AppEmptyState title={text.unavailable} description={error || text.proposalFailed} actionLabel={text.retry} onAction={() => void load()} /></AppPageShell>
  }

  if (!surfacePath && searchParams.get('flow') === 'setup') {
    return <EventSetupPipeline key={eventId} workspace={workspace} plan={plan} archetypes={archetypes} eventBasePath={eventBasePath} language={language} />
  }

  if (surfacePath && (!selectedPageDefinition || !selectedPageItem)) {
    return (
      <AppPageShell title={text.unknownSurface} subtitle={text.unknownSurfaceDescription} actions={<Link className="text-sm font-bold text-[#176b5a]" to={returnToRamSetup ? `${workspaceBasePath}?flow=setup&stage=arrangements&module=safety.ram` : workspaceBasePath}>{returnToRamSetup ? (language === 'zh' ? '返回活动筹备' : 'Back to event preparation') : text.backWorkspace}</Link>}>
        <AppEmptyState title={text.unknownSurface} description={text.unknownSurfaceDescription} />
      </AppPageShell>
    )
  }

  if (surfacePath && selectedPageItem) {
    return (
      <AppPageShell
        title={localize(selectedPageItem.label, language)}
        subtitle={text.independentPage}
        actions={<Link className="text-sm font-bold text-[#176b5a]" to={returnToRamSetup ? `${workspaceBasePath}?flow=setup&stage=arrangements&module=safety.ram` : workspaceBasePath}>{returnToRamSetup ? (language === 'zh' ? '返回活动筹备' : 'Back to event preparation') : text.backWorkspace}</Link>}
      >
        <EventSurfaceRenderer item={selectedPageItem} language={language} eventBasePath={eventBasePath} eventId={eventId} groupId={groupId} canManage={workspace.canManage} />
      </AppPageShell>
    )
  }

  return (
    <AppPageShell
      title={`${text.title} · ${localize(workspace.title, language)}`}
      subtitle={text.subtitle}
      actions={<Link className="text-sm font-bold text-[#176b5a]" to={eventBasePath}>{text.back}</Link>}
    >
      <Link className="text-sm font-semibold text-[#176b5a]" to={`${workspaceBasePath}?flow=setup&stage=arrangements`}>{language === 'zh' ? '继续活动筹备流程 →' : 'Continue event preparation →'}</Link>

      <div className="flex gap-2 overflow-x-auto border-b border-[#2f4b42]/10 pb-2" role="tablist" aria-label={text.title}>
        {tabItems.map((item) => (
          <Link
            key={item.surfaceKey}
            role="tab"
            aria-selected={selectedTab?.surfaceKey === item.surfaceKey}
            to={item.sectionKey === 'overview' ? workspaceBasePath : `${workspaceBasePath}?tab=${encodeURIComponent(item.sectionKey ?? '')}`}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold ${selectedTab?.surfaceKey === item.surfaceKey ? 'bg-[#176b5a] text-white' : 'bg-white text-[#40554e] ring-1 ring-[#2f4b42]/15'}`}
          >
            {localize(item.label, language)}
          </Link>
        ))}
      </div>

      {selectedTab?.surfaceKey === 'workspace.overview' ? (
        <>
          <div className="grid gap-4 tablet:grid-cols-2">
            <AppSectionCard title={text.readiness} action={<AppBadge variant={readinessVariant(workspace.readiness.status)}>{workspace.readiness.status}</AppBadge>}>
              <p className="text-sm text-[#66766f]">{workspace.planVersion ? `${text.currentPlan} v${workspace.planVersion}` : text.noPlan}</p>
              <p className="mt-2 text-sm text-[#66766f]">{text.sponsorship}: {workspace.sponsorshipStatus}</p>
              {plan?.isLegacyBackfill ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{text.reviewLegacy}</p> : null}
            </AppSectionCard>
            <AppSectionCard title={text.nextSteps}>
              <ol className="space-y-2 text-sm text-[#40554e]">
                {workspace.nextSteps.map((step, index) => <li key={`${step.en}-${index}`}>{index + 1}. {localize(step, language)}</li>)}
              </ol>
            </AppSectionCard>
          </div>

          {workspace.canManage ? <AppSectionCard title={language === 'zh' ? '活动筹备' : 'Event preparation'}>
            <Link className="inline-flex min-h-11 items-center rounded-xl bg-[#176b5a] px-4 text-sm font-bold text-white" to={`${workspaceBasePath}?flow=setup&stage=details`}>
              {language === 'zh' ? '进入活动筹备流程' : 'Open event preparation'}
            </Link>
          </AppSectionCard> : null}

          <AppSectionCard title={text.enabledPages}>
            {pageItems.length ? (
              <div className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-3">
                {pageItems.map((item) => (
                  <Link key={item.surfaceKey} to={`${workspaceBasePath}/${encodeURIComponent(item.pathSegment ?? '')}`} className="rounded-2xl border border-[#2f4b42]/10 bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#176b5a]/30">
                    <span className="font-black text-[#18332d]">{localize(item.label, language)}</span>
                    <span className="mt-2 block text-xs text-[#66766f]">{item.moduleCode} · {item.readiness}</span>
                  </Link>
                ))}
              </div>
            ) : <AppEmptyState title={text.enabledPages} description={text.noPages} />}
          </AppSectionCard>
        </>
      ) : selectedTab?.surfaceKey === 'workspace.governance' ? (
        <EventPackageFoundationPanel
          eventId={eventId}
          groupId={groupId}
          planETag={plan?.eTag}
          canManage={workspace.canManage}
          language={language}
        />
      ) : selectedTab ? (
        <EventSurfaceRenderer item={selectedTab} language={language} eventBasePath={eventBasePath} eventId={eventId} groupId={groupId} canManage={workspace.canManage} />
      ) : null}
    </AppPageShell>
  )
}

export default EventWorkspaceView
