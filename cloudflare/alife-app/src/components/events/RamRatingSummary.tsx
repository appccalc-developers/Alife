import type { RamDraft, RamLevel, RamRisk } from '../../types/ramGovernance'
import { worstRamLevel } from '../../utils/ramRatings'
import { RamLevelBadge, levelClass } from './RamFields'
import { riskHasMissingFields } from '../../utils/ramAuthoring'

export function RiskScores({risk,zh}:{risk:RamRisk;zh:boolean}) {
  return <span className="flex flex-wrap gap-2 text-xs font-medium">{(['initial','residual'] as const).map(stage=>{
    const score=stage==='initial'?risk.riskScore:risk.residualScore,level=(stage==='initial'?risk.initialLevel:risk.residualLevel)||'Incomplete'
    return <span key={stage} className={`rounded-lg px-2 py-1 ${levelClass[level]}`}>{stage==='initial'?(zh?'初始':'Initial'):(zh?'剩余':'Residual')} {score??(zh?'尚未评分':'Not rated')}{score!=null&&level==='Incomplete'?(zh?' · 颜色待确认':' · Colour pending'):null}</span>
  })}</span>
}
export default function RamRatingSummary({draft,zh,dirty,level}:{draft:RamDraft;zh:boolean;dirty:boolean;level?:RamLevel}) {
  const hasText=(v:{en:string;zh:string})=>!!(v?.en?.trim()||v?.zh?.trim())
  const incomplete=!draft.activities.length||!draft.participantCount||draft.authorAttendsAndLeads==null||draft.authorAttendsAndLeads===false&&!draft.onsiteMemberId||draft.isOuting&&!hasText(draft.weatherConfirmation)||draft.isOvernight&&!hasText(draft.accommodation)||draft.activities.some(a=>!draft.hazards.some(r=>r.activityId===a.id))||draft.hazards.some(r=>riskHasMissingFields(r)||!draft.activities.some(a=>a.id===r.activityId)||(r.initialLevel==='Yellow'||r.residualLevel==='Yellow')&&!hasText(r.additionalAction))
  return <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4" aria-label={zh?'评分概览':'Rating overview'}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{zh?'整体剩余风险':'Overall residual risk'}</h3><RamLevelBadge zh={zh} level={level||(incomplete?'Incomplete':worstRamLevel(draft.hazards))}/></div>
    <div className="flex flex-wrap gap-2">{(['Red','Yellow','Green','Incomplete'] as const).map(l=><span key={l} className={`rounded-xl px-3 py-2 text-sm ${levelClass[l]}`}><RamLevelBadge zh={zh} level={l}/> <strong>{draft.hazards.filter(r=>(r.residualLevel||'Incomplete')===l).length}</strong></span>)}</div>
    <p className="text-xs">{dirty?(zh?'当前预览 · 未保存，正式评分由服务器核验。':'Current preview · Unsaved; formal ratings are verified by the server.'):(zh?'风险分数逐项显示，不相加；颜色采用教会政策矩阵。':'Risk scores are shown individually, never added; colours use the church policy matrix.')}</p>
  </section>
}
