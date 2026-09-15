import RamSourceSummary from './RamSourceSummary'
import { RiskScores } from './RamRatingSummary'
import { previewRisk, worstRamLevel } from '../../utils/ramRatings'
import { useEffect, useState } from 'react'
import type { RamDraft, RamPolicyData, RamRisk, RamScale } from '../../types/ramGovernance'
import useConfirmation from '../../hooks/useConfirmation'
import { duplicateRamRisk, riskHasMissingFields } from '../../utils/ramAuthoring'
import { displayRamText as text, ramDefaultScales, ramText } from '../../types/ramGovernance'
import { RamLevelBadge, RamMatrix, RamTextField, ramInput } from './RamFields'
import { EventToolSection as AppSectionCard } from './ArrangementTileDeck'
import AppActionButton from '../layout/AppActionButton'

function scaleOptionText(scale: RamScale, zh: boolean) {
  const primary = zh ? `${scale.label.zh} — ${scale.description.zh}` : `${scale.label.en} — ${scale.description.en}`
  return `${scale.value} · ${primary}`
}

function RamScaleDefinition({ scale, zh }: { scale?: RamScale; zh: boolean }) {
  if (!scale) return null
  return <div className="mt-2 rounded-lg bg-[#f5f2eb] px-3 py-2 text-xs leading-5 text-[#445c54]" aria-live="polite">
    <p><strong>{scale.value} · {zh ? scale.label.zh : scale.label.en}</strong> </p>
    <p><span lang={zh ? 'zh-CN' : 'en'}>{zh ? scale.description.zh : scale.description.en}</span></p>
    <details><summary>{zh ? '展开 English' : 'Expand 中文'}</summary><p>{zh ? scale.description.en : scale.description.zh}</p></details>
  </div>
}

