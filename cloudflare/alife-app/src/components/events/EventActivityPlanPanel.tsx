import { useEffect, useState } from 'react'
import type { ActivityPlanData, ActivityPlanView } from '../../types/eventActivityPlan'
import { emptyActivityPlan } from '../../types/eventActivityPlan'
import { eventActivityPlanService } from '../../services/eventActivityPlanService'
import { eventOperationsService } from '../../services/eventOperationsService'
import { normalizeApiError } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import { displayRamText as text, ramActivityLabels, ramActivityTypes } from '../../types/ramGovernance'
import { RamEditingLanguage, RamTextField, ramInput } from './RamFields'
import { EventToolSection } from './ArrangementTileDeck'
import { useArrangementDraft } from './ArrangementTileDeck'
import AppActionButton from '../layout/AppActionButton'
import useConfirmation from '../../hooks/useConfirmation'

export function ActivityPlanEditor({ data, onChange, zh, disabled = false, occurrences = [] }: { data: ActivityPlanData; onChange: (data: ActivityPlanData) => void; zh: boolean; disabled?: boolean; occurrences?: {id:string; startUtc:string}[] }) {
  const {requestConfirmation,confirmationModal} = useConfirmation()
  const update = (value: Partial<ActivityPlanData>) => onChange({...data,...value})
  return <RamEditingLanguage.Provider value={zh}><fieldset disabled={disabled} className="space-y-3" data-activity-plan-editor>
    <label className="block text-sm">{zh ? '预计人数' : 'Expected participants'}<input className={ramInput} type="number" min={1} max={1000000} value={data.participantCount ?? ''} onChange={e=>update({participantCount:e.target.value ? Number(e.target.value) : null})}/></label>
    <div className="flex flex-wrap gap-4">{(['isOuting','isOvernight','isHighRisk'] as const).map((key,i)=><label key={key} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={data[key]} onChange={e=>update({[key]:e.target.checked})}/>{(zh?['室外／场外','过夜','已知高风险活动']:['Outdoor / off-site','Overnight','Known high-risk activity'])[i]}</label>)}</div>
    {data.activities.map(a=><details key={a.id} className="rounded-xl border border-violet-200 bg-violet-50/40 px-3" data-planned-activity><summary className="min-h-11 cursor-pointer py-3 font-semibold">{text(a.name,zh)|| (zh?'未命名活动':'Unnamed activity')} <span className="text-xs font-normal">{text(ramActivityLabels[a.type],zh)}</span></summary><div className="space-y-3 pb-3">
      <RamTextField label={zh?'活动名称':'Activity name'} value={a.name} onChange={name=>update({activities:data.activities.map(x=>x.id===a.id?{...x,name}:x)})}/>
      <label className="block text-sm">{zh?'活动类型':'Activity type'}<select className={ramInput} value={a.type} onChange={e=>update({activities:data.activities.map(x=>x.id===a.id?{...x,type:e.target.value}:x)})}>{ramActivityTypes.map(t=><option key={t} value={t}>{text(ramActivityLabels[t],zh)}</option>)}</select></label>
      <RamTextField label={zh?'活动条件':'Activity conditions'} value={a.conditions} onChange={conditions=>update({activities:data.activities.map(x=>x.id===a.id?{...x,conditions}:x)})}/>
      {occurrences.length ? <label className="block text-sm">{zh?'适用场次':'Occurrence'}<select className={ramInput} value={a.occurrenceId||''} onChange={e=>update({activities:data.activities.map(x=>x.id===a.id?{...x,occurrenceId:e.target.value||null}:x)})}><option value="">{zh?'全活动':'Entire event'}</option>{occurrences.map(o=><option key={o.id} value={o.id}>{new Date(o.startUtc).toLocaleString(zh?'zh':'en')}</option>)}</select></label>:null}
      <AppActionButton variant="danger" onClick={()=>void requestConfirmation({title:zh?'移除活动项目':'Remove activity',description:zh?'关联任务和风险会保留，需要重新核对归属。':'Linked tasks and risks remain and will need their activity checked.'}).then(ok=>{if(ok)update({activities:data.activities.filter(x=>x.id!==a.id)})})}>{zh?'移除项目':'Remove activity'}</AppActionButton>
    </div></details>)}
    <AppActionButton disabled={data.activities.length>=50} onClick={()=>update({activities:[...data.activities,{id:crypto.randomUUID(),type:'generic',name:{en:'',zh:''},conditions:{en:'',zh:''}}]})}>{zh?'添加活动项目':'Add activity'}</AppActionButton>
    {data.isOuting?<RamTextField label={zh?'天气核查与替代安排':'Weather review and alternatives'} value={data.weatherConfirmation || {en:'',zh:''}} onChange={weatherConfirmation=>update({weatherConfirmation})}/>:null}
    <p className="text-xs text-[#66766f]">{zh?'交通、住宿等具体安排引用对应模块已采纳的报告。':'Travel and accommodation details come from the adopted reports of their modules.'}</p>
  </fieldset>{confirmationModal}</RamEditingLanguage.Provider>
}

