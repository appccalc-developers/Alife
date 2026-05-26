import AppSectionCard from '../layout/AppSectionCard'
import type { GroupDto } from '../../types/group'
import { useUiText } from '../../i18n/uiText'

type Props = {
  group: GroupDto
  subgroupCount: number
  pageCount: number
}

const GroupOverviewPanel = ({ group, subgroupCount, pageCount }: Props) => {
  const t = useUiText()

  return (
  <AppSectionCard title={t('overview')} subtitle={t('overviewSubtitle')}>
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">{t('metadata')}</p>
        <p className="text-sm text-slate-700">{t('groupId')}: {group.id}</p>
        <p className="text-sm text-slate-700">{t('access')}: {group.accessType}</p>
        <p className="text-sm text-slate-700">{t('status')}: {group.isClosed ? t('closed') : t('active')}</p>
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
    </div>
  </AppSectionCard>
  )
}

export default GroupOverviewPanel
