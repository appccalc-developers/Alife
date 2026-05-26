import AppEmptyState from '../layout/AppEmptyState'
import AppPageShell from '../layout/AppPageShell'
import AppSectionCard from '../layout/AppSectionCard'
import type { GroupDto, GroupPageDto, GroupSummaryDto, GroupTab } from '../../types/group'
import { useUiText } from '../../i18n/uiText'
import GroupPageTabs from './GroupPageTabs'

type Props = {
  group: GroupDto | null
  subgroups: GroupSummaryDto[]
  pages: GroupPageDto[]
  loading: boolean
  error: string
  activeTab: GroupTab
  canCreatePage: boolean
  canEditAllPages: boolean
  contentMode?: 'pages' | 'tabs'
  selectedPageId?: string
  statusMessage?: string
  onAddPage: () => void
  onPageSaved?: () => void
}

const GroupScreenShell = ({
  group,
  subgroups,
  pages,
  loading,
  error,
  activeTab,
  canCreatePage,
  canEditAllPages,
  contentMode = 'tabs',
  selectedPageId = '',
  statusMessage,
  onAddPage,
  onPageSaved = () => undefined,
}: Props) => {
  const t = useUiText()

  return (
    <AppPageShell
    >
      {loading ? (
        <AppSectionCard dense>
          <p className="text-sm text-slate-600">{t('loadingGroup')}</p>
        </AppSectionCard>
      ) : null}

      {!loading && error ? (
        <AppSectionCard dense>
          <p className="text-sm text-rose-700">{error}</p>
        </AppSectionCard>
      ) : null}

      {!loading && !error && group ? (
        <div className="space-y-6">
            {(contentMode === 'pages' || activeTab === 'pages') ? (
              <GroupPageTabs
                pages={pages}
                subgroups={subgroups}
                selectedPageId={selectedPageId}
                mode="view"
                canEditAllPages={canEditAllPages}
                onSaved={onPageSaved}
                showCreateAction={contentMode === 'tabs' && canCreatePage}
                onCreate={onAddPage}
              />
            ) : null}

            {statusMessage ? (
              <AppSectionCard dense>
                <p className="text-sm text-slate-600">{statusMessage}</p>
              </AppSectionCard>
            ) : null}
        </div>
      ) : null}

      {!loading && !error && !group ? (
        <AppEmptyState
          title={t('groupNotFound')}
          description={t('groupNotFoundDescription')}
        />
      ) : null}
    </AppPageShell>
  )
}

export default GroupScreenShell
