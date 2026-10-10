import { eventEnrollmentPanelText } from '../../i18n/eventEnrollmentPanel.ts'
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
  const statusText = (row: EventEnrollmentRecord) => row.status === 'cancelled' ? (zh ? eventEnrollmentPanelText.cancelled.zh : eventEnrollmentPanelText.cancelled.en) : row.status === 'waitlisted' ? (zh ? eventEnrollmentPanelText.waitlistPosition.zh(row.waitlistPosition ?? '—') : eventEnrollmentPanelText.waitlistPosition.en(row.waitlistPosition ?? '—')) : (zh ? eventEnrollmentPanelText.confirmed.zh : eventEnrollmentPanelText.confirmed.en)
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
      {capacity ? <AppSectionCard title={zh ? eventEnrollmentPanelText.registrationCapacity.zh : eventEnrollmentPanelText.registrationCapacity.en} summary={zh ? eventEnrollmentPanelText.peopleConfirmedWaitlistedCapacity.zh(capacity.confirmed, capacity.waitlisted, capacity.capacity) : eventEnrollmentPanelText.peopleConfirmedWaitlistedCapacity.en(capacity.confirmed, capacity.waitlisted, capacity.capacity)}><p className="text-sm">{zh ? eventEnrollmentPanelText.capacityConfirmedWaitlisted.zh(capacity.capacity, capacity.confirmed, capacity.waitlisted) : eventEnrollmentPanelText.capacityConfirmedWaitlisted.en(capacity.capacity, capacity.confirmed, capacity.waitlisted)}</p>{!capacity.isOpen ? <p className="mt-2 text-sm text-amber-800">{zh ? eventEnrollmentPanelText.registrationIsClosedOrItsConditionsAreNotMet.zh : eventEnrollmentPanelText.registrationIsClosedOrItsConditionsAreNotMet.en}</p> : null}{capacity.overCapacity ? <p role="alert" className="mt-2 text-sm text-amber-800">{zh ? eventEnrollmentPanelText.existingConfirmedRegistrationsExceedCapacityTheirPlacesAreRetained.zh : eventEnrollmentPanelText.existingConfirmedRegistrationsExceedCapacityTheirPlacesAreRetained.en}</p> : null}</AppSectionCard> : null}
      {message ? (
        <AppSectionCard dense>
          <p className={message === text.withdrawSuccess ? 'text-sm text-emerald-700' : 'text-sm text-rose-700'}>{message}</p>
        </AppSectionCard>
      ) : null}

      {currentEnrollment ? (
        <AppSectionCard
          dense
          title={statusText(currentEnrollment)} summary={statusText(currentEnrollment)}
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
            {currentEnrollment.status === 'waitlisted' ? <p className="mt-2 text-sm">{zh ? eventEnrollmentPanelText.aPlaceIsNotYetConfirmedYouWillReceive.zh : eventEnrollmentPanelText.aPlaceIsNotYetConfirmedYouWillReceive.en}</p> : null}
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

      <AppSectionCard dense title={`${text.enrollments} (${enrollments.length})`} summary={loading ? text.loading : (language === 'zh' ? eventEnrollmentPanelText.enrollments.zh(enrollments.length) : eventEnrollmentPanelText.enrollments.en(enrollments.length))}>
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
