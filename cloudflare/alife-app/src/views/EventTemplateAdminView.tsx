import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarRange, ChevronLeft, ChevronRight, CircleOff, LockKeyhole, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import AppActionButton from '../components/layout/AppActionButton'
import AppBadge from '../components/layout/AppBadge'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import useConfirmation from '../hooks/useConfirmation'
import { eventTemplateAdminService } from '../services/eventTemplateAdminService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import type { AdminEventActivityTemplate, AdminEventActivityTemplateCatalog, EventTemplateAdminFilters } from '../types/eventTemplateAdmin'
import {
  emptyEventTemplateAdminForm,
  eventTemplateToAdminForm,
  normalizeEventTemplateCode,
  toCreateEventTemplateRequest,
  toUpdateEventTemplateRequest,
  validateEventTemplateAdminForm,
  type EventTemplateAdminForm,
} from '../utils/eventTemplateAdminState'
import SystemManagementFrame from './admin/SystemManagementFrame'

type EditorMode = 'closed' | 'create' | 'edit'
const fieldClass = 'mt-1.5 min-h-11 w-full rounded-xl border border-[#2f4b42]/15 bg-white px-3 text-sm text-[#18332d] outline-none transition focus:border-[#176b5a] focus:ring-2 focus:ring-[#176b5a]/15 disabled:bg-slate-50 disabled:text-slate-500'
const labelClass = 'min-w-0 text-xs font-black text-[#52665f]'

const localize = (value: { en: string; zh: string }, language: 'en' | 'zh') => value[language] || value.en || value.zh

const validationCopy: Record<string, { en: string; zh: string }> = {
  code: { en: 'Use a stable 3–80 character lowercase code with letters, numbers, and hyphens.', zh: '模板代码须为 3–80 位小写字母、数字和短横线，并以字母开头。' },
  archetype: { en: 'Choose one of the four fixed event categories.', zh: '请选择四个固定活动分类之一。' },
  name: { en: 'English and Chinese names are required.', zh: '必须填写英文和中文名称。' },
  description: { en: 'English and Chinese descriptions are required.', zh: '必须填写英文和中文说明。' },
  icon: { en: 'Choose a controlled icon key.', zh: '请选择系统允许的图标代码。' },
  modules: { en: 'A selected module is duplicated or unavailable.', zh: '预选模块重复或不可用。' },
  workflow: { en: 'Choose an available workflow recommendation.', zh: '请选择可用的 Workflow 建议。' },
  'roster-module': { en: 'Enable SERVICE.ROSTER or remove its slot presets.', zh: '请启用 SERVICE.ROSTER，或移除岗位预设。' },
  'roster-slots': { en: 'Add at least one service slot or disable SERVICE.ROSTER.', zh: '请至少添加一个岗位，或关闭 SERVICE.ROSTER。' },
  'slot-code': { en: 'Service-slot role codes must be unique.', zh: '岗位角色代码不能重复。' },
  slot: { en: 'Every service slot needs a valid code, bilingual label, and 1–999 people.', zh: '每个岗位都需要有效代码、双语名称及 1–999 人。' },
}

