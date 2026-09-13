import type { AppNotification } from '../types/notification'

export function selectTaskPage(tasks: AppNotification[], filter: { category: string; eventId?: string; sourceType?: string; sort?: string; page?: number }) {
  const time = (value?: string, fallback = 0) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : fallback
  const filtered = tasks.filter(t => t.category === filter.category && (!filter.eventId || t.eventId === filter.eventId) && (!filter.sourceType || t.sourceType === filter.sourceType))
    .sort((a, b) => (filter.sort === 'newest' ? time(b.createdUtc) - time(a.createdUtc) : filter.sort === 'oldest' ? time(a.createdUtc) - time(b.createdUtc) : time(a.dueUtc, Infinity) - time(b.dueUtc, Infinity)) || time(b.createdUtc) - time(a.createdUtc) || (a.taskKey || a.id).localeCompare(b.taskKey || b.id))
  const pages = Math.max(1, Math.ceil(filtered.length / 20))
  const page = Math.min(pages, Math.max(1, Number.isFinite(filter.page) ? Math.floor(filter.page!) : 1))
  return { items: filtered.slice((page - 1) * 20, page * 20), page, pages, total: filtered.length }
}

export function taskSourceLabel(source: string, zh: boolean) {
  const labels: Record<string, [string, string]> = {
    teamInvitation: ['Team invitation', '团队邀请'], roleInvitation: ['Role invitation', '职责邀请'], rosterAssignment: ['Service confirmation', '排班确认'],
    rosterCoordination: ['Service arrangements', '排班补位'], eventTask: ['Task completion & review', '任务执行与审核'], ramAssessment: ['RAM preparation', 'RAM 起草与修改'],
    ramRevision: ['RAM confirmation & review', 'RAM 确认与审核'], eventPackage: ['Event approval', '活动审批'], packageCondition: ['Approval conditions', '审批条件'],
    sponsorship: ['Church sponsorship', '教会身份审批'], preparationReopen: ['Reopen preparation', '重新编辑审批'], eventNextStep: ['Owner next step', '负责人推进'], execution: ['Execution confirmation', '执行确认'],
  }
  return labels[source]?.[zh ? 1 : 0] || (zh ? '其他事务' : 'Other responsibilities')
}
