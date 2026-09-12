export const systemManagementAdminPermissions = [
  'admin.access',
  'admin.roles.managePermissions',
  'admin.messages.manage',
  'admin.events.manageTemplates',
  'admin.events.managePackagePolicies',
  'admin.events.manageRamPolicies',
  'admin.files.view',
  'admin.auditLogs.view',
  'admin.sermons.sync',
] as const

export const churchManagementSections = [
  'dashboard',
  'group',
  'members',
  'contacts',
  'subgroups',
  'ministries',
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
}

export const hasSystemManagementAdminPermission = (
  hasAdminPermission: (permissionCode: string) => boolean,
) => systemManagementAdminPermissions.some((permission) => hasAdminPermission(permission))

export const canAccessChurchManagement = ({
  churchGroupId,
  canManageGroup,
}: ChurchManagementAccessArgs) => {
  const normalizedChurchGroupId = churchGroupId?.trim() ?? ''
  return Boolean(normalizedChurchGroupId && canManageGroup(normalizedChurchGroupId))
}
