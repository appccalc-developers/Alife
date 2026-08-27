import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { EventSurfaceRenderer } from '../components/events/EventSurfaceRenderer'
import { resolveEventSurface, resolveEventSurfacePath } from '../components/events/eventSurfaceRegistry'
import AppActionButton from '../components/layout/AppActionButton'
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
  EventFactInput,
  EventPlanComposeRequest,
  EventPlanProposal,
  EventPlanSnapshot,
  EventWorkspace,
  LocalizedText,
} from '../types/eventComposition'
import { buildScopedEventDetailPath } from '../utils/eventRoutes'
import {
  omitServerControlledEventFacts,
  resolveWorkspaceLoadFailure,
  resolveWorkspaceMutationFailure,
} from '../utils/eventWorkspaceState'

type LoadState = 'loading' | 'ready' | 'error' | 'permission-denied'
type MutationState = 'idle' | 'composing' | 'accepting' | 'success' | 'stale' | 'conflict' | 'error'

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

const booleanFacts = [
  ['people.volunteersRequired', 'Volunteers required', '需要志愿者'],
  ['money.hasMoneyFlow', 'Money collected or spent', '涉及收款或支出'],
  ['safety.requiresRam', 'RAM required', '需要 RAM'],
  ['people.childrenPresent', 'Children present', '有儿童参与'],
  ['programme.productionRequired', 'Managed programme', '需要节目制作'],
  ['place.resourcesRequired', 'Managed venue or resources', '需要场地或资源管理'],
  ['move.transportRequired', 'Transport required', '需要交通安排'],
  ['move.accommodationRequired', 'Accommodation required', '需要住宿'],
  ['food.serviceRequired', 'Food service required', '需要餐饮服务'],
  ['scale.multiZone', 'Multiple live zones', '多区域现场运作'],
  ['comms.followupRequired', 'Follow-up required', '需要后续跟进'],
] as const

const knownFactCodes = new Set([
  ...booleanFacts.map(([code]) => code),
  'people.registrationMode',
  'visibility',
])

const localize = (value: LocalizedText, language: 'en' | 'zh') =>
  value[language] || value.en || value.zh

const readinessVariant = (status: string) =>
  status === 'ready' ? 'success' as const : status === 'blocked' ? 'danger' as const : 'warning' as const

const readFactValue = (fact: EventFactInput): string => {
  if (fact.certainty !== 'confirmed') return 'unknown'
  if (typeof fact.value === 'boolean') return fact.value ? 'true' : 'false'
  return typeof fact.value === 'string' ? fact.value : 'unknown'
}

const initialFactValues = (plan?: EventPlanSnapshot | null): Record<string, string> => {
  const values: Record<string, string> = Object.fromEntries(booleanFacts.map(([code]) => [code, 'unknown']))
  values['people.registrationMode'] = 'unknown'
  values.visibility = 'unknown'
  for (const fact of plan?.plan.facts.items ?? []) {
    if (knownFactCodes.has(fact.code)) values[fact.code] = readFactValue(fact)
  }
  return values
}

const buildFacts = (values: Record<string, string>, preservedFacts: EventFactInput[]): EventFactInput[] => {
  const configured = Object.entries(values).map(([code, value]): EventFactInput => ({
    code,
    value: value === 'unknown' ? null : value === 'true' ? true : value === 'false' ? false : value,
    certainty: value === 'unknown' ? 'unknown' : 'confirmed',
    source: 'human',
  }))
  return omitServerControlledEventFacts([
    ...preservedFacts.filter((fact) => !knownFactCodes.has(fact.code)),
    ...configured,
  ])
}

