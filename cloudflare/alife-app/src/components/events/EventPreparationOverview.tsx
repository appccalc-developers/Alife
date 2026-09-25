import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowUpRight, CalendarDays, Circle, LockKeyhole } from 'lucide-react'
import type { EventWorkspaceItem, LocalizedText, ModuleDecision, Readiness } from '../../types/eventComposition'
import type { CreationDraft } from '../../utils/eventCreationDraft'
import { localText } from './creation/CreationFields'
import '../../styles/eventPreparationEditorial.css'

export type PreparationDomain = {
  decision: ModuleDecision; enabled: boolean; dirty: boolean; workspaceItem?: EventWorkspaceItem
  icon?: ReactNode; color?: string; ink?: string; capability?: string; en?: string; zh?: string
}

type DomainState = 'blocked' | 'working' | 'ready' | 'complete' | 'unknown'
const domainState = (domain: PreparationDomain, checked: boolean): DomainState => {
  if (!checked || !domain.workspaceItem) return 'unknown'
  if (domain.workspaceItem.readiness === 'blocked' || domain.workspaceItem.blockers.length > 0) return 'blocked'
  if (domain.dirty) return 'working'
  if (domain.workspaceItem.readiness === 'ready' || domain.workspaceItem.readiness === 'complete') return domain.workspaceItem.readiness
  return domain.workspaceItem.readiness === 'notReady' ? 'working' : 'unknown'
}
const stateLabel = (state: DomainState, zh: boolean) => ({
  blocked: zh ? '受阻' : 'Blocked', working: zh ? '进行中' : 'In progress',
  ready: zh ? '就绪' : 'Ready', complete: zh ? '已完成' : 'Complete',
  unknown: zh ? '待核验' : 'Not checked',
})[state]
const stateDetail = (domain: PreparationDomain, state: DomainState, zh: boolean) => {
  if (state === 'blocked') return (domain.workspaceItem?.blockers[0] ? localText(domain.workspaceItem.blockers[0], zh) : '') || (zh ? '请打开领域查看阻碍' : 'Open this area to review the blocker')
  if (domain.dirty) return zh ? '本地修改尚未保存' : 'Local changes are not saved'
  if (state === 'working') return zh ? '仍需完成模块检查' : 'Module checks are still pending'
  if (state === 'ready') return zh ? '已保存内容通过模块检查' : 'Saved content passed module checks'
  if (state === 'complete') return zh ? '已保存内容完成模块检查' : 'Saved content completed module checks'
  return zh ? '暂未取得模块检查结果' : 'Module check is not available yet'
}

type MapLine = { code: string; x1: number; y1: number; x2: number; y2: number }
const domainName = (domain: PreparationDomain, chinese: boolean) => {
  const label = localText(domain.decision.label, chinese)
  return label && label !== domain.decision.moduleCode ? label : (chinese ? domain.zh : domain.en) || label
}

