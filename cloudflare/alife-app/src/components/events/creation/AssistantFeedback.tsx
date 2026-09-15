import type { ReactNode } from 'react'
import type { Bilingual } from '../../../../../shared/eventDetails'
import AppActionButton from '../../layout/AppActionButton'

export default function AssistantFeedback({ zh, completion, labels, revealField, defaults = [], onConfirm, disabled, children }: {
  zh: boolean; completion: { completed: number; total: number; percent: number; pending: string[] }
  labels: Record<string, Bilingual>; revealField: (field: string) => void; defaults?: string[]; onConfirm?: () => void; disabled?: boolean; children?: ReactNode
}) {
  const text = (field: string) => labels[field]?.[zh ? 'zh' : 'en'] || field
  return <><div className="event-assistant-completion" aria-live="polite">
    <div className="event-completion-count"><strong>{zh ? '字段完成度' : 'Field completion'}</strong><span>{completion.completed}/{completion.total} · {completion.percent}%</span></div>
    <progress aria-label={zh ? '字段完成度' : 'Field completion'} value={completion.percent} max={100} />
    <p>{zh ? '仅表示填写完整度' : 'Form completeness only'}</p>
    {completion.pending.length ? <div className="event-pending-fields" aria-label={zh ? '待填写或确认' : 'Fields to complete or confirm'}>{completion.pending.map(field => <button key={field} type="button" onClick={() => revealField(field)}>{text(field)}<span aria-hidden="true">↗</span></button>)}</div> : null}
    {defaults.length && onConfirm ? <><p>{zh ? '待核对默认值：' : 'Review defaults: '}{defaults.map(text).join(' · ')}</p><AppActionButton disabled={disabled} onClick={onConfirm}>{zh ? '确认当前默认设置' : 'Confirm current defaults'}</AppActionButton></> : null}
  </div>{children}</>
}
