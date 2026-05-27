import { useEffect, useState, type FormEvent } from 'react'
import AppActionButton from '../layout/AppActionButton'
import AppSectionCard from '../layout/AppSectionCard'
import type { GroupDto } from '../../types/group'
import type { LocalizedText } from '../../types'
import { useUiText } from '../../i18n/uiText'
import { toLocalizedText } from '../../utils/localizedText'

type Props = {
  group: GroupDto
  subgroupCount: number
  pageCount: number
  saving?: boolean
  onSave?: (payload: { name: LocalizedText; description?: LocalizedText; accessType: GroupDto['accessType']; isClosed: boolean }) => Promise<void> | void
}

const GroupOverviewPanel = ({ group, subgroupCount, pageCount, saving = false, onSave }: Props) => {
  const t = useUiText()
  const [name, setName] = useState(() => toLocalizedText(group.name))
  const [description, setDescription] = useState(() => toLocalizedText(group.description))
  const [accessType, setAccessType] = useState<GroupDto['accessType']>(group.accessType)
  const [isClosed, setIsClosed] = useState(group.isClosed)
  const canSave = Boolean(onSave) && Object.values(name).some((value) => value.trim().length > 0) && !saving

  useEffect(() => {
    setName(toLocalizedText(group.name))
    setDescription(toLocalizedText(group.description))
    setAccessType(group.accessType)
    setIsClosed(group.isClosed)
  }, [group])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSave) return
    await onSave?.({ name, description, accessType, isClosed })
  }

  return (
  <AppSectionCard dense title={t('groupSettings')} subtitle={t('overviewSubtitle')}>
    <form className="grid gap-4 lg:grid-cols-3" onSubmit={submit}>
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2 sm:grid-cols-2">
        <label>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('groupNameEnglish')}</span>
          <input
            value={name.en ?? ''}
            onChange={(event) => setName((current) => ({ ...current, en: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <label>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('groupNameChinese')}</span>
          <input
            value={name.cn ?? ''}
            onChange={(event) => setName((current) => ({ ...current, cn: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <label>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('groupDescriptionEnglish')}</span>
          <textarea
            value={description.en ?? ''}
            onChange={(event) => setDescription((current) => ({ ...current, en: event.target.value }))}
            className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <label>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('groupDescriptionChinese')}</span>
          <textarea
            value={description.cn ?? ''}
            onChange={(event) => setDescription((current) => ({ ...current, cn: event.target.value }))}
            className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <label>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('access')}</span>
          <select
            value={accessType}
            onChange={(event) => setAccessType(event.target.value as GroupDto['accessType'])}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            <option value="public">{t('public')}</option>
            <option value="protected">{t('protected')}</option>
            <option value="private">{t('private')}</option>
          </select>
        </label>

        <label>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('status')}</span>
          <select
            value={isClosed ? 'closed' : 'active'}
            onChange={(event) => setIsClosed(event.target.value === 'closed')}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            <option value="active">{t('active')}</option>
            <option value="closed">{t('closed')}</option>
          </select>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
          <p className="text-xs text-slate-500">{t('groupId')}: {group.id}</p>
          <AppActionButton type="submit" variant="primary" disabled={!canSave}>
            {saving ? t('saving') : t('saveChanges')}
          </AppActionButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{t('subgroups')}</p>
          <p className="text-2xl font-semibold text-slate-900">{subgroupCount}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{t('pages')}</p>
          <p className="text-2xl font-semibold text-slate-900">{pageCount}</p>
        </div>
      </div>
    </form>
  </AppSectionCard>
  )
}

export default GroupOverviewPanel
