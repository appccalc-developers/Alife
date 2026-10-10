import { eventDetailsAssistantText } from '../../../i18n/eventDetailsAssistant.ts'
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import AssistantFeedback from './AssistantFeedback'
import AppBadge from '../../layout/AppBadge'
import { createAiSessionService } from '../../../services/aiSessionService'
import type { EventActivityType } from '../../../types/eventComposition'
import { invalidateArrangementConfirmation, type CreationDraft } from '../../../utils/eventCreationDraft'
import { applyDetailsResult, detailsSnapshot } from '../../../utils/eventDetailsAssistant'
import { applicableDetails, detailCompletion, detailLabels, validDetail, type Bilingual, type DetailsResult } from '../../../../../shared/eventDetails'
import { localText } from './CreationFields'
import { useDetailsWorkspace } from './DetailsWorkspace'
import EventAssistantChat from './EventAssistantChat'

const service = createAiSessionService<DetailsResult>('/api/events/details-session')
export default function EventDetailsAssistant({ draft, setDraft, type, isSeries, zh, active, onBusy }: {
  draft: CreationDraft; setDraft: Dispatch<SetStateAction<CreationDraft>>; type: EventActivityType; isSeries: boolean; zh: boolean; active: boolean; onBusy: (busy: boolean) => void
}) {
  const { readOnly, revealField, markUpdated } = useDetailsWorkspace()
  const editable = useRef(!readOnly); editable.current = !readOnly
  const [busy, setBusy] = useState(false), [result, setResult] = useState<DetailsResult | null>(null)
  const [resultSignature, setResultSignature] = useState('')
  const sessionId = useRef(crypto.randomUUID()), alive = useRef(true), started = useRef(false)
  const revision = useRef(0), previous = useRef('')
  const signature = JSON.stringify({ draft, type: type.code, isSeries })
  if (previous.current !== signature) { previous.current = signature; revision.current++ }
  const latest = useRef(signature); latest.current = signature
  const snapshot = detailsSnapshot(draft, type, isSeries, revision.current)
  const completion = detailCompletion(snapshot.form, snapshot.sources, isSeries)
  const text = (value: Bilingual) => (zh ? value.zh : value.en) || value.en || value.zh
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; if (started.current) void service.close(sessionId.current).catch(() => undefined) }
  }, [])
  const send = async (submitted: string): Promise<Bilingual> => {
    started.current = true
    const sentSignature = signature, sentRevision = snapshot.revision
    const response = await service.sendMessage(sessionId.current, submitted, { inputMode: 'text', appContext: { language: zh ? 'zh' : 'en', knownFacts: { snapshot } } })
    if (!alive.current || !editable.current) throw new Error(zh ? eventDetailsAssistantText.theseDetailsAreNowReadOnlyTheReplyWas.zh : eventDetailsAssistantText.theseDetailsAreNowReadOnlyTheReplyWas.en)
    if (latest.current !== sentSignature || response.result?.revision !== sentRevision) {
      throw new Error(zh ? eventDetailsAssistantText.detailsChangedTheOldReplyWasNotAdoptedSend.zh : eventDetailsAssistantText.detailsChangedTheOldReplyWasNotAdoptedSend.en)
    }
    if (!response.result) throw new Error(zh ? eventDetailsAssistantText.aiReturnedNoDetailsDraft.zh : eventDetailsAssistantText.aiReturnedNoDetailsDraft.en)
    const next = response.result
    const nextDraft = invalidateArrangementConfirmation(applyDetailsResult(draft, next, submitted))
    setDraft(current => JSON.stringify({ draft: current, type: type.code, isSeries }) === sentSignature ? nextDraft : current)
    const updatedForm = detailsSnapshot(nextDraft, type, isSeries, snapshot.revision).form
    markUpdated(next.adoptedFields.filter(field => JSON.stringify(snapshot.form[field]) !== JSON.stringify(updatedForm[field])))
    setResult(next); setResultSignature(JSON.stringify({ draft: nextDraft, type: type.code, isSeries }))
    return next.assistantReply
  }
  const confirmDefaults = () => setDraft(current => {
    if (readOnly) return current
    const sources = { ...current.detailSources }
    for (const field of applicableDetails(snapshot.form, isSeries)) if ((sources[field] ?? 'default') === 'default' && validDetail(field, snapshot.form)) sources[field] = 'human'
    return { ...current, detailSources: sources }
  })
  const currentResult = resultSignature === signature ? result : null
  const defaultsPending = completion.pending.filter(field => (snapshot.sources[field] ?? 'default') === 'default' && validDetail(field, snapshot.form))
  return <EventAssistantChat zh={zh} active={active} readOnly={readOnly} onSend={send} onBusy={value => { setBusy(value); onBusy(value) }}
    heading={<div className="event-assistant-heading"><h3>{zh ? eventDetailsAssistantText.aiDetailsAssistant.zh : eventDetailsAssistantText.aiDetailsAssistant.en}</h3><AppBadge className="max-w-full break-words align-middle">{zh ? eventDetailsAssistantText.selectedTemplate.zh : eventDetailsAssistantText.selectedTemplate.en}{localText(type.name, zh)}</AppBadge></div>}
    intro={zh ? eventDetailsAssistantText.tellMeAboutTheEventWhenItHappensAnd.zh : eventDetailsAssistantText.tellMeAboutTheEventWhenItHappensAnd.en}
    footer={<>
    <AssistantFeedback zh={zh} completion={completion} labels={detailLabels} revealField={revealField} defaults={defaultsPending} onConfirm={confirmDefaults} disabled={readOnly || busy} />
    {currentResult ? <div className="event-assistant-assessment" aria-live="polite">
      {currentResult.adoptedFields.length ? <p>{zh ? eventDetailsAssistantText.updated.zh : eventDetailsAssistantText.updated.en}{currentResult.adoptedFields.map(field => text(detailLabels[field])).join(' · ')}</p> : null}
      {currentResult.issues.length ? <ul>{currentResult.issues.slice(0, 2).map((issue, index) => <li key={index}><button type="button" onClick={() => revealField(issue.field)}>{text(detailLabels[issue.field])} ↗</button> {text(issue.question)}</li>)}</ul> : null}
      <details><summary>{zh ? eventDetailsAssistantText.viewAiSufficiencyAssessment.zh : eventDetailsAssistantText.viewAiSufficiencyAssessment.en}</summary><p>{currentResult.assessment.sufficiencyScore}/100 · {text(currentResult.assessment.summary)}</p></details>
    </div> : result ? <p className="event-assistant-review">{zh ? eventDetailsAssistantText.theFormChangedThePreviousAiAssessmentIsOut.zh : eventDetailsAssistantText.theFormChangedThePreviousAiAssessmentIsOut.en}</p> : null}

    </>} />
}
