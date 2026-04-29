import type { GroupPageDto } from '../../types/group'
import type { PageEditModel, SectionEditModel } from '../../types/page-editor'

export const createEmptySection = (): SectionEditModel => ({
  order: 0,
  type: 'RichText',
  contentJson: { text: '' },
  styleJson: {},
})

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

export const parseTags = (tagsJson?: string): string[] => {
  if (!tagsJson) {
    return []
  }

  try {
    const parsed = JSON.parse(tagsJson) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.map((item) => String(item)).filter(Boolean)
  } catch {
    return []
  }
}

export const normalizeSort = (sections: SectionEditModel[]) =>
  sections.map((section, index) => ({
    ...section,
    order: index,
  }))

export const mapPageToEditModel = (page: GroupPageDto, groupId: string): PageEditModel => ({
  id: page.id,
  groupId,
  createdByMemberId: page.createdByMemberId,
  slug: page.slug,
  title: page.title,
  description: page.description ?? '',
  tags: parseTags(page.tagsJson),
  titleDisplayStyle: page.titleDisplayStyle ?? 'Default',
  language: page.language,
  visibility: page.visibility,
  sections: [],
})
