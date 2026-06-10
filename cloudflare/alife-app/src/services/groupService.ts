import { http } from './http'
import type { GroupDto, GroupMembershipDto, GroupSummaryDto, LocalizedText, PageSummaryDto } from '../types'
import { normalizeGroup, normalizeGroupMembership, normalizeMembershipStatus, normalizePageSummary } from '../utils/apiEnums'

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
}

export type SetCoLeaderPayload = {
  memberId: string
  isCoLeader: boolean
}

export const groupService = {
  async getGlobalPages() {
    const { data } = await http.get<PageSummaryDto[]>('/api/pages/global')
    return data.map(normalizePageSummary)
  },

  async getChurch() {
    const { data } = await http.get<GroupDto>('/api/groups/church')
    return normalizeGroup(data)
  },

  async getGroup(groupId: string) {
    const { data } = await http.get<GroupDto>(`/api/groups/${groupId}`)
    return normalizeGroup(data)
  },

  async getSubgroups(groupId: string) {
    const { data } = await http.get<GroupSummaryDto[]>(`/api/groups/${groupId}/subgroups`)
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

  async updateGroup(groupId: string, payload: UpdateGroupPayload) {
    const { data } = await http.put<GroupDto>(`/api/groups/${groupId}`, payload)
    return normalizeGroup(data)
  },

  async updateSubgroup(_subgroupId: string, _payload: CreateSubgroupPayload) {
    // TODO: backend endpoint is not available yet for subgroup update.
    throw new Error('Subgroup update endpoint is not implemented on the backend.')
  },

  async deleteSubgroup(_subgroupId: string) {
    // TODO: backend endpoint is not available yet for subgroup deletion.
    throw new Error('Subgroup delete endpoint is not implemented on the backend.')
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
    return data
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

  async kickMember(groupId: string, payload: MemberTargetPayload) {
    await http.post(`/api/groups/${groupId}/kick`, payload)
  },

  async syncSermons() {
    const { data } = await http.post<{ message?: string }>('/api/admin/sermons/sync')
    return data
  },

  async refreshCloudflareCache(groupId: string) {
    const { data } = await http.post<{ message?: string }>(`/api/admin/groups/${groupId}/cloudflare-cache/refresh`)
    return data
  },
}
