import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AppPageShell from '../components/layout/AppPageShell'
import GroupDashboard from '../components/group/GroupDashboard'
import GroupScreenShell from '../components/group/GroupScreenShell'
import { useGroupScreen } from '../hooks/useGroupScreen'
import { groupService } from '../services/groupService'
import { useAuthStore } from '../stores/auth'
import { localizeText } from '../utils/localizedText'

const ChurchLifeContent = ({ churchId }: { churchId: string }) => {
  const { language } = useAuthStore()
  const [searchParams] = useSearchParams()
  const pageId = searchParams.get('page')?.trim() ?? ''
  const {
    activeTab,
    group,
    subgroups,
    pages,
    events,
    loading,
    error,
    statusMessage,
    refreshPages,
  } = useGroupScreen(churchId, { loadEvents: true })

  return (
    <>
      {pageId ? <Link to="/church" className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold text-[#176b5a] ring-1 ring-emerald-200 transition hover:bg-emerald-50">← {group ? localizeText(group.name, language) : (language === 'zh' ? '教会生活' : 'Church Life')}</Link> : null}
      <GroupScreenShell
        group={group}
        subgroups={subgroups}
        pages={pages}
        loading={loading}
        error={error}
        activeTab={activeTab}
        canCreatePage={false}
        canEditAllPages={false}
        contentMode={pageId ? 'pages' : 'dashboard'}
        dashboard={group ? <GroupDashboard group={group} pages={pages} events={events} canManage={false} scope="church" /> : null}
        selectedPageId={pageId}
        statusMessage={statusMessage}
        onAddPage={() => undefined}
        onPageSaved={() => { refreshPages().catch(() => undefined) }}
      />
    </>
  )
}

const ChurchLifeView = () => {
  const auth = useAuthStore()
  const [churchId, setChurchId] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    groupService.getChurch()
      .then((church) => {
        if (!cancelled) setChurchId(church.id)
      })
      .catch((reason) => {
        console.error('[ChurchLifeView] church load failed', reason)
        if (!cancelled) setLoadFailed(true)
      })
    return () => { cancelled = true }
  }, [])

  return (
    <AppPageShell>
      {loadFailed ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{auth.language === 'zh' ? '无法加载教会生活。' : 'Unable to load Church Life.'}</section> : null}
      {!loadFailed && !churchId ? <section className="rounded-2xl border border-emerald-100 bg-white p-5 text-sm text-[#60716a]">{auth.language === 'zh' ? '正在加载教会生活…' : 'Loading Church Life…'}</section> : null}
      {churchId ? <ChurchLifeContent churchId={churchId} /> : null}
    </AppPageShell>
  )
}

export default ChurchLifeView
