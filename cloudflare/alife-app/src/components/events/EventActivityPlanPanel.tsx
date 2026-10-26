import { eventActivityPlanPanelText } from '../../i18n/eventActivityPlanPanel.ts'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { ActivityPlanData, ActivityPlanView, PlannedActivity } from '../../types/eventActivityPlan'
import { emptyActivityPlan, validStoredActivityPlan } from '../../types/eventActivityPlan'
import { eventActivityPlanService } from '../../services/eventActivityPlanService'
import { eventOperationsService } from '../../services/eventOperationsService'
import { eventCompositionService } from '../../services/eventCompositionService'
import { normalizeApiError } from '../../services/http'
import { useAuthStore } from '../../stores/auth'
import { displayRamText as text, activityAttributes, activityAttributeCodes, ramActivityContentName, type RamQuestion } from '../../types/ramGovernance'
import { ramActivityAttributesText as attributeCopy } from '../../i18n/ramActivityAttributes'
import RamApplicableChecks from './RamApplicableChecks'
import EventPolicyHelp from './EventPolicyHelp'
import { ramService } from '../../services/ramGovernanceService'
import { RamEditingLanguage, RamTextField, ramInput } from './RamFields'
import { EventToolSection } from './ArrangementTileDeck'
import { useArrangementDraft } from './ArrangementTileDeck'
import AppActionButton from '../layout/AppActionButton'
import useConfirmation from '../../hooks/useConfirmation'
import DetailsWorkspace from './creation/DetailsWorkspace'
import EventFormAssistant from './creation/EventFormAssistant'
import { activityPlanAssistantForm, applyActivityPlanAssistantForm } from '../../utils/eventFormAssistant'
import type { FormAssistantContext } from '../../../../shared/eventFormAssistant'

import EventProjectQuestions from './EventProjectQuestions'
import EventProjectModuleSummary from './EventProjectModuleSummary'
import { eventProjectQuestionnaireText as projectCopy } from '../../i18n/eventProjectQuestionnaire'
import type { EventProjectQuestionDefinition } from '../../types/eventProjectQuestionnaire'
import { newProjectAnswers, projectModuleRequirements, projectNeedsConfirmation } from '../../utils/eventProjectQuestionnaire'
import { localPreparationDate } from '../../utils/eventSavedPreparation'
import { localTimeToUtc } from '../../../../shared/eventDetails'

export const EventProjectFactContext = createContext<Record<string, 'yes' | 'no' | 'unknown'> | null>(null)

