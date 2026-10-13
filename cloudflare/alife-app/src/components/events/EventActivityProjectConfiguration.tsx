import { useState, type FormEvent } from 'react'
import type { PlannedActivity } from '../../types/eventActivityPlan'
import type { EventOccurrence } from '../../types/eventOperations'
import type { EventVenueReservation } from '../../types/eventVenue'
import type { ActivityActionRequest, ActivityOffer, ActivityOperationsWorkspace, ActivityProjectOperations, ActivityProjectRules, ActivitySpaceRequest } from '../../types/eventActivityOperations'
import { eventActivityOperationsText as copy } from '../../i18n/eventActivityOperations'
import { BilingualField, creationInput } from './creation/CreationFields'
import { localPreparationDate } from '../../utils/eventSavedPreparation'
import { localTimeToUtc } from '../../../../shared/eventDetails'
import { eventActivityOperationsService as service, newActivityETag } from '../../services/eventActivityOperationsService'
import { currencyScale } from '../../services/eventRegistrationWorkService'
import AppActionButton from '../layout/AppActionButton'
import useConfirmation from '../../hooks/useConfirmation'
import { useArrangementDraft } from './ArrangementTileDeck'

type Language = 'en' | 'zh'
export type ActivityOperationsMutation = (action: () => Promise<ActivityOperationsWorkspace>) => Promise<void>
type Mutation = ActivityOperationsMutation
const text = (key: { en: string; zh: string }, language: Language) => key[language]
const name = (value: { en: string; zh: string }, language: Language) => value[language] || value.en || value.zh
const labelClass = 'grid gap-1 text-sm font-semibold text-[#40554e]'
const blank = { en: '', zh: '' }

type Props = { eventId: string; activity: PlannedActivity; project: ActivityProjectOperations | undefined; workspace: ActivityOperationsWorkspace | null; occurrences: EventOccurrence[]; reservations: EventVenueReservation[]; timeZone: string; language: Language; planDirty: boolean; busy: boolean; mutate: Mutation }

export default function EventActivityProjectConfiguration({ eventId, activity, project, workspace, occurrences, reservations, timeZone, language, planDirty, busy, mutate }: Props) {
  if (!workspace || !project) return <p className="text-sm text-amber-900">{text(copy.saveProjectFirst, language)}</p>
  const selectionEnabled = activity.answers?.projectSelection?.value === 'yes'
  return <div className="space-y-4" data-project-configuration={activity.id}>
    {planDirty ? <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{text(copy.savePlanFirst, language)}</p> : null}
    {!selectionEnabled ? <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{text(copy.selectionRequiredForPolicy, language)}</p> : null}
    <PolicyEditor key={project.policy?.eTag ?? 'new'} eventId={eventId} activityId={activity.id} defaults={activity.defaultConfiguration} project={project} workspace={workspace} timeZone={timeZone} language={language} disabled={busy || planDirty} mutate={mutate}/>
    {project.policy ? <details className="rounded-xl border border-[#2f4b42]/15 bg-white p-3"><summary className="min-h-11 cursor-pointer py-2 font-bold text-[#18332d]">{text(copy.sessions, language)} · {project.offers.length}</summary>
      <div className="space-y-3 pt-2">{occurrences.filter(o => o.status !== 'cancelled' && (!activity.occurrenceId || activity.occurrenceId === o.id)).map(occurrence => <OfferEditor key={`${occurrence.id}:${project.offers.find(x => x.occurrenceId === occurrence.id)?.eTag ?? 'new'}`} eventId={eventId} activityId={activity.id} occurrence={occurrence} offer={project.offers.find(x => x.occurrenceId === occurrence.id)} policy={project.policy!} reservations={reservations} timeZone={timeZone} language={language} workspace={workspace} disabled={busy || planDirty} selectionEnabled={selectionEnabled} mutate={mutate}/>)}</div>
      {!occurrences.length ? <p className="text-sm text-[#66766f]">{text(copy.noSessions, language)}</p> : null}
    </details> : null}
    {project.participations.length ? <ParticipationList eventId={eventId} project={project} workspace={workspace} language={language} busy={busy} mutate={mutate}/> : null}
  </div>
}

