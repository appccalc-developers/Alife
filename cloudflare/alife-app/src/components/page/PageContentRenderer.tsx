import SectionBlock from '../page-sections/SectionBlock'
import type { GroupPageDto } from '../../types/group'
import type { PageEditModel, PageEditorValidation, SectionEditModel, SectionType } from '../../types/page-editor'
import type { PageLinkItem } from '../page-sections/types'
import SectionListEditor from '../page-editor/SectionListEditor'
import { translateUi, useUiText } from '../../i18n/uiText'
import { useAuthStore } from '../../stores/auth'
import { localizeText } from '../../utils/localizedText'
import { DEFAULT_HERO_ASPECT_RATIO, DEFAULT_HERO_IMAGE, EditableText } from '../page-sections/sectionUtils'

type GroupLinkItem = {
  id: string
  name: string
  accessType: string
}

type Props = {
  page: GroupPageDto | PageEditModel
  sections: SectionEditModel[]
  subgroupItems: GroupLinkItem[]
  groupPageItems: PageLinkItem[]
  editing?: boolean
  canEdit?: boolean
  validation?: PageEditorValidation
  contextGroupId?: string
  showHeader?: boolean
  framed?: boolean
  message?: string
  onPageChange?: (page: PageEditModel) => void
  onSectionsChange?: (sections: SectionEditModel[]) => void
  onEditPage?: (pageId: string, groupId: string) => void
}

const createDefaultSectionHeader = () => ({
  title: { en: '', zh: '' },
  subtitle: { en: '', zh: '' },
  align: 'center' as const,
  scale: 'normal' as const,
  tone: 'default' as const,
})

export const createEmptyPageSection = (type: SectionType = 'Hero'): SectionEditModel => {
  if (type === 'RichText') {
    return {
      order: 0,
      type: 'RichText',
      contentJson: {
        header: createDefaultSectionHeader(),
        spacing: 'normal',
        title: '',
        subtitle: '',
        text: '',
      },
      styleJson: {},
    }
  }

  if (type === 'Spotlight') {
    return {
      order: 0,
      type: 'Spotlight',
      contentJson: {
        header: createDefaultSectionHeader(),
        spacing: 'normal',
        spotlight: {
          mode: 'manual',
          source: 'sermons',
          preset: 'latest',
        },
        media: {
          type: 'image',
          url: DEFAULT_HERO_IMAGE,
          position: 'left',
        },
        imageUrl: DEFAULT_HERO_IMAGE,
        backgroundImage: DEFAULT_HERO_IMAGE,
        backgroundImageUrl: DEFAULT_HERO_IMAGE,
        title: '',
        headline: '',
        subtitle: '',
        subheadline: '',
        centerText: '',
        body: '',
        text: '',
        youtubeUrl: '',
        linkLabel: '',
        linkText: '',
        ctaLabel: '',
        linkUrl: '',
        ctaUrl: '',
        href: '',
      },
      styleJson: {
        layout: 'spotlight',
        mediaPosition: 'left',
        imagePosition: 'left',
      },
    }
  }

  if (type === 'ListView') {
    return {
      order: 0,
      type: 'ListView',
      contentJson: {
        header: createDefaultSectionHeader(),
        spacing: 'normal',
        source: 'sermons',
        preset: 'latest',
        layout: 'grid',
        sourceType: 'sermons',
        sourceScope: 'global',
        limit: 10,
        sortBy: 'date',
        sortDirection: 'desc',
      },
      styleJson: {},
    }
  }

  return {
    order: 0,
    type: 'Hero',
    contentJson: {
      header: createDefaultSectionHeader(),
      spacing: 'normal',
      backgroundImage: DEFAULT_HERO_IMAGE,
      backgroundImageUrl: DEFAULT_HERO_IMAGE,
      title: '',
      headline: '',
      centerText: '',
      body: '',
      subtitle: '',
      subheadline: '',
      linkLabel: '',
      linkText: '',
      ctaLabel: '',
      linkUrl: '',
      ctaUrl: '',
      href: '',
    },
    styleJson: { layout: 'featured', aspectRatio: DEFAULT_HERO_ASPECT_RATIO },
  }
}

export const normalizePageSections = (items: SectionEditModel[]) =>
  items.map((section, index) => ({
    ...section,
    order: index,
  }))

export const validatePageContent = (model: PageEditModel, language = 'en'): PageEditorValidation => ({
  sectionTypeErrors: model.sections.map((section) => (section.type ? '' : translateUi(language, 'sectionTypeRequired'))),
})

const PageContentRenderer = ({
  page,
  sections,
  groupPageItems,
  editing = false,
  canEdit = false,
  validation = { sectionTypeErrors: [] },
  contextGroupId,
  showHeader = true,
  framed = true,
  message,
  onSectionsChange,
  onEditPage,
}: Props) => {
  const auth = useAuthStore()
  const t = useUiText()
  const pageTitle = localizeText(page.title, auth.language)
  const pageDescription = localizeText(page.description, auth.language)

  const updateSections = (nextSections: SectionEditModel[]) => onSectionsChange?.(normalizePageSections(nextSections))

  const addSection = (type: SectionType) => updateSections([...sections, createEmptyPageSection(type)])

  const updateSection = (index: number, section: SectionEditModel) => {
    const nextSections = [...sections]
    nextSections[index] = section
    updateSections(nextSections)
  }

  const removeSection = (index: number) => {
    const nextSections = [...sections]
    nextSections.splice(index, 1)
    updateSections(nextSections)
  }

  const moveSection = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= sections.length) {
      return
    }

    const nextSections = [...sections]
    const [item] = nextSections.splice(index, 1)
    if (!item) {
      return
    }

    nextSections.splice(nextIndex, 0, item)
    updateSections(nextSections)
  }

  return (
    <article className={framed ? 'space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5' : 'space-y-4'}>
      {showHeader ? (
        <header className="space-y-2 border-b border-slate-200 pb-3">
          <EditableText
            as="h1"
            value={pageTitle}
            fallback={t('untitledPage')}
            className="text-2xl font-bold text-slate-900 sm:text-3xl"
          />
          <EditableText
            as="p"
            multiline
            value={pageDescription}
            fallback={t('pageDescriptionEmpty')}
            className="text-sm text-slate-600"
          />
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{t('visibilityLabel', { visibility: page.visibility })}</span>
          </div>
          {message ? <p className="rounded-lg border border-blue-100 bg-blue-50 p-2 text-sm text-blue-700">{message}</p> : null}
        </header>
      ) : null}

      {editing ? (
        <SectionListEditor
          sections={sections}
          canEdit={canEdit}
          sectionTypeErrors={validation.sectionTypeErrors}
          contextGroupId={contextGroupId}
          onAdd={addSection}
          onUpdate={({ index, section }) => updateSection(index, section)}
          onRemove={removeSection}
          onMoveUp={(index) => moveSection(index, -1)}
          onMoveDown={(index) => moveSection(index, 1)}
        />
      ) : (
        <div className="space-y-4">
          {sections.map((section) => (
            <SectionBlock
              key={section.id || `${section.order}-${section.type}`}
              section={section}
              mode="render"
              page={page as GroupPageDto}
              groupPageItems={groupPageItems}
            />
          ))}

          {sections.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">{t('noSectionsYet')}</div>
          ) : null}
        </div>
      )}

      {'ownerGroupId' in page && page.ownerGroupId && onEditPage ? (
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded border border-blue-300 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
            type="button"
            onClick={() => onEditPage(page.id, page.ownerGroupId as string)}
          >
            {t('editPage')}
          </button>
        </div>
      ) : null}
    </article>
  )
}

export default PageContentRenderer
