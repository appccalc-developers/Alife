import AppBadge from '../layout/AppBadge'
import AppSectionCard from '../layout/AppSectionCard'
import { useUiText } from '../../i18n/uiText'
import type { PageVisibility } from '../../types/group'
import type { PageEditModel } from '../../types/page-editor'

type Props = {
  model: PageEditModel
  canEditVisibility: boolean
  message?: string
  onChange: (value: PageEditModel) => void
}

const visibilityOptions: PageVisibility[] = ['InvisibleDraft', 'VisibleToGroup', 'VisiblePublic']

const PageSettingsPanel = ({
  model,
  canEditVisibility,
  message,
  onChange,
}: Props) => {
  const t = useUiText()

  return (
  <div className="grid gap-4 lg:grid-cols-2">
    <AppSectionCard title={t('pageSettings')} subtitle={t('pageSettingsSubtitle')}>
      <div className="space-y-3">
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

      </div>
    </AppSectionCard>

    <AppSectionCard title={t('editingTips')} dense>
      <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
        <li>{t('saveDraftTip')}</li>
        <li>{t('publishReadyTip')}</li>
        <li>{t('rawJsonTip')}</li>
      </ul>
      {message ? <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">{message}</p> : null}
    </AppSectionCard>
  </div>
  )
}

export default PageSettingsPanel
