import { churchSiteNavigationText } from '../../i18n/churchSiteNavigation.ts'
import { useLocation } from 'react-router-dom'
import { getChurchSiteMenu, getChurchSiteSection, withChurchSiteOwnerFilter } from '../../app/navigation/churchSiteNavigation'
import { useAuthStore } from '../../stores/auth'
import AppSiteNavigation from '../layout/AppSiteNavigation'

const ChurchSiteNavigation = () => {
  const auth = useAuthStore()
  const location = useLocation()
  const isMember = !auth.loading && !auth.isGuest && auth.isRegistered
  const items = [
    ...(isMember ? [{ key: 'home', label: auth.language === 'zh' ? churchSiteNavigationText.home.zh : churchSiteNavigationText.home.en, to: '/church' }] : []),
    ...getChurchSiteMenu(auth.language, {
      isMember,
      canReviewRam: isMember && auth.hasAdminPermission('admin.events.audit'),
    }),
  ]
  return <AppSiteNavigation items={items} activeSection={getChurchSiteSection(location.pathname, location.search)}
    label={auth.language === 'zh' ? churchSiteNavigationText.churchLifeSiteNavigation.zh : churchSiteNavigationText.churchLifeSiteNavigation.en}
    idPrefix="church-site-tab" panelId="church-site-panel" resolveTo={withChurchSiteOwnerFilter} />
}

export default ChurchSiteNavigation
