import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ClipboardList, MessagesSquare, PanelRightClose, PanelRightOpen } from 'lucide-react'
import type { DetailField } from '../../../../../shared/eventDetails'
import { focusTilePanel } from '../ArrangementTileDeck'
import '../../../styles/eventPreparation.css'

export type DetailsFocusRequest = { field: DetailField; version: number }
const DetailsContext = createContext({
  readOnly: false,
  updatedFields: [] as string[],
  revealField: (_field?: string) => {},
  markUpdated: (_fields: string[]) => {},
})
export const useDetailsWorkspace = () => useContext(DetailsContext)

export default function DetailsWorkspace({ zh, active, form, assistant, readOnly = false, focusRequest, labels, limitAssistantHeight = false }: {
  zh: boolean; active: boolean; form: ReactNode; assistant: (active: boolean) => ReactNode
  readOnly?: boolean; focusRequest?: DetailsFocusRequest
  labels?: { workspace: string; form: string; assistant: string }
  limitAssistantHeight?: boolean
}) {
  const root = useRef<HTMLDivElement>(null), formRegion = useRef<HTMLDivElement>(null)
  const id = useId()
  const [wide, setWide] = useState(false), [view, setView] = useState<'form' | 'assistant'>('form')
  const [assistantOpen, setAssistantOpen] = useState(true)
  const [updatedFields, setUpdatedFields] = useState<string[]>([])
  const [pendingReveal, setPendingReveal] = useState<{ field?: string; version: number }>()
  useEffect(() => {
    const element = root.current
    if (!element) return
    const desktop = window.matchMedia('(min-width: 1024px)')
    const measure = () => setWide(desktop.matches && element.getBoundingClientRect().width >= 880)
    const observer = new ResizeObserver(measure)
    observer.observe(element); desktop.addEventListener('change', measure); measure()
    return () => { observer.disconnect(); desktop.removeEventListener('change', measure) }
  }, [])
  useEffect(() => {
    formRegion.current?.querySelectorAll<HTMLElement>('[data-detail-field]').forEach(element => {
      element.dataset.aiUpdated = String(updatedFields.includes(element.dataset.detailField || ''))
    })
    if (!updatedFields.length) return
    const timer = window.setTimeout(() => setUpdatedFields([]), 6000)
    return () => window.clearTimeout(timer)
  }, [updatedFields])
  const revealField = useCallback((field?: string) => {
    setView('form')
    setPendingReveal(previous => ({ field, version: (previous?.version ?? 0) + 1 }))
  }, [])
  useEffect(() => {
    if (!pendingReveal) return
    const { field } = pendingReveal
    const frame = requestAnimationFrame(() => {
      const region = field ? formRegion.current?.querySelector<HTMLElement>(`[data-detail-field="${CSS.escape(field)}"]`) : formRegion.current
      if (!region) return
      const controls = Array.from(region.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select'))
      // Prefer the missing translation; completion and save validation intentionally differ.
      const control = controls.find(input => input.dataset.locale && !input.value.trim()) ?? controls[0]
      let ancestor: HTMLElement | null = control?.parentElement ?? region
      while (ancestor && ancestor !== formRegion.current) {
        if (ancestor instanceof HTMLDetailsElement) ancestor.open = true
        ancestor = ancestor.parentElement
      }
      focusTilePanel(control && !control.matches(':disabled') ? control : region)
    })
    return () => cancelAnimationFrame(frame)
  }, [pendingReveal])
  useEffect(() => { if (active && focusRequest) revealField(focusRequest.field) }, [active, focusRequest, revealField])
  const assistantVisible = active && (wide ? assistantOpen : view === 'assistant')
  return <DetailsContext.Provider value={{ readOnly, updatedFields, revealField, markUpdated: setUpdatedFields }}>
    <div ref={root} className={`event-details-workspace${labels ? ' event-module-form-workspace' : ''}`} data-wide={wide} data-assistant-open={assistantOpen}>
      {!wide ? <div className="event-details-tabs" role="tablist" aria-label={labels?.workspace ?? (zh ? '活动资料工作区' : 'Event details workspace')}>
        {(['form', 'assistant'] as const).map((tab, index) => <button key={tab} id={`${id}-${tab}-tab`} type="button" role="tab" aria-selected={view === tab} aria-controls={`${id}-${tab}`} tabIndex={view === tab ? 0 : -1} onClick={() => setView(tab)} onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const next = event.key === 'Home' ? 'form' : event.key === 'End' ? 'assistant' : index === 0 ? 'assistant' : 'form'
          setView(next); document.getElementById(`${id}-${next}-tab`)?.focus()
        }}>{tab === 'form' ? <ClipboardList size={18} aria-hidden="true" /> : <MessagesSquare size={18} aria-hidden="true" />}{tab === 'form' ? (labels?.form ?? (zh ? '资料表单' : 'Details form')) : (zh ? 'AI 助手' : 'AI assistant')}</button>)}
      </div> : <div className="event-details-toolbar"><span>{readOnly ? (zh ? '只读 · 可浏览全部资料' : 'Read-only · browse all details') : (zh ? '填写资料，也可与助手一起整理' : 'Edit the details or organise them with your assistant')}</span><button type="button" aria-expanded={assistantOpen} aria-controls={`${id}-assistant`} onClick={() => setAssistantOpen(value => !value)}>{assistantOpen ? <PanelRightClose size={18} aria-hidden="true" /> : <PanelRightOpen size={18} aria-hidden="true" />}{assistantOpen ? (zh ? '收起助手' : 'Collapse assistant') : (zh ? '展开助手' : 'Show assistant')}</button></div>}
      <div className="event-details-columns">
        <div ref={formRegion} id={`${id}-form`} role={wide ? 'region' : 'tabpanel'} aria-label={wide ? (labels?.form ?? (zh ? '资料表单' : 'Details form')) : undefined} aria-labelledby={wide ? undefined : `${id}-form-tab`} tabIndex={-1} hidden={!wide && view !== 'form'} className="event-details-form">
          {!wide && readOnly ? <p className="event-details-readonly">{zh ? '只读 · 可浏览全部资料' : 'Read-only · browse all details'}</p> : null}{form}
        </div>
        <div id={`${id}-assistant`} role={wide ? 'complementary' : 'tabpanel'} aria-label={wide ? (labels?.assistant ?? (zh ? 'AI 资料助手' : 'AI details assistant')) : undefined} aria-labelledby={wide ? undefined : `${id}-assistant-tab`} hidden={wide ? !assistantOpen : view !== 'assistant'} className={`event-details-assistant${limitAssistantHeight ? ' event-details-assistant--viewport' : ''}`}>
          {assistant(assistantVisible)}
        </div>
      </div>
    </div>
  </DetailsContext.Provider>
}
