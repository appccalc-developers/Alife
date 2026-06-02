import SectionBlock from '../page-sections/SectionBlock'
import type { GroupPageDto } from '../../types/group'
import type { PageEditModel, PageEditorValidation, SectionEditModel } from '../../types/page-editor'
import type { PageLinkItem } from '../page-sections/types'
import SectionListEditor from '../page-editor/SectionListEditor'
import { translateUi, useUiText } from '../../i18n/uiText'
import { useAuthStore } from '../../stores/auth'
import { languageKey, localizeText } from '../../utils/localizedText'
import { DEFAULT_HERO_ASPECT_RATIO, EditableText } from '../page-sections/sectionUtils'

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

export const createEmptyPageSection = (): SectionEditModel => ({
  order: 0,
  type: 'Hero',
  contentJson: {
    backgroundImage: 'https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=1600&q=80',
    backgroundImageUrl: 'https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=1600&q=80',
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
})

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
  onPageChange,
  onSectionsChange,
  onEditPage,
}: Props) => {
  const auth = useAuthStore()
  const t = useUiText()
  const editablePage = editing && canEdit && onPageChange && 'groupId' in page
  const activeLanguageKey = languageKey(auth.language)
  const pageTitle = localizeText(page.title, auth.language)
  const pageDescription = localizeText(page.description, auth.language)
  const updateLocalizedPageField = (field: 'title' | 'description', value: string) => {
    if (!editablePage) {
      return
    }

    const editPage = page as PageEditModel
    onPageChange({
      ...editPage,
      [field]: {
        ...editPage[field],
        [activeLanguageKey]: value,
      },
    })
  }

  const updateSections = (nextSections: SectionEditModel[]) => onSectionsChange?.(normalizePageSections(nextSections))

  const addSection = () => updateSections([...sections, createEmptyPageSection()])

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
            disabled={!editablePage}
            className="text-2xl font-bold text-slate-900 sm:text-3xl"
            onChange={(value) => updateLocalizedPageField('title', value)}
          />
          <EditableText
            as="p"
            multiline
            value={pageDescription}
            fallback={t('pageDescriptionEmpty')}
            disabled={!editablePage}
            className="text-sm text-slate-600"
            onChange={(value) => updateLocalizedPageField('description', value)}
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
