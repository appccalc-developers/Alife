import { groupSiteLayoutText } from '../../i18n/groupSiteLayout.ts'
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
import AccessTypeBadge from './AccessTypeBadge'

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
  const isDetailPage = /^\/groups\/[^/]+$/.test(location.pathname) && new URLSearchParams(location.search).has('page')
    || /^\/groups\/[^/]+\/albums\/[^/]+$/.test(location.pathname)
    || /^\/groups\/[^/]+\/forum\/posts\/[^/]+$/.test(location.pathname)
  const returnTo = new URLSearchParams(location.search).get('returnTo') ?? '/groups'
  const backPath = /^\/groups(?:\?[^#]*)?$/.test(returnTo) ? returnTo : '/groups'
  const descriptions = {
    home: [localizeText(groupQuery.data?.description, auth.language) || groupSiteLayoutText.descriptionsHome, localizeText(groupQuery.data?.description, auth.language) || 'See the group’s latest events, notices, and published content.'],
    announcements: [groupSiteLayoutText.readAndManageGroupAnnouncements.zh, groupSiteLayoutText.readAndManageGroupAnnouncements.en],
    albums: [groupSiteLayoutText.organizeGroupImagesWithAlbumsAndSubalbums.zh, groupSiteLayoutText.organizeGroupImagesWithAlbumsAndSubalbums.en],
    forum: [groupSiteLayoutText.shareUpdatesQuestionsAndResourcesWithYourGroup.zh, groupSiteLayoutText.shareUpdatesQuestionsAndResourcesWithYourGroup.en],
    events: [groupSiteLayoutText.exploreEventsManageEnrollmentAndRevisitPastGatherings.zh, groupSiteLayoutText.exploreEventsManageEnrollmentAndRevisitPastGatherings.en],
  }
  if (groupQuery.isError) return <GroupLoadError error={groupQuery.error} retry={() => void groupQuery.refetch()} />
  if (groupQuery.isPending) return <p role="status">{zh ? groupSiteLayoutText.loadingGroup.zh : groupSiteLayoutText.loadingGroup.en}</p>
  return <GroupSiteContext.Provider value>
    <div className="mx-auto w-full max-w-6xl space-y-5 desktop:space-y-6">
      {!isDetailPage ? <AppPageTitleBar title={localizeText(groupQuery.data?.name, auth.language) || (zh ? groupSiteLayoutText.groupLife.zh : groupSiteLayoutText.groupLife.en)}
        context={zh ? groupSiteLayoutText.groupLife.zh : groupSiteLayoutText.groupLife.en} subtitle={descriptions[route?.section ?? 'home'][zh ? 0 : 1]} showSubtitleOnMobile
        status={groupQuery.data ? <AccessTypeBadge accessType={groupQuery.data.accessType} showProtected /> : undefined}
        backLink={{ label: zh ? groupSiteLayoutText.backToGroupLife.zh : groupSiteLayoutText.backToGroupLife.en, to: backPath }}
        primaryAction={canManage
          ? <AppTitleBarAction label={zh ? groupSiteLayoutText.groupManagement.zh : groupSiteLayoutText.groupManagement.en} icon={<Settings2 className="h-4 w-4" />}
              to={`/groups/${encodeURIComponent(groupId)}?section=group`} />
          : !canRead ? <AppTitleBarAction label={zh ? groupSiteLayoutText.joinRequestStatus.zh : groupSiteLayoutText.joinRequestStatus.en} icon={<UserPlus className="h-4 w-4" />}
              to={`/groups/${encodeURIComponent(groupId)}/join?returnTo=${encodeURIComponent(backPath)}`} /> : undefined}
        navigation={<AppSiteNavigation items={items.map(item => ({ ...item, to: `${item.to}${item.to.includes('?') ? '&' : '?'}returnTo=${encodeURIComponent(backPath)}` }))} activeSection={route?.section ?? null} label={zh ? groupSiteLayoutText.groupLifeSiteNavigation.zh : groupSiteLayoutText.groupLifeSiteNavigation.en}
          idPrefix="group-site-tab" panelId="group-site-panel" />}

      /> : null}
      <div id="group-site-panel" role={isDetailPage ? 'region' : 'tabpanel'} aria-labelledby={isDetailPage ? undefined : `group-site-tab-${route?.section ?? 'home'}`} aria-label={isDetailPage ? (zh ? groupSiteLayoutText.groupContentDetail.zh : groupSiteLayoutText.groupContentDetail.en) : undefined} tabIndex={0} className="outline-none focus-visible:ring-2 focus-visible:ring-[#176b5a]">
        <AppStableTabBody>{children}</AppStableTabBody>
      </div>
    </div>
  </GroupSiteContext.Provider>
}

export default GroupSiteLayout
