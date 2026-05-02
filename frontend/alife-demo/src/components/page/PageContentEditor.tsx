import PageMetaForm from '../page-editor/PageMetaForm'
import SectionListEditor from '../page-editor/SectionListEditor'
import type { PageEditModel, PageEditorValidation, SectionEditModel } from '../../types/page-editor'

type Props = {
  model: PageEditModel
  canEdit: boolean
  canEditVisibility: boolean
  isCreateMode?: boolean
  message?: string
  validation?: PageEditorValidation
  onChange: (value: PageEditModel) => void
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
  styleJson: { layout: 'featured' },
})

export const normalizePageSections = (sections: SectionEditModel[]) =>
  sections.map((section, index) => ({
    ...section,
    order: index,
  }))

export const validatePageContent = (model: PageEditModel): PageEditorValidation => {
  const title = model.title.trim()
  const sectionTypeErrors = model.sections.map((section) => (section.type ? '' : 'Section type is required.'))

  return {
    title: title ? undefined : 'Page title is required.',
    sectionTypeErrors,
  }
}

const PageContentEditor = ({
  model,
  canEdit,
  isCreateMode = false,
  validation = validatePageContent(model),
  onChange,
}: Props) => {
  const addSection = () => {
    onChange({
      ...model,
      sections: normalizePageSections([...model.sections, createEmptyPageSection()]),
    })
  }

  const updateSection = (index: number, section: SectionEditModel) => {
    const sections = [...model.sections]
    sections[index] = section
    onChange({ ...model, sections: normalizePageSections(sections) })
  }

  const removeSection = (index: number) => {
    const sections = [...model.sections]
    sections.splice(index, 1)
    onChange({ ...model, sections: normalizePageSections(sections) })
  }

  const moveSection = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= model.sections.length) {
      return
    }

    const sections = [...model.sections]
    const [item] = sections.splice(index, 1)
    if (!item) {
      return
    }

    sections.splice(nextIndex, 0, item)
    onChange({ ...model, sections: normalizePageSections(sections) })
  }

  return (
    <>
      <div className="w-full space-y-4">
        <PageMetaForm
          model={model}
          canEdit={canEdit}
          isCreateMode={isCreateMode}
          titleError={validation.title}
          onChange={onChange}
        />

        <SectionListEditor
          sections={model.sections}
          canEdit={canEdit}
          sectionTypeErrors={validation.sectionTypeErrors}
          onAdd={addSection}
          onUpdate={({ index, section }) => updateSection(index, section)}
          onRemove={removeSection}
          onMoveUp={(index) => moveSection(index, -1)}
          onMoveDown={(index) => moveSection(index, 1)}
        />
      </div>
    </>
  )
}

export default PageContentEditor
