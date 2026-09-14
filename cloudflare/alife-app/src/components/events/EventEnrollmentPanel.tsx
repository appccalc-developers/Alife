import { useEffect, useState } from 'react'
import EnrollmentChatDialog from '../group/EnrollmentChatDialog'
import AppActionButton from '../layout/AppActionButton'
import AppBadge from '../layout/AppBadge'
import { EventToolSection as AppSectionCard } from './ArrangementTileDeck'
import useConfirmation from '../../hooks/useConfirmation'
import { enrollmentSessionService } from '../../services/enrollmentSessionService'
import { normalizeApiError } from '../../services/http'
import type { EventEnrollmentRecord, EnrollmentCapacity } from '../../types/enrollment'
import type { EventDto, GroupEventRecord } from '../../types/event'
import { getLabels, formatDateTime, parseEnrollmentPayload, isBeforeDeadline } from '../../utils/eventDetailPresentation'

const EnrollmentPanel = ({
  event,
  eventDto,
  enrollments,
  language,
  memberId,
  isGuest,
  loading,
  onRefresh,
}: {
  event: GroupEventRecord
  eventDto: EventDto
  enrollments: EventEnrollmentRecord[]
  language: string
  memberId?: string
  isGuest: boolean
  loading: boolean
  onRefresh: () => Promise<void>
}) => {
  const text = getLabels(language)
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const [deletingId, setDeletingId] = useState('')
  const [message, setMessage] = useState('')
  const currentEnrollment = memberId ? enrollments.find((item) => item.memberId === memberId && item.status !== 'cancelled') : undefined
  const [capacity, setCapacity] = useState<EnrollmentCapacity | null>(null)
  const zh = language === 'zh'
  const statusText = (row: EventEnrollmentRecord) => row.status === 'cancelled' ? (zh ? '已取消' : 'Cancelled') : row.status === 'waitlisted' ? (zh ? `候补第 ${row.waitlistPosition ?? '—'} 位` : `Waitlist position ${row.waitlistPosition ?? '—'}`) : (zh ? '正式报名' : 'Confirmed')
  useEffect(() => {
    let active = true
    if (!isGuest) void enrollmentSessionService.capacity(event.id).then(value => { if (active) setCapacity(value) }).catch(() => { if (active) setCapacity(null) })
    return () => { active = false }
  }, [event.id, memberId, isGuest, enrollments])
  const canWithdraw = isBeforeDeadline(eventDto.registrationDeadline)

  const withdraw = async () => {
    if (!currentEnrollment || !await requestConfirmation({
      title: text.withdrawTitle,
      description: text.withdrawConfirm,
      confirmLabel: text.withdraw,
      tone: 'danger',
    })) return
    setDeletingId(currentEnrollment.id)
    setMessage('')
    try {
      await enrollmentSessionService.deleteEnrollment(event.id, currentEnrollment.id)
      setMessage(text.withdrawSuccess)
      await onRefresh()
    } catch (reason) {
      setMessage(normalizeApiError(reason).message)
    } finally {
      setDeletingId('')
    }
  }

  return (
    <>
    <div className="space-y-5">
      {capacity ? <AppSectionCard title={zh ? '报名容量' : 'Registration capacity'}><p className="text-sm">{zh ? `容量 ${capacity.capacity} · 正式报名 ${capacity.confirmed} · 候补 ${capacity.waitlisted}` : `Capacity ${capacity.capacity} · Confirmed ${capacity.confirmed} · Waitlisted ${capacity.waitlisted}`}</p>{!capacity.isOpen ? <p className="mt-2 text-sm text-amber-800">{zh ? '报名当前未开放或条件未满足；候补队列保留，暂不递补。' : 'Registration is closed or its conditions are not met. The waitlist is retained without promotion.'}</p> : null}{capacity.overCapacity ? <p role="alert" className="mt-2 text-sm text-amber-800">{zh ? '历史正式报名已超过当前容量，现有名额保留。请由负责人复核容量。' : 'Existing confirmed registrations exceed capacity. Their places are retained; an organiser should review capacity.'}</p> : null}</AppSectionCard> : null}
      {message ? (
        <AppSectionCard dense>
          <p className={message === text.withdrawSuccess ? 'text-sm text-emerald-700' : 'text-sm text-rose-700'}>{message}</p>
        </AppSectionCard>
      ) : null}

      {currentEnrollment ? (
        <AppSectionCard
          dense
          title={statusText(currentEnrollment)}
          action={
            canWithdraw ? (
              <AppActionButton variant="danger" disabled={Boolean(deletingId)} onClick={() => void withdraw()}>
                {deletingId ? text.withdrawing : text.withdraw}
              </AppActionButton>
            ) : null
          }
        >
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3">
            <AppBadge variant={currentEnrollment.status === 'waitlisted' ? 'warning' : 'success'}>{statusText(currentEnrollment)}</AppBadge>
            {currentEnrollment.status === 'waitlisted' ? <p className="mt-2 text-sm">{zh ? '尚未获得正式名额。递补成功后会收到站内通知。' : 'A place is not yet confirmed. You will receive an in-app notification after promotion.'}</p> : null}
            {!canWithdraw ? <p className="mt-2 text-sm text-emerald-900">{text.withdrawClosed}</p> : null}
          </div>
        </AppSectionCard>
      ) : isGuest ? (
        <AppSectionCard dense title={text.enrollNow}>
          <p className="text-sm text-slate-600">{text.guestEnrollmentHint}</p>
        </AppSectionCard>
      ) : (
        <AppSectionCard dense title={text.enrollNow}>
          <EnrollmentChatDialog
            variant="page"
            groupId={event.groupId}
            event={event}
            memberId={memberId}
            language={language}
            onSuccess={(successMessage) => {
              setMessage(successMessage)
              window.setTimeout(() => {
                onRefresh().catch(() => undefined)
              }, 300)
            }}
          />
        </AppSectionCard>
      )}

      <AppSectionCard dense title={`${text.enrollments} (${enrollments.length})`}>
        {loading ? <p className="text-sm text-slate-500">{text.loading}</p> : null}
        {!loading && enrollments.length === 0 ? <p className="text-sm text-slate-500">{text.noEnrollments}</p> : null}
        <div className="space-y-2">
          {enrollments.map((enrollment) => {
            const payload = parseEnrollmentPayload(enrollment)
            const isCurrentUser = enrollment.memberId === memberId
            const applicantName = payload.applicantName || enrollment.memberId.slice(0, 8)
            const paymentCount = payload.paymentFiles?.length ?? 0
            return (
              <div
                key={enrollment.id}
                className={[
                  'rounded-lg border px-3 py-3',
                  isCurrentUser ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white',
                ].join(' ')}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{applicantName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {text.submitted}: {formatDateTime(payload.submittedAtUtc || enrollment.createdUtc, language) || '-'}
                    </p>
                  </div>
                  <AppBadge variant={enrollment.status === 'waitlisted' ? 'warning' : enrollment.status === 'cancelled' ? 'neutral' : 'success'}>{statusText(enrollment)}</AppBadge>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {text.paymentFiles}: {paymentCount}
                </p>
              </div>
            )
          })}
        </div>
      </AppSectionCard>
    </div>
    {confirmationModal}
    </>
  )
}


export default EnrollmentPanel
