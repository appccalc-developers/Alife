import type { SectionEditModel } from '../types/page-editor'
import { readText } from '../utils/pageSectionContent'

export type PageTemplateId = 'heroFeatured'

/** 从当前单一模版区块还原向导栏位；无法识别时返回 null（保留现有 sections，勿用默认草稿硬覆盖）。 */
export const deriveTemplateStateFromSections = (
  sections: SectionEditModel[],
): { templateId: PageTemplateId; draft: Record<string, string> } | null => {
  if (sections.length !== 1) {
    return null
  }

  const s = sections[0]
  if (!s) {
    return null
  }

  if (s.type === 'Hero') {
    return {
      templateId: 'heroFeatured',
      draft: {
        backgroundUrl: readText(s.contentJson, 'backgroundImage', 'backgroundImageUrl'),
        heroText: readText(s.contentJson, 'title', 'headline'),
        heroContent: readText(s.contentJson, 'centerText', 'body', 'subtitle', 'subheadline'),
        linkUrl: readText(s.contentJson, 'linkUrl', 'ctaUrl', 'href'),
        linkLabel: readText(s.contentJson, 'linkLabel', 'linkText', 'ctaLabel'),
      },
    }
  }

  return null
}

export type TemplateFieldDef = {
  key: string
  label: string
  placeholder?: string
  multiline?: boolean
}

export const DEFAULT_HERO_IMAGE =
  'https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=1600&q=80'

const orderSections = (sections: SectionEditModel[]): SectionEditModel[] =>
  sections.map((section, index) => ({ ...section, order: index }))

export type PageTemplateDefinition = {
  id: PageTemplateId
  name: string
  description: string
  previewGradient: string
  fields: TemplateFieldDef[]
  defaultDraft: Record<string, string>
  buildSections: (draft: Record<string, string>) => SectionEditModel[]
}

export const PAGE_TEMPLATES: PageTemplateDefinition[] = [
  {
    id: 'heroFeatured',
    name: 'Hero 模版',
    description: '一个背景图 + 文本 + 内容 + 底部超链接按钮。',
    previewGradient: 'from-indigo-600 to-violet-800',
    fields: [
      {
        key: 'backgroundUrl',
        label: '背景图 URL',
        placeholder: DEFAULT_HERO_IMAGE,
      },
      { key: 'heroText', label: '文本', placeholder: '请输入标题文本' },
      {
        key: 'heroContent',
        label: '内容',
        multiline: true,
        placeholder: '请输入主要内容',
      },
      { key: 'linkLabel', label: '按钮文字', placeholder: '了解更多' },
      { key: 'linkUrl', label: '按钮超链接 URL', placeholder: 'https://' },
    ],
    defaultDraft: {
      backgroundUrl: '',
      heroText: '',
      heroContent: '',
      linkUrl: '',
      linkLabel: '',
    },
    buildSections: (draft) => {
      const bg = (draft.backgroundUrl || '').trim() || DEFAULT_HERO_IMAGE
      return orderSections([
        {
          order: 0,
          type: 'Hero',
          contentJson: {
            backgroundImage: bg,
            backgroundImageUrl: bg,
            title: draft.heroText || '',
            headline: draft.heroText || '',
            centerText: draft.heroContent || '',
            body: draft.heroContent || '',
            subtitle: '',
            subheadline: '',
            linkUrl: (draft.linkUrl || '').trim(),
            ctaUrl: (draft.linkUrl || '').trim(),
            href: (draft.linkUrl || '').trim(),
            linkLabel: draft.linkLabel || '',
            linkText: draft.linkLabel || '',
            ctaLabel: draft.linkLabel || '',
          },
          styleJson: { layout: 'featured' },
        },
      ])
    },
  },
]
