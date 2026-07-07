import { http } from './http'
import { conditionalGet, removeCachedRecord } from '../db/httpCache'
import { subgroupsQueryKey } from '../db/collections/groupCollection'
import { sermonsQueryKey } from '../db/collections/sermonsCollection'
import { queryClient } from '../db/queryClient'
import type { GroupDto, GroupMembershipDto, GroupSummaryDto, LocalizedText, MembershipStatus, PageSummaryDto } from '../types'
import { normalizeGroup, normalizeGroupMembership, normalizeMembershipStatus, normalizePageSummary, normalizePageVisibility } from '../utils/apiEnums'
import { toLocalizedText } from '../utils/localizedText'

export type CreateSubgroupPayload = {
  name: LocalizedText
  description?: LocalizedText
  accessType: GroupDto['accessType']
}

export type UpdateGroupPayload = {
  name: LocalizedText
  description?: LocalizedText
  accessType: GroupDto['accessType']
  isClosed: boolean
}

export type MemberTargetPayload = {
  memberId: string
}

export type InviteMemberPayload = {
  targetPhoneE164: string
}

export type MemberSummaryDto = {
  id: string
  displayName: string | null
  membershipStatus?: MembershipStatus | null
}

export type SetCoLeaderPayload = {
  memberId: string
  isCoLeader: boolean
}

export type AdminMemberDto = {
  id: string
  displayName: string | null
  email: string | null
  phoneE164: string | null
  isRegistered: boolean
  legacyIsAdmin: boolean
  createdUtc: string
  updatedUtc: string
  platformRole: 'user' | 'admin' | 'superadmin' | string
  platformRoles: string[]
  approvedGroupCount: number
  pendingGroupCount: number
}

export type AdminPlatformRoleDto = {
  id: number
  code: 'user' | 'admin' | 'superadmin' | string
  name: LocalizedText
  level: number
  permissions: string[]
  availablePermissions: Array<{ code: string; name: LocalizedText }>
  canEditPermissions: boolean
  isSystem: boolean
  canDelete: boolean
  assignedMemberCount: number
}

export type CreatePlatformRolePayload = {
  code: string
  nameEn: string
  nameZh: string
  permissionCodes: string[]
}

export type AdminPageReviewDto = {
  id: string
  ownerGroupId: string
  ownerGroupName: LocalizedText | null
  createdByMemberId: string
  creatorDisplayName: string | null
  title: LocalizedText
  description: LocalizedText | null
  tagsJson: string
  titleDisplayStyle: string
  visibility: 'draft' | 'group' | 'public' | string
  reviewStatus: 'pending' | 'approved' | 'returned'
  accessName: LocalizedText | null
  returnReason: string | null
  reviewedUtc: string | null
  updatedUtc: string
}

export type PagePublicationReviewActionDto = {
  ok: boolean
  pageId: string
  ownerGroupId: string
  page?: PageSummaryDto | null
}

export type ApprovePagePublicationReviewPayload = {
  accessName: LocalizedText
}

export type ReturnPagePublicationReviewPayload = {
  reason: string
}

export type AuditLogDto = {
  id: string
  actorMemberId: string | null
  actorDisplayName: string | null
  action: string
  entityType: string
  entityId: string | null
  groupId: string | null
  eventId: string | null
  targetMemberId: string | null
  targetDisplayName: string | null
  beforeJson: string | null
  afterJson: string | null
  metadataJson: string | null
  occurredUtc: string
}

export type AdminNotificationDto = {
  id: string
  recipientMemberId: string
  recipientDisplayName: string | null
  createdByMemberId: string
  createdByDisplayName: string | null
  groupId: string | null
  groupNameJson: string | null
  eventId: string | null
  eventTitleEn: string | null
  eventTitleZh: string | null
  occurredUtc: string
  actionType: string
  actionDataJson: string
  responseDataJson: string | null
  readUtc: string | null
  repliedUtc: string | null
  createdUtc: string
  updatedUtc: string
}

