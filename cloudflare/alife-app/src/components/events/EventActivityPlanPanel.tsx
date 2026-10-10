import { eventActivityPlanPanelText } from '../../i18n/eventActivityPlanPanel.ts'
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
import DetailsWorkspace from './creation/DetailsWorkspace'
import EventFormAssistant from './creation/EventFormAssistant'
import { activityPlanAssistantForm, applyActivityPlanAssistantForm } from '../../utils/eventFormAssistant'
import type { FormAssistantContext } from '../../../../shared/eventFormAssistant'

export function ActivityPlanEditor({ data, onChange, zh, disabled = false, occurrences = [] }: { data: ActivityPlanData; onChange: (data: ActivityPlanData) => void; zh: boolean; disabled?: boolean; occurrences?: {id:string; startUtc:string}[] }) {
  const {requestConfirmation,confirmationModal} = useConfirmation()
  const update = (value: Partial<ActivityPlanData>) => onChange({...data,...value})
  return <RamEditingLanguage.Provider value={zh}><fieldset disabled={disabled} className="space-y-3" data-activity-plan-editor>
    <label data-detail-field="participantCount" className="block text-sm">{zh ? eventActivityPlanPanelText.expectedParticipants.zh : eventActivityPlanPanelText.expectedParticipants.en}<input className={ramInput} type="number" min={1} max={1000000} value={data.participantCount ?? ''} onChange={e=>update({participantCount:e.target.value ? Number(e.target.value) : null})}/></label>
    <div className="flex flex-wrap gap-4">{(['isOuting','isOvernight','isHighRisk'] as const).map((key,i)=><label data-detail-field={key} key={key} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={data[key]} onChange={e=>update({[key]:e.target.checked})}/>{(zh?[...eventActivityPlanPanelText.localizedCopy.zh]:[...eventActivityPlanPanelText.localizedCopy.en])[i]}</label>)}</div>
    <div data-detail-field="activities" className="space-y-3">{data.activities.map(a=><details key={a.id} className="rounded-xl border border-violet-200 bg-violet-50/40 px-3" data-planned-activity><summary className="min-h-11 cursor-pointer py-3 font-semibold">{text(a.name,zh)|| (zh?eventActivityPlanPanelText.unnamedActivity.zh:eventActivityPlanPanelText.unnamedActivity.en)} <span className="text-xs font-normal">{text(ramActivityLabels[a.type],zh)}</span></summary><div className="space-y-3 pb-3">
      <RamTextField label={zh?eventActivityPlanPanelText.activityName.zh:eventActivityPlanPanelText.activityName.en} value={a.name} onChange={name=>update({activities:data.activities.map(x=>x.id===a.id?{...x,name}:x)})}/>
      <label className="block text-sm">{zh?eventActivityPlanPanelText.activityType.zh:eventActivityPlanPanelText.activityType.en}<select className={ramInput} value={a.type} onChange={e=>update({activities:data.activities.map(x=>x.id===a.id?{...x,type:e.target.value}:x)})}>{ramActivityTypes.map(t=><option key={t} value={t}>{text(ramActivityLabels[t],zh)}</option>)}</select></label>
      <RamTextField label={zh?eventActivityPlanPanelText.activityConditions.zh:eventActivityPlanPanelText.activityConditions.en} value={a.conditions} onChange={conditions=>update({activities:data.activities.map(x=>x.id===a.id?{...x,conditions}:x)})}/>
      {occurrences.length ? <label className="block text-sm">{zh?eventActivityPlanPanelText.occurrence.zh:eventActivityPlanPanelText.occurrence.en}<select className={ramInput} value={a.occurrenceId||''} onChange={e=>update({activities:data.activities.map(x=>x.id===a.id?{...x,occurrenceId:e.target.value||null}:x)})}><option value="">{zh?eventActivityPlanPanelText.entireEvent.zh:eventActivityPlanPanelText.entireEvent.en}</option>{occurrences.map(o=><option key={o.id} value={o.id}>{new Date(o.startUtc).toLocaleString(zh?'zh':'en')}</option>)}</select></label>:null}
      <AppActionButton variant="danger" onClick={()=>void requestConfirmation({title:zh?eventActivityPlanPanelText.removeActivity.zh:eventActivityPlanPanelText.removeActivity.en,description:zh?eventActivityPlanPanelText.linkedTasksAndRisksRemainAndWillNeedTheir.zh:eventActivityPlanPanelText.linkedTasksAndRisksRemainAndWillNeedTheir.en}).then(ok=>{if(ok)update({activities:data.activities.filter(x=>x.id!==a.id)})})}>{zh?eventActivityPlanPanelText.removeActivityLabel.zh:eventActivityPlanPanelText.removeActivityLabel.en}</AppActionButton>
    </div></details>)}
    </div><AppActionButton disabled={data.activities.length>=50} onClick={()=>update({activities:[...data.activities,{id:crypto.randomUUID(),type:'generic',name:{en:'',zh:''},conditions:{en:'',zh:''}}]})}>{zh?eventActivityPlanPanelText.addActivity.zh:eventActivityPlanPanelText.addActivity.en}</AppActionButton>
    {data.isOuting?<RamTextField label={zh?eventActivityPlanPanelText.weatherReviewAndAlternatives.zh:eventActivityPlanPanelText.weatherReviewAndAlternatives.en} value={data.weatherConfirmation || {en:'',zh:''}} onChange={weatherConfirmation=>update({weatherConfirmation})}/>:null}
    <p className="text-xs text-[#66766f]">{zh?eventActivityPlanPanelText.travelAndAccommodationDetailsComeFromTheAdoptedReports.zh:eventActivityPlanPanelText.travelAndAccommodationDetailsComeFromTheAdoptedReports.en}</p>
  </fieldset>{confirmationModal}</RamEditingLanguage.Provider>
}