export function ActivityPlanEditor({ data, onChange, zh, disabled = false, occurrences = [], checkItems, questionDefinitions, groupId, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone, renderProjectConfiguration, planDirty = false, registrationMode, eventAnswers }: { data: ActivityPlanData; onChange: (data: ActivityPlanData) => void; zh: boolean; disabled?: boolean; occurrences?: {id:string; startUtc:string}[]; checkItems?: RamQuestion[] | null; questionDefinitions?: EventProjectQuestionDefinition[]; groupId?: string; timeZone?: string; renderProjectConfiguration?: (activity: PlannedActivity, planDirty: boolean) => ReactNode; planDirty?: boolean; registrationMode?: 'none' | 'required'; eventAnswers?: Record<string, 'yes' | 'no' | 'unknown'> }) {
  const {requestConfirmation,confirmationModal} = useConfirmation()
  const root = useRef<HTMLDivElement>(null)
  const viewer = useAuthStore().me?.id
  const [loadedDefinitions, setLoadedDefinitions] = useState<EventProjectQuestionDefinition[]>([])
  const [timeError, setTimeError] = useState('')
  const [loadedQuestions, setLoadedQuestions] = useState<RamQuestion[] | null>()
  const [checkItemsError, setCheckItemsError] = useState('')
  const [checkItemsReload, setCheckItemsReload] = useState(0)
  useEffect(() => {
    if (!groupId || checkItems !== undefined && questionDefinitions !== undefined) return
    let live = true; setLoadedQuestions(undefined); setCheckItemsError('')
    void ramService.authoringContext({ groupId }).then(context => { if (live) { setLoadedQuestions(context.policy?.data.questions ?? null); setLoadedDefinitions(context.questionDefinitions ?? []) } })
      .catch(error => { if (live) setCheckItemsError(normalizeApiError(error).message) })
    return () => { live = false }
  }, [groupId, checkItems, questionDefinitions, checkItemsReload, viewer])
  const questions = checkItems !== undefined ? checkItems : loadedQuestions
  const definitions = questionDefinitions ?? loadedDefinitions
  const updateActivity = (activity: PlannedActivity) => update({ activities: data.activities.map(item => item.id === activity.id ? activity : item) })
  const selectProject = (id: string) => { const element = Array.from(root.current?.querySelectorAll<HTMLDetailsElement>('[data-planned-activity]') ?? []).find(item => item.dataset.activityId === id); if (element) { element.open = true; element.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); element.querySelector<HTMLElement>('summary')?.focus() } }
  const editTime = (activity: PlannedActivity, field: 'startUtc' | 'endUtc', value: string) => { try { updateActivity({ ...activity, [field]: value ? localTimeToUtc(value, timeZone) : null }); setTimeError('') } catch (error) { setTimeError(normalizeApiError(error).message) } }
  const update = (value: Partial<ActivityPlanData>) => onChange({...data,...value,questionnaireVersion:2})
  return <RamEditingLanguage.Provider value={zh}>{checkItemsError ? <div><p role="alert">{checkItemsError}</p><AppActionButton onClick={() => setCheckItemsReload(value => value + 1)}>{zh ? eventActivityPlanPanelText.reload.zh : eventActivityPlanPanelText.reload.en}</AppActionButton></div> : groupId && checkItems === undefined && loadedQuestions === undefined ? <p role="status">{zh ? eventActivityPlanPanelText.loadingCheckItems.zh : eventActivityPlanPanelText.loadingCheckItems.en}</p> : null}<div ref={root} className="space-y-3" data-activity-plan-editor>
    <label data-detail-field="participantCount" className="block text-sm">{zh ? eventActivityPlanPanelText.expectedParticipants.zh : eventActivityPlanPanelText.expectedParticipants.en}<input disabled={disabled} className={ramInput} type="number" min={1} max={1000000} value={data.participantCount ?? ''} onChange={e=>update({participantCount:e.target.value ? Number(e.target.value) : null})}/></label>
    <div className="flex flex-wrap gap-4">{(['isOuting','isOvernight','isHighRisk'] as const).map((key,i)=><label data-detail-field={key} key={key} className="flex min-h-11 items-center gap-2 text-sm"><input disabled={disabled} type="checkbox" checked={data[key]} onChange={e=>update({[key]:e.target.checked})}/>{(zh?[...eventActivityPlanPanelText.localizedCopy.zh]:[...eventActivityPlanPanelText.localizedCopy.en])[i]}</label>)}</div>
    <EventProjectModuleSummary activities={data.activities} definitions={definitions} zh={zh} registrationMode={registrationMode} eventAnswers={eventAnswers} onSelectProject={selectProject}/>{timeError ? <p role="alert">{timeError}</p> : null}
    <div data-detail-field="activities" className="space-y-3">{data.activities.map(a=><details key={a.id} className="rounded-xl border border-violet-200 bg-violet-50/40 px-3" data-planned-activity data-activity-id={a.id}><summary className="min-h-11 cursor-pointer py-3 font-semibold">{text(a.name,zh)|| (zh?eventActivityPlanPanelText.unnamedActivity.zh:eventActivityPlanPanelText.unnamedActivity.en)} <span className="text-xs font-normal">{activityAttributes(a).map(code => text(ramActivityContentName(code),zh)).join(' · ') || text(attributeCopy.general,zh)}</span> {a.sourcePresetKey ? <span className={projectNeedsConfirmation(a,definitions) ? 'text-xs text-amber-900' : 'text-xs text-[#176b5a]'}>{text(projectNeedsConfirmation(a,definitions) ? projectCopy.templatePending : projectCopy.reviewed,zh)}</span> : null}</summary><div className="space-y-3 pb-3">
      <RamTextField disabled={disabled} label={zh?eventActivityPlanPanelText.activityName.zh:eventActivityPlanPanelText.activityName.en} value={a.name} onChange={name=>update({activities:data.activities.map(x=>x.id===a.id?{...x,name}:x)})}/>
      <fieldset className="space-y-2" data-activity-attributes><legend className="flex items-center gap-2 text-sm font-semibold">{text(attributeCopy.attributes,zh)}<EventPolicyHelp zh={zh} label={text(attributeCopy.attributes,zh)} text={text(attributeCopy.help,zh)}/></legend><div className="flex flex-wrap gap-x-5 gap-y-1">{activityAttributeCodes.map(code=><label key={code} className="flex min-h-11 items-center gap-2 text-sm"><input disabled={disabled} type="checkbox" checked={activityAttributes(a).includes(code)} onChange={e=>{ const attributes=e.target.checked?[...activityAttributes(a),code]:activityAttributes(a).filter(value=>value!==code); update({activities:data.activities.map(x=>x.id===a.id?{...x,attributes,presetConfirmed:x.sourcePresetKey ? false : x.presetConfirmed}:x)}) }}/>{text(ramActivityContentName(code),zh)}</label>)}</div></fieldset>
      <EventProjectQuestions activity={a} definitions={definitions} onChange={updateActivity} zh={zh} disabled={disabled}/>
      <div className="grid gap-3 sm:grid-cols-2">{(['startUtc','endUtc'] as const).map((field,index)=><label key={field} className="block text-sm">{text(index===0?projectCopy.start:projectCopy.end,zh)}<input disabled={disabled} className={ramInput} type="datetime-local" value={a[field] ? localPreparationDate(a[field]!,timeZone) : ''} onChange={event=>editTime(a,field,event.target.value)}/></label>)}</div>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input disabled={disabled} type="checkbox" checked={a.repeatForEachOccurrence ?? false} onChange={event=>updateActivity({...a,repeatForEachOccurrence:event.target.checked})}/>{text(projectCopy.repeat,zh)}</label>
      {projectModuleRequirements(a,definitions).length ? <details className="rounded-lg border p-3"><summary className="min-h-11 cursor-pointer font-semibold">{text(projectCopy.modules,zh)}</summary><div className="space-y-3 py-2">{projectModuleRequirements(a,definitions).map(code=><p key={code}>{text(projectCopy.moduleNames[code],zh)}</p>)}</div></details> : null}
      {renderProjectConfiguration?.(a, planDirty)}
      <RamApplicableChecks activity={a} questions={questions} zh={zh}/>
      <RamTextField disabled={disabled} label={zh?eventActivityPlanPanelText.activityConditions.zh:eventActivityPlanPanelText.activityConditions.en} value={a.conditions} onChange={conditions=>update({activities:data.activities.map(x=>x.id===a.id?{...x,conditions}:x)})}/>
      {occurrences.length ? <label className="block text-sm">{zh?eventActivityPlanPanelText.occurrence.zh:eventActivityPlanPanelText.occurrence.en}<select disabled={disabled} className={ramInput} value={a.occurrenceId||''} onChange={e=>update({activities:data.activities.map(x=>x.id===a.id?{...x,occurrenceId:e.target.value||null}:x)})}><option value="">{zh?eventActivityPlanPanelText.entireEvent.zh:eventActivityPlanPanelText.entireEvent.en}</option>{occurrences.map(o=><option key={o.id} value={o.id}>{new Date(o.startUtc).toLocaleString(zh?'zh':'en')}</option>)}</select></label>:null}
      <AppActionButton disabled={disabled || data.activities.length>=50} onClick={()=>update({activities:[...data.activities,{...structuredClone(a),id:crypto.randomUUID(),sourcePresetKey:null,sourceTemplateVersion:null,presetConfirmed:false,answers:Object.fromEntries(Object.entries(a.answers ?? {}).map(([code,answer])=>[code,{...answer,source:'human',confirmed:answer.value!=='unknown'}]))}]})}>{text(projectCopy.duplicate,zh)}</AppActionButton>
      <AppActionButton disabled={disabled} variant="danger" onClick={()=>void requestConfirmation({title:zh?eventActivityPlanPanelText.removeActivity.zh:eventActivityPlanPanelText.removeActivity.en,description:zh?eventActivityPlanPanelText.linkedTasksAndRisksRemainAndWillNeedTheir.zh:eventActivityPlanPanelText.linkedTasksAndRisksRemainAndWillNeedTheir.en}).then(ok=>{if(ok)update({activities:data.activities.filter(x=>x.id!==a.id)})})}>{zh?eventActivityPlanPanelText.removeActivityLabel.zh:eventActivityPlanPanelText.removeActivityLabel.en}</AppActionButton>
    </div></details>)}
    </div><AppActionButton disabled={disabled || data.activities.length>=50} onClick={()=>update({activities:[...data.activities,{id:crypto.randomUUID(),attributes:[],answers:newProjectAnswers(),presetConfirmed:false,name:{en:'',zh:''},conditions:{en:'',zh:''}}]})}>{zh?eventActivityPlanPanelText.addActivity.zh:eventActivityPlanPanelText.addActivity.en}</AppActionButton>
    {data.isOuting?<RamTextField disabled={disabled} label={zh?eventActivityPlanPanelText.weatherReviewAndAlternatives.zh:eventActivityPlanPanelText.weatherReviewAndAlternatives.en} value={data.weatherConfirmation || {en:'',zh:''}} onChange={weatherConfirmation=>update({weatherConfirmation})}/>:null}
    <p className="text-xs text-[#66766f]">{zh?eventActivityPlanPanelText.travelAndAccommodationDetailsComeFromTheAdoptedReports.zh:eventActivityPlanPanelText.travelAndAccommodationDetailsComeFromTheAdoptedReports.en}</p>
  </div>{confirmationModal}</RamEditingLanguage.Provider>
}

