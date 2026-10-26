import { eventTemplateAdminViewText } from '../i18n/eventTemplateAdminView.ts'
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
import EventTemplatePresetProjects from '../components/events/EventTemplatePresetProjects'
import { eventProjectQuestionnaireText as projectCopy } from '../i18n/eventProjectQuestionnaire'
import SystemManagementFrame from './admin/SystemManagementFrame'

type EditorMode = 'closed' | 'create' | 'edit'
const fieldClass = 'mt-1.5 min-h-11 w-full rounded-xl border border-[#2f4b42]/15 bg-white px-3 text-sm text-[#18332d] outline-none transition focus:border-[#176b5a] focus:ring-2 focus:ring-[#176b5a]/15 disabled:bg-slate-50 disabled:text-slate-500'
const labelClass = 'min-w-0 text-xs font-black text-[#52665f]'

const localize = (value: { en: string; zh: string }, language: 'en' | 'zh') => value[language] || value.en || value.zh

const validationCopy: Record<string, { en: string; zh: string }> = eventTemplateAdminViewText.validationCopy

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
  const validationCode = catalog ? validateEventTemplateAdminForm(form, allowedArchetypes, allowedModules, allowedIcons) : 'archetype'

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!catalog || validationCode) return
    if (editorMode === 'edit' && selected?.isActive && !form.isActive) {
      const confirmed = await requestConfirmation({
        title: isZh ? eventTemplateAdminViewText.deactivateThisEventTemplate.zh : eventTemplateAdminViewText.deactivateThisEventTemplate.en,
        description: isZh
          ? eventTemplateAdminViewText.newEventCreationAndRecompositionWillNoLongerOffer.zh
          : eventTemplateAdminViewText.newEventCreationAndRecompositionWillNoLongerOffer.en,
        confirmLabel: isZh ? eventTemplateAdminViewText.deactivate.zh : eventTemplateAdminViewText.deactivate.en,
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
      setSuccess(isZh ? eventTemplateAdminViewText.savedV.zh(localize(saved.template.name, language), saved.template.version) : eventTemplateAdminViewText.savedV.en(localize(saved.template.name, language), saved.template.version))
      await load(filters)
    } catch (reason) {
      const nextError = normalizeApiError(reason)
      setError(nextError.status === 412
        ? (isZh ? eventTemplateAdminViewText.anotherAdministratorChangedThisTemplateRefreshAndTryAgain.zh : eventTemplateAdminViewText.anotherAdministratorChangedThisTemplateRefreshAndTryAgain.en)
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
        title={isZh ? eventTemplateAdminViewText.eventTemplateManagement.zh : eventTemplateAdminViewText.eventTemplateManagement.en}
        subtitle={isZh ? eventTemplateAdminViewText.theFourEventCategoriesAreSystemFixedManageThe.zh : eventTemplateAdminViewText.theFourEventCategoriesAreSystemFixedManageThe.en}
        language={language}
        iconKey="eventTemplates"
        bodyClassName="space-y-6 p-4 sm:p-5 lg:p-6"
        actions={<><button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void load(filters)} disabled={state === 'loading'}><RefreshCw className={`h-4 w-4 ${state === 'loading' ? 'animate-spin' : ''}`} />{isZh ? eventTemplateAdminViewText.refresh.zh : eventTemplateAdminViewText.refresh.en}</button><button type="button" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/60 bg-[#fff9ef] px-4 py-2.5 text-sm font-black text-[#123b34] shadow-[0_10px_24px_rgba(7,42,35,0.2)] transition hover:-translate-y-0.5 hover:bg-white" onClick={openCreate}><Plus className="h-4 w-4" />{isZh ? eventTemplateAdminViewText.newTemplate.zh : eventTemplateAdminViewText.newTemplate.en}</button></>}
      >
        <section aria-labelledby="fixed-categories-heading">
        <div className="mb-3 flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-[#176b5a]" /><h2 id="fixed-categories-heading" className="text-sm font-black text-[#18332d]">{isZh ? eventTemplateAdminViewText.fixedEventCategories.zh : eventTemplateAdminViewText.fixedEventCategories.en}</h2></div>
        <div className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-4">
          {(catalog?.archetypes ?? []).map((archetype) => <button key={archetype.code} type="button" aria-pressed={filters.archetypeCode === archetype.code} onClick={() => chooseCategory(archetype.code)} className={`min-h-28 rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[#176b5a]/30 ${filters.archetypeCode === archetype.code ? 'border-[#176b5a] bg-[#e3f0eb]' : 'border-[#2f4b42]/10 bg-white hover:border-[#176b5a]/35'}`}><div className="flex items-start justify-between gap-2"><CalendarRange className="h-5 w-5 text-[#176b5a]" /><LockKeyhole className="h-3.5 w-3.5 text-[#809088]" aria-label={isZh ? eventTemplateAdminViewText.immutableCategory.zh : eventTemplateAdminViewText.immutableCategory.en} /></div><p className="mt-3 font-black text-[#18332d]">{localize(archetype.name, language)}</p><p className="mt-1 text-xs text-[#66766f]">{archetype.activeTemplateCount}/{archetype.totalTemplateCount} {isZh ? eventTemplateAdminViewText.active.zh : eventTemplateAdminViewText.active.en} · {archetype.code}</p></button>)}
        </div>
      </section>

      <AppSectionCard title={isZh ? eventTemplateAdminViewText.templateCatalogue.zh : eventTemplateAdminViewText.templateCatalogue.en} subtitle={isZh ? eventTemplateAdminViewText.filterSortAndPaginateInactiveTemplatesRetainVersionHistory.zh : eventTemplateAdminViewText.filterSortAndPaginateInactiveTemplatesRetainVersionHistory.en}>
        <form className="grid gap-3 tablet:grid-cols-[minmax(0,1fr)_10rem_10rem_auto]" onSubmit={applyFilters}>
          <label className={labelClass}>{isZh ? eventTemplateAdminViewText.search.zh : eventTemplateAdminViewText.search.en}<span className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718079]" /><input className={`${fieldClass} pl-9`} value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder={isZh ? eventTemplateAdminViewText.codeOrBilingualName.zh : eventTemplateAdminViewText.codeOrBilingualName.en} /></span></label>
          <label className={labelClass}>{isZh ? eventTemplateAdminViewText.status.zh : eventTemplateAdminViewText.status.en}<select className={fieldClass} value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as Required<EventTemplateAdminFilters>['status'], page: 1 }))}><option value="all">{isZh ? eventTemplateAdminViewText.all.zh : eventTemplateAdminViewText.all.en}</option><option value="active">{isZh ? eventTemplateAdminViewText.activeLabel.zh : eventTemplateAdminViewText.activeLabel.en}</option><option value="inactive">{isZh ? eventTemplateAdminViewText.inactive.zh : eventTemplateAdminViewText.inactive.en}</option></select></label>
          <label className={labelClass}>{isZh ? eventTemplateAdminViewText.sort.zh : eventTemplateAdminViewText.sort.en}<select className={fieldClass} value={filters.sortBy} onChange={(event) => setFilters((current) => ({ ...current, sortBy: event.target.value as Required<EventTemplateAdminFilters>['sortBy'], page: 1 }))}><option value="name">{isZh ? eventTemplateAdminViewText.name.zh : eventTemplateAdminViewText.name.en}</option><option value="code">{isZh ? eventTemplateAdminViewText.code.zh : eventTemplateAdminViewText.code.en}</option><option value="category">{isZh ? eventTemplateAdminViewText.category.zh : eventTemplateAdminViewText.category.en}</option><option value="updated">{isZh ? eventTemplateAdminViewText.updated.zh : eventTemplateAdminViewText.updated.en}</option></select></label>
          <AppActionButton className="self-end" type="submit" variant="primary">{isZh ? eventTemplateAdminViewText.apply.zh : eventTemplateAdminViewText.apply.en}</AppActionButton>
        </form>

        {state === 'loading' ? <p className="py-10 text-center text-sm text-[#66766f]" role="status">{isZh ? eventTemplateAdminViewText.loadingEventTemplates.zh : eventTemplateAdminViewText.loadingEventTemplates.en}</p> : null}
        {state === 'forbidden' ? <AppEmptyState title={isZh ? eventTemplateAdminViewText.permissionDenied.zh : eventTemplateAdminViewText.permissionDenied.en} description={isZh ? eventTemplateAdminViewText.theAdminEventsManageTemplatesPermissionIsRequired.zh : eventTemplateAdminViewText.theAdminEventsManageTemplatesPermissionIsRequired.en} /> : null}
        {state === 'error' ? <AppEmptyState title={isZh ? eventTemplateAdminViewText.unableToLoadTemplates.zh : eventTemplateAdminViewText.unableToLoadTemplates.en} description={error} actionLabel={isZh ? eventTemplateAdminViewText.retry.zh : eventTemplateAdminViewText.retry.en} onAction={() => void load(filters)} /> : null}
        {state === 'empty' ? <AppEmptyState title={isZh ? eventTemplateAdminViewText.noMatchingTemplates.zh : eventTemplateAdminViewText.noMatchingTemplates.en} description={isZh ? eventTemplateAdminViewText.changeTheFiltersOrAddATemplateInsideThe.zh : eventTemplateAdminViewText.changeTheFiltersOrAddATemplateInsideThe.en} actionLabel={isZh ? eventTemplateAdminViewText.newTemplate.zh : eventTemplateAdminViewText.newTemplate.en} onAction={openCreate} /> : null}
        {state === 'ready' && catalog ? <div className="mt-5 space-y-3">{catalog.templates.items.map((item) => <article key={item.template.code} className={`rounded-2xl border p-4 ${selected?.template.code === item.template.code ? 'border-[#176b5a] bg-[#f0f7f3]' : 'border-[#2f4b42]/10 bg-[#fbfcf8]'}`}><div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-[#18332d]">{localize(item.template.name, language)}</h3><AppBadge variant={item.isActive ? 'success' : 'danger'}>{item.isActive ? (isZh ? eventTemplateAdminViewText.activeLabel.zh : eventTemplateAdminViewText.activeLabel.en) : (isZh ? eventTemplateAdminViewText.inactive.zh : eventTemplateAdminViewText.inactive.en)}</AppBadge>{item.isSystemPreset ? <AppBadge variant="info">{isZh ? eventTemplateAdminViewText.systemPreset.zh : eventTemplateAdminViewText.systemPreset.en}</AppBadge> : <AppBadge>{isZh ? eventTemplateAdminViewText.adminCreated.zh : eventTemplateAdminViewText.adminCreated.en}</AppBadge>}</div><p className="mt-1 break-words text-xs text-[#66766f]">{item.template.code} · {item.template.archetypeCode} · v{item.template.version} · {item.template.preselectedModules.length} {isZh ? eventTemplateAdminViewText.presetModules.zh : eventTemplateAdminViewText.presetModules.en} · {item.template.presetServiceSlots.length} {isZh ? eventTemplateAdminViewText.slots.zh : eventTemplateAdminViewText.slots.en}</p><p className="mt-2 text-sm leading-6 text-[#52665f]">{localize(item.template.description, language)}</p></div><AppActionButton onClick={() => openEdit(item)}><Pencil className="mr-2 h-4 w-4" />{isZh ? eventTemplateAdminViewText.edit.zh : eventTemplateAdminViewText.edit.en}</AppActionButton></div></article>)}</div> : null}

        {catalog && catalog.templates.totalPages > 1 ? <nav aria-label={isZh ? eventTemplateAdminViewText.templatePagination.zh : eventTemplateAdminViewText.templatePagination.en} className="mt-5 flex items-center justify-between gap-3"><AppActionButton disabled={filters.page <= 1 || state === 'loading'} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}><ChevronLeft className="mr-1 h-4 w-4" />{isZh ? eventTemplateAdminViewText.previous.zh : eventTemplateAdminViewText.previous.en}</AppActionButton><span className="text-xs font-bold text-[#66766f]">{filters.page}/{catalog.templates.totalPages} · {catalog.templates.totalCount}</span><AppActionButton disabled={filters.page >= catalog.templates.totalPages || state === 'loading'} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>{isZh ? eventTemplateAdminViewText.next.zh : eventTemplateAdminViewText.next.en}<ChevronRight className="ml-1 h-4 w-4" /></AppActionButton></nav> : null}
      </AppSectionCard>

        {editorMode !== 'closed' && catalog ? <AppSectionCard title={editorMode === 'create' ? (isZh ? eventTemplateAdminViewText.createEventTemplate.zh : eventTemplateAdminViewText.createEventTemplate.en) : (isZh ? eventTemplateAdminViewText.editEventTemplate.zh : eventTemplateAdminViewText.editEventTemplate.en)} subtitle={isZh ? eventTemplateAdminViewText.codeAndCategoryAreImmutableAfterCreationSavingAn.zh : eventTemplateAdminViewText.codeAndCategoryAreImmutableAfterCreationSavingAn.en} action={<AppActionButton variant="ghost" onClick={() => { setEditorMode('closed'); setSelected(null) }}>{isZh ? eventTemplateAdminViewText.close.zh : eventTemplateAdminViewText.close.en}</AppActionButton>}>
        <form className="space-y-6" onSubmit={(event) => void save(event)}>
          {success ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{success}</p> : null}
          {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</p> : null}
          {validationCode ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{localize(validationCopy[validationCode] ?? (validationCode === 'projects' ? projectCopy.invalidProjects : validationCopy.slot), language)}</p> : null}

          <div className="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-4">
            <label className={labelClass}>{isZh ? eventTemplateAdminViewText.templateCode.zh : eventTemplateAdminViewText.templateCode.en}<input className={fieldClass} disabled={editorMode === 'edit'} value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: normalizeEventTemplateCode(event.target.value) }))} /></label>
            <label className={labelClass}>{isZh ? eventTemplateAdminViewText.fixedCategory.zh : eventTemplateAdminViewText.fixedCategory.en}<select className={fieldClass} disabled={editorMode === 'edit'} value={form.archetypeCode} onChange={(event) => setForm((current) => ({ ...current, archetypeCode: event.target.value }))}>{catalog.archetypes.map((item) => <option key={item.code} value={item.code}>{localize(item.name, language)}</option>)}</select></label>
            <label className={labelClass}>{isZh ? eventTemplateAdminViewText.iconKey.zh : eventTemplateAdminViewText.iconKey.en}<select className={fieldClass} value={form.iconKey} onChange={(event) => setForm((current) => ({ ...current, iconKey: event.target.value }))}>{catalog.iconKeys.map((key) => <option key={key} value={key}>{key}</option>)}</select></label>
            <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-[#2f4b42]/10 bg-[#fbfcf8] px-3 text-sm font-black text-[#40554e]"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />{form.isActive ? (isZh ? eventTemplateAdminViewText.availableForCreation.zh : eventTemplateAdminViewText.availableForCreation.en) : (isZh ? eventTemplateAdminViewText.inactive.zh : eventTemplateAdminViewText.inactive.en)}</label>
          </div>

          <div className="grid gap-4 tablet:grid-cols-2">
            <label className={labelClass}>{isZh ? eventTemplateAdminViewText.englishName.zh : eventTemplateAdminViewText.englishName.en}<input className={fieldClass} value={form.name.en} onChange={(event) => setForm((current) => ({ ...current, name: { ...current.name, en: event.target.value } }))} /></label>
            <label className={labelClass}>{isZh ? eventTemplateAdminViewText.chineseName.zh : eventTemplateAdminViewText.chineseName.en}<input className={fieldClass} value={form.name.zh} onChange={(event) => setForm((current) => ({ ...current, name: { ...current.name, zh: event.target.value } }))} /></label>
            <label className={labelClass}>{isZh ? eventTemplateAdminViewText.englishDescription.zh : eventTemplateAdminViewText.englishDescription.en}<textarea rows={3} className={fieldClass} value={form.description.en} onChange={(event) => setForm((current) => ({ ...current, description: { ...current.description, en: event.target.value } }))} /></label>
            <label className={labelClass}>{isZh ? eventTemplateAdminViewText.chineseDescription.zh : eventTemplateAdminViewText.chineseDescription.en}<textarea rows={3} className={fieldClass} value={form.description.zh} onChange={(event) => setForm((current) => ({ ...current, description: { ...current.description, zh: event.target.value } }))} /></label>
          </div>

          <fieldset><legend className="text-sm font-black text-[#18332d]">{isZh ? eventTemplateAdminViewText.formDefaults.zh : eventTemplateAdminViewText.formDefaults.en}</legend><div className="mt-3 grid gap-4 tablet:grid-cols-2"><label className={labelClass}>{isZh ? eventTemplateAdminViewText.visibility.zh : eventTemplateAdminViewText.visibility.en}<select className={fieldClass} value={form.defaults.visibility} onChange={(event) => setForm((current) => ({ ...current, defaults: { ...current.defaults, visibility: event.target.value as EventTemplateAdminForm['defaults']['visibility'] } }))}><option value="groupVisible">groupVisible</option><option value="churchVisible">churchVisible</option><option value="public">public</option></select></label><label className={labelClass}>{isZh ? eventTemplateAdminViewText.registration.zh : eventTemplateAdminViewText.registration.en}<select className={fieldClass} value={form.defaults.registrationMode} onChange={(event) => setForm((current) => ({ ...current, defaults: { ...current.defaults, registrationMode: event.target.value as 'none' | 'required' } }))}><option value="none">none</option><option value="required">required</option></select></label></div></fieldset>

          <EventTemplatePresetProjects projects={form.presetProjects} definitions={catalog.questionDefinitions ?? []} zh={isZh} onChange={presetProjects=>setForm(current=>({...current,presetProjects}))}/>

          <fieldset><legend className="text-sm font-black text-[#18332d]">{isZh ? eventTemplateAdminViewText.preselectedCapabilities.zh : eventTemplateAdminViewText.preselectedCapabilities.en}</legend><p className="mt-1 text-xs leading-5 text-[#66766f]">{isZh ? eventTemplateAdminViewText.teamWorkIsAlwaysImplicitMoneyFinanceStillRequires.zh : eventTemplateAdminViewText.teamWorkIsAlwaysImplicitMoneyFinanceStillRequires.en}</p><div className="mt-3 grid gap-2 tablet:grid-cols-2 desktop:grid-cols-3">{catalog.moduleOptions.map((module) => { const checked = form.preselectedModules.includes(module.code); return <label key={module.code} className={`flex min-h-16 items-start gap-3 rounded-xl border p-3 ${checked ? 'border-[#176b5a]/35 bg-[#e3f0eb]/70' : 'border-[#2f4b42]/10 bg-white'}`}><input className="mt-1" type="checkbox" checked={checked} onChange={(event) => setForm((current) => ({ ...current, preselectedModules: event.target.checked ? [...current.preselectedModules, module.code] : current.preselectedModules.filter((code) => code !== module.code) }))} /><span className="min-w-0"><strong className="block text-sm text-[#18332d]">{localize(module.name, language)}</strong><span className="break-all text-xs text-[#66766f]">{module.code}</span></span></label> })}</div></fieldset>

          <fieldset><div className="flex flex-wrap items-end justify-between gap-3"><div><legend className="text-sm font-black text-[#18332d]">{isZh ? eventTemplateAdminViewText.serviceSlotPresets.zh : eventTemplateAdminViewText.serviceSlotPresets.en}</legend><p className="mt-1 text-xs leading-5 text-[#66766f]">{isZh ? eventTemplateAdminViewText.slotsDescribeTypicalPlanningNeedsOnlyTheyAssignNobody.zh : eventTemplateAdminViewText.slotsDescribeTypicalPlanningNeedsOnlyTheyAssignNobody.en}</p></div><AppActionButton size="sm" onClick={addSlot}><Plus className="mr-1 h-4 w-4" />{isZh ? eventTemplateAdminViewText.addSlot.zh : eventTemplateAdminViewText.addSlot.en}</AppActionButton></div><div className="mt-3 space-y-3">{form.presetServiceSlots.map((slot, index) => <div key={`${index}-${slot.roleCode}`} className="grid min-w-0 gap-3 rounded-2xl border border-[#2f4b42]/10 bg-[#fbfcf8] p-3 tablet:grid-cols-2 desktop:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_6rem_auto]"><label className={labelClass}>{isZh ? eventTemplateAdminViewText.roleCode.zh : eventTemplateAdminViewText.roleCode.en}<input className={fieldClass} value={slot.roleCode} onChange={(event) => updateSlot(index, { roleCode: event.target.value.toLowerCase() })} /></label><label className={labelClass}>{isZh ? eventTemplateAdminViewText.englishLabel.zh : eventTemplateAdminViewText.englishLabel.en}<input className={fieldClass} value={slot.label.en} onChange={(event) => updateSlot(index, { label: { ...slot.label, en: event.target.value } })} /></label><label className={labelClass}>{isZh ? eventTemplateAdminViewText.chineseLabel.zh : eventTemplateAdminViewText.chineseLabel.en}<input className={fieldClass} value={slot.label.zh} onChange={(event) => updateSlot(index, { label: { ...slot.label, zh: event.target.value } })} /></label><label className={`${labelClass} w-24 max-w-full`}>{isZh ? eventTemplateAdminViewText.people.zh : eventTemplateAdminViewText.people.en}<input type="number" min="1" max="999" className={`${fieldClass} w-24 max-w-full`} value={slot.requiredCount} onChange={(event) => updateSlot(index, { requiredCount: Number(event.target.value) })} /></label><AppActionButton className="self-end" size="sm" variant="danger" aria-label={isZh ? eventTemplateAdminViewText.removeSlot.zh : eventTemplateAdminViewText.removeSlot.en} onClick={() => removeSlot(index)}><Trash2 className="h-4 w-4" /></AppActionButton></div>)}{!form.presetServiceSlots.length ? <div className="rounded-xl border border-dashed border-[#2f4b42]/20 p-5 text-sm text-[#66766f]">{isZh ? eventTemplateAdminViewText.noSlotPresetsYetIfServiceRosterIsEnabled.zh : eventTemplateAdminViewText.noSlotPresetsYetIfServiceRosterIsEnabled.en}</div> : null}</div></fieldset>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#2f4b42]/10 pt-5"><p className="text-xs text-[#66766f]">{editorMode === 'edit' ? <>{isZh ? eventTemplateAdminViewText.current.zh : eventTemplateAdminViewText.current.en} v{selected?.template.version} · {isZh ? eventTemplateAdminViewText.savingCreatesTheNextVersion.zh : eventTemplateAdminViewText.savingCreatesTheNextVersion.en}</> : (isZh ? eventTemplateAdminViewText.newTemplatesStartAtV1.zh : eventTemplateAdminViewText.newTemplatesStartAtV1.en)}</p><div className="flex flex-wrap gap-2">{editorMode === 'edit' && selected && !selected.isActive ? <AppBadge variant="danger"><CircleOff className="mr-1 h-3.5 w-3.5" />{isZh ? eventTemplateAdminViewText.currentlyInactive.zh : eventTemplateAdminViewText.currentlyInactive.en}</AppBadge> : null}<AppActionButton type="submit" variant="primary" disabled={saving || Boolean(validationCode)}>{saving ? (isZh ? eventTemplateAdminViewText.saving.zh : eventTemplateAdminViewText.saving.en) : (isZh ? eventTemplateAdminViewText.saveNewVersion.zh : eventTemplateAdminViewText.saveNewVersion.en)}</AppActionButton></div></div>
        </form>
        </AppSectionCard> : null}
      </SystemManagementFrame>
      {confirmationModal}
    </AppPageShell>
  )
}

export default EventTemplateAdminView
