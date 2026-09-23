import { http } from './http'
import type { EventPlanSnapshot, LocalizedText } from '../types/eventComposition'
export const reportModules = ['SAFEGUARDING.CHILD', 'PROGRAM.PRODUCTION', 'MOVE.STAY', 'FOOD.HOSPITALITY', 'COMMS.FOLLOWUP']
export const workStages = ['preparation', 'registration', 'execution', 'followup'] as const
export const workStageText = (stage: string, zh: boolean) => ({ preparation: zh ? '筹备' : 'Preparation', registration: zh ? '公布' : 'Published', execution: zh ? '执行' : 'Delivery', followup: zh ? '收尾' : 'Follow-up' }[stage] || stage)
export type WorkSummary = { eventId: string; groupId: string; title: LocalizedText; startUtc: string; endUtc: string; posterImageUrl?: string | null; stage: string; canManage: boolean; roles: string[] }
export type WorkPage = { preparationProgress?: import('../types/eventComposition').Readiness | null; planContext?: import('../types/ramGovernance').RamEventPlanContext | null; event: WorkSummary; links: { key: string; stage: string; title: LocalizedText; url: string; canEdit: boolean }[]; occurrences: { id: string; startUtc: string; endUtc: string; stage: string; status: string }[]; occurrencePage: number; hasMoreOccurrences: boolean; plan: EventPlanSnapshot | null; reports: ReportRevision[]; duties: { task: { taskKey: string; actionLabel: LocalizedText; actionUrl: string } }[] }
export type ReportRevision = { id: string; version: number; text: LocalizedText; authorMemberId: string; planVersion: number | null; submittedUtc: string }
export type ModuleReport = { eventId: string; moduleCode: string; id: string | null; draft: LocalizedText; status: string; submittedRevisionId: string | null; adoptedRevisionId: string | null; eTag: string; canEdit: boolean; canAdopt: boolean; frozen: boolean; revisions: ReportRevision[]; actions: { revisionId: string | null; operation: string; reason: string; actorMemberId: string; createdUtc: string }[] }
export const eventWorkService = {
  list: async (page: number, search: string) => (await http.get<{ items: WorkSummary[]; page: number; hasMore: boolean }>('/api/events/work', { params: { page, search } })).data,
  get: async (id: string, page = 1) => (await http.get<WorkPage>(`/api/events/${id}/work`, { params: { page } })).data,
  report: async (id: string, module: string) => (await http.get<ModuleReport>(`/api/events/${id}/reports/${module}`)).data,
  reportAction: async (id: string, module: string, operation: string, body: { text?: LocalizedText; revisionId?: string | null; reason?: string }, eTag: string, key: string) =>
    (await http.post<ModuleReport>(`/api/events/${id}/reports/${module}/${operation}`, body, { headers: { 'If-Match': eTag, 'Idempotency-Key': key } })).data,
}