export default function RamAssessmentFields({ draft, update, policy, editable, dirty, zh, focusRequest, eventId }: {
  eventId?: string; draft: RamDraft; update: (change: Partial<RamDraft>) => void; policy?: RamPolicyData; editable: boolean; dirty: boolean; zh: boolean; evaluatedDraft?: RamDraft; focusRequest?: object
}) {
  const [activityFilter, setActivityFilter] = useState(''), [categoryFilter, setCategoryFilter] = useState(''), [completionFilter, setCompletionFilter] = useState('')
  const { requestConfirmation, confirmationModal } = useConfirmation()
  useEffect(() => { if (focusRequest) { setActivityFilter(''); setCategoryFilter(''); setCompletionFilter('') } }, [focusRequest])
  const editRisk = (id: string, fields: Partial<RamRisk>) => update({ hazards: draft.hazards.map(h => h.id === id ? { ...h, ...fields } : h) })
  return <div className="space-y-4">
    <RamSourceSummary draft={draft} zh={zh} eventId={eventId}/>
    {!eventId?<AppSectionCard title={zh?'现场负责人确认':'Onsite leadership confirmation'}><fieldset disabled={!editable}>        <label data-ram-field="ram.onsite" className="block text-sm font-semibold">{zh ? '填表人会亲自出席并领导吗？' : 'Will the author personally attend and lead?'}<select className={ramInput} value={draft.authorAttendsAndLeads === null ? '' : String(draft.authorAttendsAndLeads)} onChange={e => update({ authorAttendsAndLeads: e.target.value === '' ? null : e.target.value === 'true' })}><option value="">{zh ? '尚未确认' : 'Not yet confirmed'}</option><option value="true">{zh ? '会' : 'Yes'}</option><option value="false">{zh ? '不会，由其他成员领导' : 'No, another member will lead'}</option></select></label>
</fieldset></AppSectionCard>:null}

    <AppSectionCard summary={zh ? `${draft.hazards.length} 项风险${dirty ? ' · 有未保存修改' : ''}` : `${draft.hazards.length} risks${dirty ? ' · Unsaved changes' : ''}`} title={zh ? '风险明细' : 'Risk details'} subtitle={zh ? '请填写所有初始及剩余评分。缺项不会被视为低风险。' : 'Complete both initial and residual ratings. Missing information is never treated as low risk.'}>
    {policy ? <AppSectionCard title={zh ? '评分定义与矩阵' : 'Scoring definitions and matrix'}><details><summary className="cursor-pointer py-3 font-semibold">{zh ? '查看 1–5 定义和完整矩阵' : 'View 1–5 definitions and full matrix'}</summary><RamMatrix policy={policy} zh={zh} />{(['likelihood', 'impact'] as const).map(kind => <div key={kind} className="mt-4"><h3 className="font-bold">{kind === 'likelihood' ? (zh ? '可能性' : 'Likelihood') : (zh ? '影响程度' : 'Impact')}</h3>{policy[kind].map(s => <p key={s.value} className="py-1 text-sm">{s.value}. {text(s.label, zh)} — {text(s.description, zh)}</p>)}</div>)}</details></AppSectionCard> : null}
      <div className="mb-4 grid gap-3 sm:grid-cols-3"><label className="text-sm">{zh ? '筛选项目' : 'Filter activity'}<select className={ramInput} value={activityFilter} onChange={e => setActivityFilter(e.target.value)}><option value="">{zh ? '全部项目' : 'All activities'}</option>{draft.activities.map(a => <option key={a.id} value={a.id}>{text(a.name, zh)}</option>)}</select></label><label className="text-sm">{zh ? '筛选类别' : 'Filter category'}<select className={ramInput} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="">{zh ? '全部类别' : 'All categories'}</option>{Array.from(new Set(draft.hazards.map(h => h.categoryCode))).filter(Boolean).map(code => <option value={code} key={code}>{text(policy?.categories.find(c => c.code === code)?.name, zh) || code}</option>)}</select></label><label className="text-sm">{zh ? '填写状态' : 'Completion'}<select className={ramInput} value={completionFilter} onChange={e => setCompletionFilter(e.target.value)}><option value="">{zh ? '全部' : 'All'}</option><option value="missing">{zh ? '有缺项' : 'Missing fields'}</option><option value="complete">{zh ? '已填写' : 'Filled in'}</option></select></label></div>
      <fieldset data-ram-field="ram.hazards" disabled={!editable} className="space-y-5">{[...draft.activities.map(a=>({id:a.id,name:text(a.name,zh)})),{id:'__orphan',name:zh?'待重新归属的风险':'Risks needing an activity'}].filter(group=>!activityFilter||group.id===activityFilter).map(group=>{
      const groupRisks=draft.hazards.filter(r=>group.id==='__orphan'?!draft.activities.some(a=>a.id===r.activityId):r.activityId===group.id)
      if(group.id==='__orphan'&&!groupRisks.length)return null
      return <details key={group.id} className="rounded-xl border border-violet-200 bg-violet-50/30 p-3" data-ram-activity><summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2 text-sm"><strong>{group.name}</strong><span>{groupRisks.length} {zh?'项风险':'risks'} · {groupRisks.filter(r=>!r.likelihood||!r.impact||!r.residualLikelihood||!r.residualImpact).length} {zh?'未评分':'unrated'}</span><RamLevelBadge zh={zh} level={worstRamLevel(groupRisks.map(r=>previewRisk(r,policy)).filter(r=>r.residualLevel!=='Incomplete'))}/></summary><div className="space-y-2 pt-2">{groupRisks.filter(risk => (!activityFilter || risk.activityId === activityFilter) && (!categoryFilter || risk.categoryCode === categoryFilter) && (!completionFilter || riskHasMissingFields(risk) === (completionFilter === 'missing'))).map((risk) => {
        const index = draft.hazards.findIndex(r => r.id === risk.id), rating = previewRisk(risk, policy)
        return <details key={risk.id} className="rounded-xl border border-[#d9e5df] p-4" data-ram-risk data-ram-field={`ram.risk.${risk.id}`}>
        <summary className="min-h-11 cursor-pointer font-bold">{zh ? '风险' : 'Risk'} {index + 1} · {text(risk.hazard, zh) || (zh ? '未命名风险' : 'Unnamed risk')}<RiskScores risk={rating} zh={zh}/></summary><div className="mt-3 space-y-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">{zh ? '所属项目' : 'Activity'}<select className={ramInput} value={risk.activityId} onChange={e => editRisk(risk.id, { activityId: e.target.value })}><option value="">—</option>{draft.activities.map(a => <option key={a.id} value={a.id}>{text(a.name, zh) || (zh ? '未命名项目' : 'Unnamed activity')}</option>)}</select></label>
          <label className="text-sm">{zh ? '风险类别' : 'Risk category'}<select className={ramInput} value={risk.categoryCode} onChange={e => editRisk(risk.id, { categoryCode: e.target.value })}><option value="">—</option>{(policy?.categories || [{ code: 'environment', name: { en: 'Environment', zh: '环境' } }, { code: 'activity', name: { en: 'Activity', zh: '活动' } }, { code: 'participants', name: { en: 'Participants', zh: '参与者' } }, { code: 'transport', name: { en: 'Transport', zh: '交通' } }, { code: 'emergency', name: { en: 'Emergency', zh: '应急准备' } }]).map(c => <option key={c.code} value={c.code}>{text(c.name, zh)}</option>)}</select></label></div>
        <RamTextField label={zh ? '危害' : 'Hazard'} value={risk.hazard} onChange={hazard => editRisk(risk.id, { hazard })} /><RamTextField label={zh ? '可能后果' : 'Possible consequence'} value={risk.consequence} onChange={consequence => editRisk(risk.id, { consequence })} />
        {(['initial', 'residual'] as const).map(stage => <section key={stage} className="space-y-3">{stage === 'residual' ? <><RamTextField label={zh ? '控制措施' : 'Control measures'} value={risk.controlMeasures} onChange={controlMeasures => editRisk(risk.id, { controlMeasures })} /><label className="block text-sm">{zh ? '负责人' : 'Responsible person'}<input className={ramInput} value={risk.personResponsible || ''} onChange={e => editRisk(risk.id, { personResponsible: e.target.value })} /></label></> : null}
          <h4 className="font-semibold">{stage === 'initial' ? (zh ? '初始评分' : 'Initial rating') : (zh ? '剩余评分' : 'Residual rating')}</h4><div className="grid gap-3 md:grid-cols-2">{(['likelihood', 'impact'] as const).map(kind => {
            const key = stage === 'initial' ? kind : kind === 'likelihood' ? 'residualLikelihood' : 'residualImpact'
            const scales = policy?.[kind]?.length === 5 ? policy[kind] : ramDefaultScales[kind]
            const selectedScale = scales.find(scale => scale.value === risk[key])
            return <label key={kind} className="min-w-0 text-sm">{kind === 'likelihood' ? (zh ? '可能性' : 'Likelihood') : (zh ? '影响程度' : 'Impact')}<select className={ramInput} value={risk[key] ?? ''} onChange={e => editRisk(risk.id, { [key]: e.target.value ? Number(e.target.value) : null })}><option value="">{zh ? '未完成' : 'Incomplete'}</option>{scales.map(scale => <option value={scale.value} key={scale.value}>{scaleOptionText(scale, zh)}</option>)}</select><RamScaleDefinition scale={selectedScale} zh={zh} /></label>
          })}</div><p className="text-sm">{dirty ? (zh ? '当前草稿评分（未保存）' : 'Current draft rating (not saved)') : (zh ? '服务器已保存评分' : 'Server-saved rating')}: {stage === 'initial' ? `${risk.likelihood ?? '—'} × ${risk.impact ?? '—'} = ${rating.riskScore ?? '—'}` : `${risk.residualLikelihood ?? '—'} × ${risk.residualImpact ?? '—'} = ${rating.residualScore ?? '—'}`}  <RamLevelBadge zh={zh} level={stage === 'initial' ? rating?.initialLevel : rating?.residualLevel} /></p>
        </section>)}
        <RamTextField label={zh ? '额外行动／黄色风险额外控制' : 'Additional action / extra controls for yellow risk'} value={risk.additionalAction} onChange={additionalAction => editRisk(risk.id, { additionalAction })} />
        <div className="flex flex-wrap gap-3"><AppActionButton variant="secondary" onClick={() => update({ hazards: [...draft.hazards, duplicateRamRisk(risk, crypto.randomUUID())] })}>{zh ? '复制为新风险' : 'Duplicate as new risk'}</AppActionButton><button type="button" className="min-h-11 text-sm text-red-800" onClick={() => void requestConfirmation({ title: zh ? '移除草稿风险' : 'Remove draft risk', description: zh ? '保存前可通过撤销未保存修改恢复。' : 'Restore it by discarding unsaved changes before saving.' }).then(ok => { if (ok) update({ hazards: draft.hazards.filter(h => h.id !== risk.id) }) })}>{zh ? '移除此草稿风险' : 'Remove this draft risk'}</button></div>
      </div></details>})}</div></details>})}<AppActionButton variant="secondary" onClick={() => { setActivityFilter(''); setCategoryFilter(''); setCompletionFilter(''); update({ hazards: [...draft.hazards, { id: crypto.randomUUID(), activityId: draft.activities[0]?.id || '', categoryCode: '', hazard: ramText(), consequence: ramText(), likelihood: null, impact: null, controlMeasures: ramText(), personResponsible: '', residualLikelihood: null, residualImpact: null, additionalAction: ramText() }] }) }}>{zh ? '添加风险' : 'Add risk'}</AppActionButton></fieldset>
    </AppSectionCard>
    {confirmationModal}
  </div>
}
