import { creationMessage } from '../../../utils/eventCreationCopy'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import AppSectionCard from '../../layout/AppSectionCard'
import AppBadge from '../../layout/AppBadge'
import type { EventActivityType, EventArchetype, EventPlanProposal, ModuleDecision } from '../../../types/eventComposition'
import type { MultilingualString } from '../../../types/event'
import { arrangementGroups, changeOptionalModule, creationFacts, creationSettings, selectCreationTemplate, type CreationDraft } from '../../../utils/eventCreationDraft'

export const creationInput = 'mt-1 min-h-11 w-full rounded-xl border border-[#2f4b42]/20 bg-white px-3 text-sm font-normal text-[#18332d] focus:outline-none focus:ring-2 focus:ring-[#176b5a]/40'
const choice = (selected: boolean) => `min-h-11 rounded-xl border px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#176b5a]/40 ${selected ? 'border-[#176b5a] bg-[#e3f0eb] text-[#0d4f43]' : 'border-[#2f4b42]/20 bg-white text-[#40554e]'}`
export const localText = (value: MultilingualString, zh: boolean) => (zh ? value.zh : value.en) || value.en || value.zh
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

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="min-w-0 text-sm font-semibold text-[#40554e]">{label}{children}</label> }
function BilingualField({ label, value, onChange, multiline }: { label: string; value: MultilingualString; onChange: (value: MultilingualString) => void; multiline?: boolean }) {
  return <fieldset className="md:col-span-2"><legend className="text-sm font-semibold text-[#40554e]">{label}</legend><div className="grid gap-2 md:grid-cols-2">{(['zh', 'en'] as const).map(code => <Field key={code} label={code === 'zh' ? '中文' : 'English'}>{multiline ? <textarea rows={3} className={`${creationInput} py-2`} value={value[code]} onChange={e => onChange({ ...value, [code]: e.target.value })} /> : <input className={creationInput} value={value[code]} onChange={e => onChange({ ...value, [code]: e.target.value })} />}</Field>)}</div></fieldset>
}

