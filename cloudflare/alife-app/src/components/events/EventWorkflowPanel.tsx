import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { eventWorkflowService } from '../../services/eventWorkflowService'
import { normalizeApiError } from '../../services/http'
import type {
  EventArtifact,
  EventArtifactStatus,
  EventWorkflow,
  EventWorkflowStep,
  EventWorkflowStepStatus,
  EventWorkflowTemplate,
  WorkflowText,
} from '../../types/eventWorkflow'
import AppActionButton from '../layout/AppActionButton'
import AppBadge from '../layout/AppBadge'
import AppSectionCard from '../layout/AppSectionCard'

type Props = {
  eventId: string
  groupId: string
  language: string
  canManage: boolean
}

const statusTone = (status: string): 'success' | 'warning' | 'neutral' => {
  if (status === 'completed' || status === 'approved') return 'success'
  if (status === 'awaitingApproval' || status === 'submitted' || status === 'needsChanges') return 'warning'
  return 'neutral'
}

const labels = {
  en: {
    title: 'Event workflow', outputs: 'Outputs', required: 'Required', optional: 'Optional',
    loading: 'Loading workflow...', noWorkflow: 'No workflow has been selected for this event.',
    choose: 'Choose a workflow template', initialize: 'Use this workflow', initializing: 'Initializing...',
    progress: 'required steps completed', managed: 'Managed in event RAM', openRam: 'Open event / RAM editor',
    start: 'Start', submit: 'Request approval', complete: 'Complete step', reopen: 'Reopen',
    markReady: 'Mark submitted', approve: 'Approve', returnDraft: 'Return to draft', openFile: 'Open file',
    public: 'Public', groupVisible: 'Group members', memberPrivate: 'Restricted/private',
    notStarted: 'Not started', inProgress: 'In progress', awaitingApproval: 'Awaiting approval',
    needsChanges: 'Needs changes', completed: 'Completed', skipped: 'Skipped',
    draft: 'Draft', submitted: 'Submitted', approved: 'Approved', version: 'Version',
  },
  zh: {
    title: '活动工作流', outputs: '产出物', required: '必需', optional: '可选',
    loading: '正在加载工作流……', noWorkflow: '这个活动尚未选择工作流。',
    choose: '选择工作流模板', initialize: '采用此工作流', initializing: '正在初始化……',
    progress: '个必需步骤已完成', managed: '由活动 RAM 流程管理', openRam: '打开活动 / RAM 编辑器',
    start: '开始', submit: '提交审批', complete: '完成步骤', reopen: '重新打开',
    markReady: '标记为已提交', approve: '批准', returnDraft: '退回草稿', openFile: '打开文件',
    public: '公开', groupVisible: '小组成员可见', memberPrivate: '受限／私密',
    notStarted: '未开始', inProgress: '进行中', awaitingApproval: '等待审批',
    needsChanges: '需要修改', completed: '已完成', skipped: '已跳过',
    draft: '草稿', submitted: '已提交', approved: '已批准', version: '版本',
  },
} as const

const localize = (value: WorkflowText, language: string) =>
  (language === 'zh' ? value.zh : value.en) || value.en || value.zh

