import AppSectionCard from '../layout/AppSectionCard'
import type { PageEditModel } from '../../types/page-editor'

type Props = {
  model: PageEditModel
  canEdit: boolean
  titleError?: string
  onChange: (value: PageEditModel) => void
}

const PageMetaForm = ({ model, canEdit, titleError, onChange }: Props) => {
  const updateField = <K extends keyof PageEditModel>(key: K, value: PageEditModel[K]) => {
    onChange({ ...model, [key]: value })
  }
  const updateTitle = (key: 'en' | 'cn', value: string) => updateField('title', { ...model.title, [key]: value })
  const updateDescription = (key: 'en' | 'cn', value: string) => updateField('description', { ...model.description, [key]: value })

  return (
    <AppSectionCard title="Page Metadata" subtitle="Core page identity and discovery fields.">
      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Title (English)</span>
          <input
            value={model.title.en ?? ''}
            disabled={!canEdit}
            className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
            placeholder="Page title"
            onChange={(event) => updateTitle('en', event.target.value)}
          />
          {titleError ? <p className="text-xs text-red-600">{titleError}</p> : null}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Title (Chinese)</span>
          <input
            value={model.title.cn ?? ''}
            disabled={!canEdit}
            className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
            placeholder="页面标题"
            onChange={(event) => updateTitle('cn', event.target.value)}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Description (English)</span>
          <textarea
            value={model.description.en ?? ''}
            disabled={!canEdit}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
            placeholder="Page summary"
            onChange={(event) => updateDescription('en', event.target.value)}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Description (Chinese)</span>
          <textarea
            value={model.description.cn ?? ''}
            disabled={!canEdit}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
            placeholder="页面摘要"
            onChange={(event) => updateDescription('cn', event.target.value)}
          />
        </label>
      </div>
    </AppSectionCard>
  )
}

export default PageMetaForm