type PolicyDraft = Omit<ActivityProjectRules, 'minimumAge' | 'maximumAge' | 'capacity' | 'feeMinor' | 'opensUtc' | 'deadlineUtc'> & { capacity: string; fee: string; opens: string; deadline: string; minimumAge: string; maximumAge: string }
function draftPolicy(policy: Partial<ActivityProjectRules> | undefined | null, timeZone: string): PolicyDraft {
  return { eligibility: policy?.eligibility ?? { ...blank }, minimumAge: policy?.minimumAge?.toString() ?? '', maximumAge: policy?.maximumAge?.toString() ?? '', capacity: policy?.capacity?.toString() ?? '', allowWaitlist: policy?.allowWaitlist ?? false,
    requiresGuardianConsent: policy?.requiresGuardianConsent ?? false, fee: policy?.feeMinor != null ? String(policy.feeMinor / currencyScale(policy.currency ?? 'NZD')) : '', currency: policy?.currency ?? 'NZD',
    opens: policy?.opensUtc ? localPreparationDate(policy.opensUtc, timeZone) : '', deadline: policy?.deadlineUtc ? localPreparationDate(policy.deadlineUtc, timeZone) : '',
    needsSpace: policy?.needsSpace ?? false, terms: policy?.terms ?? { ...blank }, feeChargeScope: policy?.feeChargeScope ?? 'perOccurrence' }
}
function PolicyEditor({ eventId, activityId, defaults, project, workspace, timeZone, language, disabled, mutate }: { eventId: string; activityId: string; defaults: PlannedActivity['defaultConfiguration']; project: ActivityProjectOperations; workspace: ActivityOperationsWorkspace; timeZone: string; language: Language; disabled: boolean; mutate: Mutation }) {
  const [draft, setDraft] = useState(() => draftPolicy(project.policy?.rules ?? defaults, timeZone))
  const [reason, setReason] = useState('')
  const change = <K extends keyof PolicyDraft>(key: K, value: PolicyDraft[K]) => setDraft(p => ({ ...p, [key]: value }))
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftPolicy(project.policy?.rules ?? defaults, timeZone))
  useArrangementDraft(workspace.canConfigure && dirty)
  const save = (event: FormEvent) => {
    event.preventDefault()
    if (disabled || !workspace.canConfigure) return
    let opensUtc: string, deadlineUtc: string
    try { opensUtc = localTimeToUtc(draft.opens, timeZone); deadlineUtc = localTimeToUtc(draft.deadline, timeZone) } catch { return }
    const rules: ActivityProjectRules = { eligibility: draft.eligibility, minimumAge: draft.minimumAge === '' ? null : Number(draft.minimumAge), maximumAge: draft.maximumAge === '' ? null : Number(draft.maximumAge),
      capacity: Number(draft.capacity), allowWaitlist: draft.allowWaitlist, requiresGuardianConsent: draft.requiresGuardianConsent, feeMinor: Math.round(Number(draft.fee) * currencyScale(draft.currency.toUpperCase())), currency: draft.currency.toUpperCase(),
      opensUtc, deadlineUtc, needsSpace: draft.needsSpace, terms: draft.terms, feeChargeScope: draft.feeChargeScope }
    void mutate(() => service.policy(eventId, activityId, rules, project.policy?.eTag ?? newActivityETag))
  }
  const feeAction = (operation: 'submit' | 'approve' | 'return') => { if (!project.policy) return; void mutate(() => service.feeAction(eventId, activityId, operation, project.policy!.eTag, { evidence: reason })) }
  return <details className="rounded-xl border border-[#2f4b42]/15 bg-[#fbfcf8] p-3" data-project-policy><summary className="min-h-11 cursor-pointer py-2 font-bold text-[#18332d]">{text(copy.policy, language)} {project.policy ? <span className="text-xs font-normal text-[#66766f]">· {copy.policyVersion[language](project.policy.version)}</span> : null}</summary>
    {workspace.canConfigure ? <form className="grid gap-3 pt-2 md:grid-cols-2" onSubmit={save}><fieldset disabled={disabled} className="contents">
      <label className={labelClass}>{text(copy.capacity, language)}<input className={creationInput} type="number" min="0" max="1000000" required value={draft.capacity} onChange={e => change('capacity', e.target.value)}/></label>
      <label className={labelClass}>{text(copy.currency, language)}<input className={creationInput} maxLength={3} pattern="[A-Za-z]{3}" required value={draft.currency} onChange={e => change('currency', e.target.value)}/></label>
      <label className={labelClass}>{text(copy.minAge, language)}<input className={creationInput} type="number" min="0" max="130" value={draft.minimumAge} onChange={e => change('minimumAge', e.target.value)}/></label>
      <label className={labelClass}>{text(copy.maxAge, language)}<input className={creationInput} type="number" min="0" max="130" value={draft.maximumAge} onChange={e => change('maximumAge', e.target.value)}/></label>
      <label className={labelClass}>{text(copy.fee, language)}<input className={creationInput} type="number" min="0" step={1 / currencyScale(draft.currency.toUpperCase())} required value={draft.fee} onChange={e => change('fee', e.target.value)}/></label>
      <label className={labelClass}>{text(copy.feeScope, language)}<select className={creationInput} value={draft.feeChargeScope} onChange={e => change('feeChargeScope', e.target.value as ActivityProjectRules['feeChargeScope'])}><option value="perOccurrence">{text(copy.perOccurrence, language)}</option><option value="oncePerSeries">{text(copy.oncePerSeries, language)}</option></select></label>
      <label className={labelClass}>{text(copy.opens, language)}<input className={creationInput} type="datetime-local" required value={draft.opens} onChange={e => change('opens', e.target.value)}/></label>
      <label className={labelClass}>{text(copy.deadline, language)}<input className={creationInput} type="datetime-local" required value={draft.deadline} onChange={e => change('deadline', e.target.value)}/></label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.allowWaitlist} onChange={e => change('allowWaitlist', e.target.checked)}/>{text(copy.waitlist, language)}</label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.requiresGuardianConsent} onChange={e => change('requiresGuardianConsent', e.target.checked)}/>{text(copy.guardianConsent, language)}</label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={draft.needsSpace} onChange={e => change('needsSpace', e.target.checked)}/>{text(copy.needsSpace, language)}</label>
      <BilingualField primaryLanguage={language} label={text(copy.eligibility, language)} value={draft.eligibility} onChange={value => change('eligibility', value)} multiline maxLength={4000}/>
      <BilingualField primaryLanguage={language} label={text(copy.terms, language)} value={draft.terms} onChange={value => change('terms', value)} multiline required maxLength={4000}/>
      <AppActionButton type="submit" variant="primary" disabled={disabled}>{text(copy.savePolicy, language)}</AppActionButton>
    </fieldset></form> : project.policy ? <div className="pt-2 text-sm text-[#40554e]"><p>{text(copy.capacity, language)}: {project.policy.rules.capacity}</p><p>{text(copy.fee, language)}: {money(project.policy.rules.feeMinor, project.policy.rules.currency, language)}</p><p>{name(project.policy.rules.terms, language)}</p></div> : <p className="pt-2 text-sm text-[#66766f]">{text(copy.noPolicy, language)}</p>}
    {project.policy && project.policy.rules.feeMinor > 0 ? <div className="mt-4 rounded-lg border border-[#2f4b42]/15 p-3"><p className="text-sm font-bold">{text(copy.feeApproval, language)} · {project.policy.feeApprovalStatus}</p>
      {(workspace.canFinance || workspace.canApproveFees) ? <div className="mt-2 flex flex-wrap items-end gap-2"><label className={labelClass}>{text(copy.reason, language)}<input className={creationInput} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)}/></label>
        {workspace.canFinance && project.policy.feeApprovalStatus !== 'pending' && project.policy.feeApprovalStatus !== 'approved' ? <AppActionButton disabled={disabled} onClick={() => feeAction('submit')}>{text(copy.submitFee, language)}</AppActionButton> : null}
        {workspace.canApproveFees && project.policy.feeApprovalStatus === 'pending' ? <><AppActionButton disabled={disabled} variant="primary" onClick={() => feeAction('approve')}>{text(copy.approveFee, language)}</AppActionButton><AppActionButton disabled={disabled || !reason.trim()} onClick={() => feeAction('return')}>{text(copy.returnFee, language)}</AppActionButton></> : null}</div> : null}
    </div> : null}
  </details>
}

