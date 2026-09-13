import type { DetailField } from '../../../../../shared/eventDetails'
import { creationMessage } from '../../../utils/eventCreationCopy'
import { useCallback, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import AppSectionCard from '../../layout/AppSectionCard'
import AppBadge from '../../layout/AppBadge'
import type { EventActivityType, EventArchetype, EventPlanProposal, ModuleDecision } from '../../../types/eventComposition'
import { BilingualField, Field, creationInput, localText } from './CreationFields'
import { CreationProgrammeEditor, CreationRosterEditor, CreationVenueEditor } from './CreationArrangementEditors'
import { TileButtons, ModuleDraftBoundary, ToolTileDeck, ToolTileGroup, EventToolSection, focusTilePanel } from '../ArrangementTileDeck'
import { Users, UserRoundCheck, CalendarCheck, ShieldCheck, Baby, Music, MapPin, Tent, Bus, Utensils, Wallet, MessagesSquare, ArrowLeft } from 'lucide-react'
import CreationArrangementSummary from './CreationArrangementSummary'
import { validateCreationArrangements } from '../../../utils/eventCreationArrangements'
export { creationInput, localText } from './CreationFields'
import { ArrangementRoles } from '../EventArrangementRoles'
import { arrangementGroups, creationModuleCodes, confirmArrangementModule, invalidateArrangementConfirmation, selectArrangementModule, creationSettings, selectCreationTemplate, type CreationDraft } from '../../../utils/eventCreationDraft'

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
  const setDraft: typeof updateDraft = action => updateDraft(previous => {
    const next = typeof action === 'function' ? action(previous) : action
    const conditions = (value: CreationDraft) => JSON.stringify([value.startLocal, value.endLocal, value.timeZone, value.intervalWeeks, value.maxCapacity, value.locationName])
    if (conditions(previous) !== conditions(next)) return invalidateArrangementConfirmation(next)
    if (JSON.stringify(previous.overrides) !== JSON.stringify(next.overrides)) return invalidateArrangementConfirmation(invalidateArrangementConfirmation(next, 'PEOPLE.REGISTRATION'), 'COMMS.FOLLOWUP')
    return next
  })
  const mark = (current: CreationDraft, field: DetailField) => ({ ...current.detailSources, [field]: 'human' as const })
  const textField = (key: 'startLocal' | 'endLocal' | 'maxCapacity' | 'timeZone' | 'intervalWeeks', label: string, inputType = 'text') => <Field label={label}><input className={creationInput} type={inputType} value={draft[key] ?? ''} min={inputType === 'number' ? 1 : undefined} max={key === 'intervalWeeks' ? 52 : undefined} step={inputType === 'number' ? 1 : undefined} onChange={e => setDraft(current => ({ ...current, [key]: e.target.value, detailSources: mark(current, key) }))} /></Field>
  return <div className="space-y-4">
    <div className="rounded-2xl border border-[#2f4b42]/20 bg-[#e3f0eb] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm text-[#66766f]">{zh ? '活动资料' : 'Event details'}</p>
        <AppBadge>{zh ? '活动模板：' : 'Template: '}{localText(type.name, zh)}</AppBadge>
      </div>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      {(['title', 'description', 'locationName'] as const).map(key => <BilingualField key={key} label={key === 'title' ? (zh ? '活动名称' : 'Event title') : key === 'description' ? (zh ? '活动说明' : 'Description') : (zh ? '地点说明' : 'Location')} value={draft[key]} multiline={key === 'description'} onChange={value => setDraft(current => ({ ...current, [key]: value, detailSources: mark(current, key) }))} />)}
      <p className="col-span-full text-sm text-[#66766f]">{zh ? `开始和结束时间均为 ${draft.timeZone || '所选活动时区'} 的当地时间，不是设备时区。` : `Start and end use local time in ${draft.timeZone || 'the selected event time zone'}, not the device time zone.`}{(!draft.detailSources?.startLocal || !draft.detailSources?.endLocal) ? (zh ? ' 预填时间尚未确认，请填写或让助手按您提供的时间更新。' : ' Prefilled times are unconfirmed; edit them or supply your times to the assistant.') : ''}</p>
      {textField('startLocal', zh ? '开始时间' : 'Start time', 'datetime-local')}{textField('endLocal', zh ? '结束时间' : 'End time', 'datetime-local')}
      <Field label={zh ? '可见范围' : 'Visibility'}><select className={creationInput} value={settings.visibility} onChange={e => { const value = e.target.value as typeof settings.visibility; setDraft(current => ({ ...current, overrides: { ...current.overrides, visibility: value }, detailSources: mark(current, 'visibility') })) }}>{['groupVisible', 'churchVisible', 'public'].map(value => <option key={value} value={value}>{visibilityText(value, zh)}</option>)}</select></Field>
      <Field label={zh ? '报名方式' : 'Registration'}><select className={creationInput} value={settings.registrationMode} onChange={e => { const value = e.target.value as 'none' | 'required'; setDraft(current => ({ ...current, overrides: { ...current.overrides, registrationMode: value }, detailSources: mark(current, 'registrationMode') })) }}><option value="none">{zh ? '无需报名' : 'No registration'}</option><option value="required">{zh ? '需要报名' : 'Registration required'}</option></select></Field>
      {settings.registrationMode === 'required' ? <>{textField('maxCapacity', zh ? '最多参加人数' : 'Capacity', 'number')}<p className="self-center text-sm text-[#66766f]">{zh ? '报名默认在活动开始前一天截止。' : 'Registration closes one day before the event starts.'}</p></> : null}
      {textField('timeZone', zh ? '活动时区' : 'Event time zone')}
      {archetype.isSeries ? <>{textField('intervalWeeks', zh ? '每隔几周举行' : 'Repeat every N weeks', 'number')}<p hidden={saved} className="self-center text-sm text-[#66766f]">{zh ? `每 ${draft.intervalWeeks || '1'} 周同一时间举行，预先安排未来 12 周。` : `Repeats every ${draft.intervalWeeks || '1'} week(s), scheduling the next 12 weeks.`}</p></> : null}
    </div>
    {ai}
  </div>
}

