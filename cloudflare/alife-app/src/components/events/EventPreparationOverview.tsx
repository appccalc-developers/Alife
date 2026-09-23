import type { CSSProperties, ReactNode } from 'react'
import { ArrowUpRight, CalendarDays, Check, Circle, LockKeyhole } from 'lucide-react'
import type { LocalizedText, ModuleDecision, Readiness } from '../../types/eventComposition'
import type { CreationDraft } from '../../utils/eventCreationDraft'
import { localText } from './creation/CreationFields'
import '../../styles/eventPreparationEditorial.css'

export type PreparationDomain = {
  decision: ModuleDecision; enabled: boolean; dirty: boolean; confirmed: boolean
  icon?: ReactNode; color?: string; ink?: string; capability?: string
}

// This is a projection of authorized data already loaded by the saved editor.
// A local confirmation is never an approval, report adoption or readiness score.
export default function EventPreparationOverview({ draft, typeName, owner, domains, active, onSelect, modeToggle, zh, dirty, readiness, onReview, reviewDisabled }: {
  draft: CreationDraft; typeName: LocalizedText; owner?: ReactNode; domains: PreparationDomain[]
  active: string | null; onSelect: (code: string) => void; modeToggle: ReactNode; zh: boolean
  dirty: boolean; readiness?: Readiness; onReview: () => void; reviewDisabled: boolean
}) {
  const date = draft.startLocal.split('T')[0]
  const blockers = readiness?.blockers ?? []
  const checked = Boolean(readiness?.checkedUtc)
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
    <div className="event-editorial-index-heading"><h2>{zh ? '筹备领域' : 'Preparation areas'}</h2>{modeToggle}</div>
    <div className="event-editorial-domains" role="group" aria-label={zh ? '活动模块总览' : 'Event module overview'}>
      {domains.map(({ decision, enabled, dirty: domainDirty, confirmed, icon, color, ink, capability }) => <button type="button" key={decision.moduleCode} data-arrangement-tile={decision.moduleCode} data-selected={active === decision.moduleCode} data-enabled={enabled} aria-expanded={active === decision.moduleCode} aria-controls={active === decision.moduleCode ? `tile-panel-${decision.moduleCode}` : undefined} onClick={() => onSelect(decision.moduleCode)} className="event-editorial-domain" style={{ '--domain-paper': color || '#f0f4f2', '--domain-ink': ink || '#18332d' } as CSSProperties}>
        <span className="event-editorial-domain-top"><span className="event-editorial-domain-symbol" aria-hidden="true">{icon || <Circle size={20} />}</span><ArrowUpRight size={17} aria-hidden="true" /></span>
        <strong>{localText(decision.label, zh)}</strong>
        <span className="event-editorial-domain-state">{domainDirty ? (zh ? '有未保存修改' : 'Unsaved changes') : !enabled ? (zh ? '未启用' : 'Not enabled') : confirmed ? <><Check size={14} aria-hidden="true" />{zh ? '填写已确认' : 'Details confirmed'}</> : (zh ? '待核对填写' : 'Details to review')}</span>
        {capability ? <small>{capability}</small> : null}
      </button>)}
      {!domains.length ? <p className="event-editorial-muted">{zh ? '暂无相关领域；可查看所有模块或重新读取方案。' : 'No related areas. Show all modules or reload the plan.'}</p> : null}
    </div>
    {blockers.length > 0 ? <details className="event-editorial-blockers"><summary>{zh ? `已保存方案 · ${blockers.length} 项待处理` : `Saved plan · ${blockers.length} items to address`}</summary><ul>{blockers.map((blocker, index) => <li key={index}>{localText(blocker, zh)}</li>)}</ul></details> : null}
  </div>
}
