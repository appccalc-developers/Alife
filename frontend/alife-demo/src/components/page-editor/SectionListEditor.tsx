import AppActionButton from '../layout/AppActionButton'
import AppEmptyState from '../layout/AppEmptyState'
import AppSectionCard from '../layout/AppSectionCard'
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
}

const SectionListEditor = ({ sections, canEdit, sectionTypeErrors, onAdd, onUpdate, onRemove, onMoveUp, onMoveDown }: Props) => (
  <AppSectionCard title="Section List" subtitle="Compose your page with modular content blocks.">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-slate-600">Reorder sections with move controls and configure each section below.</p>
      <AppActionButton variant="primary" disabled={!canEdit} onClick={onAdd}>Add Section</AppActionButton>
    </div>

    {sections.length === 0 ? (
      <AppEmptyState
        title="No sections yet"
        description="Add a section to start building this page."
        actionLabel="Add Section"
        onAction={onAdd}
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
            onUpdate={(nextSection) => onUpdate({ index, section: nextSection })}
            onRemove={() => onRemove(index)}
            onMoveUp={() => onMoveUp(index)}
            onMoveDown={() => onMoveDown(index)}
          />
        ))}
      </div>
    )}
  </AppSectionCard>
)

export default SectionListEditor