export function DetailsWorkspace({ zh, active, form, assistant }: { zh: boolean; active: boolean; form: ReactNode; assistant: (active: boolean) => ReactNode }) {
  const [aiOpen, setAiOpen] = useState(false)
  return <div className="space-y-3">
    {form}
    <button type="button" className="flex min-h-11 w-full items-center justify-between rounded-xl border border-[#2f4b42]/20 bg-white px-3 py-2 text-left text-sm font-semibold" onClick={() => setAiOpen(value => !value)} aria-expanded={aiOpen}>
      <span>{zh ? 'AI 资料助手' : 'AI details assistant'}</span>
      <span className="text-xs text-[#66766f]">{aiOpen ? (zh ? '收起' : 'Collapse') : (zh ? '展开' : 'Expand')}</span>
    </button>
    {aiOpen ? <div>{assistant(active && aiOpen)}</div> : null}
  </div>
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

const tileMeta: Record<string, { en: string; zh: string; color: string; icon: ReactNode }> = {
  'TEAM.WORK': { en: 'Team & tasks', zh: '团队任务', color: '#e3f0eb', icon: <Users size={20} /> },
  'PEOPLE.REGISTRATION': { en: 'Registration', zh: '邀请报名', color: '#e3f0eb', icon: <UserRoundCheck size={20} /> },
  'SERVICE.ROSTER': { en: 'Roles & shifts', zh: '岗位轮班', color: '#e3f0eb', icon: <CalendarCheck size={20} /> },
  'SAFETY.RAM': { en: 'RAM & safety', zh: 'RAM 安全', color: '#f6e5df', icon: <ShieldCheck size={20} /> },
  'SAFEGUARDING.CHILD': { en: 'Safeguarding', zh: '儿童保护', color: '#f6e5df', icon: <Baby size={20} /> },
  'PROGRAM.PRODUCTION': { en: 'Programme', zh: '节目安排', color: '#e7e9f5', icon: <Music size={20} /> },
  'PLACE.RESOURCE': { en: 'Venues', zh: '场地资源', color: '#e7e9f5', icon: <MapPin size={20} /> },
  'FESTIVAL.OPERATIONS': { en: 'Operations', zh: '现场运营', color: '#e7e9f5', icon: <Tent size={20} /> },
  'MOVE.STAY': { en: 'Travel & stay', zh: '交通住宿', color: '#deedf1', icon: <Bus size={20} /> },
  'FOOD.HOSPITALITY': { en: 'Food', zh: '餐饮接待', color: '#f3ead5', icon: <Utensils size={20} /> },
  'MONEY.FINANCE': { en: 'Finance', zh: '费用财务', color: '#e8ecd9', icon: <Wallet size={20} /> },
  'COMMS.FOLLOWUP': { en: 'Follow-up', zh: '沟通跟进', color: '#eedfeb', icon: <MessagesSquare size={20} /> },
}
function ArrangementModule({ draft, setDraft, zh, decision, current, type, groupId, saved = false, ramPanel, ramDirty = false, readOnly = false, modulePanels, rolePanels, activeModules = [] }: DraftProps & { activeModules?: string[]; decision: ModuleDecision; current: boolean; type: EventActivityType; groupId: string; saved?: boolean; ramPanel?: ReactNode; ramDirty?: boolean; readOnly?: boolean; modulePanels?: Record<string, ReactNode>; rolePanels?: Record<string, ReactNode> }) {
  const required = !saved && decision.status === 'required'
  const selected = required || (draft.moduleOverrides[decision.moduleCode] ?? decision.status !== 'inactive')
  const editorProps = { draft, setDraft, zh, type, groupId }
  const planningOnly = ['MONEY.FINANCE', 'FOOD.HOSPITALITY', 'FESTIVAL.OPERATIONS'].includes(decision.moduleCode)
  return <ToolTileDeck zh={zh}>
    <EventToolSection title={zh ? '设置与职责' : 'Settings and responsibilities'} summary={selected ? (zh ? '已启用' : 'Enabled') : (zh ? '未启用' : 'Not enabled')}>
      <fieldset disabled={!current} className="space-y-3"><div className="flex flex-wrap items-center gap-3"><span className="text-sm font-semibold">{zh ? '本次活动需要此功能吗？' : 'Does this event need this tool?'}</span>{required ? <AppBadge variant="warning">{zh ? '必需' : 'Required'}</AppBadge> : <div role="group" aria-label={`${localText(decision.label, zh)} · ${zh ? '是否启用' : 'Enable'}`} className="flex gap-2">{[true, false].map(value => <button key={String(value)} type="button" disabled={!current || (saved && decision.moduleCode === 'SAFETY.RAM' && ramDirty)} aria-pressed={selected === value} className={choice(selected === value)} onClick={() => setDraft(previous => selectArrangementModule(previous, decision.moduleCode, value))}>{value ? (zh ? '是' : 'Yes') : (zh ? '否' : 'No')}</button>)}</div>}</div>
      <p className="text-sm text-[#66766f]">{moduleReason(decision, zh)}</p>{planningOnly ? <p className="text-sm text-amber-800">{zh ? '目前支持规划，完整业务工具尚未提供。' : 'Planning support only; full operational tools are not available yet.'}</p> : null}
      <div hidden={!selected}>{rolePanels?.[decision.moduleCode]}</div></fieldset>
    </EventToolSection>
    <ToolTileGroup enabled={selected}><fieldset disabled={readOnly} className="min-w-0">
      {decision.moduleCode === 'SAFETY.RAM' ? ramPanel : saved ? modulePanels?.[decision.moduleCode] ?? (!planningOnly ? <p className="text-sm text-[#66766f]">{zh ? '保存活动安排后，可配置有权限的功能。' : 'Save arrangements to configure tools available to your role.'}</p> : null) : decision.moduleCode === 'PROGRAM.PRODUCTION' ? <EventToolSection title={zh ? '节目安排' : 'Programme plan'} summary={`${draft.arrangements?.sessions?.length || 0}`}><CreationProgrammeEditor {...editorProps} /></EventToolSection> : decision.moduleCode === 'PLACE.RESOURCE' ? <EventToolSection title={zh ? '场地安排' : 'Venue plan'} summary={`${draft.arrangements?.venues?.length || 0}`}><CreationVenueEditor {...editorProps} /></EventToolSection> : null}
      {!saved && activeModules.includes('SERVICE.ROSTER') ? <EventToolSection title={zh ? '岗位轮班' : 'Role shifts'}><CreationRosterEditor {...editorProps} moduleCode={decision.moduleCode} activeModules={activeModules} /></EventToolSection> : null}
    </fieldset></ToolTileGroup>
  </ToolTileDeck>
}

export function ArrangementsStep({ draft, setDraft, readOnly = false, zh, type, proposal, current, status, groupId, saved = false, ramPanel, ramDirty = false, modulePanels, rolePanels, ownerPanel, detailsPanel, detailsDraft = draft, detailsDirty = false, focusModule, savedModules = {}, onUnsavedTools }: DraftProps & { onUnsavedTools?: (dirty: boolean) => void; savedModules?: Record<string, number>; type: EventActivityType; ownerPanel?: ReactNode; detailsPanel?: (active: boolean) => ReactNode; detailsDraft?: CreationDraft; detailsDirty?: boolean; proposal: EventPlanProposal | null; current: boolean; status: ReactNode; groupId: string; saved?: boolean; ramPanel?: ReactNode; ramDirty?: boolean; readOnly?: boolean; modulePanels?: Record<string, ReactNode>; rolePanels?: Record<string, ReactNode>; focusModule?: string | null }) {
  const [active, setActive] = useState<string | null>(null), [visited, setVisited] = useState<string[]>([])
  const [showAllModules, setShowAllModules] = useState(false)
  const [toolDrafts, setToolDrafts] = useState<Record<string, Record<string, boolean>>>({})
  const reportDraft = useCallback((code: string, id: string, dirty: boolean) => {
    setToolDrafts(previous => previous[code]?.[id] === dirty ? previous : ({ ...previous, [code]: { ...previous[code], [id]: dirty } }))
    if (dirty) setDraft(previous => invalidateArrangementConfirmation(previous, code))
  }, [setDraft])
  const unsavedTools = Object.values(toolDrafts).some(group => Object.values(group).some(Boolean))
  useEffect(() => { onUnsavedTools?.(unsavedTools) }, [onUnsavedTools, unsavedTools])
  const [confirmationError, setConfirmationError] = useState('')
  const grid = useRef<HTMLDivElement>(null), panelsRef = useRef<HTMLDivElement>(null), savedRef = useRef(savedModules)
  const decisions = proposal?.moduleDecisions ?? []
  const relevantModules = decisions.filter(item => item.status !== 'inactive')
  const moduleChoices = showAllModules ? decisions : relevantModules
  const relatedCount = relevantModules.length
  const totalCount = decisions.length || creationModuleCodes.length
  const visibleIds = new Set(moduleChoices.map(item => item.moduleCode))
  const moduleSignature = (code: string) => JSON.stringify([draft.moduleOverrides[code], draft.moduleConfirmations?.[code] ?? false,
    code === 'PROGRAM.PRODUCTION' ? draft.arrangements?.sessions : code === 'PLACE.RESOURCE' ? draft.arrangements?.venues : code === 'SERVICE.ROSTER' ? draft.arrangements?.slots : null])
  const [baseline, setBaseline] = useState<Record<string, string>>(() => Object.fromEntries(creationModuleCodes.map(code => [code, moduleSignature(code)])))
  const edited = Object.fromEntries(decisions.map(item => [item.moduleCode, baseline[item.moduleCode] !== moduleSignature(item.moduleCode)]))
  const choose = (code: string) => { const next = active === code ? null : code; setActive(next); setVisited(previous => previous.includes(code) ? previous : [...previous, code]); setConfirmationError(''); requestAnimationFrame(() => next ? focusTilePanel(document.getElementById(`module-heading-${code}`)) : focusTilePanel(grid.current?.querySelector<HTMLButtonElement>(`[data-arrangement-tile="${code}"]`) ?? null)) }
  const focusedLink = useRef<string | null>(null)
  const target = focusModule === 'EVENT.DETAILS' ? focusModule : decisions.find(item => item.moduleCode === focusModule?.toUpperCase())?.moduleCode
  useEffect(() => { if (!target) { focusedLink.current = null; return }; if (focusedLink.current === target) return; focusedLink.current = target; setActive(target); setVisited(previous => previous.includes(target) ? previous : [...previous, target]); requestAnimationFrame(() => focusTilePanel(document.getElementById(`module-heading-${target}`))) }, [target])
  useEffect(() => { if (active && active !== 'EVENT.DETAILS' && !visibleIds.has(active)) setActive(null) }, [active, visibleIds])
  useEffect(() => { const changed = Object.keys(savedModules).filter(code => savedModules[code] !== savedRef.current[code]); savedRef.current = savedModules; if (changed.length) setBaseline(previous => ({ ...previous, ...Object.fromEntries(changed.map(code => [code, moduleSignature(code)])) })) }, [savedModules, draft])
  const issue = !saved && current && proposal ? validateCreationArrangements(draft, type, proposal, zh) : ''
  const confirm = (code: string, checked: boolean) => {
    if (checked && proposal) {
      const error = !saved ? validateCreationArrangements(draft, type, proposal, zh, code) : ''
      if (error) { setConfirmationError(error); return }
      const controls = panelsRef.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')
      const invalid = Array.from(controls || []).find(control => !control.disabled && !control.closest('[hidden]') && !control.checkValidity())
      if (!saved && invalid) { invalid.reportValidity(); return }
    }
    setConfirmationError(''); setDraft(previous => confirmArrangementModule(previous, code, checked, decisions))
  }
  const defaultRoles = Object.fromEntries(decisions.map(decision => [decision.moduleCode, <ArrangementRoles key={decision.moduleCode} roles={proposal?.roleRequirements.filter(role => role.moduleCode === decision.moduleCode && role.roleCode !== 'event.accountableOwner') ?? []} zh={zh} />]))
  const modeToggleLabel = showAllModules ? (zh ? `显示相关模块（${relatedCount}/${totalCount}）` : `Show related modules (${relatedCount}/${totalCount})`) : (zh ? `显示所有模块（${totalCount}）` : `Show all modules (${totalCount})`)
  return <div className="space-y-4" data-arrangement-overview>{status}
    <div className="flex flex-wrap items-center justify-end gap-2 text-sm"><button type="button" className="inline-flex min-h-11 items-center rounded-xl border border-[#2f4b42]/25 bg-[#f9f9f9] px-3 py-2 text-sm font-semibold" aria-pressed={showAllModules} onClick={() => setShowAllModules(value => !value)}>{modeToggleLabel}</button></div>
    <div ref={grid} className="space-y-3">{detailsPanel ? <div className="rounded-2xl border-2 border-[#14564f] bg-[#e3f0eb] p-4 text-[#0d4f43] shadow-sm">
      <button type="button" data-arrangement-tile="EVENT.DETAILS" aria-expanded={active === 'EVENT.DETAILS'} aria-controls="tile-panel-EVENT.DETAILS" onClick={() => choose('EVENT.DETAILS')} className="w-full min-h-11 text-left focus-visible:outline focus-visible:outline-2">
        <span className="mb-2 flex items-start justify-between gap-2"><span className="flex items-center gap-2 font-semibold"><CalendarCheck size={20} />{zh ? '活动资料' : 'Event details'}</span>{detailsDirty ? <span className="text-xs">{zh ? '未保存' : 'Unsaved'}</span> : null}</span>
        <strong className="mt-2 block break-words text-xl">{localText(detailsDraft.title, zh) || (zh ? '尚未填写活动名称' : 'Add an event title')}</strong>
        <span className="mt-2 block text-sm">{detailsDraft.startLocal.replace('T', ' ')} – {detailsDraft.endLocal.replace('T', ' ')} · {detailsDraft.timeZone}</span>
        <p className="mt-2 text-xs font-semibold text-[#334b42]">{zh ? '所选模板：' : 'Selected template: '}{localText(type.name, zh)}</p>
      </button><div className="mt-3 text-sm"><strong>{zh ? '活动总负责人（创建者）' : 'Accountable owner (creator)'}</strong>{ownerPanel}</div>
    </div> : null}<TileButtons label={zh ? '活动模块总览' : 'Event module overview'} active={active} onSelect={choose} items={moduleChoices.map(decision => { const meta = tileMeta[decision.moduleCode]; const selected = draft.moduleOverrides[decision.moduleCode] ?? decision.status !== 'inactive'; return { id: decision.moduleCode, title: localText(decision.label, zh), shortTitle: meta ? (zh ? meta.zh : meta.en) : undefined, icon: meta?.icon, color: meta?.color, confirmed: draft.moduleConfirmations?.[decision.moduleCode] === true, dirty: Object.values(toolDrafts[decision.moduleCode] || {}).some(Boolean) || edited[decision.moduleCode] || ( decision.moduleCode === 'SAFETY.RAM' && ramDirty), status: selected ? (zh ? '已启用' : 'Enabled') : (zh ? '未启用' : 'Off'), faded: showAllModules && decision.status === 'inactive' } })} /></div>
    <div ref={panelsRef}>{detailsPanel && visited.includes('EVENT.DETAILS') ? <section hidden={active !== 'EVENT.DETAILS'} id="tile-panel-EVENT.DETAILS" data-module-editor="EVENT.DETAILS" className="arrangement-editor min-w-0 border-t-2 border-[#176b5a] pt-3"><button type="button" className="min-h-11 text-sm font-semibold" onClick={() => choose('EVENT.DETAILS')}>{zh ? '返回模块总览' : 'Back to modules'}</button><h2 id="module-heading-EVENT.DETAILS" tabIndex={-1} className="scroll-mt-24 text-xl font-bold outline-none">{zh ? '活动资料' : 'Event details'}</h2>{detailsPanel(active === 'EVENT.DETAILS')}</section> : null}{decisions.filter(decision => visited.includes(decision.moduleCode)).map(decision => <section key={decision.moduleCode} hidden={active !== decision.moduleCode} id={`tile-panel-${decision.moduleCode}`} aria-label={localText(decision.label, zh)} data-module-editor={decision.moduleCode} className="arrangement-editor min-w-0 border-t-2 border-[#176b5a] pt-3">
      <header className="mb-4 space-y-2"><p className="text-xs text-[#66766f]">{arrangementGroups.find(group => group.modules.some(code => code === decision.moduleCode))?.[zh ? 'zh' : 'en']}</p><button type="button" onClick={() => choose(decision.moduleCode)} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#176b5a]"><ArrowLeft size={16} />{zh ? '返回模块总览' : 'Back to modules'}</button><div className="flex flex-wrap items-center justify-between gap-3"><h2 id={`module-heading-${decision.moduleCode}`} tabIndex={-1} className="scroll-mt-24 text-xl font-bold outline-none">{localText(decision.label, zh)}</h2><label data-module-confirmation className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" disabled={!current || Object.values(toolDrafts[decision.moduleCode] || {}).some(Boolean) || (saved && decision.moduleCode === 'SAFETY.RAM' && ramDirty)} checked={draft.moduleConfirmations?.[decision.moduleCode] === true} onChange={event => confirm(decision.moduleCode, event.target.checked)} />{zh ? '填写已确认' : 'Details confirmed'}</label></div><p className="text-xs text-[#66766f]">{zh ? '填写确认不代表本人接受职责、RAM 签署或安全审批。' : 'Details confirmation does not accept a role, sign RAM or grant safety approval.'}</p></header>
      {confirmationError ? <p role="alert" className="mb-3 text-sm text-rose-800">{confirmationError}</p> : null}
      <ModuleDraftBoundary code={decision.moduleCode} onChange={reportDraft}><ArrangementModule {...{ draft, setDraft, zh, type, decision, current, groupId, saved, ramPanel, ramDirty, readOnly, modulePanels }} rolePanels={rolePanels ?? defaultRoles} activeModules={decisions.filter(item => item.status === 'required' || item.status === 'selected').map(item => item.moduleCode)} /></ModuleDraftBoundary>
    </section>)}</div>
    <div className="border-t-2 border-[#14564f] pt-3 text-sm">{issue ? <p role="status" className="text-amber-900">{issue}</p> : null}{!saved && proposal ? <details><summary className="min-h-11 cursor-pointer py-3 font-semibold">{zh ? '查看整体安排摘要' : 'Review arrangement summary'}</summary><CreationArrangementSummary {...{ draft, type, proposal, zh }} /></details> : null}</div>
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
    <AppSectionCard title={zh ? '模块确认与负责人' : 'Module confirmation and responsible roles'}><div className="space-y-2">{proposal.moduleDecisions.map(module => <div key={module.moduleCode} className="flex items-center justify-between gap-3 text-sm"><span>{localText(module.label, zh)}</span><AppBadge variant={draft.moduleConfirmations?.[module.moduleCode] ? 'success' : 'warning'}>{draft.moduleConfirmations?.[module.moduleCode] ? (zh ? '填写已确认' : 'Details confirmed') : (zh ? '待确认' : 'Pending')}</AppBadge></div>)}</div><div className="mt-4">{roleSummary ?? <ArrangementRoles roles={proposal.roleRequirements} zh={zh} summary moduleLabels={Object.fromEntries(proposal.moduleDecisions.map(item => [item.moduleCode, localText(item.label, zh)]))} />}</div></AppSectionCard>

    {proposal.readiness.blockers.length ? <AppSectionCard title={zh ? '创建后的准备任务' : 'Preparation after creation'}><ul className="list-disc space-y-1 pl-5 text-sm">{proposal.readiness.blockers.map((item, index) => <li key={index}>{creationMessage(item, zh, proposal.moduleDecisions)}</li>)}</ul></AppSectionCard> : null}
    {proposal.warnings.length ? <AppSectionCard title={zh ? '需要留意' : 'Please note'}><ul className="list-disc space-y-1 pl-5 text-sm">{proposal.warnings.map((item, index) => <li key={index}>{creationMessage(item, zh, proposal.moduleDecisions)}</li>)}</ul></AppSectionCard> : null}
  </div>
}