export default function EventActivityPlanPanel({eventId,groupId,zh,onSaved,onPlanChange}:{eventId:string;groupId:string;zh:boolean;onSaved?:()=>Promise<void>;onPlanChange?:(plan:ActivityPlanData)=>void}) {
  const viewer=useAuthStore().me?.id
  const [view,setView]=useState<ActivityPlanView|null>(null),[draft,setDraft]=useState(emptyActivityPlan),[error,setError]=useState(''),[busy,setBusy]=useState(false),[occurrences,setOccurrences]=useState<{id:string;startUtc:string}[]>([]),[reload,setReload]=useState(0)
  const dirty=!!view&&JSON.stringify(draft)!==JSON.stringify(view.data)
  useArrangementDraft(dirty||busy)
  useEffect(()=>{let live=true;setView(null);setError('');void eventActivityPlanService.get(eventId).then(v=>{if(live){setView(v);setDraft(v.data);onPlanChange?.(v.data)}}).catch(e=>{if(live)setError(normalizeApiError(e).message)});void eventOperationsService.listOccurrences(eventId).then(v=>{if(live)setOccurrences(v)}).catch(()=>{});return()=>{live=false}},[eventId,viewer,reload])
  return <EventToolSection title={zh?'活动项目与条件':'Activities and conditions'} summary={view?`${draft.activities.length} ${zh?'个活动项目':'activities'}`:(zh?'正在读取':'Loading')}>
    {error?<p role="alert">{error}</p>:null}
    {!view?<AppActionButton onClick={()=>setReload(x=>x+1)}>{zh?'重新读取':'Reload'}</AppActionButton>:<div className="space-y-3">
      {view.legacyCandidate?<details className="rounded-xl border p-3"><summary>{zh?'旧 RAM 中的活动资料（待采纳）':'Activities from legacy RAM (not adopted)'}</summary><p className="py-2 text-sm">{view.legacyCandidate.activities.map(a=>text(a.name,zh)).join(' · ')|| (zh?'没有可直接采纳的真实活动':'No activity definitions to adopt')}</p><AppActionButton disabled={!view.canEdit||busy} onClick={()=>setDraft(structuredClone(view.legacyCandidate!))}>{zh?'载入为草稿，核对后保存':'Load as draft, then review and save'}</AppActionButton></details>:null}
      <ActivityPlanEditor data={draft} onChange={setDraft} zh={zh} disabled={!view.canEdit||busy} occurrences={occurrences}/>
      {view.reports.filter(r=>r.moduleCode==='MOVE.STAY').map(r=><details key={r.moduleCode}><summary>{zh?'已采纳的交通住宿安排':'Adopted travel and accommodation'} · v{r.version}</summary><p className="whitespace-pre-wrap text-sm">{text(r.text,zh)}</p><details><summary>{zh?'展开 English':'Expand 中文'}</summary><p>{text(r.text,!zh)}</p></details></details>)}
      {view.canEdit?<AppActionButton variant="primary" disabled={!dirty||busy} onClick={()=>{setBusy(true);setError('');void eventActivityPlanService.save(eventId,draft,view.eTag,groupId).then(async v=>{setView(v);setDraft(v.data);onPlanChange?.(v.data);await onSaved?.()}).catch(e=>setError(normalizeApiError(e).message)).finally(()=>setBusy(false))}}>{zh?'保存活动项目与条件':'Save activities and conditions'}</AppActionButton>:null}
    </div>}
  </EventToolSection>
}
