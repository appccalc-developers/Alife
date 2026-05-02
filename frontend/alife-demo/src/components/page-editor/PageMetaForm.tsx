import AppSectionCard from '../layout/AppSectionCard'
import type { PageEditModel } from '../../types/page-editor'

type Props = {
  model: PageEditModel
  canEdit: boolean
  isCreateMode: boolean
  titleError?: string
  onChange: (value: PageEditModel) => void
}

const PageMetaForm = ({ model, canEdit, isCreateMode, titleError, onChange }: Props) => {
  const updateField = <K extends keyof PageEditModel>(key: K, value: PageEditModel[K]) => {
    onChange({ ...model, [key]: value })
  }

  const onTagsInput = (value: string) => {
    const tags = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    updateField('tags', tags)
  }

  return (
    <AppSectionCard title="Page Metadata" subtitle="Core page identity and discovery fields.">
      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Title</span>
          <input
            value={model.title}
            disabled={!canEdit}
            className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
            placeholder="Page title"
            onChange={(event) => updateField('title', event.target.value)}
          />
          {titleError ? <p className="text-xs text-red-600">{titleError}</p> : null}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Description</span>
          <textarea
            value={model.description}
            disabled={!canEdit}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
            placeholder="Page summary"
            onChange={(event) => updateField('description', event.target.value)}
          />
        </label>
      </div>
    </AppSectionCard>
  )
}

export default PageMetaForm