export default function EventActivityPlanPanel({eventId,groupId,zh,eventContext,onSaved,onPlanChange,onBusy,timeZone,renderProjectConfiguration}:{eventId:string;groupId:string;zh:boolean;eventContext?:FormAssistantContext;onSaved?:()=>Promise<void>;onPlanChange?:(plan:ActivityPlanData)=>void;onBusy?:(busy:boolean)=>void;timeZone?:string;renderProjectConfiguration?:(activity:PlannedActivity, planDirty: boolean)=>ReactNode}) {
  const viewer=useAuthStore().me?.id
  const editingEventAnswers=useContext(EventProjectFactContext)
  const [view,setView]=useState<ActivityPlanView|null>(null),[draft,setDraft]=useState(emptyActivityPlan),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[occurrences,setOccurrences]=useState<{id:string;startUtc:string}[]>([]),[reload,setReload]=useState(0)
  const [eventAnswers,setEventAnswers]=useState<Record<string,'yes'|'no'|'unknown'>>({})
  const dirty=!!view&&JSON.stringify(draft)!==JSON.stringify(view.data)
  useArrangementDraft(dirty||busy)
  useEffect(() => { onBusy?.(busy); return () => onBusy?.(false) }, [busy, onBusy])
  useEffect(()=>{let live=true;setView(null);setError('');void eventActivityPlanService.get(eventId).then(v=>{if(!validStoredActivityPlan(v.data))throw new Error(zh?eventActivityPlanPanelText.unsupportedSchema.zh:eventActivityPlanPanelText.unsupportedSchema.en);if(live){setView(v);setDraft(v.data);onPlanChange?.(v.data)}}).catch(e=>{if(live)setError(normalizeApiError(e).message)});void eventOperationsService.listOccurrences(eventId).then(v=>{if(live)setOccurrences(v)}).catch(()=>{});void eventCompositionService.getPlan(eventId).then(plan=>{if(live)setEventAnswers(Object.fromEntries((plan?.plan.facts.items??[]).filter(fact=>['safety.requiresRam','comms.followupRequired','scale.multiZone'].includes(fact.code)).map(fact=>[fact.code,fact.certainty==='confirmed'&&typeof fact.value==='boolean'?(fact.value?'yes':'no'):'unknown'])))}).catch(()=>{});return()=>{live=false}},[eventId,viewer,reload,zh])
  return <EventToolSection title={zh?eventActivityPlanPanelText.activitiesAndConditions.zh:eventActivityPlanPanelText.activitiesAndConditions.en} summary={view?`${draft.activities.length} ${zh?eventActivityPlanPanelText.activities.zh:eventActivityPlanPanelText.activities.en}`:(zh?eventActivityPlanPanelText.loading.zh:eventActivityPlanPanelText.loading.en)}>
    {error?<p role="alert">{error}</p>:null}{notice?<p role="status" className="text-sm text-[#176b5a]">{notice}</p>:null}
    {!view?<AppActionButton onClick={()=>setReload(x=>x+1)}>{zh?eventActivityPlanPanelText.reload.zh:eventActivityPlanPanelText.reload.en}</AppActionButton>:<div className="space-y-3">
      <DetailsWorkspace zh active readOnly={!view.canEdit||busy} limitAssistantHeight labels={{ workspace: zh ? eventActivityPlanPanelText.activitiesAndConditionsWorkspace.zh : eventActivityPlanPanelText.activitiesAndConditionsWorkspace.en, form: zh ? eventActivityPlanPanelText.activityConditionsForm.zh : eventActivityPlanPanelText.activityConditionsForm.en, assistant: zh ? eventActivityPlanPanelText.aiActivityAssistant.zh : eventActivityPlanPanelText.aiActivityAssistant.en }}
        form={<ActivityPlanEditor checkItems={view.checkItems ?? null} questionDefinitions={view.questionDefinitions ?? []} registrationMode={view.registrationMode} eventAnswers={editingEventAnswers ?? eventAnswers} timeZone={timeZone} renderProjectConfiguration={renderProjectConfiguration} planDirty={dirty} data={draft} onChange={value=>{setDraft(value);onPlanChange?.(value)}} zh={zh} disabled={!view.canEdit||busy} occurrences={occurrences}/>}
        assistant={active => <EventFormAssistant eventId={eventId} scope="activityPlan" form={activityPlanAssistantForm(draft)} context={eventContext} contextSignature={JSON.stringify([draft, eventContext])} zh={zh} active={active} initiallyConfirmed onBusy={onBusy}
          onAdopt={(form, fields) => { const next=applyActivityPlanAssistantForm(draft,form,fields);setDraft(next);onPlanChange?.(next) }} />} />
      {view.reports.filter(r=>r.moduleCode==='MOVE.STAY').map(r=><details key={r.moduleCode}><summary>{zh?eventActivityPlanPanelText.adoptedTravelAndAccommodation.zh:eventActivityPlanPanelText.adoptedTravelAndAccommodation.en} · v{r.version}</summary><p className="whitespace-pre-wrap text-sm">{text(r.text,zh)}</p><details><summary>{zh?eventActivityPlanPanelText.expand.zh:eventActivityPlanPanelText.expand.en}</summary><p>{text(r.text,!zh)}</p></details></details>)}
      {view.canEdit?<AppActionButton variant="primary" disabled={!dirty||busy} onClick={()=>{setBusy(true);setError('');void eventActivityPlanService.save(eventId,draft,view.eTag,groupId).then(async v=>{setView(v);setDraft(v.data);onPlanChange?.(v.data);setNotice(text(projectCopy.recomposeRequired,zh));await onSaved?.()}).catch(e=>setError(normalizeApiError(e).message)).finally(()=>setBusy(false))}}>{zh?eventActivityPlanPanelText.saveActivitiesAndConditions.zh:eventActivityPlanPanelText.saveActivitiesAndConditions.en}</AppActionButton>:null}
    </div>}
  </EventToolSection>
}
