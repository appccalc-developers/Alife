import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useSearchParams } from 'react-router-dom'
import { getChurchSiteSection } from '../../app/navigation/churchSiteNavigation'
import { churchQueryKey } from '../../db/collections/groupCollection'
import { groupService } from '../../services/groupService'
import type { ChurchLifeGroup } from '../../services/churchLifeService'
import { useAuthStore } from '../../stores/auth'
import { localizeText } from '../../utils/localizedText'
import { updateChurchLifeOwnerFilter } from '../../utils/churchLifeGroups'
import AppPageTitleBar from '../layout/AppPageTitleBar'
import AppStableTabBody from '../layout/AppStableTabBody'
import ChurchGroupFilter from './ChurchGroupFilter'
import ChurchSiteNavigation from './ChurchSiteNavigation'
import { churchSiteDescription } from './churchSiteCopy'
import AccessTypeBadge from '../group/AccessTypeBadge'

const ChurchSiteGroupsContext = createContext<Dispatch<SetStateAction<ChurchLifeGroup[]>> | null>(null)

// Keep the current authorized options while the next tab loads its own response.
export const useChurchSiteGroups = (groups: ChurchLifeGroup[] | undefined) => {
  const setGroups = useContext(ChurchSiteGroupsContext)
  useEffect(() => {
    if (groups) setGroups?.(groups)
  }, [groups, setGroups])
}

const ChurchSiteLayout = ({ children }: { children: ReactNode }) => {
  const auth = useAuthStore()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [groups, setGroups] = useState<ChurchLifeGroup[]>([])
  const churchQuery = useQuery({ queryKey: churchQueryKey, queryFn: groupService.getChurch, staleTime: 5 * 60_000, enabled: !auth.isGuest })
  const section = getChurchSiteSection(location.pathname, location.search)
  const isSidebarPage = section === 'bulletins'
  const isDetailPage = (location.pathname.startsWith('/sermons/') && location.pathname !== '/sermons')
    || /^\/church\/groups\/[^/]+\/albums(?:\/[^/]+)?$/.test(location.pathname)
    || /^\/church\/forum\/posts\/[^/]+$/.test(location.pathname)
  const sidebarPageLabel = section === 'sermons'
    ? (auth.language === 'zh' ? '主日证道' : 'Sunday Sermons')
    : (auth.language === 'zh' ? '主日周报' : 'Sunday Bulletins')
  const filterable = location.pathname === '/church' || location.pathname === '/church/albums' || location.pathname === '/church/forum'
  const title = localizeText(churchQuery.data?.name, auth.language) || (auth.language === 'zh' ? '教会生活' : 'Church Life')

  return (
    <ChurchSiteGroupsContext.Provider value={setGroups}>
      <div className="mx-auto w-full max-w-6xl space-y-5 desktop:space-y-6">
        {!isDetailPage ? <AppPageTitleBar
          title={title}
          context={auth.language === 'zh' ? '教会生活' : 'Church Life'}
          subtitle={churchSiteDescription(section, auth.language)}
          showSubtitleOnMobile
          status={churchQuery.data ? <AccessTypeBadge accessType={churchQuery.data.accessType} showProtected /> : undefined}
          controls={!auth.isGuest ? <ChurchGroupFilter
            disabled={!filterable}
            groups={groups}
            value={searchParams.get('ownerGroupId')?.trim() ?? ''}
            language={auth.language}
            onChange={groupId => setSearchParams(updateChurchLifeOwnerFilter(searchParams, groupId), { preventScrollReset: true })}
          /> : undefined}
          navigation={<ChurchSiteNavigation />}
        /> : null}
        <div id="church-site-panel" role={isSidebarPage || isDetailPage ? 'region' : 'tabpanel'} aria-labelledby={section && !isSidebarPage && !isDetailPage ? `church-site-tab-${section}` : undefined} aria-label={isDetailPage ? (auth.language === 'zh' ? '教会内容详情' : 'Church content detail') : isSidebarPage ? sidebarPageLabel : undefined} tabIndex={0} className="outline-none focus-visible:ring-2 focus-visible:ring-[#176b5a]">
          <AppStableTabBody>{children}</AppStableTabBody>
        </div>
      </div>
    </ChurchSiteGroupsContext.Provider>
  )
}

export default ChurchSiteLayout
