import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AppPageShell from '../components/layout/AppPageShell'
import { groupService } from '../services/groupService'
import { useAuthStore } from '../stores/auth'
import { GroupWorkspaceView } from './GroupDetailView'
import GroupManageView from './GroupManageView'

const ChurchLifeView = () => {
  const auth = useAuthStore()
  const [searchParams] = useSearchParams()
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

  if (churchId) {
    const section = searchParams.get('section')?.trim() ?? ''
    if (section === 'events' || section === 'announcements') {
      return <GroupManageView embeddedWorkspace explicitGroupId={churchId} workspaceBasePath="/church" />
    }

    return (
      <GroupWorkspaceView
        groupId={churchId}
        pageId={searchParams.get('page')?.trim() ?? ''}
        scope="church"
        managementEnabled={false}
      />
    )
  }

  return (
    <AppPageShell>
      {loadFailed ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">{auth.language === 'zh' ? '无法加载教会生活。' : 'Unable to load Church Life.'}</section> : null}
      {!loadFailed ? <section className="rounded-2xl border border-emerald-100 bg-white p-5 text-sm text-[#60716a]">{auth.language === 'zh' ? '正在加载教会生活…' : 'Loading Church Life…'}</section> : null}
    </AppPageShell>
  )
}

export default ChurchLifeView