export default function EventActivityPlanPanel({eventId,groupId,zh,eventContext,onSaved,onPlanChange,onBusy}:{eventId:string;groupId:string;zh:boolean;eventContext?:FormAssistantContext;onSaved?:()=>Promise<void>;onPlanChange?:(plan:ActivityPlanData)=>void;onBusy?:(busy:boolean)=>void}) {
  const viewer=useAuthStore().me?.id
  const [view,setView]=useState<ActivityPlanView|null>(null),[draft,setDraft]=useState(emptyActivityPlan),[error,setError]=useState(''),[busy,setBusy]=useState(false),[occurrences,setOccurrences]=useState<{id:string;startUtc:string}[]>([]),[reload,setReload]=useState(0)
  const dirty=!!view&&JSON.stringify(draft)!==JSON.stringify(view.data)
  useArrangementDraft(dirty||busy)
  useEffect(() => { onBusy?.(busy); return () => onBusy?.(false) }, [busy, onBusy])
  useEffect(()=>{let live=true;setView(null);setError('');void eventActivityPlanService.get(eventId).then(v=>{if(live){setView(v);setDraft(v.data);onPlanChange?.(v.data)}}).catch(e=>{if(live)setError(normalizeApiError(e).message)});void eventOperationsService.listOccurrences(eventId).then(v=>{if(live)setOccurrences(v)}).catch(()=>{});return()=>{live=false}},[eventId,viewer,reload])
  return <EventToolSection title={zh?eventActivityPlanPanelText.activitiesAndConditions.zh:eventActivityPlanPanelText.activitiesAndConditions.en} summary={view?`${draft.activities.length} ${zh?eventActivityPlanPanelText.activities.zh:eventActivityPlanPanelText.activities.en}`:(zh?eventActivityPlanPanelText.loading.zh:eventActivityPlanPanelText.loading.en)}>
    {error?<p role="alert">{error}</p>:null}
    {!view?<AppActionButton onClick={()=>setReload(x=>x+1)}>{zh?eventActivityPlanPanelText.reload.zh:eventActivityPlanPanelText.reload.en}</AppActionButton>:<div className="space-y-3">
      {view.legacyCandidate?<details className="rounded-xl border p-3"><summary>{zh?eventActivityPlanPanelText.activitiesFromLegacyRamNotAdopted.zh:eventActivityPlanPanelText.activitiesFromLegacyRamNotAdopted.en}</summary><p className="py-2 text-sm">{view.legacyCandidate.activities.map(a=>text(a.name,zh)).join(' · ')|| (zh?eventActivityPlanPanelText.noActivityDefinitionsToAdopt.zh:eventActivityPlanPanelText.noActivityDefinitionsToAdopt.en)}</p><AppActionButton disabled={!view.canEdit||busy} onClick={()=>setDraft(structuredClone(view.legacyCandidate!))}>{zh?eventActivityPlanPanelText.loadAsDraftThenReviewAndSave.zh:eventActivityPlanPanelText.loadAsDraftThenReviewAndSave.en}</AppActionButton></details>:null}
      <DetailsWorkspace zh active readOnly={!view.canEdit||busy} limitAssistantHeight labels={{ workspace: zh ? eventActivityPlanPanelText.activitiesAndConditionsWorkspace.zh : eventActivityPlanPanelText.activitiesAndConditionsWorkspace.en, form: zh ? eventActivityPlanPanelText.activityConditionsForm.zh : eventActivityPlanPanelText.activityConditionsForm.en, assistant: zh ? eventActivityPlanPanelText.aiActivityAssistant.zh : eventActivityPlanPanelText.aiActivityAssistant.en }}
        form={<ActivityPlanEditor data={draft} onChange={setDraft} zh={zh} disabled={!view.canEdit||busy} occurrences={occurrences}/>}
        assistant={active => <EventFormAssistant eventId={eventId} scope="activityPlan" form={activityPlanAssistantForm(draft)} context={eventContext} contextSignature={JSON.stringify([draft, eventContext])} zh={zh} active={active} initiallyConfirmed onBusy={onBusy}
          onAdopt={(form, fields) => setDraft(current => JSON.stringify(current) === JSON.stringify(draft) ? applyActivityPlanAssistantForm(current, form, fields) : current)} />} />
      {view.reports.filter(r=>r.moduleCode==='MOVE.STAY').map(r=><details key={r.moduleCode}><summary>{zh?eventActivityPlanPanelText.adoptedTravelAndAccommodation.zh:eventActivityPlanPanelText.adoptedTravelAndAccommodation.en} · v{r.version}</summary><p className="whitespace-pre-wrap text-sm">{text(r.text,zh)}</p><details><summary>{zh?eventActivityPlanPanelText.expand.zh:eventActivityPlanPanelText.expand.en}</summary><p>{text(r.text,!zh)}</p></details></details>)}
      {view.canEdit?<AppActionButton variant="primary" disabled={!dirty||busy} onClick={()=>{setBusy(true);setError('');void eventActivityPlanService.save(eventId,draft,view.eTag,groupId).then(async v=>{setView(v);setDraft(v.data);onPlanChange?.(v.data);await onSaved?.()}).catch(e=>setError(normalizeApiError(e).message)).finally(()=>setBusy(false))}}>{zh?eventActivityPlanPanelText.saveActivitiesAndConditions.zh:eventActivityPlanPanelText.saveActivitiesAndConditions.en}</AppActionButton>:null}
    </div>}
  </EventToolSection>
}
