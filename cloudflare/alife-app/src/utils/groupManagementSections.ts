export type ManageSection =
  | 'announcements'
  | 'applications'
  | 'contacts'
  | 'members'
  | 'events'
  | 'albums'
  | 'pages'
  | 'subgroups'
  | 'group'

const manageSectionKeys: ManageSection[] = [
  'members',
  'applications',
  'contacts',
  'subgroups',
  'events',
  'announcements',
  'albums',
  'pages',
  'group',
]

export const normalizeManageSection = (value: string | null): ManageSection =>
  manageSectionKeys.includes(value as ManageSection) ? value as ManageSection : 'group'

export const resolveManageSection = (
  value: string | null,
  visibleSections?: readonly ManageSection[],
): ManageSection => {
  const requestedSection = normalizeManageSection(value)

  if (!visibleSections?.length || visibleSections.includes(requestedSection)) {
    return requestedSection
  }

  return visibleSections[0] ?? 'group'
}
