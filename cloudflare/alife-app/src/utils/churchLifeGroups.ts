import type { ChurchLifeGroup } from '../services/churchLifeService'

const localizeGroupName = (name: Record<string, string> | undefined, language: string) =>
  name?.[language === 'zh' ? 'zh' : language] || name?.en || name?.zh || Object.values(name ?? {})[0] || ''

export const churchGroupPath = (
  groupId: string | null | undefined,
  groups: ChurchLifeGroup[],
  language: string,
) => {
  if (!groupId) return ''
  const byId = new Map(groups.map((group) => [group.id, group]))
  const group = byId.get(groupId)
  if (!group) return ''
  return group.pathIds
    .map((id) => localizeGroupName(byId.get(id)?.name, language))
    .filter(Boolean)
    .join(' / ')
}

export const updateChurchLifeOwnerFilter = (search: URLSearchParams, ownerGroupId: string) => {
  const next = new URLSearchParams(search)
  if (ownerGroupId) next.set('ownerGroupId', ownerGroupId)
  else next.delete('ownerGroupId')
  next.delete('page')
  return next
}
