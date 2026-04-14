import { groupService as groups } from '../services/groupService'
import { pageService } from '../services/pageService'
import { http } from '../services/http'
import type { PageSummaryDto, PageVisibility } from '../types'
import type { SectionEditModel } from '../types/page-editor'

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
  updateSubgroup: groups.updateSubgroup,
  deleteSubgroup: groups.deleteSubgroup,
  closeGroup: groups.closeGroup,
  inviteMember: (groupId: string, payload: string | { targetPhoneE164: string }) =>
    groups.inviteMember(groupId, typeof payload === 'string' ? { targetPhoneE164: payload } : payload),
  approve: groups.approveMember,
  approveMember: groups.approveMember,
  reject: groups.rejectMember,
  rejectMember: groups.rejectMember,
  setCoLeader: groups.setCoLeader,
  kick: groups.kickMember,
  kickMember: groups.kickMember,
  createGroupPage: pageService.createGroupPage,
  updatePage: pageService.updatePage,
  publishPage: (pageId: string, visibility: PageVisibility = 'VisibleToGroup') =>
    pageService.publishPage(pageId, { visibility }),
  deletePage: pageService.deletePage,
  getPageBySlug: async (slug: string, lang = 'en') => {
    const { data } = await http.get<PageSummaryDto>(`/api/pages/${slug}`, { params: { lang } })
    return data
  },
  getPageById: async (_pageId: string, _lang = 'en'): Promise<PageSummaryDto> => {
    // TODO: backend endpoint is not available yet for get page by id.
    throw new Error('Get page by id endpoint is not implemented on the backend.')
  },
  getPageSections: pageService.getPageSections,
  savePageSections: (pageId: string, sections: SectionEditModel[]) => pageService.savePageSections(pageId, sections),
  syncSermons: groups.syncSermons,
}
