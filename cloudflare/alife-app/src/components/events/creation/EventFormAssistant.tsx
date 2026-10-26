import { eventFormAssistantText } from '../../../i18n/eventFormAssistant.ts'
import { useEffect, useRef, useState } from 'react'
import { http } from '../../../services/http'
import { assistantApplicableFields, assistantFieldComplete, formAssistantFields, validateFormAssistantResult, type AssistantForm, type FormAssistantContext, type FormAssistantInput, type FormAssistantScope } from '../../../../../shared/eventFormAssistant'
import { useDetailsWorkspace } from './DetailsWorkspace'
import EventAssistantChat, { type AssistantTurn } from './EventAssistantChat'
import AssistantFeedback from './AssistantFeedback'

export default function EventFormAssistant({ eventId, scope, form, context, contextSignature, zh, active, initiallyConfirmed = false, onAdopt, onBusy }: {
  eventId: string; scope: FormAssistantScope; form: AssistantForm; contextSignature: string; zh: boolean; active: boolean; initiallyConfirmed?: boolean
  context?: FormAssistantContext
  onAdopt: (form: AssistantForm, fields: string[]) => void; onBusy?: (busy: boolean) => void
}) {
  const { readOnly, revealField, markUpdated } = useDetailsWorkspace()
  const [busy, setBusy] = useState(false), [updated, setUpdated] = useState<string[]>([])
  const [confirmed, setConfirmed] = useState<Record<string, string>>(() => initiallyConfirmed ? Object.fromEntries(Object.entries(form).map(([k, v]) => [k, JSON.stringify(v)])) : {})
  const previousForm = useRef(form), revision = useRef(0), previous = useRef(''), alive = useRef(true), editable = useRef(!readOnly)
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const signature = JSON.stringify({ eventId, scope, form, contextSignature, timeZone })
  if (previous.current !== signature) { previous.current = signature; revision.current++ }
  const latest = useRef(signature); latest.current = signature; editable.current = !readOnly
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    const changed = Object.keys(form).filter(key => JSON.stringify(previousForm.current[key]) !== JSON.stringify(form[key]))
    previousForm.current = form
    if (changed.length) setConfirmed(current => ({ ...current, ...Object.fromEntries(changed.map(key => [key, JSON.stringify(form[key])])) }))
  }, [form])
  const send = async (message: string, turns: AssistantTurn[]) => {
    const sent = signature
    const input: FormAssistantInput = { eventId, scope, form, context, revision: revision.current, language: zh ? 'zh' : 'en', timeZone, message, history: turns.slice(-8).map(turn => ({ role: turn.role, text: typeof turn.text === 'string' ? turn.text : turn.text[zh ? 'zh' : 'en'] })) }
    const { data } = await http.post<unknown>('/api/events/form-assistance', input)
    if (!alive.current || !editable.current || latest.current !== sent) throw new Error(zh ? eventFormAssistantText.theFormChangedOrBecameReadOnlyTheOld.zh : eventFormAssistantText.theFormChangedOrBecameReadOnlyTheOld.en)
    const result = validateFormAssistantResult(data, input)
    const changed = result.adoptedFields.filter(key => JSON.stringify(form[key]) !== JSON.stringify(result.form[key]))
    onAdopt(result.form, changed); markUpdated(changed); setUpdated(changed)
    setConfirmed(current => ({ ...current, ...Object.fromEntries(result.adoptedFields.map(key => [key, JSON.stringify(result.form[key])])) }))
    return result.assistantReply
  }
  const fields = assistantApplicableFields(scope, form), labels = Object.fromEntries(Object.entries(formAssistantFields[scope]).map(([key, definition]) => [key, definition.label]))
  const pending = fields.filter(key => !assistantFieldComplete(scope, key, form, timeZone) || confirmed[key] !== JSON.stringify(form[key]))
  const completion = { completed: fields.length - pending.length, total: fields.length, percent: Math.round((fields.length - pending.length) / fields.length * 100), pending }
  const defaults = pending.filter(key => assistantFieldComplete(scope, key, form, timeZone))
  return <EventAssistantChat zh={zh} active={active} readOnly={readOnly} onBusy={value => { setBusy(value); onBusy?.(value) }} onSend={send}
    heading={<div className="event-assistant-heading"><h3>{zh ? eventFormAssistantText.aiDetailsAssistant.zh : eventFormAssistantText.aiDetailsAssistant.en}</h3><span>{scope === 'tasks' ? (zh ? eventFormAssistantText.tasksAndHandoffs.zh : eventFormAssistantText.tasksAndHandoffs.en) : scope === 'registration' ? (zh ? eventFormAssistantText.registration.zh : eventFormAssistantText.registration.en) : (zh ? eventFormAssistantText.activitiesAndConditions.zh : eventFormAssistantText.activitiesAndConditions.en)}</span></div>}
    intro={scope === 'tasks' ? (zh ? eventFormAssistantText.describeThisTaskItsDeadlineAndWhetherReviewIs.zh : eventFormAssistantText.describeThisTaskItsDeadlineAndWhetherReviewIs.en) : scope === 'registration' ? (zh ? eventFormAssistantText.describeTheRegistrationPurposeEligibilityCapacityAndTimingWe.zh : eventFormAssistantText.describeTheRegistrationPurposeEligibilityCapacityAndTimingWe.en) : (zh ? eventFormAssistantText.useTheEventTitleAndDescriptionToDraftActivities.zh : eventFormAssistantText.useTheEventTitleAndDescriptionToDraftActivities.en)}
    footer={<AssistantFeedback {...{ zh, completion, labels, revealField, defaults }} disabled={readOnly || busy} onConfirm={() => setConfirmed(current => ({ ...current, ...Object.fromEntries(defaults.map(key => [key, JSON.stringify(form[key])])) }))}>
      {updated.length ? <p className="event-assistant-assessment">{zh ? eventFormAssistantText.updated.zh : eventFormAssistantText.updated.en}{updated.map(key => labels[key][zh ? 'zh' : 'en']).join(' · ')}</p> : null}
    </AssistantFeedback>} />
}