// This is a projection of authorized data already loaded by the saved editor.
// A local confirmation is never an approval, report adoption or readiness score.
export default function EventPreparationOverview({ draft, typeName, owner, domains, active, onSelect, zh, dirty, readiness, onReview, reviewDisabled }: {
  draft: CreationDraft; typeName: LocalizedText; owner?: ReactNode; domains: PreparationDomain[]
  active: string | null; onSelect: (code: string) => void; zh: boolean
  dirty: boolean; readiness?: Readiness; onReview: () => void; reviewDisabled: boolean
}) {
  const date = draft.startLocal.split('T')[0]
  const blockers = readiness?.blockers ?? []
  const checked = Boolean(readiness?.checkedUtc)
  const [lines, setLines] = useState<MapLine[]>([])
  const [previewCode, setPreviewCode] = useState<string | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const coreRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef(new Map<string, HTMLButtonElement>())
  const enabledCount = domains.filter(domain => domain.enabled).length
  const states = domains.filter(domain => domain.enabled).map(domain => domainState(domain, checked))
  const readyCount = states.filter(state => state === 'ready' || state === 'complete').length
  const blockedCount = states.filter(state => state === 'blocked').length
  const workingCount = states.filter(state => state === 'working').length
  const unknownCount = states.filter(state => state === 'unknown').length

  useEffect(() => {
    const map = mapRef.current
    const core = coreRef.current
    if (!map || !core) return
    const update = () => {
      const bounds = map.getBoundingClientRect()
      const center = core.getBoundingClientRect()
      setLines(domains.flatMap(({ decision, enabled }) => {
        if (!enabled) return []
        const card = cardRefs.current.get(decision.moduleCode)?.getBoundingClientRect()
        return card ? [{ code: decision.moduleCode,
          x1: center.left + center.width / 2 - bounds.left, y1: center.top + center.height / 2 - bounds.top,
          x2: card.left + card.width / 2 - bounds.left, y2: card.top + card.height / 2 - bounds.top }] : []
      }))
    }
    const observer = new ResizeObserver(update)
    observer.observe(map)
    observer.observe(core)
    cardRefs.current.forEach(card => observer.observe(card))
    update()
    return () => observer.disconnect()
  }, [domains])
  return <div className="event-editorial-overview" data-editorial-overview>
    <div className="event-editorial-spread">
      <section className="event-editorial-brief" data-selected={active === 'EVENT.DETAILS'}>
        <div className="event-editorial-kicker"><CalendarDays size={16} aria-hidden="true" />{localText(typeName, zh)}</div>
        <h2 className="event-editorial-date">{date || '—'} <span>{draft.startLocal.slice(11, 16) || '—'}{draft.endLocal ? ` – ${draft.endLocal.startsWith(date) ? '' : `${draft.endLocal.slice(0, 10)} `}${draft.endLocal.slice(11, 16)}` : ''}</span></h2>
        <p className="event-editorial-muted">{localText(draft.locationName, zh) || (zh ? '地点待安排' : 'Location to be arranged')} · {draft.timeZone}</p>
        <details className="event-editorial-brief-details"><summary>{zh ? '活动资料摘要' : 'Event brief'}</summary><dl className="event-editorial-facts">
          <div><dt>{zh ? '活动地点' : 'Location'}</dt><dd>{localText(draft.locationName, zh) || (zh ? '待安排' : 'To be arranged')}</dd></div>
          <div><dt>{zh ? '总负责人' : 'Accountable owner'}</dt><dd>{owner}</dd></div>
          <div><dt>{zh ? '活动时区' : 'Time zone'}</dt><dd>{draft.timeZone}</dd></div>
        </dl></details>
        <button type="button" className="event-editorial-text-action" data-arrangement-tile="EVENT.DETAILS" aria-expanded={active === 'EVENT.DETAILS'} aria-controls={active === 'EVENT.DETAILS' ? 'tile-panel-EVENT.DETAILS' : undefined} onClick={() => onSelect('EVENT.DETAILS')}>
          {zh ? '查看与编辑活动资料' : 'View and edit event details'}{dirty ? <span>{zh ? '· 未保存' : '· Unsaved'}</span> : null}<ArrowUpRight size={17} aria-hidden="true" />
        </button>
      </section>
      <aside className="event-editorial-check" aria-label={zh ? '审批检查入口' : 'Approval review entry'}>
        <h2 className="event-editorial-kicker"><LockKeyhole size={16} aria-hidden="true" />{zh ? '审批检查' : 'Approval review'}</h2>
        <div className="event-editorial-check-count"><strong>{checked ? blockers.length : '—'}</strong><span>{checked ? (zh ? '项筹备阻碍' : 'preparation blockers') : (zh ? '状态待核验' : 'status not checked')}</span></div>
        <p>{zh ? '筹备检查不等于正式批准。' : 'Readiness is not formal approval.'}</p>
        <button type="button" onClick={onReview} disabled={reviewDisabled} className="event-editorial-review-action">{zh ? '进入审批检查' : 'Open approval review'}<ArrowUpRight size={18} aria-hidden="true" /></button>
        {reviewDisabled ? <small>{zh ? '请先完成当前操作并保存修改' : 'Finish the current action and save your changes first'}</small> : null}
      </aside>
    </div>
    <div className="event-editorial-index-heading"><div><p className="event-editorial-eyebrow">{zh ? '活动筹备 / 全景' : 'Event preparation / overview'}</p><h2>{zh ? '筹备全景' : 'Preparation map'}</h2><p className="event-editorial-muted">{zh ? '只显示本次活动启用的领域；点击卡片即可填写。' : 'Only areas enabled for this event appear here. Select a card to edit.'}</p></div></div>
    <div className="event-editorial-map" ref={mapRef} data-compact={domains.length <= 4} data-empty={domains.length === 0} data-has-preview={previewCode !== null}>
      <svg className="event-editorial-map-lines" aria-hidden="true" width="100%" height="100%"><g>{lines.map(line => <line key={line.code} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} data-preview={line.code === previewCode} />)}</g></svg>
      <div className="event-editorial-domains" role="group" aria-label={zh ? '活动模块总览' : 'Event module overview'}>
      {domains.map((domain, index) => { const { decision, enabled, icon, color, ink, capability } = domain; const state = domainState(domain, checked); return <button type="button" key={decision.moduleCode} ref={node => { if (node) cardRefs.current.set(decision.moduleCode, node); else cardRefs.current.delete(decision.moduleCode) }} data-arrangement-tile={decision.moduleCode} data-slot={index < 12 ? index + 1 : undefined} data-enabled={enabled} data-readiness={state} data-preview={previewCode === decision.moduleCode} onPointerEnter={() => setPreviewCode(decision.moduleCode)} onPointerLeave={() => setPreviewCode(null)} onFocus={() => setPreviewCode(decision.moduleCode)} onBlur={() => setPreviewCode(null)} onClick={() => onSelect(decision.moduleCode)} className="event-editorial-domain" style={{ '--domain-paper': color || '#f0f4f2', '--domain-ink': ink || '#18332d' } as CSSProperties}>
        <span className="event-editorial-domain-top"><span className="event-editorial-domain-symbol" aria-hidden="true">{icon || <Circle size={20} />}</span><ArrowUpRight size={17} aria-hidden="true" /></span>
        <strong>{domainName(domain, zh)}</strong>
        <span className="event-editorial-domain-state"><span className="event-editorial-domain-state-name">{stateLabel(state, zh)}</span><span className="event-editorial-domain-state-detail">{stateDetail(domain, state, zh)}</span>{domain.dirty && state === 'blocked' ? <span className="event-editorial-domain-unsaved">{zh ? '另有未保存修改' : 'Also has unsaved changes'}</span> : null}</span>
        {capability ? <small>{capability}</small> : null}
      </button> })}
      <div className="event-editorial-core" ref={coreRef}>
        <span>EVENT CORE · {zh ? '模块筹备态' : 'PREPARATION STATE'}</span><strong>{readyCount} / {enabledCount}</strong>
        <p>{zh ? '个已启用领域就绪' : 'enabled areas ready'}</p>
        <div className="event-editorial-core-state-counts"><span>{blockedCount} {zh ? '受阻' : 'blocked'}</span><span>{workingCount} {zh ? '进行中' : 'in progress'}</span>{unknownCount > 0 ? <span>{unknownCount} {zh ? '待核验' : 'not checked'}</span> : null}</div>
        <small>{zh ? '以已保存内容为准 · 不代表正式审批' : 'Saved content only · not formal approval'}</small>
      </div>
      {!domains.length ? <p className="event-editorial-muted">{zh ? '本次活动暂无已启用领域；请检查活动方案或重新读取方案。' : 'No areas are enabled for this event. Check or reload the plan.'}</p> : null}
      </div>
    </div>
    {blockers.length > 0 ? <details className="event-editorial-blockers"><summary>{zh ? `已保存方案 · ${blockers.length} 项待处理` : `Saved plan · ${blockers.length} items to address`}</summary><ul>{blockers.map((blocker, index) => <li key={index}>{localText(blocker, zh)}</li>)}</ul></details> : null}
  </div>
}