const EventTemplateAdminView = () => {
  const auth = useAuthStore()
  const language = auth.language
  const isZh = language === 'zh'
  const [catalog, setCatalog] = useState<AdminEventActivityTemplateCatalog | null>(null)
  const [filters, setFilters] = useState<Required<EventTemplateAdminFilters>>({
    search: '', archetypeCode: '', status: 'all', sortBy: 'name', sortDirection: 'asc', page: 1, pageSize: 12,
  })
  const [draftSearch, setDraftSearch] = useState('')
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error' | 'forbidden'>('loading')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode>('closed')
  const [selected, setSelected] = useState<AdminEventActivityTemplate | null>(null)
  const [form, setForm] = useState<EventTemplateAdminForm>(emptyEventTemplateAdminForm())
  const { requestConfirmation, confirmationModal } = useConfirmation()

  const load = useCallback(async (nextFilters: Required<EventTemplateAdminFilters>) => {
    setState('loading'); setError('')
    try {
      const next = await eventTemplateAdminService.list(nextFilters)
      setCatalog(next)
      setState(next.templates.items.length ? 'ready' : 'empty')
    } catch (reason) {
      const nextError = normalizeApiError(reason)
      setError(nextError.message)
      setState(nextError.status === 403 ? 'forbidden' : 'error')
    }
  }, [])

  useEffect(() => { void load(filters) }, [filters, load])

  const applyFilters = (event: FormEvent) => {
    event.preventDefault()
    setFilters((current) => ({ ...current, search: draftSearch.trim(), page: 1 }))
  }
  const chooseCategory = (code: string) => setFilters((current) => ({ ...current, archetypeCode: current.archetypeCode === code ? '' : code, page: 1 }))
  const openCreate = () => {
    const archetypeCode = filters.archetypeCode || catalog?.archetypes[0]?.code || 'simple-social'
    setSelected(null); setForm(emptyEventTemplateAdminForm(archetypeCode)); setEditorMode('create'); setError(''); setSuccess('')
  }
  const openEdit = (item: AdminEventActivityTemplate) => {
    setSelected(item); setForm(eventTemplateToAdminForm(item)); setEditorMode('edit'); setError(''); setSuccess('')
  }

  const allowedArchetypes = useMemo(() => new Set(catalog?.archetypes.map((item) => item.code) ?? []), [catalog])
  const allowedModules = useMemo(() => new Set(catalog?.moduleOptions.map((item) => item.code) ?? []), [catalog])
  const allowedIcons = useMemo(() => new Set(catalog?.iconKeys ?? []), [catalog])
  const allowedWorkflows = useMemo(() => new Set(catalog?.workflowTemplateCodes ?? []), [catalog])
  const validationCode = catalog ? validateEventTemplateAdminForm(form, allowedArchetypes, allowedModules, allowedIcons, allowedWorkflows) : 'archetype'

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!catalog || validationCode) return
    if (editorMode === 'edit' && selected?.isActive && !form.isActive) {
      const confirmed = await requestConfirmation({
        title: isZh ? '停用这个活动模板？' : 'Deactivate this event template?',
        description: isZh
          ? '停用后，新建活动和重新组合不会再提供这个模板；既有活动和 Plan Snapshot 不受影响。'
          : 'New event creation and recomposition will no longer offer it. Existing events and plan snapshots remain unchanged.',
        confirmLabel: isZh ? '确认停用' : 'Deactivate',
        tone: 'danger',
      })
      if (!confirmed) return
    }
    setSaving(true); setError(''); setSuccess('')
    try {
      const saved = editorMode === 'create'
        ? await eventTemplateAdminService.create(toCreateEventTemplateRequest(form))
        : await eventTemplateAdminService.update(form.code, toUpdateEventTemplateRequest(form), selected!.eTag)
      setSelected(saved); setForm(eventTemplateToAdminForm(saved)); setEditorMode('edit')
      setSuccess(isZh ? `已保存 ${localize(saved.template.name, language)} v${saved.template.version}。` : `Saved ${localize(saved.template.name, language)} v${saved.template.version}.`)
      await load(filters)
    } catch (reason) {
      const nextError = normalizeApiError(reason)
      setError(nextError.status === 412
        ? (isZh ? '模板已被其他管理员修改，请刷新后重试。' : 'Another administrator changed this template. Refresh and try again.')
        : nextError.message)
    } finally {
      setSaving(false)
    }
  }

  const updateSlot = (index: number, patch: Partial<EventTemplateAdminForm['presetServiceSlots'][number]>) => {
    setForm((current) => ({
      ...current,
      presetServiceSlots: current.presetServiceSlots.map((slot, slotIndex) => slotIndex === index
        ? { ...slot, ...patch, label: patch.label ? { ...patch.label } : slot.label }
        : slot),
    }))
  }
  const addSlot = () => setForm((current) => ({
    ...current,
    presetServiceSlots: [...current.presetServiceSlots, {
      roleCode: '', label: { en: '', zh: '' }, requiredCount: 1, eligibilityCode: 'approvedGroupMember',
    }],
  }))
  const removeSlot = (index: number) => setForm((current) => ({
    ...current,
    presetServiceSlots: current.presetServiceSlots.filter((_, slotIndex) => slotIndex !== index),
  }))

  return (
    <AppPageShell>
      <SystemManagementFrame
        title={isZh ? '活动模板管理' : 'Event template management'}
        subtitle={isZh ? '四个活动分类由系统固定；管理分类内可用于创建活动的版本化模板。' : 'The four event categories are system-fixed. Manage the versioned templates offered inside them during event creation.'}
        language={language}
        iconKey="eventTemplates"
        bodyClassName="space-y-6 p-4 sm:p-5 lg:p-6"
        actions={<><button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void load(filters)} disabled={state === 'loading'}><RefreshCw className={`h-4 w-4 ${state === 'loading' ? 'animate-spin' : ''}`} />{isZh ? '刷新' : 'Refresh'}</button><button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/60 bg-[#fff9ef] px-4 py-2.5 text-sm font-black text-[#123b34] shadow-[0_10px_24px_rgba(7,42,35,0.2)] transition hover:-translate-y-0.5 hover:bg-white" onClick={openCreate}><Plus className="h-4 w-4" />{isZh ? '新增模板' : 'New template'}</button></>}
      >
        <section aria-labelledby="fixed-categories-heading">
        <div className="mb-3 flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-[#176b5a]" /><h2 id="fixed-categories-heading" className="text-sm font-black text-[#18332d]">{isZh ? '固定活动分类' : 'Fixed event categories'}</h2></div>
        <div className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-4">
          {(catalog?.archetypes ?? []).map((archetype) => <button key={archetype.code} type="button" aria-pressed={filters.archetypeCode === archetype.code} onClick={() => chooseCategory(archetype.code)} className={`min-h-28 rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[#176b5a]/30 ${filters.archetypeCode === archetype.code ? 'border-[#176b5a] bg-[#e3f0eb]' : 'border-[#2f4b42]/10 bg-white hover:border-[#176b5a]/35'}`}><div className="flex items-start justify-between gap-2"><CalendarRange className="h-5 w-5 text-[#176b5a]" /><LockKeyhole className="h-3.5 w-3.5 text-[#809088]" aria-label={isZh ? '不可修改分类' : 'Immutable category'} /></div><p className="mt-3 font-black text-[#18332d]">{localize(archetype.name, language)}</p><p className="mt-1 text-xs text-[#66766f]">{archetype.activeTemplateCount}/{archetype.totalTemplateCount} {isZh ? '启用' : 'active'} · {archetype.code}</p></button>)}
        </div>
      </section>

      <AppSectionCard title={isZh ? '模板目录' : 'Template catalogue'} subtitle={isZh ? '可筛选、排序和分页；停用模板仍保留版本历史及既有活动引用。' : 'Filter, sort, and paginate. Inactive templates retain version history and existing event references.'}>
        <form className="grid gap-3 tablet:grid-cols-[minmax(0,1fr)_10rem_10rem_auto]" onSubmit={applyFilters}>
          <label className={labelClass}>{isZh ? '搜索' : 'Search'}<span className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718079]" /><input className={`${fieldClass} pl-9`} value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder={isZh ? '代码或双语名称' : 'Code or bilingual name'} /></span></label>
          <label className={labelClass}>{isZh ? '状态' : 'Status'}<select className={fieldClass} value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as Required<EventTemplateAdminFilters>['status'], page: 1 }))}><option value="all">{isZh ? '全部' : 'All'}</option><option value="active">{isZh ? '启用' : 'Active'}</option><option value="inactive">{isZh ? '停用' : 'Inactive'}</option></select></label>
          <label className={labelClass}>{isZh ? '排序' : 'Sort'}<select className={fieldClass} value={filters.sortBy} onChange={(event) => setFilters((current) => ({ ...current, sortBy: event.target.value as Required<EventTemplateAdminFilters>['sortBy'], page: 1 }))}><option value="name">{isZh ? '名称' : 'Name'}</option><option value="code">{isZh ? '代码' : 'Code'}</option><option value="category">{isZh ? '分类' : 'Category'}</option><option value="updated">{isZh ? '更新时间' : 'Updated'}</option></select></label>
          <AppActionButton className="self-end" type="submit" variant="primary">{isZh ? '应用' : 'Apply'}</AppActionButton>
        </form>

        {state === 'loading' ? <p className="py-10 text-center text-sm text-[#66766f]" role="status">{isZh ? '正在加载活动模板……' : 'Loading event templates…'}</p> : null}
        {state === 'forbidden' ? <AppEmptyState title={isZh ? '没有管理权限' : 'Permission denied'} description={isZh ? '需要 admin.events.manageTemplates 权限。' : 'The admin.events.manageTemplates permission is required.'} /> : null}
        {state === 'error' ? <AppEmptyState title={isZh ? '无法加载模板' : 'Unable to load templates'} description={error} actionLabel={isZh ? '重试' : 'Retry'} onAction={() => void load(filters)} /> : null}
        {state === 'empty' ? <AppEmptyState title={isZh ? '没有匹配模板' : 'No matching templates'} description={isZh ? '调整筛选条件，或在当前固定分类下新增模板。' : 'Change the filters or add a template inside the selected fixed category.'} actionLabel={isZh ? '新增模板' : 'New template'} onAction={openCreate} /> : null}
        {state === 'ready' && catalog ? <div className="mt-5 space-y-3">{catalog.templates.items.map((item) => <article key={item.template.code} className={`rounded-2xl border p-4 ${selected?.template.code === item.template.code ? 'border-[#176b5a] bg-[#f0f7f3]' : 'border-[#2f4b42]/10 bg-[#fbfcf8]'}`}><div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-[#18332d]">{localize(item.template.name, language)}</h3><AppBadge variant={item.isActive ? 'success' : 'danger'}>{item.isActive ? (isZh ? '启用' : 'Active') : (isZh ? '停用' : 'Inactive')}</AppBadge>{item.isSystemPreset ? <AppBadge variant="info">{isZh ? '系统预置' : 'System preset'}</AppBadge> : <AppBadge>{isZh ? '管理员新增' : 'Admin-created'}</AppBadge>}</div><p className="mt-1 break-words text-xs text-[#66766f]">{item.template.code} · {item.template.archetypeCode} · v{item.template.version} · {item.template.preselectedModules.length} {isZh ? '个预选模块' : 'preset modules'} · {item.template.presetServiceSlots.length} {isZh ? '个岗位' : 'slots'}</p><p className="mt-2 text-sm leading-6 text-[#52665f]">{localize(item.template.description, language)}</p></div><AppActionButton onClick={() => openEdit(item)}><Pencil className="mr-2 h-4 w-4" />{isZh ? '编辑' : 'Edit'}</AppActionButton></div></article>)}</div> : null}

        {catalog && catalog.templates.totalPages > 1 ? <nav aria-label={isZh ? '模板分页' : 'Template pagination'} className="mt-5 flex items-center justify-between gap-3"><AppActionButton disabled={filters.page <= 1 || state === 'loading'} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}><ChevronLeft className="mr-1 h-4 w-4" />{isZh ? '上一页' : 'Previous'}</AppActionButton><span className="text-xs font-bold text-[#66766f]">{filters.page}/{catalog.templates.totalPages} · {catalog.templates.totalCount}</span><AppActionButton disabled={filters.page >= catalog.templates.totalPages || state === 'loading'} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>{isZh ? '下一页' : 'Next'}<ChevronRight className="ml-1 h-4 w-4" /></AppActionButton></nav> : null}
      </AppSectionCard>

        {editorMode !== 'closed' && catalog ? <AppSectionCard title={editorMode === 'create' ? (isZh ? '新增活动模板' : 'Create event template') : (isZh ? '编辑活动模板' : 'Edit event template')} subtitle={isZh ? '代码与所属分类创建后不可更改；保存修改会建立新的模板版本。' : 'Code and category are immutable after creation. Saving an edit creates a new template version.'} action={<AppActionButton variant="ghost" onClick={() => { setEditorMode('closed'); setSelected(null) }}>{isZh ? '关闭' : 'Close'}</AppActionButton>}>
        <form className="space-y-6" onSubmit={(event) => void save(event)}>
          {success ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{success}</p> : null}
          {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</p> : null}
          {validationCode ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{localize(validationCopy[validationCode] ?? validationCopy.slot, language)}</p> : null}

          <div className="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-4">
            <label className={labelClass}>{isZh ? '模板代码' : 'Template code'}<input className={fieldClass} disabled={editorMode === 'edit'} value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: normalizeEventTemplateCode(event.target.value) }))} /></label>
            <label className={labelClass}>{isZh ? '固定分类' : 'Fixed category'}<select className={fieldClass} disabled={editorMode === 'edit'} value={form.archetypeCode} onChange={(event) => setForm((current) => ({ ...current, archetypeCode: event.target.value }))}>{catalog.archetypes.map((item) => <option key={item.code} value={item.code}>{localize(item.name, language)}</option>)}</select></label>
            <label className={labelClass}>{isZh ? '图标代码' : 'Icon key'}<select className={fieldClass} value={form.iconKey} onChange={(event) => setForm((current) => ({ ...current, iconKey: event.target.value }))}>{catalog.iconKeys.map((key) => <option key={key} value={key}>{key}</option>)}</select></label>
            <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-[#2f4b42]/10 bg-[#fbfcf8] px-3 text-sm font-black text-[#40554e]"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />{form.isActive ? (isZh ? '创建时可选' : 'Available for creation') : (isZh ? '停用' : 'Inactive')}</label>
          </div>

          <div className="grid gap-4 tablet:grid-cols-2">
            <label className={labelClass}>{isZh ? '英文名称' : 'English name'}<input className={fieldClass} value={form.name.en} onChange={(event) => setForm((current) => ({ ...current, name: { ...current.name, en: event.target.value } }))} /></label>
            <label className={labelClass}>{isZh ? '中文名称' : 'Chinese name'}<input className={fieldClass} value={form.name.zh} onChange={(event) => setForm((current) => ({ ...current, name: { ...current.name, zh: event.target.value } }))} /></label>
            <label className={labelClass}>{isZh ? '英文说明' : 'English description'}<textarea rows={3} className={fieldClass} value={form.description.en} onChange={(event) => setForm((current) => ({ ...current, description: { ...current.description, en: event.target.value } }))} /></label>
            <label className={labelClass}>{isZh ? '中文说明' : 'Chinese description'}<textarea rows={3} className={fieldClass} value={form.description.zh} onChange={(event) => setForm((current) => ({ ...current, description: { ...current.description, zh: event.target.value } }))} /></label>
          </div>

          <fieldset><legend className="text-sm font-black text-[#18332d]">{isZh ? '表单默认值' : 'Form defaults'}</legend><div className="mt-3 grid gap-4 tablet:grid-cols-3"><label className={labelClass}>{isZh ? '可见性' : 'Visibility'}<select className={fieldClass} value={form.defaults.visibility} onChange={(event) => setForm((current) => ({ ...current, defaults: { ...current.defaults, visibility: event.target.value as EventTemplateAdminForm['defaults']['visibility'] } }))}><option value="groupVisible">groupVisible</option><option value="churchVisible">churchVisible</option><option value="public">public</option></select></label><label className={labelClass}>{isZh ? '报名方式' : 'Registration'}<select className={fieldClass} value={form.defaults.registrationMode} onChange={(event) => setForm((current) => ({ ...current, defaults: { ...current.defaults, registrationMode: event.target.value as 'none' | 'required' } }))}><option value="none">none</option><option value="required">required</option></select></label><label className={labelClass}>{isZh ? 'Workflow 建议' : 'Workflow recommendation'}<select className={fieldClass} value={form.recommendedWorkflowTemplateCode ?? ''} onChange={(event) => setForm((current) => ({ ...current, recommendedWorkflowTemplateCode: event.target.value || null }))}><option value="">{isZh ? '无' : 'None'}</option>{catalog.workflowTemplateCodes.map((code) => <option key={code} value={code}>{code}</option>)}</select></label></div></fieldset>

          <fieldset><legend className="text-sm font-black text-[#18332d]">{isZh ? '外围功能预选' : 'Preselected capabilities'}</legend><p className="mt-1 text-xs leading-5 text-[#66766f]">{isZh ? 'TEAM.WORK 永远隐式包含；MONEY.FINANCE 仍只能由明确资金事实或创建者选择启用。' : 'TEAM.WORK is always implicit. MONEY.FINANCE still requires an explicit money fact or creator selection.'}</p><div className="mt-3 grid gap-2 tablet:grid-cols-2 desktop:grid-cols-3">{catalog.moduleOptions.map((module) => { const checked = form.preselectedModules.includes(module.code); return <label key={module.code} className={`flex min-h-16 items-start gap-3 rounded-xl border p-3 ${checked ? 'border-[#176b5a]/35 bg-[#e3f0eb]/70' : 'border-[#2f4b42]/10 bg-white'}`}><input className="mt-1" type="checkbox" checked={checked} onChange={(event) => setForm((current) => ({ ...current, preselectedModules: event.target.checked ? [...current.preselectedModules, module.code] : current.preselectedModules.filter((code) => code !== module.code) }))} /><span className="min-w-0"><strong className="block text-sm text-[#18332d]">{localize(module.name, language)}</strong><span className="break-all text-xs text-[#66766f]">{module.code}</span></span></label> })}</div></fieldset>

          <fieldset><div className="flex flex-wrap items-end justify-between gap-3"><div><legend className="text-sm font-black text-[#18332d]">{isZh ? '岗位预设' : 'Service-slot presets'}</legend><p className="mt-1 text-xs leading-5 text-[#66766f]">{isZh ? '岗位只定义通常需要，不分配成员，也不构成儿童保护或资格政策。' : 'Slots describe typical planning needs only. They assign nobody and do not define safeguarding or eligibility policy.'}</p></div><AppActionButton size="sm" onClick={addSlot}><Plus className="mr-1 h-4 w-4" />{isZh ? '添加岗位' : 'Add slot'}</AppActionButton></div><div className="mt-3 space-y-3">{form.presetServiceSlots.map((slot, index) => <div key={`${index}-${slot.roleCode}`} className="grid min-w-0 gap-3 rounded-2xl border border-[#2f4b42]/10 bg-[#fbfcf8] p-3 tablet:grid-cols-2 desktop:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_6rem_auto]"><label className={labelClass}>{isZh ? '角色代码' : 'Role code'}<input className={fieldClass} value={slot.roleCode} onChange={(event) => updateSlot(index, { roleCode: event.target.value.toLowerCase() })} /></label><label className={labelClass}>{isZh ? '英文岗位名' : 'English label'}<input className={fieldClass} value={slot.label.en} onChange={(event) => updateSlot(index, { label: { ...slot.label, en: event.target.value } })} /></label><label className={labelClass}>{isZh ? '中文岗位名' : 'Chinese label'}<input className={fieldClass} value={slot.label.zh} onChange={(event) => updateSlot(index, { label: { ...slot.label, zh: event.target.value } })} /></label><label className={`${labelClass} w-24 max-w-full`}>{isZh ? '人数' : 'People'}<input type="number" min="1" max="999" className={`${fieldClass} w-24 max-w-full`} value={slot.requiredCount} onChange={(event) => updateSlot(index, { requiredCount: Number(event.target.value) })} /></label><AppActionButton className="self-end" size="sm" variant="danger" aria-label={isZh ? '移除岗位' : 'Remove slot'} onClick={() => removeSlot(index)}><Trash2 className="h-4 w-4" /></AppActionButton></div>)}{!form.presetServiceSlots.length ? <div className="rounded-xl border border-dashed border-[#2f4b42]/20 p-5 text-sm text-[#66766f]">{isZh ? '尚无岗位预设。若启用 SERVICE.ROSTER，保存前必须至少添加一个岗位。' : 'No slot presets yet. If SERVICE.ROSTER is enabled, add at least one before saving.'}</div> : null}</div></fieldset>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#2f4b42]/10 pt-5"><p className="text-xs text-[#66766f]">{editorMode === 'edit' ? <>{isZh ? '当前' : 'Current'} v{selected?.template.version} · {isZh ? '保存后建立下一版本' : 'saving creates the next version'}</> : (isZh ? '新模板从 v1 开始' : 'New templates start at v1')}</p><div className="flex flex-wrap gap-2">{editorMode === 'edit' && selected && !selected.isActive ? <AppBadge variant="danger"><CircleOff className="mr-1 h-3.5 w-3.5" />{isZh ? '目前停用' : 'Currently inactive'}</AppBadge> : null}<AppActionButton type="submit" variant="primary" disabled={saving || Boolean(validationCode)}>{saving ? (isZh ? '保存中……' : 'Saving…') : (isZh ? '保存新版本' : 'Save new version')}</AppActionButton></div></div>
        </form>
        </AppSectionCard> : null}
      </SystemManagementFrame>
      {confirmationModal}
    </AppPageShell>
  )
}

export default EventTemplateAdminView