export type VisitContactRequestStatus = 'new' | 'followUp' | 'contacted'

export type VisitContactRequestDto = {
  id: string
  displayName: string
  email: string | null
  phone: string | null
  preferredLanguage: string | null
  message: string | null
  sourcePage: string | null
  status: VisitContactRequestStatus | string
  submittedUtc: string
  handledUtc: string | null
  handledByMemberId: string | null
  handledByDisplayName: string | null
  createdUtc: string
  updatedUtc: string
}

export type AdminGroupOptionDto = {
  id: string
  nameJson: string
  isChurch: boolean
  isClosed: boolean
  parentGroupId: string | null
}

export type AdminPagedResultDto<T> = {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export type AdminSendMessagePayload = {
  scope: 'platform' | 'group' | 'member' | 'role'
  recipientMemberId?: string | null
  groupId?: string | null
  roleCodes?: string[] | null
  actionType: string
  titleEn: string
  titleZh: string
  bodyEn: string
  bodyZh: string
}

export type AdminSelfDiagnosticDto = {
  currentMemberId: string
  displayName: string | null
  isRegistered: boolean
  legacyIsAdmin: boolean
  platformRole: 'user' | 'admin' | 'superadmin' | string
  platformRoles: string[]
  permissions: string[]
  platformRoleLevel: number
  canAccessAdmin: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const normalizeAdminPagedResult = <T>(payload: unknown): AdminPagedResultDto<T> => {
  const source = isRecord(payload) && isRecord(payload.data) ? payload.data : payload
  if (!isRecord(source)) {
    return { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 }
  }

  return {
    items: (Array.isArray(source.items) ? source.items : Array.isArray(source.Items) ? source.Items : []) as T[],
    totalCount: readNumber(source.totalCount ?? source.TotalCount, 0),
    page: readNumber(source.page ?? source.Page, 1),
    pageSize: readNumber(source.pageSize ?? source.PageSize, 25),
    totalPages: readNumber(source.totalPages ?? source.TotalPages, 0),
  }
}

const normalizeAdminPageReview = (page: AdminPageReviewDto): AdminPageReviewDto => ({
  ...page,
  visibility: normalizePageVisibility(page.visibility),
  reviewStatus: normalizeAdminPageReviewStatus(page.reviewStatus),
  accessName: page.accessName ? toLocalizedText(page.accessName) : null,
  title: toLocalizedText(page.title),
  description: page.description ? toLocalizedText(page.description) : page.description,
  ownerGroupName: page.ownerGroupName ? toLocalizedText(page.ownerGroupName) : null,
})

const normalizeAdminPageReviewStatus = (value: unknown): AdminPageReviewDto['reviewStatus'] => {
  if (typeof value === 'number') {
    return value === 1 ? 'approved' : value === 2 ? 'returned' : 'pending'
  }

  if (typeof value === 'string') {
    const normalized = value.toLowerCase()
    if (normalized === 'approved' || normalized === 'returned') {
      return normalized
    }
    if (normalized === 'rejected') return 'returned'
  }

  return 'pending'
}

const toQuery = (params: Record<string, string | number | boolean | null | undefined>) => {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value))
    }
  })
  const text = query.toString()
  return text ? `?${text}` : ''
}

