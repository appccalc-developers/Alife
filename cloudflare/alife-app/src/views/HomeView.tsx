import { useAuthStore } from '../stores/auth'
import { pageSectionDividerClass, pageSectionsCanvasClass } from '../components/page-sections/sectionPresets'
import { getCopy } from './home/homeCopy'
import { useHomeData } from './home/useHomeData'
import { buildPageMenuNavItems } from './home/homeUtils'
import HomeNavHeader from './home/HomeNavHeader'
import HeroSection from './home/HeroSection'
import AboutAndLiveSection from './home/AboutAndLiveSection'
import VisitSection from './home/VisitSection'
import ReviewedPageCarouselSection from './home/ReviewedPageCarouselSection'
import RecentSermonsSection from './home/RecentSermonsSection'
import LocationSection from './home/LocationSection'
import HomeFooter from './home/HomeFooter'

const HomeView = () => {
  const auth = useAuthStore()
  const language = auth.language
  const { publicPages, recentSermons, sermonsLoading } = useHomeData()
  const churchOrganizationPages = publicPages.filter((page) => page.primaryMenuHomePlacement === 'churchOrganization')
  const recentEventPages = publicPages.filter((page) => page.primaryMenuHomePlacement === 'recentEvents')

  const copy = getCopy(language, '')
  const welcomeNavItem = { href: '#welcome', label: copy.nav.welcome }
  const headerNavItems = [
    welcomeNavItem,
    ...buildPageMenuNavItems(publicPages, language, copy.nav.ministries),
    { to: '/articles', label: copy.nav.articles },
  ]

  return (
    <div className="min-h-screen overflow-hidden bg-home-surface text-home-gold-text">
      <HomeNavHeader copy={copy} language={language} navItems={headerNavItems} />
      <main className={pageSectionsCanvasClass}>
        <HeroSection copy={copy} />
        <AboutAndLiveSection copy={copy} language={language} />
        <hr className={pageSectionDividerClass} />
        <VisitSection copy={copy} language={language} />
        <hr className={pageSectionDividerClass} />
        <ReviewedPageCarouselSection
          language={language}
          pages={churchOrganizationPages}
          sectionId="church-organization"
          eyebrow={copy.organizationEyebrow}
          title={copy.organizationTitle}
          body={copy.organizationBody}
          action={copy.organizationAction}
          emptyState={copy.organizationEmptyState}
          badge={copy.organizationBadge}
        />
        <hr className={pageSectionDividerClass} />
        <ReviewedPageCarouselSection
          language={language}
          pages={recentEventPages}
          sectionId="recent-events"
          eyebrow={copy.eventsEyebrow}
          title={copy.eventsTitle}
          body={copy.eventsLead}
          action={copy.eventAction}
          emptyState={copy.eventsEmpty}
          badge={copy.eventsFeaturedSingle}
        />
        <hr className={pageSectionDividerClass} />
        <RecentSermonsSection copy={copy} language={language} sermons={recentSermons} loading={sermonsLoading} />
        <hr className={pageSectionDividerClass} />
        <LocationSection copy={copy} />
      </main>
      <HomeFooter copy={copy} navItems={[welcomeNavItem]} />
    </div>
  )
}

export default HomeView
