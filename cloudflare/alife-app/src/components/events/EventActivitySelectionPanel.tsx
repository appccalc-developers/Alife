import { useCallback, useEffect, useMemo, useState } from 'react'
import { eventActivityOperationsText as copy } from '../../i18n/eventActivityOperations'
import { eventActivityOperationsService as service } from '../../services/eventActivityOperationsService'
import { normalizeApiError } from '../../services/http'
import { currencyScale, registrationWorkService } from '../../services/eventRegistrationWorkService'
import type { ActivityOperationsWorkspace, ActivitySelectionChange, ActivitySelectionPreview, ActivityPrivateData } from '../../types/eventActivityOperations'
import { ActivityParticipationRow, type ActivityOperationsMutation } from './EventActivityProjectConfiguration'
import { EventToolSection } from './ArrangementTileDeck'
import AppActionButton from '../layout/AppActionButton'
import { creationInput } from './creation/CreationFields'

type Language = 'en' | 'zh'
const local = (value: { en: string; zh: string }, language: Language) => value[language] || value.en || value.zh
const money = (minor: number, currency: string, language: Language) => new Intl.NumberFormat(language === 'zh' ? 'zh-NZ' : 'en-NZ', { style: 'currency', currency }).format(minor / currencyScale(currency))
const active = (status: string) => !['cancelled', 'expired'].includes(status)

