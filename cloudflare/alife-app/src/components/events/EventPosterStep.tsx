import { eventPosterStepText } from '../../i18n/eventPosterStep.ts'
import { useCallback, useEffect, useRef, useState } from 'react'
import AppActionButton from '../layout/AppActionButton'
import AppSectionCard from '../layout/AppSectionCard'
import { eventPosterAiService } from '../../services/eventPosterAiService'
import { eventPosterWorkspaceService, type EventPosterWorkspace } from '../../services/eventPosterWorkspaceService'
import { isImageFile, normalizeImageUrl, uploadImage } from '../../services/imageWorkerApi'
import { normalizeApiError } from '../../services/http'

export default function EventPosterStep({ eventId, zh, onBusy, onContinue }: {
  eventId: string; zh: boolean; onBusy: (busy: boolean) => void; onContinue: () => void
}) {
  const [info, setInfo] = useState<EventPosterWorkspace | null>(null)
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [notice, setNotice] = useState(false), [guidance, setGuidance] = useState(''), [baseImage, setBaseImage] = useState<File | null>(null)
  const [candidate, setCandidate] = useState<{ file: File; id: string; source: string } | null>(null)
  const [preview, setPreview] = useState('')
  const saveRequest = useRef<{ signature: string; url: string; key: string } | null>(null)
  const active = useRef(true), lock = useRef(false)
  useEffect(() => { active.current = true; return () => { active.current = false; onBusy(false) } }, [onBusy])
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const value = await eventPosterWorkspaceService.get(eventId); if (active.current) setInfo(value) }
    catch (reason) { if (active.current) setError(normalizeApiError(reason).message) }
    finally { if (active.current) setLoading(false) }
  }, [eventId])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!candidate) { setPreview(''); return }
    const url = URL.createObjectURL(candidate.file); setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [candidate?.file])
  const source = info ? JSON.stringify(info.brief) : ''
  const stale = Boolean(candidate && candidate.source !== source)
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return
    lock.current = true; setBusy(true); onBusy(true); setError(''); setNotice(false)
    try { await action() }
    catch (reason) {
      if (active.current) {
        const failure = normalizeApiError(reason)
        setError(failure.status === 412 ? (zh ? eventPosterStepText.eventDetailsChangedRefreshAndReviewThisPosterAgainst.zh : eventPosterStepText.eventDetailsChangedRefreshAndReviewThisPosterAgainst.en) : failure.message)
      }
    } finally { lock.current = false; if (active.current) { setBusy(false); onBusy(false) } }
  }
  const choose = (file: File | undefined, base: boolean) => {
    if (!file) return
    if (!isImageFile(file) || file.size > 6 * 1024 * 1024) { setError(zh ? eventPosterStepText.chooseAnImageNoLargerThan6Mb.zh : eventPosterStepText.chooseAnImageNoLargerThan6Mb.en); return }
    setError(''); setNotice(false)
    if (base) setBaseImage(file)
    else setCandidate({ file, id: crypto.randomUUID(), source })
  }
  const generate = () => run(async () => {
    if (!info?.canManage || !baseImage) return
    const generated = await eventPosterAiService.generate({ groupId: info.groupId, event: info.brief, baseImage, guidance: guidance.trim() })
    const file = await eventPosterAiService.toFile(generated)
    if (active.current) setCandidate({ file, id: crypto.randomUUID(), source })
  })
  const save = () => run(async () => {
    if (!info?.canManage || !candidate || stale) return
    const signature = `${info.eTag}:${candidate.id}`
    if (saveRequest.current?.signature !== signature) {
      const uploaded = await uploadImage(candidate.file, `groups/${info.groupId}/events/${eventId}/calendar`)
      saveRequest.current = { signature, url: uploaded.url, key: crypto.randomUUID() }
    }
    const result = await eventPosterWorkspaceService.save(eventId, saveRequest.current.url, info.eTag, saveRequest.current.key)
    if (active.current) { setInfo(result); setCandidate(null); setNotice(true) }
  })
  return <AppSectionCard title={zh ? eventPosterStepText.posterStudio.zh : eventPosterStepText.posterStudio.en} subtitle={zh ? eventPosterStepText.thePlanIsApprovedPostersAreOutsideFormalApproval.zh : eventPosterStepText.thePlanIsApprovedPostersAreOutsideFormalApproval.en}>
    {loading ? <p role="status">{zh ? eventPosterStepText.loadingEventDetails.zh : eventPosterStepText.loadingEventDetails.en}</p> : null}
    {error ? <div role="alert" className="my-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><p>{error}</p><AppActionButton className="mt-2" disabled={busy} onClick={() => void load()}>{zh ? eventPosterStepText.refreshEventDetails.zh : eventPosterStepText.refreshEventDetails.en}</AppActionButton></div> : null}
    {info ? <div className="space-y-4">
      <p className="text-sm text-[#66766f]">{info.brief.title[zh ? 'zh' : 'en']} · {new Date(info.brief.startDate).toLocaleString(zh ? 'zh-CN' : 'en-NZ')}</p>
      {info.posterImageUrl ? <figure><img src={normalizeImageUrl(info.posterImageUrl)} alt={zh ? eventPosterStepText.savedEventPoster.zh : eventPosterStepText.savedEventPoster.en} className="h-80 w-full rounded-xl md:h-96 bg-[#f5f2eb] object-contain" /><figcaption className="mt-2 text-sm">{zh ? eventPosterStepText.currentlyAdoptedPoster.zh : eventPosterStepText.currentlyAdoptedPoster.en}</figcaption></figure> : <p className="text-sm">{zh ? eventPosterStepText.noPosterAdoptedYetUploadAnImageOrMake.zh : eventPosterStepText.noPosterAdoptedYetUploadAnImageOrMake.en}</p>}
      {info.canManage ? <fieldset disabled={busy || loading} className="min-w-0 space-y-4">
        <label className="block text-sm font-semibold">{zh ? eventPosterStepText.uploadAnExistingPoster.zh : eventPosterStepText.uploadAnExistingPoster.en}<input type="file" accept="image/*" className="mt-2 block max-w-full text-sm" onChange={event => { choose(event.target.files?.[0], false); event.target.value = '' }} /></label>
        <section className="space-y-3 rounded-xl bg-[#f5f2eb] p-4" aria-label={zh ? eventPosterStepText.aiPosterGeneration.zh : eventPosterStepText.aiPosterGeneration.en}>
          <h3 className="font-semibold">{zh ? eventPosterStepText.makeAPosterWithAi.zh : eventPosterStepText.makeAPosterWithAi.en}</h3>
          <p className="text-sm leading-6 text-[#66766f]">{zh ? eventPosterStepText.chooseABaseImageAndDescribeTheDesignAi.zh : eventPosterStepText.chooseABaseImageAndDescribeTheDesignAi.en}</p>
          <label className="block text-sm font-semibold">{zh ? eventPosterStepText.baseImage.zh : eventPosterStepText.baseImage.en}<input type="file" accept="image/png,image/jpeg,image/webp" className="mt-2 block max-w-full text-sm" onChange={event => choose(event.target.files?.[0], true)} /></label>
          <label className="block text-sm font-semibold">{zh ? eventPosterStepText.designGuidance.zh : eventPosterStepText.designGuidance.en}<textarea rows={3} maxLength={600} value={guidance} onChange={event => setGuidance(event.target.value)} className="mt-2 w-full rounded-xl border border-[#2f4b42]/20 bg-white p-3 font-normal" /></label>
          <p className="text-xs leading-5 text-[#66766f]">{zh ? eventPosterStepText.generatingCallsTheExistingAiServiceAndMayIncur.zh : eventPosterStepText.generatingCallsTheExistingAiServiceAndMayIncur.en}</p>
          <AppActionButton disabled={!baseImage || busy || !info.brief.title.en.trim() || !info.brief.title.zh.trim()} onClick={() => void generate()}>{zh ? eventPosterStepText.generatePosterDraft.zh : eventPosterStepText.generatePosterDraft.en}</AppActionButton>
        </section>
        {candidate && preview ? <section className="space-y-3" aria-label={zh ? eventPosterStepText.posterDraftForReview.zh : eventPosterStepText.posterDraftForReview.en}><img src={preview} alt={zh ? eventPosterStepText.posterDraftForReview.zh : eventPosterStepText.posterDraftForReview.en} className="h-80 w-full rounded-xl md:h-96 bg-[#f5f2eb] object-contain" />
          <p className="text-sm">{zh ? eventPosterStepText.checkTextDatesPeopleAndContentBeforeAdoptingAnd.zh : eventPosterStepText.checkTextDatesPeopleAndContentBeforeAdoptingAnd.en}</p>
          {stale ? <div className="rounded-xl bg-amber-50 p-3 text-sm"><p>{zh ? eventPosterStepText.eventDetailsChangedCheckWhetherThisPosterIsStill.zh : eventPosterStepText.eventDetailsChangedCheckWhetherThisPosterIsStill.en}</p><AppActionButton className="mt-2" onClick={() => setCandidate({ ...candidate, source })}>{zh ? eventPosterStepText.checkedAgainstTheLatestDetails.zh : eventPosterStepText.checkedAgainstTheLatestDetails.en}</AppActionButton></div> : null}
          <AppActionButton variant="primary" disabled={busy || stale} onClick={() => void save()}>{zh ? eventPosterStepText.adoptAndSavePoster.zh : eventPosterStepText.adoptAndSavePoster.en}</AppActionButton>
        </section> : null}
      </fieldset> : null}
      {busy ? <p role="status" className="text-sm">{zh ? eventPosterStepText.processingPoster.zh : eventPosterStepText.processingPoster.en}</p> : null}
      {notice ? <p role="status" className="text-sm text-[#176b5a]">{zh ? eventPosterStepText.posterSavedContinueToPublication.zh : eventPosterStepText.posterSavedContinueToPublication.en}</p> : null}
      <div className="flex justify-end"><AppActionButton disabled={busy || loading} onClick={onContinue}>{candidate ? (zh ? eventPosterStepText.leaveDraftUnadoptedAndContinue.zh : eventPosterStepText.leaveDraftUnadoptedAndContinue.en) : info.posterImageUrl ? (zh ? eventPosterStepText.continueToPublication.zh : eventPosterStepText.continueToPublication.en) : (zh ? eventPosterStepText.skipPosterAndContinueToPublication.zh : eventPosterStepText.skipPosterAndContinueToPublication.en)}</AppActionButton></div>
    </div> : null}
  </AppSectionCard>
}