const EventWorkflowPanel = ({ eventId, groupId, language, canManage }: Props) => {
  const text = language === 'zh' ? labels.zh : labels.en
  const [workflow, setWorkflow] = useState<EventWorkflow | null>(null)
  const [templates, setTemplates] = useState<EventWorkflowTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextWorkflow, nextTemplates] = await Promise.all([
        eventWorkflowService.get(eventId),
        canManage ? eventWorkflowService.listTemplates() : Promise.resolve([]),
      ])
      setWorkflow(nextWorkflow)
      setTemplates(nextTemplates)
    } catch (reason) {
      setError(normalizeApiError(reason).message)
    } finally {
      setLoading(false)
    }
  }, [canManage, eventId])

  useEffect(() => { void load() }, [load])

  const requiredSteps = workflow?.steps.filter((step) => step.isRequired) ?? []
  const completedRequired = requiredSteps.filter((step) => step.status === 'completed').length
  const progress = requiredSteps.length ? Math.round((completedRequired / requiredSteps.length) * 100) : 0

  const initialize = async (template: EventWorkflowTemplate) => {
    setBusyId(template.id)
    setError('')
    try { setWorkflow(await eventWorkflowService.initialize(eventId, template.code)) }
    catch (reason) { setError(normalizeApiError(reason).message) }
    finally { setBusyId('') }
  }

  const updateStep = async (step: EventWorkflowStep, status: EventWorkflowStepStatus) => {
    setBusyId(step.id)
    setError('')
    try { setWorkflow(await eventWorkflowService.updateStep(eventId, step, status)) }
    catch (reason) { setError(normalizeApiError(reason).message) }
    finally { setBusyId('') }
  }

  const updateArtifact = async (artifact: EventArtifact, status: EventArtifactStatus) => {
    setBusyId(artifact.id)
    setError('')
    try {
      const updated = await eventWorkflowService.updateArtifactStatus(eventId, artifact, status)
      setWorkflow((current) => current ? {
        ...current,
        steps: current.steps.map((step) => ({
          ...step,
          artifacts: step.artifacts.map((item) => item.id === updated.id ? updated : item),
        })),
      } : current)
    } catch (reason) { setError(normalizeApiError(reason).message) }
    finally { setBusyId('') }
  }

  const visibilityLabel = useMemo(() => ({
    public: text.public,
    groupVisible: text.groupVisible,
    memberPrivate: text.memberPrivate,
  }), [text])

  if (loading) return <AppSectionCard dense><p className="text-sm text-slate-500">{text.loading}</p></AppSectionCard>

  if (!workflow) {
    return (
      <div className="space-y-4">
        {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
        <AppSectionCard title={canManage ? text.choose : text.title}>
          {!canManage ? <p className="text-sm text-slate-600">{text.noWorkflow}</p> : (
            <div className="grid gap-4 md:grid-cols-2">
              {templates.map((template) => (
                <article key={template.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-slate-950">{localize(template.name, language)}</h3>
                    <AppBadge variant="neutral">{text.version} {template.version}</AppBadge>
                  </div>
                  <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{localize(template.description, language)}</p>
                  <p className="mt-3 text-xs text-slate-500">{template.stages.length} stages · {template.stages.reduce((count, stage) => count + stage.artifacts.length, 0)} outputs</p>
                  <AppActionButton className="mt-4" disabled={Boolean(busyId)} onClick={() => void initialize(template)}>
                    {busyId === template.id ? text.initializing : text.initialize}
                  </AppActionButton>
                </article>
              ))}
            </div>
          )}
        </AppSectionCard>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      <AppSectionCard title={localize(workflow.template.name, language)}>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-slate-600">{completedRequired}/{requiredSteps.length} {text.progress}</p>
          <AppBadge variant={workflow.status === 'completed' ? 'success' : 'neutral'}>{workflow.status}</AppBadge>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${progress}%`}>
          <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </AppSectionCard>

      {workflow.steps.map((step) => {
        const requiredApproved = step.artifacts.filter((artifact) => artifact.isRequired).every((artifact) => artifact.status === 'approved')
        return (
          <AppSectionCard
            key={step.id}
            title={`${step.sortOrder}. ${localize(step.name, language)}`}
            action={<AppBadge variant={statusTone(step.status)}>{text[step.status]}</AppBadge>}
          >
            {step.integrationKey === 'ram' ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                <span>{text.managed}</span>
                {canManage ? <Link className="font-bold underline" to={`/groups/${encodeURIComponent(groupId)}/events/${encodeURIComponent(eventId)}/edit`}>{text.openRam}</Link> : null}
              </div>
            ) : null}

            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">{text.outputs}</h4>
            <div className="mt-2 space-y-2">
              {step.artifacts.map((artifact) => (
                <div key={artifact.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{localize(artifact.title, language)}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>{artifact.isRequired ? text.required : text.optional}</span>
                      <span>·</span><span>{visibilityLabel[artifact.visibility]}</span>
                      {artifact.fileAssetId ? <a className="font-bold text-emerald-700 underline" href={`/api/file-assets/${artifact.fileAssetId}/open`} target="_blank" rel="noreferrer">{text.openFile}</a> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <AppBadge variant={statusTone(artifact.status)}>{text[artifact.status]}</AppBadge>
                    {canManage && step.integrationKey !== 'ram' ? (
                      artifact.status === 'draft' ? <AppActionButton size="sm" disabled={busyId === artifact.id} onClick={() => void updateArtifact(artifact, 'submitted')}>{text.markReady}</AppActionButton>
                        : artifact.status === 'submitted' ? <AppActionButton size="sm" disabled={busyId === artifact.id} onClick={() => void updateArtifact(artifact, 'approved')}>{text.approve}</AppActionButton>
                          : <AppActionButton size="sm" variant="secondary" disabled={busyId === artifact.id} onClick={() => void updateArtifact(artifact, 'draft')}>{text.returnDraft}</AppActionButton>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {canManage && !step.integrationKey ? (
              <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                {step.status === 'notStarted' ? <AppActionButton size="sm" disabled={busyId === step.id} onClick={() => void updateStep(step, 'inProgress')}>{text.start}</AppActionButton> : null}
                {step.requiresApproval && step.status === 'inProgress' ? <AppActionButton size="sm" disabled={busyId === step.id} onClick={() => void updateStep(step, 'awaitingApproval')}>{text.submit}</AppActionButton> : null}
                {step.status !== 'completed' ? <AppActionButton size="sm" disabled={busyId === step.id || !requiredApproved} onClick={() => void updateStep(step, 'completed')}>{text.complete}</AppActionButton> : null}
                {step.status === 'completed' ? <AppActionButton size="sm" variant="secondary" disabled={busyId === step.id} onClick={() => void updateStep(step, 'inProgress')}>{text.reopen}</AppActionButton> : null}
              </div>
            ) : null}
          </AppSectionCard>
        )
      })}
    </div>
  )
}

export default EventWorkflowPanel
