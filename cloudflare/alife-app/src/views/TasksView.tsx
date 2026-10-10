import { tasksViewText } from '../i18n/tasksView.ts'
import { AlertCircle, ArrowRight, BellRing, Check, ChevronDown, LoaderCircle, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AppPageShell from '../components/layout/AppPageShell'
import { markCurrentTaskRead, useCurrentTasks } from '../hooks/useCurrentTasks'
import { useAuthStore } from '../stores/auth'
import type { AppNotification, NotificationTaskCategory, NotificationTaskDetails } from '../types/notification'
import {
  countCurrentTasks,
  formatNotificationDate,
  formatTaskCount,
  localizeNotificationText,
  normalizeNotificationActionUrl,
} from '../utils/currentTasks'
import { activateNotificationTarget } from '../utils/notificationRoutes'
import { confirmUnsavedChangesNavigation } from '../utils/unsavedChangesGuard'
import { identityAccessService, type MembershipApplication } from '../services/identityAccessService'
import { normalizeApiError } from '../services/http'
import { withDutyReturn } from '../utils/eventDutyNavigation'
import { selectTaskPage, taskSourceLabel } from '../utils/taskList'

const detailOrder: Array<keyof NotificationTaskDetails> = [
  'displayName',
  'email',
  'phone',
  'preferredLanguage',
  'message',
  'sourcePage',
]

const TasksView = () => {
  const auth = useAuthStore()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const selectedCategory: NotificationTaskCategory = params.get('type') === 'general' ? 'general' : 'urgent'
  const tasksQuery = useCurrentTasks()
  const tasks = tasksQuery.data ?? []
  const counts = countCurrentTasks(tasks)
  const selectedEvent = params.get('event') ?? '', selectedSource = params.get('source') ?? '', sort = params.get('sort') ?? 'due'
  const { items: visibleTasks, page, pages, total } = selectTaskPage(tasks, { category: selectedCategory, eventId: selectedEvent, sourceType: selectedSource, sort, page: Number(params.get('page') || 1) })
  const updateFilter = (key: string, value: string) => setParams(current => { const next = new URLSearchParams(current); if (value) next.set(key, value); else next.delete(key); if (key !== 'page') next.delete('page'); return next }, { replace: true })
  const eventOptions = [...new Map(tasks.filter(t => t.eventId).map(t => [t.eventId!, t])).values()]
  const sourceOptions = [...new Set(tasks.filter(t => t.category === selectedCategory).map(t => t.sourceType).filter(Boolean))] as string[]
  const [pendingId, setPendingId] = useState('')
  const [actionError, setActionError] = useState('')
  const [applications, setApplications] = useState<MembershipApplication[]>([])
  const [supplement, setSupplement] = useState('')
  const [applicationBusy, setApplicationBusy] = useState(false)
  const zh = auth.language === 'zh'

  const copy = zh
    ? { ...tasksViewText.localizedCopy.zh }
    : { ...tasksViewText.localizedCopy.en }

  useEffect(() => {
    identityAccessService.personalApplications().then(setApplications).catch(() => undefined)
  }, [])

  const selectedApplicationId = new URLSearchParams(window.location.search).get('application') ?? ''
  const selectedApplication = applications.find((application) => application.id === selectedApplicationId)

  const submitApplicationSupplement = async () => {
    if (!selectedApplication || supplement.trim().length < 2) return
    setApplicationBusy(true)
    setActionError('')
    try {
      const updated = await identityAccessService.supplementPersonalApplication(selectedApplication, supplement.trim())
      setApplications((current) => current.map((item) => item.id === updated.id ? updated : item))
      setSupplement('')
      window.history.replaceState(window.history.state, '', '/tasks?type=urgent')
      await tasksQuery.refetch()
      setActionError(copy.applicationUpdated)
    } catch (error) {
      setActionError(normalizeApiError(error).message)
    } finally {
      setApplicationBusy(false)
    }
  }

  const chooseCategory = (category: NotificationTaskCategory) => updateFilter('type', category)

  const handleTaskAction = (task: AppNotification) => {
    if (pendingId || !auth.me?.id) return
    const target = task.actionUrl ? normalizeNotificationActionUrl(task.actionUrl) : ''
    const externalTarget = /^https?:\/\//i.test(target)
    const internalTarget = target && !externalTarget ? activateNotificationTarget(task.taskKey ? withDutyReturn(target, `/tasks?${params.toString()}`) : target) : ''

    const continueAction = async () => {
      setPendingId(task.id)
      setActionError('')
      try {
        if (task.completionMode === 'read') {
          await markCurrentTaskRead(auth.me!.id, task.id)
        }
        if (internalTarget) navigate(internalTarget)
        if (externalTarget) window.location.assign(target)
      } catch {
        setActionError(copy.actionFailed)
      } finally {
        setPendingId('')
      }
    }

    if (target && !confirmUnsavedChangesNavigation(target, () => { void continueAction() })) return
    void continueAction()
  }

  return (
    <AppPageShell
      title={copy.title}
      context={zh ? tasksViewText.personalCenterCurrentTasks.zh : tasksViewText.personalCenterCurrentTasks.en}
      subtitle={copy.subtitle}
      controls={(
        <div className="flex rounded-xl border border-[#173f36] bg-[#173f36] p-1" role="tablist" aria-label={copy.chooser}>
          {(['urgent', 'general'] as const).map((category) => {
            const active = selectedCategory === category
            const urgent = category === 'urgent'
            const label = urgent ? copy.urgent : copy.general
            const count = counts[category]
            return (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => chooseCategory(category)}
                className={[
                  'flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 sm:px-3',
                  active ? 'bg-white text-[#173f36] shadow-sm' : 'text-white/80 hover:bg-white/10 hover:text-white',
                ].join(' ')}
              >
                <span>{label}</span>
                <span className={['inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] leading-5', active ? urgent ? 'bg-[#fbe8e2] text-[#9b3d29]' : 'bg-[#dceee7] text-[#155345]' : 'bg-white/10 text-white'].join(' ')}>{formatTaskCount(count)}</span>
              </button>
            )
          })}
        </div>
      )}
      overflowLabel={zh ? tasksViewText.moreActions.zh : tasksViewText.moreActions.en}
      overflowActions={[{
        label: tasksQuery.isFetching ? (zh ? tasksViewText.refreshing.zh : tasksViewText.refreshing.en) : (zh ? tasksViewText.refreshTasks.zh : tasksViewText.refreshTasks.en),
        icon: <RefreshCw className={tasksQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />,
        onSelect: () => void tasksQuery.refetch(),
        disabled: tasksQuery.isFetching,
      }]}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid min-w-0 gap-1 text-xs font-bold">{zh ? tasksViewText.event.zh : tasksViewText.event.en}<select className="alife-input min-h-11 w-full" value={selectedEvent} onChange={e => updateFilter('event', e.target.value)}><option value="">{zh ? tasksViewText.allEvents.zh : tasksViewText.allEvents.en}</option>{eventOptions.map(t => <option key={t.eventId} value={t.eventId}>{localizeNotificationText(t.eventTitle, auth.language) || t.eventId}</option>)}</select></label>
        <label className="grid min-w-0 gap-1 text-xs font-bold">{zh ? tasksViewText.responsibility.zh : tasksViewText.responsibility.en}<select className="alife-input min-h-11 w-full" value={selectedSource} onChange={e => updateFilter('source', e.target.value)}><option value="">{zh ? tasksViewText.allTypes.zh : tasksViewText.allTypes.en}</option>{sourceOptions.map(source => <option key={source} value={source}>{taskSourceLabel(source, zh)}</option>)}</select></label>
        <label className="grid min-w-0 gap-1 text-xs font-bold">{zh ? tasksViewText.sort.zh : tasksViewText.sort.en}<select className="alife-input min-h-11 w-full" value={sort} onChange={e => updateFilter('sort', e.target.value)}><option value="due">{zh ? tasksViewText.dueSoonest.zh : tasksViewText.dueSoonest.en}</option><option value="newest">{zh ? tasksViewText.newestFirst.zh : tasksViewText.newestFirst.en}</option><option value="oldest">{zh ? tasksViewText.oldestFirst.zh : tasksViewText.oldestFirst.en}</option></select></label>
      </div>
      {selectedApplication ? (
        <section className="rounded-[1.5rem] border border-[#b9cec5] bg-white p-4 shadow-[0_16px_38px_rgba(30,54,48,0.07)] sm:p-5" aria-labelledby="selected-application-heading">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="selected-application-heading" className="font-black text-[#18332d]">{copy.applicationTitle}</h2><p className="mt-1 text-xs text-[#718079]">{copy.applicationId}: {selectedApplication.id}</p></div><span className="rounded-full bg-[#e3f0eb] px-3 py-1 text-xs font-black text-[#176b5a]">{selectedApplication.status}</span></div>
          <p className="mt-3 text-sm leading-6 text-[#4f625b]">{auth.language === 'zh' ? selectedApplication.groupNameZh || selectedApplication.groupNameEn : selectedApplication.groupNameEn || selectedApplication.groupNameZh}</p>
          {selectedApplication.history.length ? <ol className="mt-4 space-y-2 border-l-2 border-[#dce9e3] pl-4">{selectedApplication.history.map((entry) => <li key={entry.id}><p className="text-xs font-bold text-[#314b43]">{entry.kind} · {entry.toStatus}</p>{entry.note ? <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-[#60716a]">{entry.note}</p> : null}</li>)}</ol> : null}
          {selectedApplication.status === 'needsInfo' ? <div className="mt-4 border-t border-[#e3ebe7] pt-4"><label className="block text-sm font-bold text-[#314b43]">{copy.supplement}<textarea className="alife-input mt-2 min-h-28 py-3" maxLength={2000} value={supplement} onChange={(event) => setSupplement(event.target.value)} /></label><button className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-[#176b5a] px-4 py-2 text-sm font-black text-white disabled:opacity-50" type="button" disabled={applicationBusy || supplement.trim().length < 2} onClick={() => void submitApplicationSupplement()}>{copy.sendSupplement}</button></div> : null}
        </section>
      ) : null}
      {actionError ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800" role="alert">{actionError}</p> : null}

      {tasksQuery.isLoading ? (
        <div className="flex min-h-56 items-center justify-center rounded-[1.5rem] border border-[#d8e1dc] bg-white text-sm font-bold text-[#60716a] shadow-[0_16px_38px_rgba(30,54,48,0.07)]">
          <LoaderCircle className="mr-2 h-5 w-5 animate-spin text-[#176b5a]" />{copy.loading}
        </div>
      ) : tasksQuery.isError ? (
        <div className="rounded-[1.5rem] border border-[#ead8c6] bg-[#fffbf5] p-6 text-center shadow-[0_16px_38px_rgba(30,54,48,0.07)]">
          <AlertCircle className="mx-auto h-8 w-8 text-[#b65c3e]" />
          <p className="mt-3 text-sm leading-6 text-[#725b4d]">{copy.loadFailed}</p>
        </div>
      ) : visibleTasks.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-[#cbdad3] bg-white/70 px-6 py-12 text-center">
          <BellRing className={['mx-auto h-9 w-9', selectedCategory === 'urgent' ? 'text-[#de6c4d]' : 'text-[#176b5a]'].join(' ')} />
          <p className="mt-3 text-sm font-black text-[#18332d]">{selectedCategory === 'urgent' ? copy.urgentEmpty : copy.generalEmpty}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-[#718079]">{copy.emptyHint}</p>
        </div>
      ) : (
        <div className="space-y-3" aria-live="polite">
          {visibleTasks.map((task) => {
            const title = localizeNotificationText(task.title, auth.language) || (selectedCategory === 'urgent' ? copy.urgent : copy.general)
            const body = localizeNotificationText(task.body, auth.language)
            const dateLabel = formatNotificationDate(task.createdUtc, auth.language)
            const urgent = task.category === 'urgent'
            const hasTarget = Boolean(task.actionUrl)
            const isPending = pendingId === task.id
            const actionLabel = hasTarget ? localizeNotificationText(task.actionLabel, auth.language) || copy.open : task.category === 'urgent' ? copy.acknowledge : copy.markRead

            return (
              <details key={task.taskKey || task.id} className="group relative overflow-hidden rounded-[1.35rem] border border-[#d8e1dc] bg-white shadow-[0_12px_30px_rgba(30,54,48,0.06)] open:border-[#b9cec5]">
                <span className={['absolute inset-y-0 left-0 w-1.5', urgent ? 'bg-[#de6c4d]' : 'bg-[#176b5a]'].join(' ')} aria-hidden="true" />
                <summary className="flex cursor-pointer list-none items-start gap-3 py-4 pl-5 pr-4 outline-none transition hover:bg-[#f7faf8] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#176b5a]/30 [&::-webkit-details-marker]:hidden sm:items-center sm:px-6">
                  <span className={['mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:mt-0', urgent ? 'bg-[#fbe8e2] text-[#ad482f]' : 'bg-[#dceee7] text-[#155345]'].join(' ')}>
                    {urgent ? <AlertCircle className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black leading-5 text-[#18332d]">{title}</span>
                    {task.occurrenceId ? <span className="mt-1 block break-all text-xs text-[#60716a]">{zh ? tasksViewText.occurrence.zh : tasksViewText.occurrence.en} · {task.occurrenceId.slice(0, 8)}</span> : null}
                    {task.dueUtc ? <span className={`mt-1 block text-xs font-semibold ${new Date(task.dueUtc).getTime() < Date.now() ? 'text-red-700' : 'text-[#60716a]'}`}>{new Date(task.dueUtc).getTime() < Date.now() ? (zh ? tasksViewText.overdue.zh : tasksViewText.overdue.en) : (zh ? tasksViewText.due.zh : tasksViewText.due.en)}{formatNotificationDate(task.dueUtc, auth.language)}</span> : null}
                    {dateLabel ? <span className="mt-1 block text-xs font-semibold text-[#7a8983]">{dateLabel}</span> : null}
                  </span>
                  <ChevronDown className="mt-2 h-4 w-4 shrink-0 text-[#718079] transition group-open:rotate-180 sm:mt-0" aria-hidden="true" />
                </summary>
                <div className="border-t border-[#e3ebe7] bg-[#fbfcfb] px-5 py-4 sm:px-6 sm:py-5">
                  {body ? <p className="whitespace-pre-wrap text-sm leading-6 text-[#4f625b]">{body}</p> : null}
                  {task.details ? (
                    <dl className="mt-4 grid gap-3 rounded-2xl border border-[#e0e8e4] bg-white p-4 sm:grid-cols-2">
                      {detailOrder.map((key) => task.details?.[key] ? (
                        <div key={key} className={key === 'message' || key === 'sourcePage' ? 'sm:col-span-2' : ''}>
                          <dt className="text-[10px] font-black uppercase tracking-[0.12em] text-[#809089]">{copy.details[key]}</dt>
                          <dd className="mt-1 break-words whitespace-pre-wrap text-sm font-semibold leading-5 text-[#263f37]">{task.details[key]}</dd>
                        </div>
                      ) : null)}
                    </dl>
                  ) : null}
                  {task.completionMode === 'workflow' ? <p className="mt-4 flex items-start gap-2 text-xs font-semibold leading-5 text-[#718079]"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#176b5a]" />{copy.workflowHint}</p> : null}
                  {(hasTarget || task.completionMode === 'read') ? (
                    <div className="mt-4 flex justify-end border-t border-[#e3ebe7] pt-4">
                      <button type="button" disabled={Boolean(pendingId)} onClick={() => handleTaskAction(task)} className={['inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-black text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-65', urgent ? 'bg-[#c95a3d] hover:bg-[#ad482f] focus-visible:ring-[#de6c4d]/40' : 'bg-[#176b5a] hover:bg-[#0d4f43] focus-visible:ring-[#176b5a]/35'].join(' ')}>
                        {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : hasTarget ? <ArrowRight className="h-4 w-4" /> : <Check className="h-4 w-4" />}{actionLabel}
                      </button>
                    </div>
                  ) : null}
                </div>
              </details>
            )
          })}
        </div>
      )}
      {!tasksQuery.isLoading && !tasksQuery.isError && total > 0 ? <nav aria-label={zh ? tasksViewText.taskPagination.zh : tasksViewText.taskPagination.en} className="flex flex-wrap items-center justify-between gap-3 text-sm"><button className="min-h-11 rounded-xl border bg-white px-4 disabled:opacity-40" disabled={page <= 1} onClick={() => updateFilter('page', String(page - 1))}>{zh ? tasksViewText.previous.zh : tasksViewText.previous.en}</button><span>{zh ? tasksViewText.pageTasks.zh(page, pages, total) : tasksViewText.pageTasks.en(page, pages, total)}</span><button className="min-h-11 rounded-xl border bg-white px-4 disabled:opacity-40" disabled={page >= pages} onClick={() => updateFilter('page', String(page + 1))}>{zh ? tasksViewText.next.zh : tasksViewText.next.en}</button></nav> : null}
    </AppPageShell>
  )
}

export default TasksView