export const groupService = {
  async getChurch() {
    const { data } = await http.get<GroupDto>('/api/groups/church')
    return normalizeGroup(data)
  },

  async getGroup(groupId: string) {
    const { data } = await http.get<GroupDto>(`/api/groups/${groupId}`)
    return normalizeGroup(data)
  },

  async getVisibleGroups() {
    const { data } = await http.get<GroupSummaryDto[]>('/api/groups/visible')
    return data.map(normalizeGroup)
  },

  async getSubgroups(groupId: string) {
    const data = await conditionalGet<GroupSummaryDto[]>({
      queryKey: subgroupsQueryKey(groupId),
      path: `/api/groups/${groupId}/subgroups`,
    })
    return data.map(normalizeGroup)
  },

  async getGroupPages(groupId: string) {
    const { data } = await http.get<PageSummaryDto[]>(`/api/groups/${groupId}/pages`)
    return data.map(normalizePageSummary)
  },

  async getGroupMemberships(groupId: string, options?: { includeLineCandidates?: boolean }) {
    const query = options?.includeLineCandidates ? '?includeLineCandidates=true' : ''
    const { data } = await http.get<Array<Omit<GroupMembershipDto, 'groupId'> & { memberId: string }>>(
      `/api/groups/${groupId}/memberships${query}`,
    )
    return data.map(normalizeGroupMembership)
  },

  async requestJoin(groupId: string) {
    const { data } = await http.post<{ status: string }>(`/api/groups/${groupId}/join-request`)
    return { ...data, status: normalizeMembershipStatus(data.status) }
  },

  async createSubgroup(groupId: string, payload: CreateSubgroupPayload) {
    const { data } = await http.post<GroupSummaryDto>(`/api/groups/${groupId}/subgroups`, payload)
    return normalizeGroup(data)
  },

  async claimSubgroupCoLeader(groupId: string, subgroupId: string) {
    await http.post(`/api/groups/${groupId}/subgroups/${subgroupId}/claim-coleader`)
  },

  async updateGroup(groupId: string, payload: UpdateGroupPayload) {
    const { data } = await http.put<GroupDto>(`/api/groups/${groupId}`, payload)
    return normalizeGroup(data)
  },

  async updateSubgroup(_subgroupId: string, _payload: CreateSubgroupPayload) {
    // TODO: backend endpoint is not available yet for subgroup update.
    throw new Error('Subgroup update endpoint is not implemented on the backend.')
  },

  async deleteSubgroup(subgroupId: string) {
    await http.post(`/api/groups/${subgroupId}/close`)
  },

  async closeGroup(groupId: string) {
    await http.post(`/api/groups/${groupId}/close`)
  },

  async inviteMember(groupId: string, payload: InviteMemberPayload) {
    await http.post(`/api/groups/${groupId}/invite`, payload)
  },

  async inviteMemberById(groupId: string, targetMemberId: string) {
    await http.post(`/api/groups/${groupId}/invite-by-id`, { targetMemberId })
  },

  async getInviteCandidates(groupId: string): Promise<MemberSummaryDto[]> {
    const { data } = await http.get<MemberSummaryDto[]>(`/api/groups/${groupId}/invite-candidates`)
    return data.map((member) => ({
      ...member,
      membershipStatus: member.membershipStatus ? normalizeMembershipStatus(member.membershipStatus) : null,
    }))
  },

  async getMembers(): Promise<MemberSummaryDto[]> {
    const { data } = await http.get<MemberSummaryDto[]>('/api/members')
    return data
  },

  async acceptInvite(groupId: string) {
    await http.post(`/api/groups/${groupId}/invite/accept`)
  },

  async declineInvite(groupId: string) {
    await http.post(`/api/groups/${groupId}/invite/decline`)
  },

  async approveMember(groupId: string, payload: MemberTargetPayload) {
    await http.post(`/api/groups/${groupId}/approve`, payload)
  },

  async rejectMember(groupId: string, payload: MemberTargetPayload) {
    await http.post(`/api/groups/${groupId}/reject`, payload)
  },

  async setCoLeader(groupId: string, payload: SetCoLeaderPayload) {
    await http.post(`/api/groups/${groupId}/set-coleader`, payload)
  },

  async transferLeadership(groupId: string, payload: MemberTargetPayload) {
    await http.post(`/api/groups/${groupId}/transfer-leadership`, payload)
  },

  async kickMember(groupId: string, payload: MemberTargetPayload) {
    await http.post(`/api/groups/${groupId}/kick`, payload)
  },

  async syncSermons() {
    const { data } = await http.post<{ message?: string }>('/api/admin/sermons/sync')
    await removeCachedRecord(sermonsQueryKey)
    await queryClient.invalidateQueries({ queryKey: sermonsQueryKey })
    return data
  },

  async getAdminPlatformRoles() {
    const { data } = await http.get<AdminPlatformRoleDto[]>('/api/admin/platform-roles')
    return data
  },

  async createPlatformRole(payload: CreatePlatformRolePayload) {
    const { data } = await http.post<AdminPlatformRoleDto>('/api/admin/platform-roles', payload)
    return data
  },

  async getAdminSelfDiagnostic() {
    const { data } = await http.get<AdminSelfDiagnosticDto>('/api/admin/self-diagnostic')
    return data
  },

  async getAdminGroups(params: { search?: string; page?: number; pageSize?: number } = {}) {
    const { data } = await http.get<unknown>(`/api/admin/groups${toQuery(params)}`)
    return normalizeAdminPagedResult<AdminGroupOptionDto>(data)
  },

  async getPageReviewCandidates() {
    const { data } = await http.get<AdminPageReviewDto[]>('/api/admin/pages/review-candidates')
    return data.map(normalizeAdminPageReview)
  },

  async approvePagePublicationReview(pageId: string, payload: ApprovePagePublicationReviewPayload) {
    const { data } = await http.post<PagePublicationReviewActionDto>(`/api/admin/pages/${pageId}/publication-review/approve`, payload)
    return data
  },

  async returnPagePublicationReview(pageId: string, payload: ReturnPagePublicationReviewPayload) {
    const { data } = await http.post<PagePublicationReviewActionDto>(`/api/admin/pages/${pageId}/publication-review/return`, payload)
    return data
  },

  async getAdminMembers(params: { search?: string; role?: string; isRegistered?: boolean | null; page?: number; pageSize?: number } = {}) {
    const { data } = await http.get<unknown>(`/api/admin/members${toQuery(params)}`)
    return normalizeAdminPagedResult<AdminMemberDto>(data)
  },

  async setMemberPlatformRoles(memberId: string, roleCodes: string[]) {
    const { data } = await http.put<AdminMemberDto>(`/api/admin/members/${memberId}/platform-role`, { roleCodes })
    return data
  },

  async updatePlatformRolePermissions(roleId: number, permissionCodes: string[]) {
    const { data } = await http.put<AdminPlatformRoleDto>(`/api/admin/platform-roles/${roleId}/permissions`, { permissionCodes })
    return data
  },

  async deletePlatformRole(roleId: number) {
    await http.delete(`/api/admin/platform-roles/${roleId}`)
  },

  async getAuditLogs(params: { search?: string; action?: string; entityType?: string; fromUtc?: string; toUtc?: string; page?: number; pageSize?: number } = {}) {
    const { data } = await http.get<unknown>(`/api/admin/audit-logs${toQuery(params)}`)
    return normalizeAdminPagedResult<AuditLogDto>(data)
  },

  async getAdminMessages(params: { search?: string; actionType?: string; status?: string; page?: number; pageSize?: number } = {}) {
    const { data } = await http.get<unknown>(`/api/admin/messages${toQuery(params)}`)
    return normalizeAdminPagedResult<AdminNotificationDto>(data)
  },

  async getVisitContactRequests(params: { search?: string; status?: string; page?: number; pageSize?: number } = {}) {
    const { data } = await http.get<unknown>(`/api/admin/visit-contact-requests${toQuery(params)}`)
    return normalizeAdminPagedResult<VisitContactRequestDto>(data)
  },

  async updateVisitContactRequestStatus(requestId: string, status: VisitContactRequestStatus) {
    const { data } = await http.put<VisitContactRequestDto>(`/api/admin/visit-contact-requests/${requestId}/status`, { status })
    return data
  },

  async sendAdminMessage(payload: AdminSendMessagePayload) {
    const { data } = await http.post<{ createdCount: number }>('/api/admin/messages', payload)
    return data
  },

  async refreshCloudflareCache(groupId: string) {
    const { data } = await http.post<{ message?: string }>(`/api/admin/groups/${groupId}/cloudflare-cache/refresh`)
    return data
  },
}
