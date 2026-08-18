import { AlertCircle, ArrowRight, BellRing, Check, ChevronDown, ClipboardCheck, LoaderCircle, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const [selectedCategory, setSelectedCategory] = useState<NotificationTaskCategory>(() => (
    new URLSearchParams(window.location.search).get('type') === 'general' ? 'general' : 'urgent'
  ))
  const tasksQuery = useCurrentTasks()
  const tasks = tasksQuery.data ?? []
  const counts = countCurrentTasks(tasks)
  const visibleTasks = tasks.filter((task) => task.category === selectedCategory)
  const [pendingId, setPendingId] = useState('')
  const [actionError, setActionError] = useState('')
  const zh = auth.language === 'zh'

  const copy = zh
    ? {
      title: '当前事务',
      subtitle: '集中查看需要你处理的职能事务和作为组员收到的通知。',
      chooser: '事务类型',
      chooserHint: '先处理紧要事务，再查看一般通知。',
      urgent: '紧要事务',
      general: '一般事务',
      urgentEmpty: '目前没有需要你处理的职能事务。',
      generalEmpty: '目前没有未读的一般通知。',
      emptyHint: '新的事务出现后，会自动显示在这里。',
      loading: '正在整理当前事务…',
      loadFailed: '暂时无法加载当前事务。请检查网络后重试。',
      retry: '重新加载',
      open: '前往处理',
      markRead: '标为已读',
      acknowledge: '确认已阅',
      workflowHint: '完成对应处理流程后，这项事务会自动移除。',
      received: '收到时间',
      actionFailed: '暂时无法更新这项事务，请重试。',
      details: {
        displayName: '姓名', email: 'Email', phone: '电话', preferredLanguage: '首选语言', message: '留言', sourcePage: '来源页面',
      },
    }
    : {
      title: 'Current tasks',
      subtitle: 'See duty-related work and notifications you received as a group member in one place.',
      chooser: 'Task type',
      chooserHint: 'Handle urgent duties first, then review general notifications.',
      urgent: 'Urgent tasks',
      general: 'General tasks',
      urgentEmpty: 'There are no duty-related tasks waiting for you.',
      generalEmpty: 'There are no unread general notifications.',
      emptyHint: 'New tasks will appear here automatically.',
      loading: 'Preparing your current tasks…',
      loadFailed: 'Current tasks could not be loaded. Check your connection and try again.',
      retry: 'Reload',
      open: 'Open task',
      markRead: 'Mark as read',
      acknowledge: 'Acknowledge',
      workflowHint: 'This task will clear automatically after the related workflow is completed.',
      received: 'Received',
      actionFailed: 'This task could not be updated. Try again.',
      details: {
        displayName: 'Name', email: 'Email', phone: 'Phone', preferredLanguage: 'Preferred language', message: 'Message', sourcePage: 'Source page',
      },
    }

  const chooseCategory = (category: NotificationTaskCategory) => {
    if (category === selectedCategory) return

    setSelectedCategory(category)

    const url = new URL(window.location.href)
    url.searchParams.set('type', category)
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }

  const handleTaskAction = (task: AppNotification) => {
    if (pendingId || !auth.me?.id) return
    const target = task.actionUrl ? normalizeNotificationActionUrl(task.actionUrl) : ''
    const externalTarget = /^https?:\/\//i.test(target)
    const internalTarget = target && !externalTarget ? activateNotificationTarget(target) : ''

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
    <AppPageShell title={copy.title} subtitle={copy.subtitle}>
      <section className="rounded-[1.5rem] border border-[#d8e1dc] bg-[#f8fbf8] p-4 shadow-[0_16px_38px_rgba(30,54,48,0.06)] sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-[#18332d]"><ClipboardCheck className="h-5 w-5 text-[#176b5a]" />{copy.chooser}</div>
            <p className="mt-1 text-xs font-semibold leading-5 text-[#718079]">{copy.chooserHint}</p>
          </div>
          <div className="flex rounded-xl border border-[#cddbd4] bg-white p-1" role="tablist" aria-label={copy.chooser}>
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
                    'flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b5a]/30 sm:px-4',
                    active
                      ? urgent ? 'bg-[#de6c4d] text-white shadow-sm' : 'bg-[#176b5a] text-white shadow-sm'
                      : 'text-[#63756d] hover:bg-[#edf5f1]',
                  ].join(' ')}
                >
                  <span>{label}</span>
                  <span className={['inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] leading-5', active ? 'bg-white/20 text-white' : urgent ? 'bg-[#fbe8e2] text-[#9b3d29]' : 'bg-[#dceee7] text-[#155345]'].join(' ')}>{formatTaskCount(count)}</span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {actionError ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800" role="alert">{actionError}</p> : null}

      {tasksQuery.isLoading ? (
        <div className="flex min-h-56 items-center justify-center rounded-[1.5rem] border border-[#d8e1dc] bg-white text-sm font-bold text-[#60716a] shadow-[0_16px_38px_rgba(30,54,48,0.07)]">
          <LoaderCircle className="mr-2 h-5 w-5 animate-spin text-[#176b5a]" />{copy.loading}
        </div>
      ) : tasksQuery.isError ? (
        <div className="rounded-[1.5rem] border border-[#ead8c6] bg-[#fffbf5] p-6 text-center shadow-[0_16px_38px_rgba(30,54,48,0.07)]">
          <AlertCircle className="mx-auto h-8 w-8 text-[#b65c3e]" />
          <p className="mt-3 text-sm leading-6 text-[#725b4d]">{copy.loadFailed}</p>
          <button type="button" onClick={() => void tasksQuery.refetch()} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#173f36] px-4 py-2 text-sm font-black text-white transition hover:bg-[#0d4f43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b5a]/30"><RefreshCw className="h-4 w-4" />{copy.retry}</button>
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
            const actionLabel = hasTarget ? copy.open : task.category === 'urgent' ? copy.acknowledge : copy.markRead

            return (
              <details key={task.id} className="group relative overflow-hidden rounded-[1.35rem] border border-[#d8e1dc] bg-white shadow-[0_12px_30px_rgba(30,54,48,0.06)] open:border-[#b9cec5]">
                <span className={['absolute inset-y-0 left-0 w-1.5', urgent ? 'bg-[#de6c4d]' : 'bg-[#176b5a]'].join(' ')} aria-hidden="true" />
                <summary className="flex cursor-pointer list-none items-start gap-3 py-4 pl-5 pr-4 outline-none transition hover:bg-[#f7faf8] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#176b5a]/30 [&::-webkit-details-marker]:hidden sm:items-center sm:px-6">
                  <span className={['mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:mt-0', urgent ? 'bg-[#fbe8e2] text-[#ad482f]' : 'bg-[#dceee7] text-[#155345]'].join(' ')}>
                    {urgent ? <AlertCircle className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black leading-5 text-[#18332d]">{title}</span>
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
    </AppPageShell>
  )
}

export default TasksView
