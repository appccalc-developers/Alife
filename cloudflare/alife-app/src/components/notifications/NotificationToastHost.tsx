import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Bell, Check, Loader2, X } from 'lucide-react'
import { useAuthStore } from '../../stores/auth'
import type { AppNotification } from '../../types/notification'
import { useUiText, type UiTextKey } from '../../i18n/uiText'
import { confirmUnsavedChangesNavigation } from '../../utils/unsavedChangesGuard'
import { markCurrentTaskRead, useCurrentTasks } from '../../hooks/useCurrentTasks'
import { formatNotificationDate, localizeNotificationText, normalizeNotificationActionUrl } from '../../utils/currentTasks'
import { activateNotificationTarget } from '../../utils/notificationRoutes'

const getNotificationActionLabelKey = (notification: AppNotification): UiTextKey => {
  switch (notification.actionType) {
    case 'group.invitation.received':
      return 'notificationActionReviewInvitation'
    case 'group.join-request.received':
      return 'notificationActionReviewRequest'
    case 'church.line-member.waiting':
      return 'notificationActionReviewMember'
    default:
      return notification.actionUrl ? 'notificationActionOpen' : 'notificationActionMarkRead'
  }
}

const NotificationToastHost = () => {
  const auth = useAuthStore()
  const t = useUiText()
  const navigate = useNavigate()
  const currentTasksQuery = useCurrentTasks()
  const notifications = currentTasksQuery.data ?? []
  const [open, setOpen] = useState(false)
  const [pendingId, setPendingId] = useState('')
  const [error, setError] = useState('')
  const loading = currentTasksQuery.isLoading

  if (!auth.initialized || auth.loading || auth.isGuest) {
    return null
  }

  const openNotification = async (notification: AppNotification) => {
    if (pendingId) {
      return
    }

    const target = notification.actionUrl ? normalizeNotificationActionUrl(notification.actionUrl) : ''
    const externalTarget = /^https?:\/\//i.test(target)
    const internalTarget = target && !externalTarget ? activateNotificationTarget(target) : ''
    const continueOpening = async () => {
      setPendingId(notification.id)
      setError('')

      try {
        if (notification.completionMode === 'read' && auth.me?.id) {
          await markCurrentTaskRead(auth.me.id, notification.id)
        }
        if (internalTarget) {
          navigate(internalTarget)
        }
        setOpen(false)

        if (!target) {
          return
        }

        if (externalTarget) {
          window.location.assign(target)
        }
      } catch (reason) {
        console.warn('Failed to open notification.', reason)
        setError(t('notificationOpenFailed'))
      } finally {
        setPendingId('')
      }
    }

    if (target && !confirmUnsavedChangesNavigation(target, () => {
      continueOpening().catch(() => undefined)
    })) {
      return
    }

    await continueOpening()
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="alife-icon-button relative"
        aria-label={t('notificationCenter')}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell aria-hidden="true" className="h-5 w-5" />
        {loading ? (
          <span className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-emerald-700">
            <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
          </span>
        ) : notifications.length > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold leading-5 text-white">
            {notifications.length > 99 ? '99+' : notifications.length}
          </span>
        ) : null}
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ y: -6, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -6, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-950">{t('notificationCenter')}</p>
                <p className="truncate text-xs text-slate-600">{t('notificationActiveCount', { count: notifications.length })}</p>
              </div>
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label={auth.language === 'zh' ? '关闭消息' : 'Close notifications'}
                onClick={() => setOpen(false)}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[26rem] overflow-y-auto p-3">
              {error ? (
                <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
              ) : null}

              {notifications.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                  {auth.language === 'zh' ? '目前没有未读消息。' : 'No unread messages right now.'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {notifications.map((notification) => {
                    const title = localizeNotificationText(notification.title, auth.language) || t('notification')
                    const body = localizeNotificationText(notification.body, auth.language)
                    const dateLabel = formatNotificationDate(notification.createdUtc, auth.language)
                    const actionLabel = t(getNotificationActionLabelKey(notification))
                    const isPending = pendingId === notification.id
                    const ActionIcon = notification.actionUrl ? ArrowRight : Check

                    return (
                      <li key={notification.id}>
                        <button
                          type="button"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-70"
                          disabled={Boolean(pendingId)}
                          onClick={() => void openNotification(notification)}
                        >
                          <span className="flex items-start justify-between gap-3">
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-slate-950">{title}</span>
                              {body ? <span className="mt-1 block text-sm text-slate-600">{body}</span> : null}
                              {dateLabel ? <span className="mt-2 block text-xs text-slate-500">{dateLabel}</span> : null}
                              <span className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-md bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white">
                                <span className="truncate">{actionLabel}</span>
                                <ActionIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                              </span>
                            </span>
                            {isPending ? (
                              <Loader2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-emerald-700" />
                            ) : null}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export default NotificationToastHost