export function DetailsStep({ draft, setDraft, zh, type, archetype, ai }: DraftProps & { type: EventActivityType; archetype: EventArchetype; ai: ReactNode }) {
  const settings = creationSettings(draft, type)
  const textField = (key: 'startLocal' | 'endLocal' | 'maxCapacity' | 'timeZone', label: string, inputType = 'text') => <Field label={label}><input className={creationInput} type={inputType} value={draft[key]} min={inputType === 'number' ? 1 : undefined} step={inputType === 'number' ? 1 : undefined} onChange={e => setDraft(current => ({ ...current, [key]: e.target.value }))} /></Field>
  return <div className="space-y-4"><AppSectionCard title={zh ? '活动资料' : 'Event details'}><div className="grid gap-4 md:grid-cols-2">
    {(['title', 'description', 'locationName'] as const).map(key => <BilingualField key={key} label={key === 'title' ? (zh ? '活动名称' : 'Event title') : key === 'description' ? (zh ? '活动说明' : 'Description') : (zh ? '地点说明' : 'Location')} value={draft[key]} multiline={key === 'description'} onChange={value => setDraft(current => ({ ...current, [key]: value }))} />)}
    {textField('startLocal', zh ? '开始时间' : 'Start time', 'datetime-local')}{textField('endLocal', zh ? '结束时间' : 'End time', 'datetime-local')}
    <Field label={zh ? '可见范围' : 'Visibility'}><select className={creationInput} value={settings.visibility} onChange={e => { const value = e.target.value as typeof settings.visibility; setDraft(current => ({ ...current, overrides: { ...current.overrides, visibility: value } })) }}>{['groupVisible', 'churchVisible', 'public'].map(value => <option key={value} value={value}>{visibilityText(value, zh)}</option>)}</select></Field>
    <Field label={zh ? '报名方式' : 'Registration'}><select className={creationInput} value={settings.registrationMode} onChange={e => { const value = e.target.value as 'none' | 'required'; setDraft(current => ({ ...current, overrides: { ...current.overrides, registrationMode: value } })) }}><option value="none">{zh ? '无需报名' : 'No registration'}</option><option value="required">{zh ? '需要报名' : 'Registration required'}</option></select></Field>
    {settings.registrationMode === 'required' ? <>{textField('maxCapacity', zh ? '最多参加人数' : 'Capacity', 'number')}<p className="self-center text-sm text-[#66766f]">{zh ? '报名默认在活动开始前一天截止。' : 'Registration closes one day before the event starts.'}</p></> : null}
    {archetype.isSeries ? <>{textField('timeZone', zh ? '活动时区' : 'Event time zone')}<p className="self-center text-sm text-[#66766f]">{zh ? '每周同一时间举行，预先安排未来 12 周。' : 'Repeats at the same local time each week, scheduling the next 12 weeks.'}</p></> : null}
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
  return <div className="rounded-xl bg-[#f5f2eb] p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{localText(decision.label, zh)}</strong><AppBadge variant={decision.status === 'required' ? 'warning' : 'neutral'}>{decision.status === 'required' ? (zh ? '必需' : 'Required') : (zh ? '可选' : 'Optional')}</AppBadge></div><p className="mt-1 text-[#66766f]">{moduleReason(decision, zh)}</p>{planningOnly ? <p className="mt-1 text-xs text-amber-800">{zh ? '目前支持规划，完整业务工具尚未提供。' : 'Planning support only; full operational tools are not available yet.'}</p> : null}</div>
}

export function ArrangementsStep({ draft, setDraft, zh, type, proposal, current, status }: DraftProps & { type: EventActivityType; proposal: EventPlanProposal | null; current: boolean; status: ReactNode }) {
  const active = current ? proposal?.moduleDecisions.filter(x => x.status !== 'inactive') ?? [] : []
  return <div className="space-y-4">{status}<p className="text-sm text-[#66766f]">{zh ? '确认本次活动的实际安排；系统会说明需要哪些管理功能。暂不清楚的项目请保留“待确认”。' : 'Confirm this event’s arrangements. The system explains which tools are needed. Keep uncertain answers pending.'}</p>
    {arrangementGroups.map(group => <AppSectionCard key={group.en} title={zh ? group.zh : group.en}><div className="grid gap-3 md:grid-cols-2">{group.facts.map(([code, en, cn]) => <fieldset key={code} className="min-w-0"><legend className="text-sm font-semibold">{zh ? cn : en}</legend>{code === 'safety.requiresRam' ? <p className="mt-1 text-xs leading-5 text-[#66766f]">{zh ? '依据负责人或现行安全要求确认；不清楚时保留待确认。选择“否”不代表已通过安全审批。' : 'Confirm with the organiser or applicable safety requirements. Keep pending if unsure. “No” is not safety approval.'}</p> : null}<div className="mt-2 grid grid-cols-3 gap-2">{(['unknown', 'yes', 'no'] as const).map(value => <button key={value} type="button" className={choice(draft.factValues[code] === value)} aria-pressed={draft.factValues[code] === value} onClick={() => setDraft(currentDraft => ({ ...currentDraft, factValues: { ...currentDraft.factValues, [code]: value } }))}>{value === 'unknown' ? (zh ? '待确认' : 'Pending') : value === 'yes' ? (zh ? '是' : 'Yes') : (zh ? '否' : 'No')}</button>)}</div>{draft.factValues[code] === 'unknown' && code in draft.aiCandidateFacts ? <p className="mt-1 text-xs text-amber-800">{zh ? 'AI 建议（未确认）：' : 'AI suggestion (unconfirmed): '}{draft.aiCandidateFacts[code] ? (zh ? '是' : 'Yes') : (zh ? '否' : 'No')}</p> : null}</fieldset>)}</div>{active.filter(item => group.modules.some(code => code === item.moduleCode)).length ? <div className="mt-3 space-y-2">{active.filter(item => group.modules.some(code => code === item.moduleCode)).map(item => <ModuleResult key={item.moduleCode} decision={item} zh={zh} />)}</div> : current ? <p className="mt-3 text-xs text-[#66766f]">{zh ? '当前方案未启用此类管理功能。' : 'No tools enabled for this area in the current plan.'}</p> : null}</AppSectionCard>)}
    <AppSectionCard><details><summary className="min-h-11 cursor-pointer py-2 font-semibold">{zh ? '调整管理功能' : 'Adjust management tools'}</summary><p className="mb-3 text-sm text-[#66766f]">{zh ? '可以提前添加工具，但不会替你确认活动事实。必需功能由活动安排或其他功能决定。' : 'You can add tools early without confirming facts. Required tools follow event arrangements or dependencies.'}</p><div className="grid gap-2 md:grid-cols-2">{proposal?.moduleDecisions.map(item => <label key={item.moduleCode} className="flex items-start gap-3 rounded-xl border border-[#2f4b42]/15 p-3"><input className="mt-1 h-4 w-4" type="checkbox" checked={item.status !== 'inactive'} disabled={!current || item.status === 'required'} onChange={e => setDraft(value => changeOptionalModule(value, item, e.target.checked))} /><span className="min-w-0 text-sm"><strong>{localText(item.label, zh)}</strong><span className="mt-1 block text-xs text-[#66766f]">{item.status === 'inactive' ? (zh ? '未启用；可以自行添加。' : 'Not enabled; you can add it.') : moduleReason(item, zh)}</span></span></label>)}</div></details></AppSectionCard>
    {type.recommendedWorkflowTemplateCode ? <AppSectionCard title={zh ? '筹备任务清单' : 'Preparation checklist'}><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={creationSettings(draft, type).useRecommendedWorkflow} onChange={e => { const checked = e.target.checked; setDraft(value => ({ ...value, overrides: { ...value.overrides, useRecommendedWorkflow: checked } })) }} />{zh ? '使用此模板建议的筹备任务清单' : 'Use the preparation checklist suggested by this template'}</label>{current && proposal?.workflowRecommendation?.status === 'unavailable' ? <p className="mt-2 text-sm text-amber-800">{zh ? '建议的任务清单暂不可用，可以继续创建活动。' : 'The suggested checklist is unavailable. You can still create the event.'}</p> : null}</AppSectionCard> : null}
    {active.some(item => item.moduleCode === 'SERVICE.ROSTER') && type.presetServiceSlots.length ? <AppSectionCard title={zh ? '常用岗位建议' : 'Suggested volunteer roles'} subtitle={zh ? '创建后可调整人数，不会自动指派成员，也不代表安全配比要求。' : 'Adjust counts after creation. No members are assigned; these are not safeguarding ratios.'}><div className="grid gap-2 md:grid-cols-2">{type.presetServiceSlots.map(slot => <p key={slot.roleCode} className="flex justify-between gap-2 text-sm"><span>{localText(slot.label, zh)}</span><span>{slot.requiredCount} {zh ? '人' : 'people'}</span></p>)}</div></AppSectionCard> : null}
  </div>
}

export function ReviewStep({ draft, zh, type, archetype, proposal }: { draft: CreationDraft; zh: boolean; type: EventActivityType; archetype: EventArchetype; proposal: EventPlanProposal }) {
  const settings = creationSettings(draft, type)
  const pending = creationFacts.filter(([code]) => draft.factValues[code] === 'unknown')
  return <div className="space-y-4"><AppSectionCard title={zh ? '确认活动方案' : 'Review event plan'} subtitle={zh ? '创建后进入活动工作区继续筹备；本次操作不会发布活动。' : 'Continue preparation in the event workspace after creation. This action does not publish the event.'}><h2 className="text-lg font-bold">{localText(draft.title, zh)}</h2><p className="mt-2 whitespace-pre-wrap text-sm">{localText(draft.description, zh)}</p><dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">{[
    [zh ? '模板' : 'Template', localText(type.name, zh)], [zh ? '地点' : 'Location', localText(draft.locationName, zh) || (zh ? '待确认' : 'Pending')],
    [zh ? '开始时间' : 'Starts', draft.startLocal.replace('T', ' ')], [zh ? '结束时间' : 'Ends', draft.endLocal.replace('T', ' ')],
    [zh ? '可见范围' : 'Visibility', visibilityText(settings.visibility, zh)], [zh ? '报名' : 'Registration', settings.registrationMode === 'required' ? `${zh ? '容量：' : 'Capacity: '}${draft.maxCapacity}` : (zh ? '无需报名' : 'Not required')],
    ...(archetype.isSeries ? [[zh ? '重复安排' : 'Repeat', `${zh ? '每周，未来 12 周' : 'Weekly, next 12 weeks'} · ${draft.timeZone}`]] : []),
  ].map(([label, value]) => <div key={label}><dt className="text-[#66766f]">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>)}</dl></AppSectionCard>
    <AppSectionCard title={zh ? '管理功能及来源' : 'Tools and reasons'}><div className="grid gap-2 md:grid-cols-2">{proposal.moduleDecisions.filter(x => x.status !== 'inactive').map(item => <ModuleResult key={item.moduleCode} decision={item} zh={zh} />)}</div></AppSectionCard>
    {pending.length ? <AppSectionCard title={zh ? '仍待确认的安排' : 'Arrangements still pending'}><ul className="list-disc space-y-1 pl-5 text-sm">{pending.map(([code, en, cn]) => <li key={code}>{zh ? cn : en}</li>)}</ul></AppSectionCard> : null}
    {proposal.readiness.blockers.length ? <AppSectionCard title={zh ? '创建后的准备任务' : 'Preparation after creation'}><ul className="list-disc space-y-1 pl-5 text-sm">{proposal.readiness.blockers.map((item, index) => <li key={index}>{creationMessage(item, zh, proposal.moduleDecisions)}</li>)}</ul></AppSectionCard> : null}
    {proposal.warnings.length ? <AppSectionCard title={zh ? '需要留意' : 'Please note'}><ul className="list-disc space-y-1 pl-5 text-sm">{proposal.warnings.map((item, index) => <li key={index}>{creationMessage(item, zh, proposal.moduleDecisions)}</li>)}</ul></AppSectionCard> : null}
  </div>
}
