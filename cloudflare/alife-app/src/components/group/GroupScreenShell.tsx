import AppEmptyState from '../layout/AppEmptyState'
import type { ReactNode } from 'react'
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
  canViewWorkingCopy: boolean
  contentMode?: 'dashboard' | 'pages' | 'tabs'
  dashboard?: ReactNode
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
  canViewWorkingCopy,
  contentMode = 'tabs',
  dashboard,
  selectedPageId = '',
  statusMessage,
  onAddPage,
  onPageSaved = () => undefined,
}: Props) => {
  const t = useUiText()

  return (
    <>
      {loading ? (
        <section className="mx-auto w-full max-w-6xl rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <p className="text-sm text-slate-600">{t('loadingGroup')}</p>
        </section>
      ) : null}

      {!loading && error ? (
        <section className="mx-auto w-full max-w-6xl rounded-lg border border-rose-200 bg-rose-50 p-4 sm:p-5">
          <p className="text-sm text-rose-700">{error}</p>
        </section>
      ) : null}

      {!loading && !error && group ? (
        <>
          {contentMode === 'dashboard' ? dashboard : null}

          {(contentMode === 'pages' || activeTab === 'pages') ? (
            <GroupPageTabs
              pages={pages}
              subgroups={subgroups}
              selectedPageId={selectedPageId}
              mode="view"
              canEditAllPages={canEditAllPages}
              canViewWorkingCopy={canViewWorkingCopy}
              onSaved={onPageSaved}
              showCreateAction={contentMode === 'tabs' && canCreatePage}
              flatSections={contentMode === 'pages'}
              onCreate={onAddPage}
            />
          ) : null}

          {statusMessage ? (
            <section className="mx-auto w-full max-w-6xl rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <p className="text-sm text-slate-600">{statusMessage}</p>
            </section>
          ) : null}
        </>
      ) : null}

      {!loading && !error && !group ? (
        <section className="mx-auto w-full max-w-6xl">
          <AppEmptyState
            title={t('groupNotFound')}
            description={t('groupNotFoundDescription')}
          />
        </section>
      ) : null}
    </>
  )
}

export default GroupScreenShell
