export type ManageSection =
  | 'announcements'
  | 'applications'
  | 'contacts'
  | 'members'
  | 'events'
  | 'pages'
  | 'subgroups'
  | 'ministries'
  | 'venues'
  | 'group'

const manageSectionKeys: ManageSection[] = [
  'members',
  'applications',
  'contacts',
  'subgroups',
  'ministries',
  'venues',
  'events',
  'announcements',
  'pages',
  'group',
]

export const churchManagementTabs = [
  'group',
  'venues',
  'members',
  'contacts',
  'subgroups',
  'ministries',
] as const satisfies readonly ManageSection[]

export const normalizeManageSection = (value: string | null): ManageSection =>
  manageSectionKeys.includes(value as ManageSection) ? value as ManageSection : 'group'

export const resolveManageSection = (
  value: string | null,
  visibleSections?: readonly ManageSection[],
  isChurch?: boolean,
): ManageSection => {
  const normalizedSection = normalizeManageSection(value)
  const requestedSection = normalizedSection === 'ministries' && isChurch === false ? 'subgroups' : normalizedSection

  if (requestedSection === 'venues' && !visibleSections?.includes('venues')) {
    return visibleSections?.[0] ?? 'group'
  }

  if (!visibleSections?.length || visibleSections.includes(requestedSection)) {
    return requestedSection
  }

  return visibleSections[0] ?? 'group'
}
