export const churchManagementAdminPermissions = [
  'admin.members.view',
  'admin.roles.managePermissions',
  'admin.messages.manage',
  'admin.visitRequests.receive',
  'admin.events.manageTemplates',
] as const

export const churchManagementSections = [
  'dashboard',
  'group',
  'members',
  'contacts',
  'subgroups',
] as const

export type ChurchManagementSection = typeof churchManagementSections[number]

const churchManagementSectionSet = new Set<string>(churchManagementSections)

export const normalizeChurchManagementSection = (
  value?: string | null,
): ChurchManagementSection => churchManagementSectionSet.has(value ?? '')
  ? value as ChurchManagementSection
  : 'dashboard'

type ChurchManagementAccessArgs = {
  churchGroupId?: string | null
  canManageGroup: (groupId: string) => boolean
  hasAdminPermission: (permissionCode: string) => boolean
}

export const hasChurchManagementAdminPermission = (
  hasAdminPermission: ChurchManagementAccessArgs['hasAdminPermission'],
) => churchManagementAdminPermissions.some((permission) => hasAdminPermission(permission))

export const canAccessChurchManagement = ({
  churchGroupId,
  canManageGroup,
  hasAdminPermission,
}: ChurchManagementAccessArgs) => {
  const normalizedChurchGroupId = churchGroupId?.trim() ?? ''
  return hasChurchManagementAdminPermission(hasAdminPermission) ||
    Boolean(normalizedChurchGroupId && canManageGroup(normalizedChurchGroupId))
}
