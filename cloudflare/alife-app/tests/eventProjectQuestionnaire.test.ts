import assert from 'node:assert/strict'
import test from 'node:test'
import { applicableProjectQuestions, applyTemplateProjects, confirmProjectPreset, newProjectAnswers, projectModuleRequirements, projectNeedsConfirmation, projectRequiresRegistration, templateEventSuggestions } from '../src/utils/eventProjectQuestionnaire.ts'
import { emptyActivityPlan } from '../src/types/eventActivityPlan.ts'
import { composeCreationDraft, creationEvent, initialCreationDraft, selectCreationTemplate, validateCreationDraft } from '../src/utils/eventCreationDraft.ts'
import { applyActivityPlanAssistantForm, activityPlanAssistantForm } from '../src/utils/eventFormAssistant.ts'
import type { EventActivityType, EventArchetype } from '../src/types/eventComposition.ts'
import type { EventProjectQuestionDefinition } from '../src/types/eventProjectQuestionnaire.ts'
const bi=(value:string)=>({en:value,zh:value})
const question=(code:string,attributes:string[]=[],modules:string[]=[]):EventProjectQuestionDefinition=>({code,question:bi(code),appliesToAttributes:attributes,requiredModules:modules,dependencies:[],unavailableModules:[]})
const definitions=[question('projectSelection',[],['PEOPLE.REGISTRATION']),question('foodService',['meal'],['FOOD.HOSPITALITY']),question('organizedStay',['camp'],['MOVE.STAY']),question('weatherPlan',['outdoor'],['SAFETY.RAM'])]
const template={code:'retreat',version:3,archetypeCode:'camp-retreat',defaults:{visibility:'groupVisible',registrationMode:'required'},presetProjects:[{presetKey:'meal',name:bi('Dinner'),conditions:bi(''),attributes:['meal'],defaultAnswers:{foodService:'yes',weatherPlan:'yes'},repeatForEachOccurrence:true}]} as EventActivityType
const project=()=>applyTemplateProjects([],template)[0]
test('presets receive independent stable IDs, preserve custom projects and repeat as one item',()=>{
 const own={...project(),id:'own-project',sourcePresetKey:null,answers:{}}
 const first=applyTemplateProjects([own],template),second=applyTemplateProjects(first,template)
 assert.equal(first.length,2);assert.equal(second.length,2);assert.equal(second[0].id,'own-project');assert.notEqual(second[1].id,first[1].id);assert.notEqual(first[1].id,'meal');assert.equal(first[1].repeatForEachOccurrence,true)
 first[1].name.en='Changed';assert.equal(template.presetProjects[0].name.en,'Dinner')
 const selected=selectCreationTemplate({...initialCreationDraft(),activityPlan:{...emptyActivityPlan(),activities:first}},template)
 assert.equal(selected.activityPlan?.activities.length,2)
 assert.equal(composeCreationDraft(selected,template).activityTypeVersion,3)
 assert.deepEqual(composeCreationDraft(selected,template).removedPresetKeys,[])
 const removed={...selected,activityPlan:{...selected.activityPlan!,activities:selected.activityPlan!.activities.filter(item=>item.sourcePresetKey!== 'meal')}}
 assert.deepEqual(composeCreationDraft(removed,template).removedPresetKeys,['meal'])
})
test('confirmation covers active known defaults, preserves unknown and inactive values',()=>{
 const original=project();assert.equal(projectNeedsConfirmation(original,definitions),true)
 const confirmed=confirmProjectPreset(original,definitions)
 assert.equal(projectNeedsConfirmation(confirmed,definitions),false);assert.equal(confirmed.answers.foodService.confirmed,true);assert.equal(confirmed.answers.foodService.source,'template');assert.equal(confirmed.answers.weatherPlan.confirmed,false);assert.deepEqual(confirmed.answers.projectSelection,{value:'no',source:'human',confirmed:true})
 assert.deepEqual(projectModuleRequirements(confirmed,definitions),['FOOD.HOSPITALITY'])
 assert.equal(projectNeedsConfirmation({...confirmed,attributes:['meal','outdoor']},definitions),true)
 assert.deepEqual(projectModuleRequirements({...confirmed,attributes:[]},definitions),[])
 const unknown={...original,answers:{}};assert.equal(projectNeedsConfirmation(unknown,definitions),true);assert.equal(projectNeedsConfirmation(confirmProjectPreset(unknown,definitions),definitions),false)
})
test('multi-meal and multi-night projects stay distinct while each module is deduplicated',()=>{
 const first=confirmProjectPreset(project(),definitions)
 const second={...first,id:'lunch',name:bi('Lunch')}
 const night={...first,id:'night-1',attributes:['camp'],answers:{organizedStay:{value:'yes' as const,source:'human' as const,confirmed:true}}}
 assert.deepEqual([...new Set([first,second,night,{...night,id:'night-2'}].flatMap(p=>projectModuleRequirements(p,definitions)))],['FOOD.HOSPITALITY','MOVE.STAY'])
 assert.equal(applicableProjectQuestions({...first,attributes:['meal','outdoor']},definitions).length,3)
 assert.equal(projectRequiresRegistration({...first,answers:{projectFee:{value:'yes',source:'human',confirmed:true}}}),false)
 assert.equal(projectRequiresRegistration({...first,answers:{projectSelection:{value:'yes',source:'human',confirmed:true}}}),true)
 assert.deepEqual(first.attributes,['meal'])
})
test('project answers update compose signature and schema without deriving Event conditions',()=>{
 const draft={...initialCreationDraft(),activityPlan:{...emptyActivityPlan(),activities:[project()]}}
 const before=composeCreationDraft(draft,template),after=composeCreationDraft({...draft,activityPlan:{...draft.activityPlan,activities:[confirmProjectPreset(project(),definitions)]}},template)
 assert.equal(before.schemaVersion,'2.0.0');assert.deepEqual(before.activityPlan,draft.activityPlan);assert.notDeepEqual(before,after);assert.equal(before.activityPlan?.isOuting,false);assert.equal(before.activityPlan?.isOvernight,false)
})
test('new project switches are explicit confirmed No in questionnaire version 2',()=>{
 const answers=newProjectAnswers();assert.equal(Object.keys(answers).length,8)
 assert.ok(Object.values(answers).every(answer=>answer.value==='no'&&answer.source==='human'&&answer.confirmed))
 assert.equal(emptyActivityPlan().questionnaireVersion,2)
})
test('the active questionnaire has eight independent general switches and only matching attribute questions',()=>{
 const general=['projectSelection','ageEligibility','capacityLimit','projectFee','minorsParticipate','spaceReservation','serviceTeam','programmeProduction'].map(code=>question(code,[],[code]))
 const specialized=[question('foodService',['meal'],['FOOD.HOSPITALITY']),question('weatherPlan',['outdoor'],['SAFETY.RAM']),question('waterSafety',['water'],['SAFETY.RAM'])]
 const moved=[question('safetyReview',[],['SAFETY.RAM']),question('projectNotices',[],['COMMS.FOLLOWUP']),question('multiZoneOperations',[],['FESTIVAL.OPERATIONS'])]
 const all=[...general,...moved,...specialized]
 const base={attributes:[],answers:{...newProjectAnswers(),safetyReview:{value:'yes' as const,source:'human' as const,confirmed:true}}}
 assert.deepEqual(applicableProjectQuestions(base,all).map(x=>x.code),general.map(x=>x.code))
 assert.deepEqual(projectModuleRequirements(base as ReturnType<typeof project>,all),[])
 assert.deepEqual(applicableProjectQuestions({...base,attributes:['meal','outdoor']},all).map(x=>x.code),[...general.map(x=>x.code),'foodService','weatherPlan'])
 assert.deepEqual(applicableProjectQuestions({...base,attributes:['water','outdoor']},all).map(x=>x.code),[...general.map(x=>x.code),'weatherPlan','waterSafety'])
})
test('v4 template Event suggestions remain pending and follow only retained preset projects',()=>{
 const candidate={...template,presetProjects:[{...template.presetProjects[0],eventFactSuggestions:['safety.requiresRam','scale.multiZone']}]}
 const applied=applyTemplateProjects([],candidate)
 assert.deepEqual(templateEventSuggestions(applied,candidate)[0].eventFactSuggestions,['safety.requiresRam','scale.multiZone'])
 assert.deepEqual(templateEventSuggestions([],candidate),[])
 assert.equal(composeCreationDraft({...initialCreationDraft(),activityPlan:{...emptyActivityPlan(),activities:applied}},candidate).facts.items.find(item=>item.code==='scale.multiZone')?.certainty,'unknown')
 assert.equal(applied[0].answers.projectSelection.source,'human')
 assert.equal(applied[0].answers.projectSelection.confirmed,true)
})
test('required registration allows zero capacity and emits explicit mode',()=>{
 const draft={...initialCreationDraft(),title:bi('Retreat'),description:bi('Description'),maxCapacity:'0'}
 const category={isSeries:false} as EventArchetype
 assert.equal(validateCreationDraft(draft,template,category,false),'');assert.equal(creationEvent(draft,template,'Leader').registrationMode,'required');assert.equal(creationEvent(draft,template,'Leader').maxCapacity,0)
 assert.equal(validateCreationDraft({...draft,maxCapacity:'-1'},template,category,false).length>0,true)
})
test('AI activity edits preserve question provenance and never fabricate confirmation',()=>{
 const existing=confirmProjectPreset(project(),definitions),draft={...emptyActivityPlan(),activities:[existing]}
 const form=activityPlanAssistantForm(draft),entry=(form.activities as typeof draft.activities)[0]
 assert.equal(Object.hasOwn(entry,'answers'),false);assert.equal(Object.hasOwn(entry,'sourcePresetKey'),false)
 const next=applyActivityPlanAssistantForm(draft,{...form,activities:[{...entry,attributes:['meal','outdoor']}]},['activities'])
 assert.deepEqual(next.activities[0].answers,existing.answers);assert.equal(next.activities[0].sourcePresetKey,existing.sourcePresetKey);assert.equal(next.activities[0].presetConfirmed,false)
 const added=applyActivityPlanAssistantForm(draft,{...form,activities:[entry,{...entry,id:''}]},['activities'])
 assert.ok(added.activities[1].id);assert.deepEqual(added.activities[1].answers,newProjectAnswers());assert.equal(added.activities[1].sourcePresetKey,null);assert.equal(added.questionnaireVersion,2)
})
