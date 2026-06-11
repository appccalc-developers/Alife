import AppSectionCard from '../layout/AppSectionCard'
import type { PageEditModel } from '../../types/page-editor'
import { useUiText } from '../../i18n/uiText'

type Props = {
  model: PageEditModel
  canEdit: boolean
  titleError?: string
  onChange: (value: PageEditModel) => void
}

const PageMetaForm = ({ model, canEdit, titleError, onChange }: Props) => {
  const t = useUiText()
  const updateField = <K extends keyof PageEditModel>(key: K, value: PageEditModel[K]) => {
    onChange({ ...model, [key]: value })
  }
  const updateLocalizedField = (field: 'title' | 'description', key: 'en' | 'zh', value: string) => {
    const current = model[field]
    const next = {
      en: key === 'en' ? value : current.en ?? '',
      zh: key === 'zh' ? value : current.zh ?? '',
    }
    updateField(field, next)
  }
  const updateTitle = (key: 'en' | 'zh', value: string) => updateLocalizedField('title', key, value)
  const updateDescription = (key: 'en' | 'zh', value: string) => updateLocalizedField('description', key, value)

  return (
    <AppSectionCard title={t('pageMetadata')} subtitle={t('pageMetadataSubtitle')}>
      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">{t('titleEnglish')}</span>
          <input
            value={model.title.en ?? ''}
            disabled={!canEdit}
            className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
            placeholder={t('pageTitlePlaceholder')}
            onChange={(event) => updateTitle('en', event.target.value)}
          />
          {titleError ? <p className="text-xs text-red-600">{titleError}</p> : null}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">{t('titleChinese')}</span>
          <input
            value={model.title.zh ?? ''}
            disabled={!canEdit}
            className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
            placeholder={t('pageTitlePlaceholder')}
            onChange={(event) => updateTitle('zh', event.target.value)}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">{t('descriptionEnglish')}</span>
          <textarea
            value={model.description.en ?? ''}
            disabled={!canEdit}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
            placeholder={t('pageSummaryPlaceholder')}
            onChange={(event) => updateDescription('en', event.target.value)}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">{t('descriptionChinese')}</span>
          <textarea
            value={model.description.zh ?? ''}
            disabled={!canEdit}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
            placeholder={t('pageSummaryPlaceholder')}
            onChange={(event) => updateDescription('zh', event.target.value)}
          />
        </label>
      </div>
    </AppSectionCard>
  )
}

export default PageMetaForm
