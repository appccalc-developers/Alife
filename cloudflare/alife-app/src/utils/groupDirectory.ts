import type { GroupMembershipDto, GroupSummaryDto, GroupType, PageDetailDto } from '../types/models'

export const isGroupLifeVisible = (
  group: Pick<GroupSummaryDto, 'id' | 'isChurch' | 'isClosed'>,
  memberships: GroupMembershipDto[],
) => !group.isChurch && !group.isClosed &&
  !memberships.some(m => m.groupId === group.id && m.status === 'removed')

export const isDirectoryGroupType = (group: Pick<GroupSummaryDto, 'isChurch' | 'groupType'>, type: GroupType) =>
  !group.isChurch && (group.groupType ?? 'fellowship') === type

export const readGroupDisplayImage = (page: Pick<PageDetailDto, 'sections'>) => {
  for (const section of page.sections ?? []) {
    const content = section.contentJson ?? {}
    const media = content.media && typeof content.media === 'object' && !Array.isArray(content.media)
      ? content.media as Record<string, unknown> : null
    const candidate = content.backgroundImageUrl || content.backgroundImage || content.imageUrl || media?.url
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  return ''
}