function money(minor: number, currency: string, language: Language) { return new Intl.NumberFormat(language === 'zh' ? 'zh-NZ' : 'en-NZ', { style: 'currency', currency }).format(minor / currencyScale(currency)) }

function OfferEditor({ eventId, activityId, occurrence, offer, policy, reservations, timeZone, language, workspace, disabled, selectionEnabled, mutate }: { eventId: string; activityId: string; occurrence: EventOccurrence; offer?: ActivityOffer; policy: NonNullable<ActivityProjectOperations['policy']>; reservations: EventVenueReservation[]; timeZone: string; language: Language; workspace: ActivityOperationsWorkspace; disabled: boolean; selectionEnabled: boolean; mutate: Mutation }) {
  const [start, setStart] = useState(() => localPreparationDate(offer?.startUtc ?? occurrence.startUtc, timeZone))
  const [end, setEnd] = useState(() => localPreparationDate(offer?.endUtc ?? occurrence.endUtc, timeZone))
  const [reason, setReason] = useState('')
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const canEdit = workspace.canConfigure && !disabled
  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!canEdit) return
    try { void mutate(() => service.offer(eventId, activityId, occurrence.id, localTimeToUtc(start, timeZone), localTimeToUtc(end, timeZone), offer?.eTag ?? newActivityETag)) } catch { /* native time inputs are validated before submit */ }
  }
  const act = async (operation: 'open' | 'close' | 'cancel') => {
    if (!offer || !workspace.canManage || disabled || operation === 'open' && !selectionEnabled) return
    if (operation === 'cancel' && !(await requestConfirmation({ title: text(copy.cancelTitle, language), description: text(copy.cancelDescription, language), tone: 'danger' }))) return
    await mutate(() => service.offerAction(eventId, offer.id, operation, offer.eTag, { evidence: reason }))
  }
  const used = offer ? offer.confirmed + offer.reserved : 0
  return <section className="rounded-xl border border-[#2f4b42]/15 bg-[#f7f9f5] p-3" data-project-offer={occurrence.id}>
    <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="font-bold text-[#18332d]">{new Date(occurrence.startUtc).toLocaleString(language, { timeZone })}</h4>
      {offer ? <span className="rounded-full bg-[#e3f0eb] px-2 py-1 text-xs font-bold text-[#0d4f43]">{copy.statusNames[offer.status]?.[language] ?? offer.status} · {copy.availability[language](used, offer.capacity, offer.waitlisted)}</span> : null}</div>
    {workspace.canConfigure ? <form onSubmit={save} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className={labelClass}>{text(copy.start, language)}<input className={creationInput} type="datetime-local" required disabled={!canEdit} value={start} onChange={e => setStart(e.target.value)}/></label><label className={labelClass}>{text(copy.end, language)}<input className={creationInput} type="datetime-local" required disabled={!canEdit} value={end} onChange={e => setEnd(e.target.value)}/></label><AppActionButton className="self-end" type="submit" disabled={!canEdit}>{text(copy.saveSession, language)}</AppActionButton></form> : offer ? <p className="mt-2 text-sm">{new Date(offer.startUtc).toLocaleString(language, { timeZone })} – {new Date(offer.endUtc).toLocaleString(language, { timeZone })}</p> : null}
    {offer && workspace.canManage ? <div className="mt-3 flex flex-wrap items-end gap-2"><label className={labelClass}>{text(copy.reason, language)}<input className={creationInput} maxLength={2000} disabled={disabled} value={reason} onChange={e => setReason(e.target.value)}/></label>
      {offer.status !== 'open' && offer.status !== 'cancelled' ? <AppActionButton variant="primary" disabled={disabled || !selectionEnabled} onClick={() => void act('open')}>{text(copy.open, language)}</AppActionButton> : null}
      {offer.status === 'open' ? <AppActionButton disabled={disabled} onClick={() => void act('close')}>{text(copy.close, language)}</AppActionButton> : null}
      {offer.status !== 'cancelled' ? <AppActionButton variant="danger" disabled={disabled || !reason.trim()} onClick={() => void act('cancel')}>{text(copy.cancel, language)}</AppActionButton> : null}
    </div> : null}
    {offer && policy.rules.needsSpace ? <SpaceEditor key={offer.space?.eTag ?? 'new'} eventId={eventId} offer={offer} reservations={reservations} language={language} workspace={workspace} disabled={disabled} mutate={mutate}/> : null}
    {confirmationModal}
  </section>
}

