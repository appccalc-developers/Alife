import AppBadge from '../layout/AppBadge'
import AppSectionCard from '../layout/AppSectionCard'
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
}: Props) => (
  <div className="grid gap-4 lg:grid-cols-2">
    <AppSectionCard title="Page Settings" subtitle="Visibility and publishing controls.">
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Visibility</span>
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
          {!canEditVisibility ? <p className="text-xs text-slate-500">Only leader/co-leader can edit visibility.</p> : null}
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <AppBadge variant="warning">Draft: InvisibleDraft</AppBadge>
          <AppBadge variant="info">Group: VisibleToGroup</AppBadge>
          <AppBadge variant="success">Public: VisiblePublic</AppBadge>
        </div>

      </div>
    </AppSectionCard>

    <AppSectionCard title="Editing Tips" dense>
      <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
        <li>Save draft frequently while editing sections.</li>
        <li>Use publish only when content is ready for members.</li>
        <li>Raw JSON fields are available for advanced customization.</li>
      </ul>
      {message ? <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">{message}</p> : null}
    </AppSectionCard>
  </div>
)

export default PageSettingsPanel
