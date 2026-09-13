import { useLocation } from 'react-router-dom'
import { getChurchSiteMenu, getChurchSiteSection, withChurchSiteOwnerFilter } from '../../app/navigation/churchSiteNavigation'
import { useAuthStore } from '../../stores/auth'
import AppSiteNavigation from '../layout/AppSiteNavigation'

const ChurchSiteNavigation = () => {
  const auth = useAuthStore()
  const location = useLocation()
  const isMember = !auth.loading && !auth.isGuest && auth.isRegistered
  const items = [
    ...(isMember ? [{ key: 'home', label: auth.language === 'zh' ? '首页' : 'Home', to: '/church' }] : []),
    ...getChurchSiteMenu(auth.language, {
      isMember,
      canReviewRam: isMember && auth.hasAdminPermission('admin.events.audit'),
    }),
  ]
  return <AppSiteNavigation items={items} activeSection={getChurchSiteSection(location.pathname, location.search)}
    label={auth.language === 'zh' ? '教会生活网站导航' : 'Church Life site navigation'}
    idPrefix="church-site-tab" panelId="church-site-panel" resolveTo={withChurchSiteOwnerFilter} />
}

export default ChurchSiteNavigation