function SpaceEditor({ eventId, offer, reservations, language, workspace, disabled, mutate }: { eventId: string; offer: ActivityOffer; reservations: EventVenueReservation[]; language: Language; workspace: ActivityOperationsWorkspace; disabled: boolean; mutate: Mutation }) {
  const [kind, setKind] = useState<'internal' | 'external'>(offer.space?.kind ?? 'external')
  const [reservationId, setReservationId] = useState(offer.space?.reservationId ?? '')
  const [spaceName, setSpaceName] = useState(offer.space?.name ?? { ...blank })
  const [status, setStatus] = useState<ActivitySpaceRequest['status']>(offer.space?.status as ActivitySpaceRequest['status'] ?? 'draft')
  const [evidence, setEvidence] = useState('')
  const available = reservations.filter(r => r.status === 'confirmed' && (!r.eventOccurrenceId || r.eventOccurrenceId === offer.occurrenceId) && new Date(r.startUtc) <= new Date(offer.startUtc) && new Date(r.endUtc) >= new Date(offer.endUtc))
  const save = (event: FormEvent) => { event.preventDefault(); void mutate(() => service.space(eventId, offer.id, { kind, reservationId: kind === 'internal' ? reservationId || null : null, name: spaceName, status, evidence }, offer.space?.eTag ?? newActivityETag)) }
  return <details className="mt-3 rounded-lg border border-sky-200 bg-sky-50/40 p-3"><summary className="min-h-10 cursor-pointer font-semibold text-[#18332d]">{text(copy.space, language)} · {offer.space ? (copy.statusNames[offer.space.status]?.[language] ?? offer.space.status) : text(copy.draft, language)}</summary>
    {workspace.canManageSpace ? <form onSubmit={save} className="grid gap-3 pt-3 md:grid-cols-2"><fieldset disabled={disabled} className="contents"><label className={labelClass}>{text(copy.space, language)}<select className={creationInput} value={kind} onChange={e => setKind(e.target.value as 'internal' | 'external')}><option value="external">{text(copy.external, language)}</option><option value="internal">{text(copy.internal, language)}</option></select></label>
      {kind === 'internal' ? <label className={labelClass}>{text(copy.reservation, language)}<select className={creationInput} value={reservationId} required onChange={e => setReservationId(e.target.value)}><option value="">{text(copy.selectReservation, language)}</option>{available.map(row => <option value={row.id} key={row.id}>{name(row.venueName, language)} · {new Date(row.startUtc).toLocaleString(language)}</option>)}</select></label> : null}
      <label className={labelClass}>{text(copy.spaceStatus, language)}<select className={creationInput} value={status} onChange={e => setStatus(e.target.value as ActivitySpaceRequest['status'])}>{(['draft', 'awaitingConfirmation', 'confirmed', 'refused', 'cancelled'] as const).map(code => <option key={code} value={code}>{copy.statusNames[code]?.[language] ?? copy[code][language]}</option>)}</select></label>
      <BilingualField primaryLanguage={language} label={text(copy.spaceName, language)} value={spaceName} onChange={setSpaceName} required maxLength={4000}/>
      <label className={`${labelClass} md:col-span-2`}>{text(copy.evidence, language)}<textarea className={`${creationInput} py-2`} maxLength={2000} required={kind === 'external' && status === 'confirmed'} value={evidence} onChange={e => setEvidence(e.target.value)}/></label>
      <AppActionButton type="submit" disabled={disabled}>{text(copy.saveSpace, language)}</AppActionButton></fieldset></form> : offer.space ? <p className="mt-2 text-sm">{name(offer.space.name, language)}</p> : <p className="mt-2 text-sm text-[#66766f]">{text(copy.notAvailable, language)}</p>}
  </details>
}

