import { Children, isValidElement, createContext, useCallback, useContext, useEffect, useId, useState, type ComponentProps, type ReactNode } from 'react'
import { ChevronDown, CheckCircle2, Circle, LayoutGrid, Pencil } from 'lucide-react'
import AppSectionCard from '../layout/AppSectionCard'
import AppBadge from '../layout/AppBadge'

export type ArrangementTile = { id: string; title: string; shortTitle?: string; icon?: ReactNode; color?: string; status?: string; confirmed?: boolean; dirty?: boolean; faded?: boolean }
export function TileButtons({ items, active, onSelect, label }: { items: ArrangementTile[]; active: string | null; onSelect: (id: string) => void; label: string }) {
  return <div className="arrangement-tile-grid" role="group" aria-label={label}>{items.map(item => <button key={item.id} type="button" data-arrangement-tile={item.id} aria-label={item.title} aria-expanded={active === item.id} aria-controls={`tile-panel-${item.id}`} onClick={() => onSelect(item.id)} className={`arrangement-tile ${active === item.id ? 'is-active' : ''} ${item.faded ? 'is-faded' : ''}`} style={{ backgroundColor: item.color || '#e3f0eb' }}>
    <span className="arrangement-tile-icon">{item.dirty ? <span className="arrangement-tile-dirty"><Pencil size={12} aria-hidden="true" />{label.includes('模块') ? '未保存' : 'Unsaved'}</span> : <span aria-hidden="true">{item.icon || <LayoutGrid size={19} />}</span>}</span><strong>{item.shortTitle || item.title}</strong>
    {item.status ? <span className="arrangement-tile-status">{item.status}</span> : null}
    {item.confirmed !== undefined ? <span className="arrangement-tile-status">{item.confirmed ? <CheckCircle2 size={12} /> : <Circle size={12} />}{item.confirmed ? (label.includes('模块') ? '已确认' : 'Confirmed') : (label.includes('模块') ? '待确认' : 'Pending')}</span> : null}

  </button>)}</div>
}
export function focusTilePanel(element: HTMLElement | null) { element?.focus({ preventScroll: true }); element?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }) }

const DraftContext = createContext<((id: string, dirty: boolean) => void) | null>(null)
export function ModuleDraftBoundary({ code, onChange, children }: { code: string; onChange: (code: string, id: string, dirty: boolean) => void; children: ReactNode }) {
  const report = useCallback((id: string, dirty: boolean) => onChange(code, id, dirty), [code, onChange])
  return <DraftContext.Provider value={report}>{children}</DraftContext.Provider>
}
export function useArrangementDraft(dirty: boolean) {
  const report = useContext(DraftContext), id = useId()
  useEffect(() => { report?.(id, dirty) }, [report, id, dirty])
  useEffect(() => () => report?.(id, false), [report, id])
}

// A form's baseline moves only after its own successful mutation, never on tile navigation.
export function useArrangementFormDraft(value: unknown, ready = true) {
  const serialized = JSON.stringify(value)
  const [baseline, setBaseline] = useState<string | null>(ready ? serialized : null)
  useEffect(() => { if (ready && baseline === null) setBaseline(serialized) }, [ready, baseline, serialized])
  useArrangementDraft(ready && baseline !== null && serialized !== baseline)
  return <T,>(result: T): T => { setBaseline(serialized); return result }
}

const ToolDeckContext = createContext<boolean | null>(null)
export function ToolTileGroup({ enabled, children }: { enabled: boolean; children: ReactNode }) { return <div hidden={!enabled}>{children}</div> }
export function ToolTileDeck({ children, zh }: { children: ReactNode; zh: boolean }) {
  return <ToolDeckContext.Provider value={zh}><div className="arrangement-tools space-y-3" data-tool-deck>
    {children}
  </div></ToolDeckContext.Provider>
}
function badgeSummary(node: ReactNode): string | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode }>(child)) continue
    if (child.type === AppBadge) return Children.toArray(child.props.children).filter(value => typeof value === 'string' || typeof value === 'number').join(' ')
    const summary = badgeSummary(child.props.children)
    if (summary) return summary
  }
}
// Native disclosure keeps drafts mounted, including nested rows, and stays operable in disabled fieldsets.
export function revealArrangementControl(control: HTMLElement) {
  let parent = control.parentElement
  while (parent) {
    if (parent instanceof HTMLDetailsElement) parent.open = true
    parent = parent.parentElement
  }
  requestAnimationFrame(() => control.focus())
}

// Opt-in adapter for preparation only. Repeated cards inside a detail remain ordinary content.
export function EventToolSection({ summary, defaultOpen = false, ...props }: ComponentProps<typeof AppSectionCard> & { summary?: string; defaultOpen?: boolean }) {
  const zh = useContext(ToolDeckContext), id = useId()
  const [open, setOpen] = useState(defaultOpen)
  if (zh === null || !props.title) return <AppSectionCard {...props} />
  const badge = badgeSummary(props.action)
  const readinessLabels: Record<string, string> = zh ? { ready: '已就绪', notReady: '待准备', incomplete: '待补充', notApplicable: '不适用', blocked: '有待处理事项' } : { ready: 'Ready', notReady: 'Not ready', incomplete: 'Incomplete', notApplicable: 'Not applicable', blocked: 'Blocked' }
  const status = summary ?? (badge ? readinessLabels[badge] || badge : (zh ? '查看与配置' : 'Review and configure'))
  return <details open={open} onToggle={event => { if (event.target === event.currentTarget) setOpen(event.currentTarget.open) }} data-tool-panel className="arrangement-tool-card" onInvalidCapture={event => revealArrangementControl(event.target as HTMLElement)}>
    <summary aria-controls={id} className="arrangement-tool-summary">
      <span className="min-w-0 flex-1"><span className="block font-bold text-[#18332d]">{props.title}</span><span className="mt-1 block text-sm font-normal text-[#66766f]" data-tool-summary>{status}</span></span>
      <ChevronDown size={20} className="arrangement-tool-chevron shrink-0 text-[#176b5a]" aria-hidden="true" />
    </summary>
    <div id={id} className="arrangement-tool-detail">
      {props.subtitle || props.action ? <div className="mb-4 flex flex-wrap items-start justify-between gap-3">{props.subtitle ? <p className="min-w-0 flex-1 text-sm text-[#66766f]">{props.subtitle}</p> : null}{props.action}</div> : null}
      <ToolDeckContext.Provider value={null}>{props.children}</ToolDeckContext.Provider>
    </div>
  </details>
}
