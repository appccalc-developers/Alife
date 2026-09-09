export type ManageSection =
  | 'announcements'
  | 'applications'
  | 'contacts'
  | 'members'
  | 'events'
  | 'pages'
  | 'subgroups'
  | 'ministries'
  | 'group'

const manageSectionKeys: ManageSection[] = [
  'members',
  'applications',
  'contacts',
  'subgroups',
  'ministries',
  'events',
  'announcements',
  'pages',
  'group',
]

export const normalizeManageSection = (value: string | null): ManageSection =>
  manageSectionKeys.includes(value as ManageSection) ? value as ManageSection : 'group'

export const resolveManageSection = (
  value: string | null,
  visibleSections?: readonly ManageSection[],
  isChurch?: boolean,
): ManageSection => {
  const normalizedSection = normalizeManageSection(value)
  const requestedSection = normalizedSection === 'ministries' && isChurch === false ? 'subgroups' : normalizedSection

  if (!visibleSections?.length || visibleSections.includes(requestedSection)) {
    return requestedSection
  }

  return visibleSections[0] ?? 'group'
}
