import { useState } from 'react'
import { Check, ChevronDown, ChevronRight, GitBranch, Plus, ShieldCheck } from 'lucide-react'
import type { CreateEventWorkflowTemplateInput, EventWorkflowTemplate, WorkflowText } from '../../types/eventWorkflow'
import CustomEventWorkflowTemplateEditor from './CustomEventWorkflowTemplateEditor'

type Props = {
  templates: EventWorkflowTemplate[]
  selectedCode: string | null
  language: string
  loading: boolean
  error?: string
  disabled?: boolean
  onChange: (templateCode: string | null) => void
  onCreateCustom?: (input: CreateEventWorkflowTemplateInput) => Promise<EventWorkflowTemplate>
}

const localize = (value: WorkflowText, language: string) =>
  (language === 'zh' ? value.zh : value.en) || value.en || value.zh

const EventWorkflowTemplatePicker = ({
  templates,
  selectedCode,
  language,
  loading,
  error,
  disabled = false,
  onChange,
  onCreateCustom,
}: Props) => {
  const isZh = language === 'zh'
  const [expanded, setExpanded] = useState(true)
  const [showCustomEditor, setShowCustomEditor] = useState(false)
  const selectedTemplate = templates.find((template) => template.code === selectedCode) ?? null
  const selectedName = selectedTemplate
    ? localize(selectedTemplate.name, language)
    : (isZh ? '轻量创建' : 'Quick create')
  const selectedDescription = selectedTemplate
    ? localize(selectedTemplate.description, language)
    : (isZh
      ? '适合聚餐、查经和一般聚会，不额外生成筹备任务。'
      : 'For meals, Bible studies, and regular gatherings, without extra preparation tasks.')

  const selectTemplate = (templateCode: string | null) => {
    onChange(templateCode)
  }

  return (
    <section
      className="rounded-2xl border border-[#2f4b42]/10 bg-white/90 shadow-[0_10px_30px_rgba(31,56,48,0.06)]"
      aria-labelledby="event-workflow-template-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <GitBranch className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#176b5a]">
                {isZh ? '筹备方式' : 'Preparation approach'}
              </p>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-black text-emerald-800">
                {selectedName}
              </span>
            </div>
            <h2 id="event-workflow-template-title" className="mt-1 text-base font-black text-slate-950">
              {selectedDescription}
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {isZh
                ? '这是筹备流程，不是活动类型；不会改变活动可见范围。'
                : 'This controls preparation, not event type or visibility.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="event-workflow-template-options"
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
        >
          {expanded
            ? (isZh ? '收起选择' : 'Hide options')
            : (isZh ? `更改筹备方式（${templates.length + 1}）` : `Change approach (${templates.length + 1})`)}
          <ChevronDown className={['h-4 w-4 transition', expanded ? 'rotate-180' : ''].join(' ')} aria-hidden="true" />
        </button>
      </div>

      {error ? (
        <p className="mx-5 mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {isZh ? '暂时无法加载专项模板；仍可使用轻量创建。' : 'Managed templates could not be loaded. Quick create is still available.'} {error}
        </p>
      ) : null}

      {expanded ? (
        <div id="event-workflow-template-options" className="border-t border-slate-200 px-5 py-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-black text-slate-950">{isZh ? '选择适合这次活动的筹备强度' : 'Choose the preparation level for this event'}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {isZh ? '多数活动使用轻量创建；只有需要跨阶段任务和审批时才选专项模板。' : 'Use quick create for most events. Choose a managed template only when staged tasks and approvals are needed.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {templates.length + 1} {isZh ? '种方式' : 'options'}
              </span>
              {onCreateCustom ? (
                <button
                  type="button"
                  onClick={() => setShowCustomEditor((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-3.5 py-2 text-sm font-black text-white transition hover:bg-violet-800"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {isZh ? '创建自定义流程' : 'Create custom workflow'}
                </button>
              ) : null}
            </div>
          </div>

          {showCustomEditor && onCreateCustom ? (
            <CustomEventWorkflowTemplateEditor
              language={language}
              onCancel={() => setShowCustomEditor(false)}
              onSave={async (input) => {
                const template = await onCreateCustom(input)
                onChange(template.code)
                setShowCustomEditor(false)
                return template
              }}
            />
          ) : null}

          {!showCustomEditor ? <div className="mt-4 grid gap-3 md:grid-cols-3" role="group" aria-label={isZh ? '活动筹备方式' : 'Event preparation approaches'}>
            <button
              type="button"
              aria-pressed={selectedCode === null}
              disabled={disabled}
              onClick={() => selectTemplate(null)}
              className={[
                'relative rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60',
                selectedCode === null
                  ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40',
              ].join(' ')}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="font-black text-slate-950">{isZh ? '轻量创建' : 'Quick create'}</span>
                {selectedCode === null ? <Check className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" /> : null}
              </span>
              <span className="mt-2 block text-sm leading-5 text-slate-600">
                {isZh ? '聚餐、查经和一般聚会。完成资料、通知、报名和 RAM。' : 'Meals, Bible studies, and regular gatherings. Complete details, notice, registration, and RAM.'}
              </span>
              <span className="mt-3 block text-xs font-black text-emerald-700">{isZh ? '推荐用于多数活动' : 'Recommended for most events'}</span>
            </button>

            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500" aria-live="polite">
                {isZh ? '正在加载专项模板…' : 'Loading managed templates…'}
              </div>
            ) : templates.map((template) => {
              const selected = selectedCode === template.code
              const approvalCount = template.stages.filter((stage) => stage.requiresApproval).length
              return (
                <button
                  key={`${template.code}-${template.version}`}
                  type="button"
                  aria-pressed={selected}
                  disabled={disabled}
                  onClick={() => selectTemplate(template.code)}
                  className={[
                    'relative rounded-xl border bg-white p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60',
                    selected
                      ? 'border-emerald-500 bg-emerald-50 shadow-sm ring-1 ring-emerald-200'
                      : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40',
                  ].join(' ')}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="font-black text-slate-950">{localize(template.name, language)}</span>
                      {template.ownerGroupId ? (
                        <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-black text-violet-700">
                          {isZh ? '小组自定义' : 'Group custom'}
                        </span>
                      ) : null}
                    </span>
                    {selected ? <Check className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" /> : null}
                  </span>
                  <span className="mt-2 block text-sm leading-5 text-slate-600">{localize(template.description, language)}</span>
                  <span className="mt-3 block text-xs font-bold text-slate-500">
                    {template.stages.length} {isZh ? '个阶段' : 'stages'} · {approvalCount} {isZh ? '个审批点' : 'approval gates'}
                  </span>
                </button>
              )
            })}
          </div> : null}

          {!showCustomEditor && selectedTemplate ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-black text-emerald-950">
                  {localize(selectedTemplate.name, language)} · {isZh ? '创建后执行' : 'runs after creation'}
                </h3>
                <span className="text-xs font-bold text-emerald-800">
                  {isZh ? '保存活动后才生成任务' : 'Tasks are created only after saving'}
                </span>
              </div>
              <ol className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1" aria-label={isZh ? '所选筹备模板阶段' : 'Selected preparation stages'}>
                {selectedTemplate.stages.map((stage, index) => (
                  <li key={stage.key} className="flex min-w-[10rem] flex-1 snap-start items-center">
                    <div className="flex min-h-20 flex-1 flex-col rounded-xl border border-emerald-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs font-black text-white">{index + 1}</span>
                        {stage.requiresApproval ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800">
                            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                            {isZh ? '审批' : 'Approval'}
                          </span>
                        ) : null}
                      </div>
                      <span className="mt-2 block text-sm font-black text-slate-950">{localize(stage.name, language)}</span>
                    </div>
                    {index < selectedTemplate.stages.length - 1 ? (
                      <span className="flex w-6 shrink-0 items-center justify-center text-emerald-500" aria-hidden="true"><ChevronRight className="h-5 w-5" /></span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export default EventWorkflowTemplatePicker
