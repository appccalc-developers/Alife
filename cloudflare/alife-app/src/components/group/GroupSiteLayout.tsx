import GroupLoadError from './GroupLoadError'
import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { Settings2, UserPlus } from 'lucide-react'
import { fetchGroupForViewer } from '../../db/collections/groupCollection'
import { getGroupSiteMenu, getGroupSiteRoute } from '../../app/navigation/groupSiteNavigation'
import { useAuthStore } from '../../stores/auth'
import { localizeText } from '../../utils/localizedText'
import AppPageTitleBar from '../layout/AppPageTitleBar'
import AppSiteNavigation from '../layout/AppSiteNavigation'
import AppTitleBarAction from '../layout/AppTitleBarAction'
import AppStableTabBody from '../layout/AppStableTabBody'

const GroupSiteContext = createContext(false)
export const useGroupSiteLayout = () => useContext(GroupSiteContext)

const GroupSiteLayout = ({ groupId, children }: { groupId: string; children: ReactNode }) => {
  const auth = useAuthStore()
  const location = useLocation()
  const route = getGroupSiteRoute(location.pathname, location.search)
  const groupQuery = useQuery({ queryKey: ['group-site', groupId, auth.me?.id ?? 'guest'],
    queryFn: () => fetchGroupForViewer(groupId, auth.me?.id), enabled: auth.initialized && Boolean(groupId), staleTime: 30_000 })
  const canManage = auth.hasLeaderAccess(groupId)
  const canRead = auth.isAdmin || auth.memberships.some(m => m.groupId === groupId && m.status === 'approved')
  const items = getGroupSiteMenu(auth.language, { canManage, canRead }, groupId)
  const zh = auth.language === 'zh'
  const returnTo = new URLSearchParams(location.search).get('returnTo') ?? '/groups'
  const backPath = /^\/groups(?:\?[^#]*)?$/.test(returnTo) ? returnTo : '/groups'
  const descriptions = {
    home: [localizeText(groupQuery.data?.description, auth.language) || '查看小组最近的活动、公告与已发布内容。', localizeText(groupQuery.data?.description, auth.language) || 'See the group’s latest events, notices, and published content.'],
    announcements: ['查看并管理小组公告。', 'Read and manage group announcements.'],
    albums: ['用相册和子相册整理小组图片。', 'Organize group images with albums and subalbums.'],
    forum: ['在小组内分享近况、交流问题与资源。', 'Share updates, questions, and resources with your group.'],
    events: ['查看活动安排，管理报名与回顾。', 'Explore events, manage enrollment, and revisit past gatherings.'],
  }
  if (groupQuery.isError) return <GroupLoadError error={groupQuery.error} retry={() => void groupQuery.refetch()} />
  if (groupQuery.isPending) return <p role="status">{zh ? '正在加载小组…' : 'Loading group…'}</p>
  return <GroupSiteContext.Provider value>
    <div className="mx-auto w-full max-w-6xl space-y-5 desktop:space-y-6">
      <AppPageTitleBar title={localizeText(groupQuery.data?.name, auth.language) || (zh ? '小组生活' : 'Group Life')}
        context={zh ? '小组生活' : 'Group Life'} subtitle={descriptions[route?.section ?? 'home'][zh ? 0 : 1]} showSubtitleOnMobile
        backLink={{ label: zh ? '返回小组生活' : 'Back to Group Life', to: backPath }}
        primaryAction={canManage
          ? <AppTitleBarAction label={zh ? '小组管理' : 'Group Management'} icon={<Settings2 className="h-4 w-4" />}
              to={`/groups/${encodeURIComponent(groupId)}?section=group`} />
          : !canRead ? <AppTitleBarAction label={zh ? '加入小组 / 申请状态' : 'Join / request status'} icon={<UserPlus className="h-4 w-4" />}
              to={`/groups/${encodeURIComponent(groupId)}/join?returnTo=${encodeURIComponent(backPath)}`} /> : undefined}
        navigation={<AppSiteNavigation items={items.map(item => ({ ...item, to: `${item.to}${item.to.includes('?') ? '&' : '?'}returnTo=${encodeURIComponent(backPath)}` }))} activeSection={route?.section ?? null} label={zh ? '小组生活网站导航' : 'Group Life site navigation'}
          idPrefix="group-site-tab" panelId="group-site-panel" />}

      />
      <div id="group-site-panel" role="tabpanel" aria-labelledby={`group-site-tab-${route?.section ?? 'home'}`} tabIndex={0} className="outline-none focus-visible:ring-2 focus-visible:ring-[#176b5a]">
        <AppStableTabBody>{children}</AppStableTabBody>
      </div>
    </div>
  </GroupSiteContext.Provider>
}

export default GroupSiteLayout
