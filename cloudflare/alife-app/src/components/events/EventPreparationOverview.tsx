import { eventPreparationOverviewText } from '../../i18n/eventPreparationOverview.ts'
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
  blocked: zh ? eventPreparationOverviewText.blocked.zh : eventPreparationOverviewText.blocked.en, working: zh ? eventPreparationOverviewText.inProgress.zh : eventPreparationOverviewText.inProgress.en,
  ready: zh ? eventPreparationOverviewText.ready.zh : eventPreparationOverviewText.ready.en, complete: zh ? eventPreparationOverviewText.complete.zh : eventPreparationOverviewText.complete.en,
  unknown: zh ? eventPreparationOverviewText.notChecked.zh : eventPreparationOverviewText.notChecked.en,
})[state]
const stateDetail = (domain: PreparationDomain, state: DomainState, zh: boolean) => {
  if (state === 'blocked') return (domain.workspaceItem?.blockers[0] ? localText(domain.workspaceItem.blockers[0], zh) : '') || (zh ? eventPreparationOverviewText.openThisAreaToReviewTheBlocker.zh : eventPreparationOverviewText.openThisAreaToReviewTheBlocker.en)
  if (domain.dirty) return zh ? eventPreparationOverviewText.localChangesAreNotSaved.zh : eventPreparationOverviewText.localChangesAreNotSaved.en
  if (state === 'working') return zh ? eventPreparationOverviewText.moduleChecksAreStillPending.zh : eventPreparationOverviewText.moduleChecksAreStillPending.en
  if (state === 'ready') return zh ? eventPreparationOverviewText.savedContentPassedModuleChecks.zh : eventPreparationOverviewText.savedContentPassedModuleChecks.en
  if (state === 'complete') return zh ? eventPreparationOverviewText.savedContentCompletedModuleChecks.zh : eventPreparationOverviewText.savedContentCompletedModuleChecks.en
  return zh ? eventPreparationOverviewText.moduleCheckIsNotAvailableYet.zh : eventPreparationOverviewText.moduleCheckIsNotAvailableYet.en
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
        <p className="event-editorial-muted">{localText(draft.locationName, zh) || (zh ? eventPreparationOverviewText.locationToBeArranged.zh : eventPreparationOverviewText.locationToBeArranged.en)} · {draft.timeZone}</p>
        <details className="event-editorial-brief-details"><summary>{zh ? eventPreparationOverviewText.eventBrief.zh : eventPreparationOverviewText.eventBrief.en}</summary><dl className="event-editorial-facts">
          <div><dt>{zh ? eventPreparationOverviewText.location.zh : eventPreparationOverviewText.location.en}</dt><dd>{localText(draft.locationName, zh) || (zh ? eventPreparationOverviewText.toBeArranged.zh : eventPreparationOverviewText.toBeArranged.en)}</dd></div>
          <div><dt>{zh ? eventPreparationOverviewText.accountableOwner.zh : eventPreparationOverviewText.accountableOwner.en}</dt><dd>{owner}</dd></div>
          <div><dt>{zh ? eventPreparationOverviewText.timeZone.zh : eventPreparationOverviewText.timeZone.en}</dt><dd>{draft.timeZone}</dd></div>
        </dl></details>
        <button type="button" className="event-editorial-text-action" data-arrangement-tile="EVENT.DETAILS" aria-expanded={active === 'EVENT.DETAILS'} aria-controls={active === 'EVENT.DETAILS' ? 'tile-panel-EVENT.DETAILS' : undefined} onClick={() => onSelect('EVENT.DETAILS')}>
          {zh ? eventPreparationOverviewText.viewAndEditEventDetails.zh : eventPreparationOverviewText.viewAndEditEventDetails.en}{dirty ? <span>{zh ? eventPreparationOverviewText.unsaved.zh : eventPreparationOverviewText.unsaved.en}</span> : null}<ArrowUpRight size={17} aria-hidden="true" />
        </button>
      </section>
      <aside className="event-editorial-check" aria-label={zh ? eventPreparationOverviewText.approvalReviewEntry.zh : eventPreparationOverviewText.approvalReviewEntry.en}>
        <h2 className="event-editorial-kicker"><LockKeyhole size={16} aria-hidden="true" />{zh ? eventPreparationOverviewText.approvalReview.zh : eventPreparationOverviewText.approvalReview.en}</h2>
        <div className="event-editorial-check-count"><strong>{checked ? blockers.length : '—'}</strong><span>{checked ? (zh ? eventPreparationOverviewText.preparationBlockers.zh : eventPreparationOverviewText.preparationBlockers.en) : (zh ? eventPreparationOverviewText.statusNotChecked.zh : eventPreparationOverviewText.statusNotChecked.en)}</span></div>
        <p>{zh ? eventPreparationOverviewText.readinessIsNotFormalApproval.zh : eventPreparationOverviewText.readinessIsNotFormalApproval.en}</p>
        <button type="button" onClick={onReview} disabled={reviewDisabled} className="event-editorial-review-action">{zh ? eventPreparationOverviewText.openApprovalReview.zh : eventPreparationOverviewText.openApprovalReview.en}<ArrowUpRight size={18} aria-hidden="true" /></button>
        {reviewDisabled ? <small>{zh ? eventPreparationOverviewText.finishTheCurrentActionAndSaveYourChangesFirst.zh : eventPreparationOverviewText.finishTheCurrentActionAndSaveYourChangesFirst.en}</small> : null}
      </aside>
    </div>
    <div className="event-editorial-index-heading"><div><p className="event-editorial-eyebrow">{zh ? eventPreparationOverviewText.eventPreparationOverview.zh : eventPreparationOverviewText.eventPreparationOverview.en}</p><h2>{zh ? eventPreparationOverviewText.preparationMap.zh : eventPreparationOverviewText.preparationMap.en}</h2><p className="event-editorial-muted">{zh ? eventPreparationOverviewText.onlyAreasEnabledForThisEventAppearHereSelect.zh : eventPreparationOverviewText.onlyAreasEnabledForThisEventAppearHereSelect.en}</p></div></div>
    <div className="event-editorial-map" ref={mapRef} data-compact={domains.length <= 4} data-empty={domains.length === 0} data-has-preview={previewCode !== null}>
      <svg className="event-editorial-map-lines" aria-hidden="true" width="100%" height="100%"><g>{lines.map(line => <line key={line.code} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} data-preview={line.code === previewCode} />)}</g></svg>
      <div className="event-editorial-domains" role="group" aria-label={zh ? eventPreparationOverviewText.eventModuleOverview.zh : eventPreparationOverviewText.eventModuleOverview.en}>
      {domains.map((domain, index) => { const { decision, enabled, icon, color, ink, capability } = domain; const state = domainState(domain, checked); return <button type="button" key={decision.moduleCode} ref={node => { if (node) cardRefs.current.set(decision.moduleCode, node); else cardRefs.current.delete(decision.moduleCode) }} data-arrangement-tile={decision.moduleCode} data-slot={index < 12 ? index + 1 : undefined} data-enabled={enabled} data-readiness={state} data-preview={previewCode === decision.moduleCode} onPointerEnter={() => setPreviewCode(decision.moduleCode)} onPointerLeave={() => setPreviewCode(null)} onFocus={() => setPreviewCode(decision.moduleCode)} onBlur={() => setPreviewCode(null)} onClick={() => onSelect(decision.moduleCode)} className="event-editorial-domain" style={{ '--domain-paper': color || '#f0f4f2', '--domain-ink': ink || '#18332d' } as CSSProperties}>
        <span className="event-editorial-domain-top"><span className="event-editorial-domain-symbol" aria-hidden="true">{icon || <Circle size={20} />}</span><ArrowUpRight size={17} aria-hidden="true" /></span>
        <strong>{domainName(domain, zh)}</strong>
        <span className="event-editorial-domain-state"><span className="event-editorial-domain-state-name">{stateLabel(state, zh)}</span><span className="event-editorial-domain-state-detail">{stateDetail(domain, state, zh)}</span>{domain.dirty && state === 'blocked' ? <span className="event-editorial-domain-unsaved">{zh ? eventPreparationOverviewText.alsoHasUnsavedChanges.zh : eventPreparationOverviewText.alsoHasUnsavedChanges.en}</span> : null}</span>
        {capability ? <small>{capability}</small> : null}
      </button> })}
      <div className="event-editorial-core" ref={coreRef}>
        <span>EVENT CORE · {zh ? eventPreparationOverviewText.preparationState.zh : eventPreparationOverviewText.preparationState.en}</span><strong>{readyCount} / {enabledCount}</strong>
        <p>{zh ? eventPreparationOverviewText.enabledAreasReady.zh : eventPreparationOverviewText.enabledAreasReady.en}</p>
        <div className="event-editorial-core-state-counts"><span>{blockedCount} {zh ? eventPreparationOverviewText.blockedLabel.zh : eventPreparationOverviewText.blockedLabel.en}</span><span>{workingCount} {zh ? eventPreparationOverviewText.inProgressLabel.zh : eventPreparationOverviewText.inProgressLabel.en}</span>{unknownCount > 0 ? <span>{unknownCount} {zh ? eventPreparationOverviewText.notCheckedLabel.zh : eventPreparationOverviewText.notCheckedLabel.en}</span> : null}</div>
        <small>{zh ? eventPreparationOverviewText.savedContentOnlyNotFormalApproval.zh : eventPreparationOverviewText.savedContentOnlyNotFormalApproval.en}</small>
      </div>
      {!domains.length ? <p className="event-editorial-muted">{zh ? eventPreparationOverviewText.noAreasAreEnabledForThisEventCheckOr.zh : eventPreparationOverviewText.noAreasAreEnabledForThisEventCheckOr.en}</p> : null}
      </div>
    </div>
    {blockers.length > 0 ? <details className="event-editorial-blockers"><summary>{zh ? eventPreparationOverviewText.savedPlanItemsToAddress.zh(blockers.length) : eventPreparationOverviewText.savedPlanItemsToAddress.en(blockers.length)}</summary><ul>{blockers.map((blocker, index) => <li key={index}>{localText(blocker, zh)}</li>)}</ul></details> : null}
  </div>
}
