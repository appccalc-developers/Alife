import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Save, ShieldCheck, Trash2, X } from 'lucide-react'
import type { CreateEventWorkflowTemplateInput, EventWorkflowTemplate } from '../../types/eventWorkflow'
import { normalizeApiError } from '../../services/http'

type Props = {
  language: string
  onCancel: () => void
  onSave: (input: CreateEventWorkflowTemplateInput) => Promise<EventWorkflowTemplate>
}

type EditableStage = {
  id: string
  nameEn: string
  nameZh: string
  requiresApproval: boolean
}

const createStage = (): EditableStage => ({
  id: crypto.randomUUID(),
  nameEn: '',
  nameZh: '',
  requiresApproval: false,
})

const CustomEventWorkflowTemplateEditor = ({ language, onCancel, onSave }: Props) => {
  const isZh = language === 'zh'
  const [nameEn, setNameEn] = useState('')
  const [nameZh, setNameZh] = useState('')
  const [descriptionEn, setDescriptionEn] = useState('')
  const [descriptionZh, setDescriptionZh] = useState('')
  const [stages, setStages] = useState<EditableStage[]>([createStage()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const invalidStageCount = useMemo(
    () => stages.filter((stage) => !stage.nameEn.trim() && !stage.nameZh.trim()).length,
    [stages],
  )
  const canSave = Boolean(
    (nameEn.trim() || nameZh.trim())
    && stages.length > 0
    && invalidStageCount === 0
    && !saving,
  )

  const updateStage = (id: string, patch: Partial<EditableStage>) => {
    setStages((current) => current.map((stage) => stage.id === id ? { ...stage, ...patch } : stage))
  }

  const moveStage = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= stages.length) return
    setStages((current) => {
      const next = [...current]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return next
    })
  }

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      await onSave({
        nameEn: nameEn.trim(),
        nameZh: nameZh.trim(),
        descriptionEn: descriptionEn.trim(),
        descriptionZh: descriptionZh.trim(),
        stages: stages.map((stage) => ({
          nameEn: stage.nameEn.trim(),
          nameZh: stage.nameZh.trim(),
          requiresApproval: stage.requiresApproval,
        })),
      })
    } catch (reason) {
      setError(normalizeApiError(reason).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/50 p-4" aria-labelledby="custom-workflow-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">{isZh ? '自定义模板' : 'Custom template'}</p>
          <h3 id="custom-workflow-title" className="mt-1 text-lg font-black text-slate-950">
            {isZh ? '设计一个可重复使用的筹备流程' : 'Design a reusable preparation workflow'}
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {isZh ? '模板只属于当前小组。保存后可以立即用于这次活动，也会出现在以后新建活动的列表中。' : 'The template belongs only to this group. After saving, it can be used now and for future events.'}
          </p>
        </div>
        <button type="button" onClick={onCancel} disabled={saving} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-60" aria-label={isZh ? '关闭自定义流程编辑器' : 'Close custom workflow editor'}>
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm font-bold text-slate-700">
          {isZh ? '流程名称（中文）' : 'Workflow name (Chinese)'}
          <input value={nameZh} maxLength={200} onChange={(event) => setNameZh(event.target.value)} placeholder="例如：大型家庭日筹备" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
        </label>
        <label className="text-sm font-bold text-slate-700">
          {isZh ? '流程名称（英文）' : 'Workflow name (English)'}
          <input value={nameEn} maxLength={200} onChange={(event) => setNameEn(event.target.value)} placeholder="e.g. Large Family Day Preparation" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
        </label>
        <label className="text-sm font-bold text-slate-700">
          {isZh ? '简短说明（中文，可选）' : 'Description (Chinese, optional)'}
          <input value={descriptionZh} maxLength={1000} onChange={(event) => setDescriptionZh(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
        </label>
        <label className="text-sm font-bold text-slate-700">
          {isZh ? '简短说明（英文，可选）' : 'Description (English, optional)'}
          <input value={descriptionEn} maxLength={1000} onChange={(event) => setDescriptionEn(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-black text-slate-950">{isZh ? '流程阶段' : 'Workflow stages'}</h4>
          <p className="mt-1 text-xs text-slate-500">{isZh ? '从上到下依次执行；开启审批后，该阶段必须由负责人确认。' : 'Stages run top to bottom. Approval stages require leader confirmation.'}</p>
        </div>
        <button
          type="button"
          onClick={() => setStages((current) => [...current, createStage()])}
          disabled={saving || stages.length >= 12}
          className="inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-white px-3.5 py-2 text-sm font-bold text-violet-800 transition hover:bg-violet-100 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {isZh ? '添加阶段' : 'Add stage'}
        </button>
      </div>

      <ol className="mt-3 space-y-3">
        {stages.map((stage, index) => (
          <li key={stage.id} className="relative grid gap-3 rounded-xl border border-violet-200 bg-white p-4 md:grid-cols-[2.5rem_minmax(0,1fr)_auto] md:items-start">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-700 text-sm font-black text-white">{index + 1}</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-600">
                {isZh ? '阶段名称（中文）' : 'Stage name (Chinese)'}
                <input value={stage.nameZh} maxLength={200} onChange={(event) => updateStage(stage.id, { nameZh: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-violet-500" />
              </label>
              <label className="text-xs font-bold text-slate-600">
                {isZh ? '阶段名称（英文）' : 'Stage name (English)'}
                <input value={stage.nameEn} maxLength={200} onChange={(event) => updateStage(stage.id, { nameEn: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-violet-500" />
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900 sm:col-span-2">
                <input type="checkbox" checked={stage.requiresApproval} onChange={(event) => updateStage(stage.id, { requiresApproval: event.target.checked })} className="h-4 w-4 rounded border-amber-300 text-amber-700" />
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                {isZh ? '此阶段需要审批' : 'This stage requires approval'}
              </label>
            </div>
            <div className="flex gap-1 md:flex-col">
              <button type="button" onClick={() => moveStage(index, -1)} disabled={saving || index === 0} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30" aria-label={isZh ? `上移第 ${index + 1} 阶段` : `Move stage ${index + 1} up`}><ArrowUp className="h-4 w-4" /></button>
              <button type="button" onClick={() => moveStage(index, 1)} disabled={saving || index === stages.length - 1} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30" aria-label={isZh ? `下移第 ${index + 1} 阶段` : `Move stage ${index + 1} down`}><ArrowDown className="h-4 w-4" /></button>
              <button type="button" onClick={() => setStages((current) => current.filter((item) => item.id !== stage.id))} disabled={saving || stages.length === 1} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-30" aria-label={isZh ? `删除第 ${index + 1} 阶段` : `Delete stage ${index + 1}`}><Trash2 className="h-4 w-4" /></button>
            </div>
          </li>
        ))}
      </ol>

      {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {!canSave && !saving ? (
        <p className="mt-3 text-xs font-bold text-amber-700">
          {isZh
            ? `请填写流程名称，并为每个阶段至少填写一种语言。${invalidStageCount ? `还有 ${invalidStageCount} 个阶段未命名。` : ''}`
            : `Add a workflow name and name every stage in at least one language.${invalidStageCount ? ` ${invalidStageCount} stage(s) are unnamed.` : ''}`}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          {isZh ? '取消' : 'Cancel'}
        </button>
        <button type="button" onClick={() => { void handleSave() }} disabled={!canSave} className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-violet-800 disabled:opacity-50">
          <Save className="h-4 w-4" aria-hidden="true" />
          {saving ? (isZh ? '正在保存…' : 'Saving…') : (isZh ? '保存并使用这个流程' : 'Save and use this workflow')}
        </button>
      </div>
    </section>
  )
}

export default CustomEventWorkflowTemplateEditor