export default function EventActivitySelectionPanel({ eventId, language, timeZone }: { eventId: string; language: Language; timeZone?: string }) {
  const [workspace, setWorkspace] = useState<ActivityOperationsWorkspace | null>(null)
  const [participantId, setParticipantId] = useState('')
  const [chosen, setChosen] = useState<string[]>([])
  const [preview, setPreview] = useState<ActivitySelectionPreview | null>(null)
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true)
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [privateData, setPrivateData] = useState<ActivityPrivateData | null>(null), [birthDate, setBirthDate] = useState(''), [privateError, setPrivateError] = useState('')
  const [baseFee, setBaseFee] = useState<{ minor: number; currency: string } | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setWorkspace(await service.get(eventId)) } catch (reason) { setError(normalizeApiError(reason).message) }
    finally { setLoading(false) }
  }, [eventId])
  useEffect(() => { let live = true; setLoading(true); void service.get(eventId).then(value => { if (live) setWorkspace(value) }).catch(reason => { if (live) setError(normalizeApiError(reason).message) }).finally(() => { if (live) setLoading(false) }); return () => { live = false } }, [eventId])
  useEffect(() => { let live = true; setBaseFee(null); void registrationWorkService.get(eventId).then(value => { if (live && value.policy) setBaseFee({ minor: value.policy.rules.feeMinor, currency: value.policy.rules.currency }) }).catch(() => {}); return () => { live = false } }, [eventId])
  useEffect(() => { if (!workspace) return; if (!workspace.participants.some(p => p.participantId === participantId)) setParticipantId(workspace.participants.find(p => p.canProvidePrivateData)?.participantId ?? workspace.participants[0]?.participantId ?? '') }, [workspace, participantId])
  const participant = workspace?.participants.find(p => p.participantId === participantId)
  const registrations = useMemo(() => workspace?.projects.flatMap(p => p.participations.filter(r => r.participantId === participantId && active(r.seatStatus))) ?? [], [workspace, participantId])
  const originalIds = useMemo(() => registrations.map(r => r.offerId), [registrations])
  useEffect(() => { setChosen(originalIds); setPreview(null) }, [participantId, originalIds.join('|')])
  useEffect(() => {
    setPrivateData(null); setBirthDate(''); setPrivateError('')
    if (!participantId || !participant?.canProvidePrivateData) return
    let live = true
    void service.privateData(eventId, participantId).then(value => { if (live) { setPrivateData(value); setBirthDate(value.birthDate ?? '') } }).catch(reason => { if (live) setPrivateError(normalizeApiError(reason).message) })
    return () => { live = false }
  }, [eventId, participantId, participant?.canProvidePrivateData])
  const change: ActivitySelectionChange = { participantId, addOfferIds: chosen.filter(id => !originalIds.includes(id)), removeParticipationIds: registrations.filter(row => !chosen.includes(row.offerId)).map(row => row.id) }
  const changed = change.addOfferIds.length > 0 || change.removeParticipationIds.length > 0
  const selectedRows = workspace?.projects.flatMap(project => project.participations.filter(row => row.participantId === participantId && active(row.seatStatus)).map(row => ({ project, row }))) ?? []
  const mutate: ActivityOperationsMutation = async action => { setBusy(true); setError(''); setNotice(''); try { setWorkspace(await action()); setNotice(copy.savedNotice[language]) } catch (reason) { setError(normalizeApiError(reason).message) } finally { setBusy(false) } }
  const toggle = (offerId: string, selected: boolean) => { setChosen(ids => selected ? [...ids, offerId] : ids.filter(id => id !== offerId)); setPreview(null) }
  const review = async () => { setBusy(true); setError(''); try { setPreview(await service.preview(eventId, change)) } catch (reason) { setError(normalizeApiError(reason).message) } finally { setBusy(false) } }
  const apply = async () => { if (!preview) return; setBusy(true); setError(''); try { setWorkspace(await service.apply(eventId, preview.change, preview.previewToken)); setPreview(null); setNotice(copy.savedNotice[language]) } catch (reason) { setError(normalizeApiError(reason).message) } finally { setBusy(false) } }
  const saveBirthDate = async () => { if (!privateData || !participantId || !birthDate) return; setBusy(true); setPrivateError(''); try { setPrivateData(await service.savePrivateData(eventId, participantId, birthDate, privateData.eTag)); setNotice(copy.recorded[language]) } catch (reason) { setPrivateError(normalizeApiError(reason).message) } finally { setBusy(false) } }
  return <section data-project-selection><EventToolSection title={copy.selection[language]} summary={loading ? copy.loading[language] : `${workspace?.projects.length ?? 0} ${copy.title[language]}`}>
    {loading ? <p role="status" className="text-sm text-[#66766f]">{copy.loading[language]}</p> : null}
    {error ? <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}<AppActionButton className="ml-2" size="sm" onClick={() => void load()}>{copy.retry[language]}</AppActionButton></div> : null}
    {notice ? <p role="status" className="text-sm text-[#176b5a]">{notice}</p> : null}
    {workspace && !workspace.participants.length ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{copy.noParticipants[language]}</p> : null}
    {workspace && workspace.participants.length > 0 ? <div className="space-y-4">
      <label className="grid gap-1 text-sm font-semibold text-[#40554e]">{copy.participant[language]}<select className={creationInput} value={participantId} onChange={e => { setPrivateData(null); setBirthDate(''); setParticipantId(e.target.value); setPreview(null) }}>{workspace.participants.map(p => <option key={p.participantId} value={p.participantId}>{p.displayName}</option>)}</select></label>
      {participant?.canProvidePrivateData ? <details className="rounded-xl border border-[#2f4b42]/15 bg-white p-3"><summary className="min-h-11 cursor-pointer font-semibold text-[#18332d]">{copy.birthDate[language]}</summary><p className="mb-2 text-xs text-[#66766f]">{copy.privateAgeInfo[language]}</p>
        {privateError ? <p role="alert" className="text-sm text-rose-700">{privateError}</p> : null}<div className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-sm">{copy.birthDate[language]}<input className={creationInput} type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)}/></label><AppActionButton disabled={busy || !privateData || !birthDate || birthDate === privateData.birthDate} onClick={() => void saveBirthDate()}>{copy.saveBirthDate[language]}</AppActionButton></div>
      </details> : null}
      <div className="space-y-3">{workspace.projects.map(project => {
        const visible = project.offers.filter(offer => offer.status === 'open' || originalIds.includes(offer.id))
        if (!visible.length) return null
        return <fieldset key={project.activityId} className="rounded-xl border border-[#2f4b42]/15 bg-white p-3"><legend className="px-1 font-bold text-[#18332d]">{local(project.name, language)}</legend>
          {project.policy ? <p className="mb-2 text-xs text-[#66766f]">{project.policy.rules.minimumAge != null ? `${copy.minAge[language]}: ${project.policy.rules.minimumAge} · ` : ''}{project.policy.rules.maximumAge != null ? `${copy.maxAge[language]}: ${project.policy.rules.maximumAge} · ` : ''}{copy.fee[language]}: {money(project.policy.rules.feeMinor, project.policy.rules.currency, language)}</p> : null}
          <div className="space-y-2">{visible.map(offer => { const selected = chosen.includes(offer.id), available = offer.status === 'open' || originalIds.includes(offer.id); return <label key={offer.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-[#2f4b42]/10 bg-[#fbfcf8] p-3 text-sm"><input type="checkbox" disabled={busy || !available || !participant?.canSelect} checked={selected} onChange={e => toggle(offer.id, e.target.checked)}/><span className="min-w-0 flex-1">{new Date(offer.startUtc).toLocaleString(language, { timeZone })} – {new Date(offer.endUtc).toLocaleTimeString(language, { timeZone })}</span><span className="text-xs text-[#66766f]">{offer.capacity === 0 ? copy.unlimited[language] : copy.availability[language](offer.confirmed + offer.reserved, offer.capacity, offer.waitlisted)}</span></label> })}</div>
        </fieldset>
      })}</div>
      {workspace.projects.every(project => !project.offers.some(offer => offer.status === 'open' || originalIds.includes(offer.id))) ? <p className="text-sm text-[#66766f]">{copy.noOpenOffers[language]}</p> : null}
      {changed ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="mb-2 text-sm font-semibold text-amber-950">{copy.changed[language]}</p><AppActionButton disabled={busy || !participantId} onClick={() => void review()}>{copy.preview[language]}</AppActionButton>
        {preview ? <div className="mt-3 space-y-2 text-sm"><p>{copy.quote[language](money(preview.addedFeeMinor, preview.currency, language))}</p>{baseFee && baseFee.currency === preview.currency ? <p>{copy.totalPrice[language](money(baseFee.minor, baseFee.currency, language), money(preview.addedFeeMinor, preview.currency, language), money(baseFee.minor + preview.addedFeeMinor, preview.currency, language))}</p> : null}{preview.refundReviewCount > 0 ? <p className="text-amber-950">{copy.refundReview[language](preview.refundReviewCount)}</p> : null}<AppActionButton variant="primary" disabled={busy} onClick={() => void apply()}>{copy.apply[language]}</AppActionButton></div> : null}
      </div> : null}
      {selectedRows.length ? <details className="rounded-xl border border-[#2f4b42]/15 bg-white p-3"><summary className="min-h-11 cursor-pointer font-bold">{copy.selectedProjects[language]} · {selectedRows.length}</summary><div className="divide-y divide-[#2f4b42]/10">{selectedRows.map(({ project, row }) => <div key={row.id}><p className="pt-2 text-xs font-bold text-[#66766f]">{local(project.name, language)}</p><ActivityParticipationRow eventId={eventId} row={row} person={participant} workspace={workspace} language={language} busy={busy} mutate={mutate}/></div>)}</div></details> : null}
    </div> : null}
  </EventToolSection></section>
}
