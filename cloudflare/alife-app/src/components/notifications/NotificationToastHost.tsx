import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Bell, Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { notificationService } from '../../services/notificationService'
import { useAuthStore } from '../../stores/auth'
import type { AppNotification, NotificationText } from '../../types/notification'
import { useUiText, type UiTextKey } from '../../i18n/uiText'

const localizeNotificationText = (value: NotificationText | undefined, language: string) => {
  if (!value) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  return language === 'zh'
    ? value.zh || value.cn || value.en || Object.values(value)[0] || ''
    : value.en || value.zh || value.cn || Object.values(value)[0] || ''
}

const formatNotificationDate = (value: string | undefined, language: string) => {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-NZ', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const normalizeActionUrl = (actionUrl: string) => {
  const trimmed = actionUrl.trim()
  if (!trimmed) {
    return ''
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed.replace(/^\/+/, '')}`
}

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
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pendingId, setPendingId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!auth.initialized || auth.loading || auth.isGuest) {
      setNotifications([])
      setExpanded(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    notificationService
      .getOpenNotifications()
      .then((items) => {
        if (!cancelled) {
          setNotifications(items)
          setExpanded(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNotifications([])
          setExpanded(false)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [auth.initialized, auth.isGuest, auth.loading, auth.me?.id])

  useEffect(() => {
    if (notifications.length === 0) {
      setExpanded(false)
    }
  }, [notifications.length])

  if (notifications.length === 0) {
    return null
  }

  const openNotification = async (notification: AppNotification) => {
    if (pendingId) {
      return
    }

    setPendingId(notification.id)
    setError('')

    try {
      await notificationService.openNotification(notification.id)
      setNotifications((current) => current.filter((item) => item.id !== notification.id))

      const target = notification.actionUrl ? normalizeActionUrl(notification.actionUrl) : ''
      if (!target) {
        return
      }

      if (/^https?:\/\//i.test(target)) {
        window.location.assign(target)
      } else {
        navigate(target)
      }
    } catch (reason) {
      console.warn('Failed to open notification.', reason)
      setError(t('notificationOpenFailed'))
    } finally {
      setPendingId('')
    }
  }

  return (
    <section className="sticky top-16 z-10 border-b border-emerald-200 bg-emerald-50/95 shadow-sm backdrop-blur">
      <div className="desktop:pl-72">
        <div className="px-4 py-2 sm:px-6 desktop:px-8">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Bell aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-950">{t('notificationCenter')}</span>
                <span className="block truncate text-xs text-slate-600">
                  {t('notificationActiveCount', { count: notifications.length })}
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2 text-emerald-700">
              {loading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
              {expanded ? <ChevronUp aria-hidden="true" className="h-5 w-5" /> : <ChevronDown aria-hidden="true" className="h-5 w-5" />}
            </span>
          </button>

          <AnimatePresence initial={false}>
            {expanded ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-2">
                  {error ? (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
                  ) : null}
                  <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
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
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-70"
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
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

export default NotificationToastHost
