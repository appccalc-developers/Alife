import { eventWorkspaceViewText } from '../i18n/eventWorkspaceView.ts'
import { dutyReturnPath } from '../utils/eventDutyNavigation'
import EventSetupPipeline from '../components/events/EventSetupPipeline'
import EventCapabilityNotice, { capabilityFallback } from '../components/events/EventCapabilityNotice'
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
const copy = eventWorkspaceViewText.copy

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
          eventCompositionService.getPlan(eventId).catch((reason) => {
            if (normalizeApiError(reason).status === 404) return null
            throw reason
          }),
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
  const workspaceReturnPath = returnToRamSetup
    ? `${workspaceBasePath}?flow=setup&stage=arrangements&module=safety.ram`
    : workspaceBasePath
  const workspaceReturnLabel = returnToRamSetup
    ? (language === 'zh' ? eventWorkspaceViewText.backToEventPreparation.zh : eventWorkspaceViewText.backToEventPreparation.en)
    : text.backWorkspace
  const currentTaskBackLink = searchParams.has('returnTo')
    ? { to: dutyReturnPath(searchParams.get('returnTo')), label: language === 'zh' ? eventWorkspaceViewText.backToCurrentTasks.zh : eventWorkspaceViewText.backToCurrentTasks.en }
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
    if (!workspace.canManage) return <Navigate to={`/events/${eventId}/work`} replace />
    return <EventSetupPipeline key={eventId} workspace={workspace} plan={plan} archetypes={archetypes} eventBasePath={eventBasePath} language={language} />
  }

  if (surfacePath && (!selectedPageDefinition || !selectedPageItem)) {
    return (
      <AppPageShell title={text.unknownSurface} subtitle={text.unknownSurfaceDescription} backLink={{ to: workspaceReturnPath, label: workspaceReturnLabel }}>
        <AppEmptyState title={text.unknownSurface} description={text.unknownSurfaceDescription} />
      </AppPageShell>
    )
  }

  if (surfacePath && selectedPageItem) {
    return (
      <AppPageShell
        backLink={currentTaskBackLink ?? { to: workspaceReturnPath, label: workspaceReturnLabel }}
        title={localize(selectedPageItem.label, language)}
        subtitle={text.independentPage}
        actions={surfacePath === 'roster' ? <div className="flex flex-wrap gap-4 text-sm font-bold text-[#176b5a]"><Link to={eventBasePath}>{language === 'zh' ? eventWorkspaceViewText.viewEvent.zh : eventWorkspaceViewText.viewEvent.en}</Link><Link to={`/events/${eventId}/work`}>{language === 'zh' ? eventWorkspaceViewText.viewEventStages.zh : eventWorkspaceViewText.viewEventStages.en}</Link></div> : undefined}
      >
        <EventSurfaceRenderer item={selectedPageItem} language={language} eventBasePath={eventBasePath} eventId={eventId} groupId={groupId} canManage={workspace.canManage} />
      </AppPageShell>
    )
  }

  return (
    <AppPageShell
      backLink={currentTaskBackLink ?? { to: eventBasePath, label: text.back }}
      title={`${text.title} · ${localize(workspace.title, language)}`}
      subtitle={text.subtitle}
    >
      <Link className="text-sm font-semibold text-[#176b5a]" to={`/events/${eventId}/work`}>{language === 'zh' ? eventWorkspaceViewText.myEventWorkAndStages.zh : eventWorkspaceViewText.myEventWorkAndStages.en}</Link>

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
            </AppSectionCard>
            <AppSectionCard title={text.nextSteps}>
              <ol className="space-y-2 text-sm text-[#40554e]">
                {workspace.nextSteps.map((step, index) => <li key={`${step.en}-${index}`}>{index + 1}. {localize(step, language)}</li>)}
              </ol>
            </AppSectionCard>
          </div>

          {workspace.canManage ? <AppSectionCard title={language === 'zh' ? eventWorkspaceViewText.eventPreparation.zh : eventWorkspaceViewText.eventPreparation.en}>
            <Link className="inline-flex min-h-11 items-center rounded-xl bg-[#176b5a] px-4 text-sm font-bold text-white" to={`${workspaceBasePath}?flow=setup&stage=arrangements`}>
              {language === 'zh' ? eventWorkspaceViewText.continuePreparation.zh : eventWorkspaceViewText.continuePreparation.en}
            </Link>
          </AppSectionCard> : null}

          {tabItems.some(item => capabilityFallback.some(capability => capability.moduleCode === item.moduleCode)) ? <AppSectionCard title={language === 'zh' ? eventWorkspaceViewText.capabilityAvailability.zh : eventWorkspaceViewText.capabilityAvailability.en}>
            {tabItems.filter(item => capabilityFallback.some(capability => capability.moduleCode === item.moduleCode)).map(item => <div key={item.surfaceKey}>
              <h3 className="font-semibold">{localize(item.label, language)}</h3>
              <EventCapabilityNotice code={item.moduleCode!} zh={language === 'zh'} />
            </div>)}
          </AppSectionCard> : null}

          <AppSectionCard title={text.enabledPages}>
            {pageItems.length ? (
              <div className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-3">
                {pageItems.map((item) => (
                  <Link key={item.surfaceKey} to={`${workspaceBasePath}/${encodeURIComponent(item.pathSegment ?? '')}`} className="rounded-2xl border border-[#2f4b42]/10 bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#176b5a]/30">
                    <span className="font-black text-[#18332d]">{localize(item.label, language)}</span>
                    <span className="mt-2 block text-xs text-[#66766f]">{item.moduleCode} · {item.readiness}</span>
                    {item.moduleCode ? <EventCapabilityNotice code={item.moduleCode} zh={language === 'zh'} /> : null}
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
          packageId={searchParams.get('packageId') || undefined}
          occurrenceId={searchParams.get('occurrenceId') || undefined}
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
