import type { DetailField } from '../../../../../shared/eventDetails'
import { creationMessage } from '../../../utils/eventCreationCopy'
import { useEffect, useId, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import AppSectionCard from '../../layout/AppSectionCard'
import AppBadge from '../../layout/AppBadge'
import type { EventActivityType, EventArchetype, EventPlanProposal, ModuleDecision } from '../../../types/eventComposition'
import { BilingualField, Field, creationInput, localText } from './CreationFields'
import { CreationProgrammeEditor, CreationRosterEditor, CreationVenueEditor } from './CreationArrangementEditors'
import ArrangementDisclosure, { ArrangementToggle } from './ArrangementDisclosure'
import CreationArrangementSummary from './CreationArrangementSummary'
import { validateCreationArrangements } from '../../../utils/eventCreationArrangements'
export { creationInput, localText } from './CreationFields'
import { ArrangementRoles } from '../EventArrangementRoles'
import { arrangementGroups, confirmArrangementGroup, invalidateArrangementConfirmation, selectArrangementModule, creationSettings, selectCreationTemplate, type CreationDraft } from '../../../utils/eventCreationDraft'

const choice = (selected: boolean) => `min-h-11 rounded-xl border px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#176b5a]/40 ${selected ? 'border-[#176b5a] bg-[#e3f0eb] text-[#0d4f43]' : 'border-[#2f4b42]/20 bg-white text-[#40554e]'}`
type DraftProps = { draft: CreationDraft; setDraft: Dispatch<SetStateAction<CreationDraft>>; zh: boolean }
export const visibilityText = (value: string, zh: boolean) => value === 'public' ? (zh ? '公开' : 'Public') : value === 'churchVisible' ? (zh ? '教会内可见' : 'Church only') : (zh ? '小组内可见' : 'Group only')

export function TemplateStep({ draft, setDraft, zh, archetypes, type }: DraftProps & { archetypes: EventArchetype[]; type: EventActivityType | null }) {
  const category = archetypes.find(x => x.code === draft.archetypeCode)
  return <AppSectionCard title={zh ? '选择活动模板' : 'Choose an event template'} subtitle={zh ? '选择活动分类，再选择适合本次活动的模板。安排可以在后续步骤调整。' : 'Choose a category and a template. You can adjust its arrangements in the following steps.'}>
    <div role="group" aria-label={zh ? '活动分类' : 'Event category'} className="grid grid-cols-2 gap-2 desktop:grid-cols-4">
      {archetypes.map(item => <button key={item.code} type="button" aria-pressed={draft.archetypeCode === item.code} className={choice(draft.archetypeCode === item.code)} onClick={() => setDraft(current => current.archetypeCode === item.code ? current : { ...current, archetypeCode: item.code, activityTypeCode: '' })}>{localText(item.name, zh)}<span className="mt-1 block text-xs">{item.activityTypes.length} {zh ? '种模板' : 'templates'}</span></button>)}
    </div>
    {!category ? <p className="mt-4 text-sm text-[#66766f]">{zh ? '请选择上方的活动分类。' : 'Choose a category above.'}</p> : !category.activityTypes.length ? <p className="mt-4 text-sm">{zh ? '此分类暂无启用的模板，请选择其他分类。' : 'No active templates in this category. Choose another category.'}</p> : <div className="mt-4 grid gap-2 md:grid-cols-2" role="group" aria-label={zh ? '活动模板' : 'Event template'}>{category.activityTypes.map(item => <button key={item.code} type="button" aria-pressed={type?.code === item.code} className={choice(type?.code === item.code)} onClick={() => setDraft(current => selectCreationTemplate(current, item))}><strong className="block">{localText(item.name, zh)}</strong><span className="mt-1 block text-sm leading-6 text-[#66766f]">{localText(item.description, zh)}</span><span className="mt-2 block text-xs">{visibilityText(item.defaults.visibility, zh)} · {item.defaults.registrationMode === 'required' ? (zh ? '需要报名' : 'Registration needed') : (zh ? '无需报名' : 'No registration')}</span></button>)}</div>}
    {type && category ? <div className="mt-4 rounded-xl bg-[#e3f0eb] p-3 text-sm" role="status"><strong>{zh ? '已选择：' : 'Selected: '}{localText(type.name, zh)}</strong><p className="mt-1">{category.isSeries ? (zh ? '每周重复，预先安排未来 12 周的活动。' : 'Repeats weekly, with the next 12 weeks scheduled ahead.') : category.hasZones ? (zh ? '单次活动，可安排多个环节与现场区域。' : 'One event with multiple sessions and areas.') : category.hasSessions ? (zh ? '单次活动，可安排多个环节。' : 'One event with multiple sessions.') : (zh ? '单次活动。' : 'One event.')}</p><p className="mt-1 text-[#40554e]">{zh ? '模板建议不代表本次活动事实；请继续填写实际安排。' : 'Template suggestions do not confirm facts about this event. Continue to enter its arrangements.'}</p></div> : null}
  </AppSectionCard>
}

export function DetailsStep({ draft, setDraft: updateDraft, zh, type, archetype, ai, saved = false }: DraftProps & { type: EventActivityType; archetype: EventArchetype; ai: ReactNode; saved?: boolean }) {
  const settings = creationSettings(draft, type)
  const setDraft: typeof updateDraft = action => updateDraft(previous => invalidateArrangementConfirmation(typeof action === 'function' ? action(previous) : action))
  const mark = (current: CreationDraft, field: DetailField) => ({ ...current.detailSources, [field]: 'human' as const })
  const textField = (key: 'startLocal' | 'endLocal' | 'maxCapacity' | 'timeZone' | 'intervalWeeks', label: string, inputType = 'text') => <Field label={label}><input className={creationInput} type={inputType} value={draft[key] ?? ''} min={inputType === 'number' ? 1 : undefined} max={key === 'intervalWeeks' ? 52 : undefined} step={inputType === 'number' ? 1 : undefined} onChange={e => setDraft(current => ({ ...current, [key]: e.target.value, detailSources: mark(current, key) }))} /></Field>
  return <div className="space-y-4"><AppSectionCard title={zh ? '活动资料' : 'Event details'} subtitle={`${zh ? '已选模板：' : 'Selected template: '}${localText(type.name, zh)}`}><div className="grid gap-4 md:grid-cols-2">
    {(['title', 'description', 'locationName'] as const).map(key => <BilingualField key={key} label={key === 'title' ? (zh ? '活动名称' : 'Event title') : key === 'description' ? (zh ? '活动说明' : 'Description') : (zh ? '地点说明' : 'Location')} value={draft[key]} multiline={key === 'description'} onChange={value => setDraft(current => ({ ...current, [key]: value, detailSources: mark(current, key) }))} />)}
    <p className="col-span-full text-sm text-[#66766f]">{zh ? `开始和结束时间均为 ${draft.timeZone || '所选活动时区'} 的当地时间，不是设备时区。` : `Start and end use local time in ${draft.timeZone || 'the selected event time zone'}, not the device time zone.`}{(!draft.detailSources?.startLocal || !draft.detailSources?.endLocal) ? (zh ? ' 预填时间尚未确认，请填写或让助手按您提供的时间更新。' : ' Prefilled times are unconfirmed; edit them or supply your times to the assistant.') : ''}</p>
    {textField('startLocal', zh ? '开始时间' : 'Start time', 'datetime-local')}{textField('endLocal', zh ? '结束时间' : 'End time', 'datetime-local')}
    <Field label={zh ? '可见范围' : 'Visibility'}><select className={creationInput} value={settings.visibility} onChange={e => { const value = e.target.value as typeof settings.visibility; setDraft(current => ({ ...current, overrides: { ...current.overrides, visibility: value }, detailSources: mark(current, 'visibility') })) }}>{['groupVisible', 'churchVisible', 'public'].map(value => <option key={value} value={value}>{visibilityText(value, zh)}</option>)}</select></Field>
    <Field label={zh ? '报名方式' : 'Registration'}><select className={creationInput} value={settings.registrationMode} onChange={e => { const value = e.target.value as 'none' | 'required'; setDraft(current => ({ ...current, overrides: { ...current.overrides, registrationMode: value }, detailSources: mark(current, 'registrationMode') })) }}><option value="none">{zh ? '无需报名' : 'No registration'}</option><option value="required">{zh ? '需要报名' : 'Registration required'}</option></select></Field>
    {settings.registrationMode === 'required' ? <>{textField('maxCapacity', zh ? '最多参加人数' : 'Capacity', 'number')}<p className="self-center text-sm text-[#66766f]">{zh ? '报名默认在活动开始前一天截止。' : 'Registration closes one day before the event starts.'}</p></> : null}
    {textField('timeZone', zh ? '活动时区' : 'Event time zone')}
    {archetype.isSeries ? <>{textField('intervalWeeks', zh ? '每隔几周举行' : 'Repeat every N weeks', 'number')}<p hidden={saved} className="self-center text-sm text-[#66766f]">{zh ? `每 ${draft.intervalWeeks || '1'} 周同一时间举行，预先安排未来 12 周。` : `Repeats every ${draft.intervalWeeks || '1'} week(s), scheduling the next 12 weeks.`}</p></> : null}
  </div></AppSectionCard>{ai}</div>
}

const reasonCopy: Record<string, [string, string]> = {
  'accountable-owner-required': ['Every event needs an accountable team.', '每个活动都需要负责团队。'],
  'policy-accountable-owner': ['Every event needs an accountable team.', '每个活动都需要负责团队。'],
  'registration-enabled': ['Registration is required for this event.', '本次活动需要报名。'],
  'public-discovery': ['Recommended for a public event.', '公开活动建议使用。'],
  'service-slots-required': ['You confirmed volunteers are needed.', '你已确认需要志愿同工。'],
  'money-flow-present': ['You confirmed money will be collected or spent.', '你已确认有收费或支出。'],
  'ram-policy-triggered': ['You confirmed a RAM review is required.', '你已确认需要 RAM 风险检视。'],
  'children-present': ['You confirmed children will participate.', '你已确认有未成年人参与。'],
  'managed-programme': ['You confirmed programme coordination is needed.', '你已确认需要统筹节目。'],
  'managed-place-or-resource': ['You confirmed venue or resource management is needed.', '你已确认需要管理场地或资源。'],
  'transport-required': ['You confirmed transport will be arranged.', '你已确认安排交通。'],
  'accommodation-required': ['You confirmed accommodation will be arranged.', '你已确认安排住宿。'],
  'food-service': ['You confirmed food service is needed.', '你已确认需要餐饮服务。'],
  'multi-zone-live-operation': ['You confirmed multiple live areas are needed.', '你已确认需要多个现场区域。'],
  'followup-required': ['You confirmed organised follow-up is needed.', '你已确认需要安排跟进。'],
  'event-communications': ['Recommended for event communications.', '活动沟通建议使用。'],
  'human-selected': ['Added by you.', '你主动添加的功能。'],
  'human-selected-with-reason': ['Added by you.', '你主动添加的功能。'],
}
export const moduleReason = (decision: ModuleDecision, zh: boolean) => [...new Set(decision.reasonCodes.map(reason => {
  if (reasonCopy[reason]) return reasonCopy[reason][zh ? 1 : 0]
  if (reason.startsWith('activity-type:')) return zh ? '来自所选模板的建议。' : 'Suggested by the selected template.'
  if (reason.startsWith('dependency:')) return zh ? '其他启用功能需要此功能。' : 'Required by another enabled feature.'
  return zh ? '由服务器根据活动安排和规则决定。' : 'Determined by the server from event arrangements and rules.'
}))].join(' ')

function ModuleResult({ decision, zh }: { decision: ModuleDecision; zh: boolean }) {
  const planningOnly = ['MONEY.FINANCE', 'FOOD.HOSPITALITY', 'FESTIVAL.OPERATIONS'].includes(decision.moduleCode)
  return <div className="rounded-xl bg-[#f5f2eb] p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{localText(decision.label, zh)}</strong><AppBadge variant={decision.status === 'required' ? 'warning' : 'neutral'}>{decision.status === 'required' ? (zh ? '必需' : 'Required') : (zh ? '已启用' : 'Enabled')}</AppBadge></div><p className="mt-1 text-[#66766f]">{moduleReason(decision, zh)}</p>{planningOnly ? <p className="mt-1 text-xs text-amber-800">{zh ? '目前支持规划，完整业务工具尚未提供。' : 'Planning support only; full operational tools are not available yet.'}</p> : null}</div>
}

function ArrangementModule({ draft, setDraft, zh, decision, current, type, groupId, saved = false, ramPanel, ramDirty = false, modulePanels, rolePanels, focusModule, activeModules = [] }: DraftProps & { activeModules?: string[]; decision: ModuleDecision; current: boolean; type: EventActivityType; groupId: string; saved?: boolean; ramPanel?: ReactNode; ramDirty?: boolean; modulePanels?: Record<string, ReactNode>; rolePanels?: Record<string, ReactNode>; focusModule?: string | null }) {
  const [expanded, setExpanded] = useState(true), panelId = useId()
  useEffect(() => { if (focusModule === decision.moduleCode.toLowerCase()) setExpanded(true) }, [focusModule, decision.moduleCode])
  const required = !saved && decision.status === 'required'
  const selected = required || (draft.moduleOverrides[decision.moduleCode] ?? decision.status !== 'inactive')
  const editorProps = { draft, setDraft, zh, type, groupId }
  const editor = decision.moduleCode === 'PROGRAM.PRODUCTION' ? <CreationProgrammeEditor {...editorProps} /> : decision.moduleCode === 'PLACE.RESOURCE' ? <CreationVenueEditor {...editorProps} /> : null
  const planningOnly = ['MONEY.FINANCE', 'FOOD.HOSPITALITY', 'FESTIVAL.OPERATIONS'].includes(decision.moduleCode)
  return <section id={`arrangement-${decision.moduleCode.toLowerCase()}`} aria-label={localText(decision.label, zh)} className="rounded-xl bg-[#f5f2eb] p-3 text-sm">
    <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{localText(decision.label, zh)}</h3>{required ? <AppBadge variant="warning">{zh ? '必需' : 'Required'}</AppBadge> : <div role="group" aria-label={`${localText(decision.label, zh)} · ${zh ? '是否启用' : 'Enable'}`} className="flex gap-2">{[true, false].map(value => <button key={String(value)} type="button" disabled={!current || (decision.moduleCode === 'SAFETY.RAM' && ramDirty)} aria-pressed={selected === value} className={`${choice(selected === value)} min-w-16 disabled:opacity-50`} onClick={() => { setDraft(previous => selectArrangementModule(previous, decision.moduleCode, value)); if (value) setExpanded(true) }}>{value ? (zh ? '是' : 'Yes') : (zh ? '否' : 'No')}</button>)}</div>}</div><ArrangementToggle open={expanded} title={localText(decision.label, zh)} controls={panelId} zh={zh} onToggle={() => setExpanded(value => !value)} /></div>
    <div id={panelId} hidden={!expanded}>
    <p className="mt-2 text-xs leading-5 text-[#66766f]">{decision.status === 'inactive' ? (zh ? '可按本次活动需要启用。' : 'Enable when needed for this event.') : moduleReason(decision, zh)}</p>
    {planningOnly ? <p className="mt-1 text-xs text-amber-800">{zh ? '目前支持规划，完整业务工具尚未提供。' : 'Planning support only; full operational tools are not available yet.'}</p> : null}
    {selected && rolePanels?.[decision.moduleCode] ? <div className="mt-3">{rolePanels[decision.moduleCode]}</div> : null}
    {decision.moduleCode === 'SAFETY.RAM' ? <div className="mt-3 space-y-3">
      {selected ? ramPanel : <p className="text-sm text-[#66766f]">{zh ? '选择“是”后在此填写 RAM。关闭功能会保留已保存的评估及本次填写内容。' : 'Choose Yes to fill in RAM here. Disabling keeps saved assessments and this draft.'}</p>}
    </div> : null}
    {saved && decision.moduleCode !== 'SAFETY.RAM' ? <div hidden={!selected} className="mt-3 min-w-0 [&_.alife-panel]:min-w-0 [&_.alife-panel]:p-3 sm:[&_.alife-panel]:p-4">{modulePanels?.[decision.moduleCode] ?? (selected && !planningOnly ? <p className="text-[#66766f]">{zh ? '确认保存活动安排后，即可在此配置已启用且有权限的功能。' : 'Confirm event arrangements to configure enabled tools available to your role here.'}</p> : null)}</div> : selected && editor ? <div className="mt-3">{editor}</div> : null}
    {!saved && selected && activeModules.includes('SERVICE.ROSTER') ? <div className="mt-3"><CreationRosterEditor {...editorProps} moduleCode={decision.moduleCode} activeModules={activeModules} /></div> : null}
    </div>
  </section>
}

export function ArrangementsStep({ draft, setDraft, zh, type, proposal, current, status, groupId, saved = false, ramPanel, ramDirty = false, modulePanels, rolePanels, ownerPanel, focusModule }: DraftProps & { type: EventActivityType; ownerPanel?: ReactNode; proposal: EventPlanProposal | null; current: boolean; status: ReactNode; groupId: string; saved?: boolean; ramPanel?: ReactNode; ramDirty?: boolean; modulePanels?: Record<string, ReactNode>; rolePanels?: Record<string, ReactNode>; focusModule?: string | null }) {
  const issue = !saved && current && proposal ? validateCreationArrangements(draft, type, proposal, zh) : ''
  return <div className="space-y-4">{status}<p className="text-sm text-[#66766f]">{zh ? '模板预选所需功能，可在各模块选择是或否。核对整个分区后勾选“已确认”；未勾选的分区会在确认创建时标为待确认。' : 'Start with template choices and choose Yes or No for each tool. Check Confirmed after reviewing a whole section; unchecked sections remain pending in the creation review.'}</p>
    {!saved && type.archetypeCode === 'recurring-gathering' ? <p className="rounded-xl bg-[#e3f0eb] p-3 text-sm">{zh ? '以下安排会按每次活动的开始时间，重复应用到本次创建的未来 12 周场次；各场次之后可独立调整。' : 'These arrangements repeat relative to each occurrence’s start across the next 12 weeks created now. Each occurrence can be adjusted independently.'}</p> : null}
    <AppSectionCard title={zh ? '活动总负责人' : 'Event accountable owner'} subtitle={zh ? '此职责属于整个活动，不随功能模块关闭。' : 'This responsibility belongs to the whole event and remains when tools are disabled.'}>{ownerPanel ?? <p className="text-sm">{zh ? '创建人担任活动总负责人；创建后可按权限调整。' : 'The creator is the event accountable owner; authorized changes are available after creation.'}</p>}</AppSectionCard>
    {arrangementGroups.map(group => {
      const panels = rolePanels ?? Object.fromEntries((proposal?.moduleDecisions ?? []).map(decision => [decision.moduleCode, <ArrangementRoles key={decision.moduleCode} roles={proposal?.roleRequirements.filter(role => role.moduleCode === decision.moduleCode && role.roleCode !== 'event.accountableOwner') ?? []} zh={zh} />]))
      return <ArrangementDisclosure key={group.key} title={zh ? group.zh : group.en} zh={zh} confirmed={draft.arrangementConfirmations?.[group.key] === true} disabled={!current || (group.key === 'safety' && ramDirty)} onConfirm={confirmed => setDraft(previous => confirmArrangementGroup(previous, group.key, confirmed, proposal?.moduleDecisions ?? []))} forceOpen={Boolean(focusModule && group.modules.some(code => code.toLowerCase() === focusModule))}>
        <div className="space-y-3" onChangeCapture={() => setDraft(previous => previous.arrangementConfirmations?.[group.key] ? invalidateArrangementConfirmation(previous, group.modules[0]) : previous)}>{proposal?.moduleDecisions.filter(item => group.modules.some(code => code === item.moduleCode)).map(decision => <div key={decision.moduleCode} data-safety-part={group.key === 'safety' ? (decision.moduleCode === 'SAFETY.RAM' ? 'ram' : 'children') : undefined}><ArrangementModule {...{ draft, zh, type, decision, current, groupId, saved, ramPanel, ramDirty, modulePanels, focusModule }} setDraft={setDraft} rolePanels={panels} activeModules={proposal.moduleDecisions.filter(item => item.status === 'required' || item.status === 'selected').map(item => item.moduleCode)} /></div>)}</div>
        {draft.arrangementConfirmations?.[group.key] && current && proposal ? <p role="status" className="mt-3 text-xs text-[#66766f]">{zh ? '已核对本区安排。系统已重新检查功能依赖；本人接受职责、资料准备和安全审批仍需分别完成。' : 'Section reviewed. Tool dependencies have been checked; personal role acceptance, preparation and safety approvals remain separate requirements.'}</p> : null}
      </ArrangementDisclosure>
    })}
    {type.recommendedWorkflowTemplateCode ? <AppSectionCard title={zh ? '筹备任务清单' : 'Preparation checklist'}><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={creationSettings(draft, type).useRecommendedWorkflow} onChange={e => { const checked = e.target.checked; setDraft(value => ({ ...value, overrides: { ...value.overrides, useRecommendedWorkflow: checked } })) }} />{zh ? '使用此模板建议的筹备任务清单' : 'Use the preparation checklist suggested by this template'}</label>{current && proposal?.workflowRecommendation?.status === 'unavailable' ? <p className="mt-2 text-sm text-amber-800">{zh ? '建议的任务清单暂不可用，可以继续创建活动。' : 'The suggested checklist is unavailable. You can still create the event.'}</p> : null}</AppSectionCard> : null}
    {!saved && current && proposal ? <><CreationArrangementSummary {...{ draft, type, proposal, zh }} />{issue ? <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{issue}</p> : <p role="status" className="text-sm text-[#176b5a]">{zh ? '岗位、节目及场地安排已填写，可以继续确认。' : 'Roles, programme and venue details are complete and ready for review.'}</p>}</> : null}
  </div>
}

export function ReviewStep({ draft, zh, type, archetype, proposal, saved = false, roleSummary }: { roleSummary?: ReactNode; draft: CreationDraft; zh: boolean; type: EventActivityType; archetype: EventArchetype; proposal: EventPlanProposal; saved?: boolean }) {
  const settings = creationSettings(draft, type)
  return <div className="space-y-4"><AppSectionCard title={zh ? '确认活动方案' : 'Review event plan'} subtitle={saved ? (zh ? '核对同一个活动的资料和安排，满意后继续筹备并提交审批。' : 'Review this event’s details and arrangements, then continue preparation and submit for approval.') : (zh ? '创建后进入活动工作区继续筹备；本次操作不会发布活动。' : 'Continue preparation in the event workspace after creation. This action does not publish the event.')}><h2 className="text-lg font-bold">{localText(draft.title, zh)}</h2><p className="mt-2 whitespace-pre-wrap text-sm">{localText(draft.description, zh)}</p><dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">{[
    [zh ? '模板' : 'Template', localText(type.name, zh)], [zh ? '地点' : 'Location', localText(draft.locationName, zh) || (zh ? '待确认' : 'Pending')],
    [zh ? '活动时区' : 'Time zone', draft.timeZone], [zh ? '开始时间' : 'Starts', draft.startLocal.replace('T', ' ')], [zh ? '结束时间' : 'Ends', draft.endLocal.replace('T', ' ')],
    [zh ? '可见范围' : 'Visibility', visibilityText(settings.visibility, zh)], [zh ? '报名' : 'Registration', settings.registrationMode === 'required' ? `${zh ? '容量：' : 'Capacity: '}${draft.maxCapacity}` : (zh ? '无需报名' : 'Not required')],
    ...(archetype.isSeries ? [[zh ? '重复安排' : 'Repeat', `${zh ? `每 ${draft.intervalWeeks || '1'} 周，未来 12 周` : `Every ${draft.intervalWeeks || '1'} week(s), next 12 weeks`} · ${draft.timeZone}`]] : []),
  ].map(([label, value]) => <div key={label}><dt className="text-[#66766f]">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>)}</dl></AppSectionCard>
    <CreationArrangementSummary {...{ draft, type, proposal, zh }} />
    <AppSectionCard title={zh ? '管理功能及来源' : 'Tools and reasons'}><div className="grid gap-2 md:grid-cols-2">{proposal.moduleDecisions.filter(x => x.status !== 'inactive').map(item => <ModuleResult key={item.moduleCode} decision={item} zh={zh} />)}</div></AppSectionCard>
    <AppSectionCard title={zh ? '分区确认与负责人' : 'Section confirmation and responsible roles'}><div className="space-y-2">{arrangementGroups.map(group => <div key={group.key} className="flex items-center justify-between gap-3 text-sm"><span>{zh ? group.zh : group.en}</span><AppBadge variant={draft.arrangementConfirmations?.[group.key] ? 'success' : 'warning'}>{draft.arrangementConfirmations?.[group.key] ? (zh ? '已确认' : 'Confirmed') : (zh ? '待确认' : 'Pending')}</AppBadge></div>)}</div><div className="mt-4">{roleSummary ?? <ArrangementRoles roles={proposal.roleRequirements} zh={zh} summary moduleLabels={Object.fromEntries(proposal.moduleDecisions.map(item => [item.moduleCode, localText(item.label, zh)]))} />}</div></AppSectionCard>

    {proposal.readiness.blockers.length ? <AppSectionCard title={zh ? '创建后的准备任务' : 'Preparation after creation'}><ul className="list-disc space-y-1 pl-5 text-sm">{proposal.readiness.blockers.map((item, index) => <li key={index}>{creationMessage(item, zh, proposal.moduleDecisions)}</li>)}</ul></AppSectionCard> : null}
    {proposal.warnings.length ? <AppSectionCard title={zh ? '需要留意' : 'Please note'}><ul className="list-disc space-y-1 pl-5 text-sm">{proposal.warnings.map((item, index) => <li key={index}>{creationMessage(item, zh, proposal.moduleDecisions)}</li>)}</ul></AppSectionCard> : null}
  </div>
}
