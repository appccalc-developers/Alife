import { taskListText } from '../i18n/taskList.ts'
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
    teamInvitation: [taskListText.teamInvitation.en, taskListText.teamInvitation.zh], roleInvitation: [taskListText.roleInvitation.en, taskListText.roleInvitation.zh], rosterAssignment: [taskListText.serviceConfirmation.en, taskListText.serviceConfirmation.zh],
    rosterCoordination: [taskListText.serviceArrangements.en, taskListText.serviceArrangements.zh], eventTask: [taskListText.taskCompletionReview.en, taskListText.taskCompletionReview.zh], ramAssessment: [taskListText.ramPreparation.en, taskListText.ramPreparation.zh],
    ramRevision: [taskListText.ramConfirmationReview.en, taskListText.ramConfirmationReview.zh], eventPackage: [taskListText.eventApproval.en, taskListText.eventApproval.zh], packageCondition: [taskListText.approvalConditions.en, taskListText.approvalConditions.zh],
    sponsorship: [taskListText.churchSponsorship.en, taskListText.churchSponsorship.zh], preparationReopen: [taskListText.reopenPreparation.en, taskListText.reopenPreparation.zh], eventNextStep: [taskListText.ownerNextStep.en, taskListText.ownerNextStep.zh], execution: [taskListText.executionConfirmation.en, taskListText.executionConfirmation.zh],
  }
  return labels[source]?.[zh ? 1 : 0] || (zh ? taskListText.otherResponsibilities.zh : taskListText.otherResponsibilities.en)
}
