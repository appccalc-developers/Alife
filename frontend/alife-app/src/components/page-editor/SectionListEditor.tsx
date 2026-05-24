import { useEffect, useState } from 'react'
import AppActionButton from '../layout/AppActionButton'
import AppEmptyState from '../layout/AppEmptyState'
import SectionCardEditor from './SectionCardEditor'
import type { SectionEditModel } from '../../types/page-editor'

type Props = {
  sections: SectionEditModel[]
  canEdit: boolean
  sectionTypeErrors: string[]
  onAdd: () => void
  onUpdate: (payload: { index: number; section: SectionEditModel }) => void
  onRemove: (index: number) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  contextGroupId?: string
}

const SectionListEditor = ({ sections, canEdit, sectionTypeErrors, onAdd, onUpdate, onRemove, onMoveUp, onMoveDown, contextGroupId }: Props) => {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (sections.length === 0) {
      setActiveIndex(0)
      return
    }
    if (activeIndex > sections.length - 1) {
      setActiveIndex(sections.length - 1)
    }
  }, [activeIndex, sections.length])

  const addAndSelect = () => {
    onAdd()
    setActiveIndex(sections.length)
  }

  const removeAndSelect = (index: number) => {
    onRemove(index)
    setActiveIndex(Math.max(0, Math.min(index, sections.length - 2)))
  }

  const moveAndSelect = (index: number, direction: -1 | 1) => {
    if (index + direction < 0 || index + direction >= sections.length) {
      return
    }
    direction === -1 ? onMoveUp(index) : onMoveDown(index)
    setActiveIndex(index + direction)
  }

  return (
    <section className="space-y-3">
      {sections.length === 0 ? (
        <AppEmptyState
          title="No sections yet"
          description="Add a section to start building this page."
          actionLabel="Add Section"
          onAction={addAndSelect}
        />
      ) : (
        <div className="space-y-3">
          {sections.map((section, index) => (
            <SectionCardEditor
              key={`${section.id ?? 'new'}-${index}`}
              section={section}
              index={index}
              total={sections.length}
              canEdit={canEdit}
              typeError={sectionTypeErrors[index]}
              contextGroupId={contextGroupId}
              isActive={activeIndex === index}
              onSelect={() => setActiveIndex(index)}
              onUpdate={(nextSection) => onUpdate({ index, section: nextSection })}
              onRemove={() => removeAndSelect(index)}
              onMoveUp={() => moveAndSelect(index, -1)}
              onMoveDown={() => moveAndSelect(index, 1)}
            />
          ))}
        </div>
      )}
      <br />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">Only the selected section shows editing controls.</p>
        <AppActionButton variant="primary" disabled={!canEdit} onClick={addAndSelect}>
          Add Section
        </AppActionButton>
      </div>
    </section>
  )
}

export default SectionListEditor
