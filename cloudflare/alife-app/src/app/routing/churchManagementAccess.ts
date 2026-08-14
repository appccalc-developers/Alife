export const churchManagementAdminPermissions = [
  'admin.members.view',
  'admin.roles.managePermissions',
  'admin.messages.manage',
  'admin.visitRequests.receive',
] as const

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