const StepRail = ({ stage, language }: { stage: number; language: 'en' | 'zh' }) => {
  const steps = language === 'zh'
    ? ['事实', 'Proposal', '方案审查', '人工接受', '工作区']
    : ['Facts', 'Proposal', 'Plan review', 'Human accept', 'Workspace']
  return (
    <ol className="flex snap-x gap-2 overflow-x-auto pb-1" aria-label={language === 'zh' ? '方案流程' : 'Plan flow'}>
      {steps.map((label, index) => (
        <li key={label} className="shrink-0 snap-start">
          <span className={`inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-bold ${index <= stage ? 'border-[#176b5a] bg-[#e3f0eb] text-[#0d4f43]' : 'border-slate-200 bg-white text-slate-500'}`}>
            {index + 1}. {label}
          </span>
        </li>
      ))}
    </ol>
  )
}

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
  const [mutationState, setMutationState] = useState<MutationState>('idle')
  const [error, setError] = useState('')
  const [workspace, setWorkspace] = useState<EventWorkspace | null>(null)
  const [plan, setPlan] = useState<EventPlanSnapshot | null>(null)
  const [archetypes, setArchetypes] = useState<EventArchetype[]>([])
  const [archetypeCode, setArchetypeCode] = useState('simple-social')
  const [factValues, setFactValues] = useState<Record<string, string>>(() => initialFactValues())
  const [preservedFacts, setPreservedFacts] = useState<EventFactInput[]>([])
  const [composition, setComposition] = useState<EventPlanComposeRequest | null>(null)
  const [proposal, setProposal] = useState<EventPlanProposal | null>(null)

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
        setArchetypeCode(nextPlan?.plan.archetypeCode || 'simple-social')
        setFactValues(initialFactValues(nextPlan))
        setPreservedFacts(nextPlan?.plan.facts.items ?? [])
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
  const selectedTab = tabItems.find((item) => item.sectionKey === selectedSection) ?? tabItems[0]
  const selectedPageDefinition = surfacePath ? resolveEventSurfacePath(surfacePath) : null
  const selectedPageItem = selectedPageDefinition
    ? resolvedItems.find((item) => item.surfaceKey === selectedPageDefinition.surfaceKey)
    : undefined

  const handleCompose = async () => {
    if (!eventId || !workspace) return
    const schemaVersion = plan?.plan.schemaVersion === '1.1.0' ? '1.1.0' : '1.0.0'
    const nextComposition: EventPlanComposeRequest = {
      schemaVersion,
      archetypeCode: schemaVersion === '1.1.0' ? plan?.plan.archetypeCode : archetypeCode,
      activityTypeCode: schemaVersion === '1.1.0' ? plan?.plan.activityTypeCode : null,
      useRecommendedWorkflow: schemaVersion === '1.1.0'
        ? plan?.plan.workflowRecommendation?.status === 'selected'
        : false,
      facts: { items: buildFacts(factValues, preservedFacts) },
      humanSelections: [],
      basePlanVersion: workspace.planVersion ?? null,
    }
    setComposition(nextComposition)
    setMutationState('composing')
    setError('')
    try {
      const nextProposal = await eventCompositionService.recompose(
        eventId,
        nextComposition,
        workspace.eTag,
      )
      setProposal(nextProposal)
      setMutationState('idle')
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setMutationState(resolveWorkspaceMutationFailure(apiError.status))
      setError(apiError.message)
    }
  }

  const handleAccept = async () => {
    if (!eventId || !workspace || !proposal || !composition) return
    setMutationState('accepting')
    setError('')
    try {
      await eventCompositionService.accept(
        eventId,
        proposal,
        composition,
        workspace.eTag,
        crypto.randomUUID(),
      )
      setProposal(null)
      setComposition(null)
      setMutationState('success')
      await load()
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setMutationState(resolveWorkspaceMutationFailure(apiError.status))
      setError(apiError.message)
    }
  }

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

  if (surfacePath && (!selectedPageDefinition || !selectedPageItem)) {
    return (
      <AppPageShell title={text.unknownSurface} subtitle={text.unknownSurfaceDescription} actions={<Link className="text-sm font-bold text-[#176b5a]" to={workspaceBasePath}>{text.backWorkspace}</Link>}>
        <AppEmptyState title={text.unknownSurface} description={text.unknownSurfaceDescription} />
      </AppPageShell>
    )
  }

  if (surfacePath && selectedPageItem) {
    return (
      <AppPageShell
        title={localize(selectedPageItem.label, language)}
        subtitle={text.independentPage}
        actions={<Link className="text-sm font-bold text-[#176b5a]" to={workspaceBasePath}>{text.backWorkspace}</Link>}
      >
        <EventSurfaceRenderer item={selectedPageItem} language={language} eventBasePath={eventBasePath} eventId={eventId} groupId={groupId} canManage={workspace.canManage} />
      </AppPageShell>
    )
  }

  const stage = proposal ? 3 : mutationState === 'success' || workspace.planVersion ? 4 : 0
  const activeProposalModules = proposal?.moduleDecisions.filter((module) => module.status !== 'inactive') ?? []

  return (
    <AppPageShell
      title={`${text.title} · ${localize(workspace.title, language)}`}
      subtitle={text.subtitle}
      actions={<Link className="text-sm font-bold text-[#176b5a]" to={eventBasePath}>{text.back}</Link>}
    >
      <StepRail stage={stage} language={language} />

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

          {workspace.canManage ? (
            <AppSectionCard title={text.planTitle} subtitle={text.planSubtitle}>
              <div className="grid gap-4 tablet:grid-cols-2">
                <label className="text-sm font-bold text-[#40554e]">
                  {text.archetype}
                  <select value={archetypeCode} disabled={plan?.plan.schemaVersion === '1.1.0'} onChange={(event) => setArchetypeCode(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#2f4b42]/20 bg-white px-3 font-normal disabled:bg-slate-50 disabled:text-slate-500">
                    {archetypes.map((archetype) => <option key={archetype.code} value={archetype.code}>{localize(archetype.name, language)}</option>)}
                  </select>
                </label>
                <label className="text-sm font-bold text-[#40554e]">
                  {language === 'zh' ? '报名方式' : 'Registration mode'}
                  <select value={factValues['people.registrationMode']} onChange={(event) => setFactValues((current) => ({ ...current, 'people.registrationMode': event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border border-[#2f4b42]/20 bg-white px-3 font-normal">
                    <option value="unknown">{text.unknown}</option><option value="none">{language === 'zh' ? '无需报名' : 'None'}</option><option value="required">{language === 'zh' ? '需要报名' : 'Required'}</option>
                  </select>
                </label>
                <label className="text-sm font-bold text-[#40554e]">
                  {language === 'zh' ? '可见范围' : 'Visibility'}
                  <select value={factValues.visibility} onChange={(event) => setFactValues((current) => ({ ...current, visibility: event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border border-[#2f4b42]/20 bg-white px-3 font-normal">
                    <option value="unknown">{text.unknown}</option><option value="group">{language === 'zh' ? '小组' : 'Group'}</option><option value="church">{language === 'zh' ? '教会' : 'Church'}</option><option value="public">{language === 'zh' ? '公开' : 'Public'}</option>
                  </select>
                </label>
                {booleanFacts.map(([code, en, zh]) => (
                  <label key={code} className="text-sm font-bold text-[#40554e]">
                    {language === 'zh' ? zh : en}
                    <select value={factValues[code]} onChange={(event) => setFactValues((current) => ({ ...current, [code]: event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border border-[#2f4b42]/20 bg-white px-3 font-normal">
                      <option value="unknown">{text.unknown}</option><option value="true">{text.yes}</option><option value="false">{text.no}</option>
                    </select>
                  </label>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <AppActionButton variant="primary" disabled={mutationState === 'composing' || mutationState === 'accepting'} onClick={() => void handleCompose()}>
                  {mutationState === 'composing' ? text.recomposing : text.compose}
                </AppActionButton>
                <p className="text-xs text-[#66766f]">{text.secureRegistry}</p>
              </div>
            </AppSectionCard>
          ) : null}

          {proposal ? (
            <AppSectionCard title={text.review} action={<AppBadge variant={readinessVariant(proposal.readiness.status)}>{proposal.readiness.status}</AppBadge>}>
              <h3 className="text-sm font-black text-[#18332d]">{text.activeModules}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {activeProposalModules.map((module) => <AppBadge key={module.moduleCode} variant={module.status === 'required' ? 'info' : 'neutral'}>{localize(module.label, language)} · {module.status}</AppBadge>)}
              </div>
              <h3 className="mt-5 text-sm font-black text-[#18332d]">{text.proposedChanges}</h3>
              <p className="mt-2 text-sm text-[#66766f]">+ {proposal.diff.addedModules.join(', ') || '—'} · − {proposal.diff.removedModules.join(', ') || '—'}</p>
              {proposal.diff.blockingRetirements.length ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{proposal.diff.blockingRetirements.join(', ')}</p> : null}
              <div className="mt-5">
                <AppActionButton variant="primary" disabled={mutationState === 'accepting' || proposal.diff.blockingRetirements.length > 0} onClick={() => void handleAccept()}>
                  {mutationState === 'accepting' ? text.accepting : text.accept}
                </AppActionButton>
              </div>
            </AppSectionCard>
          ) : null}

          {mutationState === 'success' ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{text.accepted}</p> : null}
          {mutationState === 'stale' ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">{text.stale} {error}</p> : null}
          {mutationState === 'conflict' ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{text.conflict} {error}</p> : null}
          {mutationState === 'error' ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">{text.proposalFailed} {error}</p> : null}

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
      ) : selectedTab ? (
        <EventSurfaceRenderer item={selectedTab} language={language} eventBasePath={eventBasePath} eventId={eventId} groupId={groupId} canManage={workspace.canManage} />
      ) : null}
    </AppPageShell>
  )
}

export default EventWorkspaceView
