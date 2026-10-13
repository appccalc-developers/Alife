import { Link } from 'react-router-dom'
import { eventEnrollmentPanelText } from '../../i18n/eventEnrollmentPanel.ts'
import type { RegistrationApplication, RegistrationPerson, RegistrationWork } from '../../services/eventRegistrationWorkService'
import { registrationStatus } from '../../services/eventRegistrationWorkService'
import AppBadge from '../layout/AppBadge'
import { EventToolSection as AppSectionCard } from './ArrangementTileDeck'

const activeParticipant = (participant: RegistrationPerson) =>
  !['cancelled', 'expired'].includes(participant.seatStatus)

const applicationBelongsTo = (application: RegistrationApplication, memberId: string | undefined) =>
  Boolean(memberId) && (application.organiserMemberId === memberId || application.participants.some(participant =>
    participant.memberId === memberId || participant.guardianMemberId === memberId))

const EventEnrollmentPanel = ({
  eventId,
  work,
  language,
  memberId,
  isGuest,
  loading,
}: {
  eventId: string
  work: RegistrationWork | null
  language: string
  memberId?: string
  isGuest: boolean
  loading: boolean
}) => {
  const zh = language === 'zh'
  const ownApplications = work?.applications.filter(application => applicationBelongsTo(application, memberId)) ?? []
  const ownParticipants = ownApplications.flatMap(application => application.participants).filter(activeParticipant)
  const capacity = work?.policy?.rules.capacity ?? 0
  const openLabel = work?.publiclyOpen
    ? (zh ? eventEnrollmentPanelText.registrationOpen.zh : eventEnrollmentPanelText.registrationOpen.en)
    : (zh ? eventEnrollmentPanelText.registrationClosed.zh : eventEnrollmentPanelText.registrationClosed.en)

  return (
    <div className="space-y-5">
      {loading ? <p role="status" className="text-sm text-slate-500">{zh ? eventEnrollmentPanelText.loading.zh : eventEnrollmentPanelText.loading.en}</p> : null}
      {work ? (
        <AppSectionCard
          title={zh ? eventEnrollmentPanelText.registrationCapacity.zh : eventEnrollmentPanelText.registrationCapacity.en}
          summary={zh
            ? eventEnrollmentPanelText.peopleConfirmedWaitlistedCapacity.zh(work.confirmed, work.waitlisted, capacity)
            : eventEnrollmentPanelText.peopleConfirmedWaitlistedCapacity.en(work.confirmed, work.waitlisted, capacity)}
        >
          <div className="flex flex-wrap items-center gap-3">
            <AppBadge variant={work.publiclyOpen ? 'success' : 'neutral'}>{openLabel}</AppBadge>
            <p className="text-sm text-slate-700">
              {zh
                ? eventEnrollmentPanelText.capacityConfirmedWaitlisted.zh(capacity, work.confirmed, work.waitlisted)
                : eventEnrollmentPanelText.capacityConfirmedWaitlisted.en(capacity, work.confirmed, work.waitlisted)}
            </p>
          </div>
          {!work.publiclyOpen ? <p className="mt-2 text-sm text-amber-800">{zh ? eventEnrollmentPanelText.registrationIsClosedOrItsConditionsAreNotMet.zh : eventEnrollmentPanelText.registrationIsClosedOrItsConditionsAreNotMet.en}</p> : null}
        </AppSectionCard>
      ) : null}

      {isGuest ? (
        <AppSectionCard dense title={zh ? eventEnrollmentPanelText.signInToRegister.zh : eventEnrollmentPanelText.signInToRegister.en}>
          <p className="text-sm text-slate-600">{zh ? eventEnrollmentPanelText.signInHint.zh : eventEnrollmentPanelText.signInHint.en}</p>
        </AppSectionCard>
      ) : work ? (
        <AppSectionCard
          dense
          title={zh ? eventEnrollmentPanelText.myRegistration.zh : eventEnrollmentPanelText.myRegistration.en}
          summary={ownParticipants.length
            ? (zh ? eventEnrollmentPanelText.myParticipants.zh(ownParticipants.length) : eventEnrollmentPanelText.myParticipants.en(ownParticipants.length))
            : (zh ? eventEnrollmentPanelText.noCurrentRegistration.zh : eventEnrollmentPanelText.noCurrentRegistration.en)}
        >
          {ownParticipants.length ? (
            <ul className="space-y-2">
              {ownParticipants.map(participant => (
                <li key={participant.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <span className="font-medium text-slate-950">{participant.displayName}</span>
                  <AppBadge variant={participant.seatStatus === 'waitlisted' ? 'warning' : participant.seatStatus === 'confirmed' ? 'success' : 'neutral'}>
                    {registrationStatus(participant.seatStatus, zh)}
                  </AppBadge>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-600">{zh ? eventEnrollmentPanelText.noCurrentRegistration.zh : eventEnrollmentPanelText.noCurrentRegistration.en}</p>}
          <Link className="mt-4 inline-flex min-h-11 items-center font-semibold text-[#176b5a] underline" to={`/events/${eventId}/registration-work`}>
            {zh ? eventEnrollmentPanelText.openRegistrationWorkspace.zh : eventEnrollmentPanelText.openRegistrationWorkspace.en}
          </Link>
        </AppSectionCard>
      ) : !loading ? (
        <AppSectionCard dense title={zh ? eventEnrollmentPanelText.registrationUnavailable.zh : eventEnrollmentPanelText.registrationUnavailable.en}>
          <p className="text-sm text-slate-600">{zh ? eventEnrollmentPanelText.registrationUnavailableHint.zh : eventEnrollmentPanelText.registrationUnavailableHint.en}</p>
          <Link className="mt-4 inline-flex min-h-11 items-center font-semibold text-[#176b5a] underline" to={`/events/${eventId}/registration-work`}>
            {zh ? eventEnrollmentPanelText.openRegistrationWorkspace.zh : eventEnrollmentPanelText.openRegistrationWorkspace.en}
          </Link>
        </AppSectionCard>
      ) : null}
    </div>
  )
}

export default EventEnrollmentPanel
