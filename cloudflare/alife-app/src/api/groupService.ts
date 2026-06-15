import { groupService as groups } from '../services/groupService'
import { pageService, type PublishPageOptimizedPayload } from '../services/pageService'
import type { PageVisibility } from '../types'

// Backward compatibility adapter for existing imports under src/api.
export const groupService = {
  getGlobalPages: groups.getGlobalPages,
  getChurch: groups.getChurch,
  getGroupById: groups.getGroup,
  getGroup: groups.getGroup,
  getSubgroups: groups.getSubgroups,
  getGroupPages: groups.getGroupPages,
  getGroupMemberships: groups.getGroupMemberships,
  joinGroup: groups.requestJoin,
  requestJoin: groups.requestJoin,
  createSubgroup: groups.createSubgroup,
  claimSubgroupCoLeader: groups.claimSubgroupCoLeader,
  updateSubgroup: groups.updateSubgroup,
  deleteSubgroup: groups.deleteSubgroup,
  closeGroup: groups.closeGroup,
  inviteMember: (groupId: string, payload: string | { targetPhoneE164: string }) =>
    groups.inviteMember(groupId, typeof payload === 'string' ? { targetPhoneE164: payload } : payload),
  getInviteCandidates: groups.getInviteCandidates,
  acceptInvite: groups.acceptInvite,
  declineInvite: groups.declineInvite,
  approve: groups.approveMember,
  approveMember: groups.approveMember,
  reject: groups.rejectMember,
  rejectMember: groups.rejectMember,
  setCoLeader: groups.setCoLeader,
  kick: groups.kickMember,
  kickMember: groups.kickMember,
  createGroupPage: pageService.createGroupPage,
  updatePage: pageService.updatePage,
  publishPage: (pageId: string, visibility: PageVisibility = 'group') =>
    pageService.publishPage(pageId, { visibility }),
  publishPageOptimized: (pageId: string, payload: PublishPageOptimizedPayload) => pageService.publishPageOptimized(pageId, payload),
  deletePage: pageService.deletePage,
  getPageById: (pageId: string) => pageService.getPageById(pageId),
  syncSermons: groups.syncSermons,
  refreshCloudflareCache: groups.refreshCloudflareCache,
}
