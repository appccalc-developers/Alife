import { http } from './http'
import type { LocalizedText } from '../types/eventComposition'
export type MaterialRule = { id: string; label: LocalizedText; kind: 'text' | 'image' | 'file'; required: boolean; maxCount: number; maxBytes: number }
export type RegistrationRules = { purpose: LocalizedText; audience: string; eligibleGroupId: string | null; eligibility: LocalizedText; capacity: number; opensUtc: string; deadlineUtc: string; allowWaitlist: boolean; channel: string; terms: LocalizedText; privacyNotice: LocalizedText; cancellationTerms: LocalizedText; manualReview: boolean; materials: MaterialRule[]; feeMinor: number; currency: string; paymentInstructions: LocalizedText; refundTerms: LocalizedText; moneyFlowScope: string }
export type RegistrationPolicy = { version: number; rules: RegistrationRules; eTag: string; feeApprovalStatus: string }
export type RegistrationPerson = { id: string; memberId: string | null; displayName: string; isChild: boolean; guardianName: string; guardianMemberId: string | null; seatStatus: string; procedureStatus: string; consentMethod: string; consentedUtc: string | null; eligibilityVerified: boolean; materialsVerified: boolean; answersJson: string; paidMinor: number; refundedMinor: number; isLegacy: boolean; proxyAccessRevoked: boolean }
export type RegistrationApplication = { id: string; organiserMemberId: string; allowSplit: boolean; isInvitation: boolean; invitationMode: string; invitedUtc: string | null; reservationExpiresUtc: string | null; eTag: string; channel: string; policyVersion: number; participants: RegistrationPerson[]; createdByMemberId: string; manualOrganiserName: string }
export type RegistrationHistory = { id: string; actorMemberId: string; operation: string; evidence: string; createdUtc: string; participantId: string | null; amountMinor: number | null }
export type RegistrationWork = { eventId: string; title: LocalizedText; policy: RegistrationPolicy | null; canConfigure: boolean; canManage: boolean; canFinance: boolean; canApproveFees: boolean; approved: boolean; publiclyOpen: boolean; confirmed: number; reserved: number; waitlisted: number; applications: RegistrationApplication[]; page: number; hasMore: boolean; groupId: string; eventStartUtc: string; eventEndUtc: string }
export type PersonInput = Pick<RegistrationPerson, 'memberId' | 'displayName' | 'isChild' | 'guardianName' | 'guardianMemberId'>
export type ApplicationInput = { organiserMemberId: string; participants: PersonInput[]; allowSplit: boolean; isInvitation: boolean; invitationMode: string; reservationExpiresUtc: string | null; channel: string; manualOrganiserName: string; proxyAuthorityEvidence: string }
export type RegistrationFile = { id: string; requirementId: string; name: string; sizeBytes: number; openUrl: string }
const path = (id: string) => `/api/events/${id}/registration-work`
const headers = (eTag: string, key: string) => ({ headers: { 'If-Match': eTag, 'Idempotency-Key': key } })
export const registrationWorkService = {
  get: async (id: string, page = 1, search = '', application?: string) => (await http.get<RegistrationWork>(path(id), { params: { page, search, application } })).data,
  history: async (id: string, app: string, page: number) => (await http.get<RegistrationHistory[]>(`${path(id)}/applications/${app}/history`, { params: { page } })).data,
  rules: async (id: string, body: RegistrationRules, eTag: string) => (await http.put<RegistrationPolicy>(`${path(id)}/rules`, body, { headers: { 'If-Match': eTag } })).data,
  create: async (id: string, body: ApplicationInput, key: string) => (await http.post<string>(`${path(id)}/applications`, body, headers('', key))).data,
  act: async (id: string, app: RegistrationApplication, operation: string, body: object, key: string) => (await http.post(`${path(id)}/applications/${app.id}/${operation}`, body, headers(app.eTag, key))).data,
  fees: async (id: string, operation: string, reason: string, eTag: string, key: string) => (await http.post<RegistrationPolicy>(`${path(id)}/fees/${operation}`, { reason }, headers(eTag, key))).data,
  files: async (id: string, person: string) => (await http.get<RegistrationFile[]>(`${path(id)}/participants/${person}/materials`)).data,
  upload: async (id: string, person: string, requirement: string, file: File, eTag: string) => { const body = new FormData(); body.append('file', file); return (await http.post<RegistrationFile>(`${path(id)}/participants/${person}/materials/${requirement}`, body, { headers: { 'If-Match': eTag } })).data },
  open: async (file: RegistrationFile) => {
    const { data } = await http.get<{ url: string }>(file.openUrl, { params: { asLink: true } });
    const response = await http.get<Blob>(data.url, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a'); link.href = url; link.download = file.name; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { url: '' };
  },
}
export const registrationStatus = (value: string, zh: boolean) => ({ draft: ['尚未分配名额', 'No place allocated'], incomplete: ['手续未完成', 'Procedures incomplete'], complete: ['手续已完成', 'Procedures complete'], reserved: ['名额已预留', 'Place reserved'], confirmed: ['名额已确认', 'Place confirmed'], waitlisted: ['候补', 'Waitlisted'], cancelled: ['已取消', 'Cancelled'], expired: ['已到期', 'Expired'], legacy: ['历史记录', 'Legacy record'], notRequired: ['无需收费审批', 'No fee approval required'], notSubmitted: ['尚未提交', 'Not submitted'], pending: ['待独立审批', 'Independent review pending'], approved: ['已批准', 'Approved'], returned: ['已退回', 'Returned'] }[value]?.[zh ? 0 : 1] || value)
export const inputStyle = 'min-h-11 w-full rounded-xl border border-[#176b5a]/25 bg-white px-3 py-2 text-sm'
export const currencyScale = (currency: string) => 10 ** (new Intl.NumberFormat('en', { style: 'currency', currency: /^[A-Z]{3}$/.test(currency) ? currency : 'NZD' }).resolvedOptions().maximumFractionDigits ?? 2)
export const localDateTime = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
