import { ramRatingSummaryText } from '../../i18n/ramRatingSummary.ts'
import type { RamDraft, RamLevel, RamRisk } from '../../types/ramGovernance'
import { worstRamLevel } from '../../utils/ramRatings'
import { RamLevelBadge, levelClass } from './RamFields'
import { riskHasMissingFields } from '../../utils/ramAuthoring'

export function RiskScores({risk,zh}:{risk:RamRisk;zh:boolean}) {
  return <span className="flex flex-wrap gap-2 text-xs font-medium">{(['initial','residual'] as const).map(stage=>{
    const score=stage==='initial'?risk.riskScore:risk.residualScore,level=(stage==='initial'?risk.initialLevel:risk.residualLevel)||'Incomplete'
    return <span key={stage} className={`rounded-lg px-2 py-1 ${levelClass[level]}`}>{stage==='initial'?(zh?ramRatingSummaryText.initial.zh:ramRatingSummaryText.initial.en):(zh?ramRatingSummaryText.residual.zh:ramRatingSummaryText.residual.en)} {score??(zh?ramRatingSummaryText.notRated.zh:ramRatingSummaryText.notRated.en)}{score!=null&&level==='Incomplete'?(zh?ramRatingSummaryText.colourPending.zh:ramRatingSummaryText.colourPending.en):null}</span>
  })}</span>
}
export default function RamRatingSummary({draft,zh,dirty,level}:{draft:RamDraft;zh:boolean;dirty:boolean;level?:RamLevel}) {
  const hasText=(v:{en:string;zh:string})=>!!(v?.en?.trim()||v?.zh?.trim())
  const incomplete=!draft.activities.length||!draft.participantCount||draft.authorAttendsAndLeads==null||draft.authorAttendsAndLeads===false&&!draft.onsiteMemberId||draft.isOuting&&!hasText(draft.weatherConfirmation)||draft.isOvernight&&!hasText(draft.accommodation)||draft.activities.some(a=>!draft.hazards.some(r=>r.activityId===a.id))||draft.hazards.some(r=>riskHasMissingFields(r)||!draft.activities.some(a=>a.id===r.activityId)||(r.initialLevel==='Yellow'||r.residualLevel==='Yellow')&&!hasText(r.additionalAction))
  return <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4" aria-label={zh?ramRatingSummaryText.ratingOverview.zh:ramRatingSummaryText.ratingOverview.en}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{zh?ramRatingSummaryText.overallResidualRisk.zh:ramRatingSummaryText.overallResidualRisk.en}</h3><RamLevelBadge zh={zh} level={level||(incomplete?'Incomplete':worstRamLevel(draft.hazards))}/></div>
    <div className="flex flex-wrap gap-2">{(['Red','Yellow','Green','Incomplete'] as const).map(l=><span key={l} className={`rounded-xl px-3 py-2 text-sm ${levelClass[l]}`}><RamLevelBadge zh={zh} level={l}/> <strong>{draft.hazards.filter(r=>(r.residualLevel||'Incomplete')===l).length}</strong></span>)}</div>
    <p className="text-xs">{dirty?(zh?ramRatingSummaryText.currentPreviewUnsavedFormalRatingsAreVerifiedByThe.zh:ramRatingSummaryText.currentPreviewUnsavedFormalRatingsAreVerifiedByThe.en):(zh?ramRatingSummaryText.riskScoresAreShownIndividuallyNeverAddedColoursUse.zh:ramRatingSummaryText.riskScoresAreShownIndividuallyNeverAddedColoursUse.en)}</p>
  </section>
}
