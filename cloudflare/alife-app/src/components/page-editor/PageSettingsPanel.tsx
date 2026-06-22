import AppBadge from '../layout/AppBadge'
import AppSectionCard from '../layout/AppSectionCard'
import { useUiText } from '../../i18n/uiText'
import type { PageVisibility } from '../../types/group'
import type { PageEditModel } from '../../types/page-editor'

type Props = {
  model: PageEditModel
  canEdit: boolean
  canEditVisibility: boolean
  message?: string
  onChange: (value: PageEditModel) => void
  onResetDefaultHome?: () => void
}

const visibilityOptions: PageVisibility[] = ['draft', 'group', 'public']

const PageSettingsPanel = ({
  model,
  canEdit,
  canEditVisibility,
  message,
  onChange,
  onResetDefaultHome,
}: Props) => {
  const t = useUiText()
  const updateLocalizedField = (field: 'title' | 'description', key: 'en' | 'zh', value: string) => {
    const current = model[field]
    onChange({
      ...model,
      [field]: {
        en: key === 'en' ? value : current.en ?? '',
        zh: key === 'zh' ? value : current.zh ?? '',
      },
    })
  }

  return (
  <div className="space-y-4">
    <AppSectionCard title={t('pageSettings')} subtitle={t('pageSettingsSubtitle')}>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">{t('titleEnglish')}</span>
            <input
              value={model.title.en ?? ''}
              disabled={!canEdit}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              placeholder={t('pageTitlePlaceholder')}
              onChange={(event) => updateLocalizedField('title', 'en', event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">{t('titleChinese')}</span>
            <input
              value={model.title.zh ?? ''}
              disabled={!canEdit}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              placeholder={t('pageTitlePlaceholder')}
              onChange={(event) => updateLocalizedField('title', 'zh', event.target.value)}
            />
          </label>
        </div>

        <div className="grid gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">{t('descriptionEnglish')}</span>
            <textarea
              value={model.description.en ?? ''}
              disabled={!canEdit}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              placeholder={t('pageSummaryPlaceholder')}
              onChange={(event) => updateLocalizedField('description', 'en', event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">{t('descriptionChinese')}</span>
            <textarea
              value={model.description.zh ?? ''}
              disabled={!canEdit}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              placeholder={t('pageSummaryPlaceholder')}
              onChange={(event) => updateLocalizedField('description', 'zh', event.target.value)}
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">{t('visibility')}</span>
          <select
            value={model.visibility}
            disabled={!canEditVisibility}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
            onChange={(event) => onChange({ ...model, visibility: event.target.value as PageVisibility })}
          >
            {visibilityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {!canEditVisibility ? <p className="text-xs text-slate-500">{t('leaderVisibilityOnly')}</p> : null}
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <AppBadge variant="warning">{t('draftBadge')}</AppBadge>
          <AppBadge variant="info">{t('groupBadge')}</AppBadge>
          <AppBadge variant="success">{t('publicBadge')}</AppBadge>
        </div>

        {onResetDefaultHome ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-950">{t('defaultHomeTemplate')}</p>
            <p className="mt-1 text-xs leading-5 text-amber-800">{t('defaultHomeTemplateHelp')}</p>
            <button
              type="button"
              className="mt-3 inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-400 disabled:opacity-60"
              disabled={!canEdit}
              onClick={() => {
                if (window.confirm(t('restoreDefaultHomeConfirm'))) {
                  onResetDefaultHome()
                }
              }}
            >
              {t('restoreDefaultHome')}
            </button>
          </div>
        ) : null}

      </div>
    </AppSectionCard>

    <AppSectionCard title={t('editingTips')} dense>
      <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
        <li>{t('saveDraftTip')}</li>
        <li>{t('publishReadyTip')}</li>
        <li>{t('controlledPresetsTip')}</li>
      </ul>
      {message ? <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">{message}</p> : null}
    </AppSectionCard>
  </div>
  )
}

export default PageSettingsPanel