function ParticipationList({ eventId, project, workspace, language, busy, mutate }: { eventId: string; project: ActivityProjectOperations; workspace: ActivityOperationsWorkspace; language: Language; busy: boolean; mutate: Mutation }) {
  return <details className="rounded-xl border border-[#2f4b42]/15 bg-white p-3"><summary className="min-h-11 cursor-pointer py-2 font-bold">{text(copy.participant, language)} · {project.participations.length}</summary>
    <div className="divide-y divide-[#2f4b42]/10">{project.participations.map(row => <ActivityParticipationRow key={row.eTag} eventId={eventId} row={row} person={workspace.participants.find(p => p.participantId === row.participantId)} workspace={workspace} language={language} busy={busy} mutate={mutate}/>)}</div>
  </details>
}

export function ActivityParticipationRow({ eventId, row, person, workspace, language, busy, mutate }: { eventId: string; row: ActivityProjectOperations['participations'][number]; person?: ActivityOperationsWorkspace['participants'][number]; workspace: ActivityOperationsWorkspace; language: Language; busy: boolean; mutate: Mutation }) {
  const [evidence, setEvidence] = useState(''), [amount, setAmount] = useState(''), [verifiedAt, setVerifiedAt] = useState('')
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const action = async (operation: 'consent' | 'verify-consent' | 'verify-eligibility' | 'complete' | 'cancel' | 'payment' | 'refund') => {
    if (operation === 'cancel' && !(await requestConfirmation({ title: text(copy.cancelParticipationTitle, language), description: text(copy.cancelParticipationDescription, language), tone: 'danger' }))) return
    const request: ActivityActionRequest = { evidence }
    if (operation === 'verify-consent') request.occurredUtc = new Date(verifiedAt).toISOString()
    if (operation === 'payment' || operation === 'refund') request.amountMinor = Math.round(Number(amount) * currencyScale(row.currency))
    await mutate(() => service.participationAction(eventId, row.id, operation, row.eTag, request))
  }
  const ended = row.seatStatus === 'cancelled' || row.seatStatus === 'expired'
  const canConsent = person?.canConsent === true
  const isCharge = row.feeMinor > 0 && (!row.chargeParticipationId || row.chargeParticipationId === row.id)
  const outstanding = row.feeMinor - row.paidMinor + row.refundedMinor
  return <div className="space-y-2 py-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{row.displayName}</strong><span>{copy.statusNames[row.seatStatus]?.[language] ?? row.seatStatus} · {copy.statusNames[row.procedureStatus]?.[language] ?? text(copy.unknownStatus, language)}</span></div>
    {row.eligibility ? <p className="text-[#40554e]">{text(copy.eligibilityStatus, language)}: {copy.statusNames[row.eligibility]?.[language] ?? row.eligibility}</p> : null}
    {isCharge ? <p>{text(copy.fee, language)}: {money(row.feeMinor, row.currency, language)} · {text(copy.alreadyPaid, language)}: {money(row.paidMinor, row.currency, language)} · {text(copy.alreadyRefunded, language)}: {money(row.refundedMinor, row.currency, language)}</p> : null}
    <div className="grid gap-2 sm:grid-cols-3"><label className={labelClass}>{text(copy.evidence, language)}<input className={creationInput} maxLength={2000} value={evidence} onChange={e => setEvidence(e.target.value)}/></label>
      {workspace.canManage ? <label className={labelClass}>{text(copy.verificationTime, language)}<input className={creationInput} type="datetime-local" value={verifiedAt} onChange={e => setVerifiedAt(e.target.value)}/></label> : null}
      {workspace.canFinance && isCharge ? <label className={labelClass}>{text(copy.amount, language)}<input className={creationInput} type="number" min={1 / currencyScale(row.currency)} step={1 / currencyScale(row.currency)} value={amount} onChange={e => setAmount(e.target.value)}/></label> : null}</div>
    <div className="flex flex-wrap gap-2">
      {canConsent && person?.isChild && !ended ? <AppActionButton size="sm" disabled={busy} onClick={() => void action('consent')}>{text(copy.consent, language)}</AppActionButton> : null}
      {workspace.canManage && !ended ? <><AppActionButton size="sm" disabled={busy || !evidence.trim() || !verifiedAt} onClick={() => void action('verify-consent')}>{text(copy.verifyConsent, language)}</AppActionButton><AppActionButton size="sm" disabled={busy || !evidence.trim()} onClick={() => void action('verify-eligibility')}>{text(copy.verifyEligibility, language)}</AppActionButton></> : null}
      {person?.canSelect && !ended ? <><AppActionButton size="sm" variant="primary" disabled={busy} onClick={() => void action('complete')}>{text(copy.complete, language)}</AppActionButton><AppActionButton size="sm" variant="danger" disabled={busy} onClick={() => void action('cancel')}>{text(copy.cancelParticipation, language)}</AppActionButton></> : null}
      {workspace.canFinance && isCharge && outstanding > 0 && !ended ? <AppActionButton size="sm" disabled={busy || !evidence.trim() || Number(amount) <= 0 || Math.round(Number(amount) * currencyScale(row.currency)) > outstanding} onClick={() => void action('payment')}>{text(copy.payment, language)}</AppActionButton> : null}
      {workspace.canFinance && isCharge && row.paidMinor > row.refundedMinor && ended ? <AppActionButton size="sm" disabled={busy || !evidence.trim() || Number(amount) <= 0 || Math.round(Number(amount) * currencyScale(row.currency)) > row.paidMinor - row.refundedMinor} onClick={() => void action('refund')}>{text(copy.refund, language)}</AppActionButton> : null}
    </div>{confirmationModal}
  </div>
}
