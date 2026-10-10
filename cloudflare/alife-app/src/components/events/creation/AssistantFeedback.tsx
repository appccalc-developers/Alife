import { assistantFeedbackText } from '../../../i18n/assistantFeedback.ts'
import type { ReactNode } from 'react'
import type { Bilingual } from '../../../../../shared/eventDetails'
import AppActionButton from '../../layout/AppActionButton'

export default function AssistantFeedback({ zh, completion, labels, revealField, defaults = [], onConfirm, disabled, children }: {
  zh: boolean; completion: { completed: number; total: number; percent: number; pending: string[] }
  labels: Record<string, Bilingual>; revealField: (field: string) => void; defaults?: string[]; onConfirm?: () => void; disabled?: boolean; children?: ReactNode
}) {
  const text = (field: string) => labels[field]?.[zh ? 'zh' : 'en'] || field
  return <><div className="event-assistant-completion" aria-live="polite">
    <div className="event-completion-count"><strong>{zh ? assistantFeedbackText.fieldCompletion.zh : assistantFeedbackText.fieldCompletion.en}</strong><span>{completion.completed}/{completion.total} · {completion.percent}%</span></div>
    <progress aria-label={zh ? assistantFeedbackText.fieldCompletion.zh : assistantFeedbackText.fieldCompletion.en} value={completion.percent} max={100} />
    <p>{zh ? assistantFeedbackText.formCompletenessOnly.zh : assistantFeedbackText.formCompletenessOnly.en}</p>
    {completion.pending.length ? <div className="event-pending-fields" aria-label={zh ? assistantFeedbackText.fieldsToCompleteOrConfirm.zh : assistantFeedbackText.fieldsToCompleteOrConfirm.en}>{completion.pending.map(field => <button key={field} type="button" onClick={() => revealField(field)}>{text(field)}<span aria-hidden="true">↗</span></button>)}</div> : null}
    {defaults.length && onConfirm ? <><p>{zh ? assistantFeedbackText.reviewDefaults.zh : assistantFeedbackText.reviewDefaults.en}{defaults.map(text).join(' · ')}</p><AppActionButton disabled={disabled} onClick={onConfirm}>{zh ? assistantFeedbackText.confirmCurrentDefaults.zh : assistantFeedbackText.confirmCurrentDefaults.en}</AppActionButton></> : null}
  </div>{children}</>
}
