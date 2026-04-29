import PageMetaForm from './PageMetaForm'
import PageSettingsPanel from './PageSettingsPanel'
import SectionListEditor from './SectionListEditor'
import type { PageEditModel, SectionEditModel } from '../../types/page-editor'

type Props = {
  model: PageEditModel
  canEdit: boolean
  canEditVisibility: boolean
  canPublish: boolean
  canDelete: boolean
  canSaveDraft: boolean
  isCreateMode: boolean
  isBusy: boolean
  titleError?: string
  sectionTypeErrors: string[]
  message?: string
  onChange: (value: PageEditModel) => void
  onAdd: () => void
  onUpdate: (payload: { index: number; section: SectionEditModel }) => void
  onRemove: (index: number) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  onSaveDraft: () => void
  onPublish: () => void
  onDelete: () => void
  onCancel: () => void
}

const PageDrawerContent = ({
  model,
  canEdit,
  canEditVisibility,
  canPublish,
  canDelete,
  canSaveDraft,
  isCreateMode,
  isBusy,
  titleError,
  sectionTypeErrors,
  message,
  onChange,
  onAdd,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onSaveDraft,
  onPublish,
  onDelete,
  onCancel,
}: Props) => (
  <>
    <PageMetaForm
      model={model}
      canEdit={canEdit}
      isCreateMode={isCreateMode}
      titleError={titleError}
      onChange={onChange}
    />

    <SectionListEditor
      sections={model.sections}
      canEdit={canEdit}
      sectionTypeErrors={sectionTypeErrors}
      onAdd={onAdd}
      onUpdate={onUpdate}
      onRemove={onRemove}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
    />

    <PageSettingsPanel
      model={model}
      canEditVisibility={canEditVisibility}
      canPublish={canPublish}
      canDelete={canDelete}
      canSaveDraft={canSaveDraft}
      isCreateMode={isCreateMode}
      isBusy={isBusy}
      message={message}
      onChange={onChange}
      onSaveDraft={onSaveDraft}
      onPublish={onPublish}
      onDelete={onDelete}
      onCancel={onCancel}
    />
  </>
)

export default PageDrawerContent
