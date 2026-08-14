import { useAuthStore } from '../stores/auth'
import { usePublicPagesQuery } from '../hooks/usePublicPageQueries'
import { getCopy } from './home/homeCopy'
import { buildPageMenuNavItems, getFirstPageMenuPage } from './home/homeUtils'
import HomeNavHeader from './home/HomeNavHeader'
import HomeFooter from './home/HomeFooter'
import ManagedHomePageContent from './home/ManagedHomePageContent'

const HomeView = () => {
  const auth = useAuthStore()
  const language = auth.language
  const publicPagesQuery = usePublicPagesQuery()
  const publicPages = publicPagesQuery.data ?? []
  const copy = getCopy(language, '')
  const headerNavItems = buildPageMenuNavItems(publicPages, language, copy.nav.ministries)
  const homePage = getFirstPageMenuPage(publicPages, language)
  const firstNavItem = headerNavItems[0]
  const footerNavItems = firstNavItem
    ? [{ href: '/', label: firstNavItem.label }]
    : []

  return (
    <div className="min-h-screen overflow-hidden bg-home-surface text-home-gold-text">
      <HomeNavHeader copy={copy} language={language} navItems={headerNavItems} />
      <ManagedHomePageContent
        copy={copy}
        pageId={homePage?.id ?? ''}
        navigationPending={!publicPagesQuery.data && publicPagesQuery.isPending}
        navigationFailed={!publicPagesQuery.data && publicPagesQuery.isError}
      />
      <HomeFooter copy={copy} navItems={footerNavItems} />
    </div>
  )
}

export default HomeView
