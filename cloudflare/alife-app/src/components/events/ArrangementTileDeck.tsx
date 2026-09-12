import { Children, isValidElement, createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { ArrowLeft, CheckCircle2, Circle, LayoutGrid, Pencil } from 'lucide-react'
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

const shortWorkTitle = (title: string) => ({
  'Settings and responsibilities': 'Settings & roles', 'Activities and conditions': 'Conditions',
  'Personal confirmation and independent review': 'Personal review', 'Version and signature history': 'History',
  'Programme and production': 'Programme', 'Venue and resources': 'Venues',
  'Collaborators and historical assignments': 'Collaborators', 'Tasks & readiness': 'Tasks',
  '本人确认与独立审核': '本人确认与审核', '版本与签署历史': '版本历史',
}[title] || title)

type Entry = { id: string; title: string; summary?: string }
type Deck = { active: string | null; count: number; register: (entry: Entry) => void; unregister: (id: string) => void; zh: boolean }
const ToolDeckContext = createContext<Deck | null>(null)
const ToolVisibility = createContext(true)
export function ToolTileGroup({ enabled, children }: { enabled: boolean; children: ReactNode }) { return <ToolVisibility.Provider value={enabled}><div hidden={!enabled}>{children}</div></ToolVisibility.Provider> }
export function ToolTileDeck({ children, zh }: { children: ReactNode; zh: boolean }) {
  const [entries, setEntries] = useState<Entry[]>([]), [active, setActive] = useState<string | null>(null)
  const nav = useRef<HTMLDivElement>(null)
  const register = useCallback((entry: Entry) => setEntries(old => {
    const found = old.find(item => item.id === entry.id)
    return found?.title === entry.title && found?.summary === entry.summary ? old : found ? old.map(item => item.id === entry.id ? entry : item) : [...old, entry]
  }), [])
  const unregister = useCallback((id: string) => setEntries(old => old.some(item => item.id === id) ? old.filter(item => item.id !== id) : old), [])
  const effective = entries.length === 1 ? entries[0].id : entries.some(item => item.id === active) ? active : null
  const context = useMemo(() => ({ active: effective, count: entries.length, register, unregister, zh }), [effective, entries.length, register, unregister, zh])
  const select = (id: string) => {
    const next = active === id ? null : id; setActive(next)
    requestAnimationFrame(() => next ? focusTilePanel(document.getElementById(`tile-heading-${next}`)) : nav.current?.querySelector<HTMLButtonElement>(`[data-arrangement-tile="${id}"]`)?.focus())
  }
  return <ToolDeckContext.Provider value={context}><div className="arrangement-tools" data-tool-deck>
    {entries.length > 1 ? <div ref={nav}><TileButtons items={entries.map(entry => ({ ...entry, shortTitle: shortWorkTitle(entry.title), status: entry.summary }))} active={effective} onSelect={select} label={zh ? '模块内工作区' : 'Module work areas'} /></div> : null}
    {entries.length > 1 && effective ? <button type="button" className="my-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#176b5a]" onClick={() => select(effective!)}><ArrowLeft size={16} />{zh ? '返回模块内总览' : 'Back to work areas'}</button> : null}
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
// Opt-in adapter for Event editors only. Cards inside a selected section remain ordinary content.
export function EventToolSection({ summary, ...props }: ComponentProps<typeof AppSectionCard> & { summary?: string }) {
  const deck = useContext(ToolDeckContext), id = useId().replace(/:/g, '')
  const available = useContext(ToolVisibility)
  const register = deck?.register, unregister = deck?.unregister
  const status = summary ?? badgeSummary(props.action)
  useEffect(() => { if (available && props.title) register?.({ id, title: props.title, summary: status }); else unregister?.(id) }, [register, unregister, id, props.title, status, available])
  useEffect(() => () => unregister?.(id), [unregister, id])
  if (!deck || !props.title) return <AppSectionCard {...props} />
  return <section id={`tile-panel-${id}`} hidden={deck.active !== id} data-tool-panel={id} className="arrangement-tool-panel">
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#2f4b42]/15 pb-3"><div className="min-w-0"><h3 id={`tile-heading-${id}`} tabIndex={-1} className="scroll-mt-24 text-lg font-bold outline-none">{props.title}</h3>{props.subtitle ? <p className="mt-1 text-sm text-[#66766f]">{props.subtitle}</p> : null}</div>{props.action}</header>
    <ToolDeckContext.Provider value={null}>{props.children}</ToolDeckContext.Provider>
  </section>
}
