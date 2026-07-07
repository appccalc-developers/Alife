import { useAuthStore } from '../stores/auth'
import { localizeText } from '../utils/localizedText'
import { pageSectionDividerClass, pageSectionsCanvasClass } from '../components/page-sections/sectionPresets'
import { getCopy } from './home/homeCopy'
import { useHomeData } from './home/useHomeData'
import { buildMinistriesNavItem, insertMinistriesNavItem } from './home/homeUtils'
import HomeNavHeader from './home/HomeNavHeader'
import HeroSection from './home/HeroSection'
import AboutAndLiveSection from './home/AboutAndLiveSection'
import VisitSection from './home/VisitSection'
import GroupsSection from './home/GroupsSection'
import EventsSection from './home/EventsSection'
import RecentSermonsSection from './home/RecentSermonsSection'
import LocationSection from './home/LocationSection'
import HomeFooter from './home/HomeFooter'

const HomeView = () => {
  const auth = useAuthStore()
  const language = auth.language
  const { church, publicPages, groupCards, upcomingEvents, recentSermons } = useHomeData()

  const churchDescription = localizeText(church?.description, language)
  const copy = getCopy(language, churchDescription)
  const eventsNavLabel = copy.nav.events

  const rawDefaultNavItems = [
    { href: '#about', label: copy.nav.about },
    { href: '#visit', label: copy.nav.visit },
    { href: '#groups', label: copy.nav.groups },
    { href: '#events', label: copy.nav.events },
    { href: '#sermons', label: copy.nav.sermons },
    { href: '#location', label: copy.nav.location },
  ]

  const sanitizedNavItems = rawDefaultNavItems.map((item) =>
    item.href === '#events' ? { ...item, label: eventsNavLabel } : item,
  )
  const ministriesNavItem = buildMinistriesNavItem(publicPages, language, copy.nav.ministries)
  const headerNavItems = insertMinistriesNavItem(sanitizedNavItems, ministriesNavItem)

  return (
    <div className="min-h-screen overflow-hidden bg-home-surface text-home-gold-text">
      <HomeNavHeader copy={copy} language={language} navItems={headerNavItems} />
      <main className={pageSectionsCanvasClass}>
        <HeroSection copy={copy} />
        <AboutAndLiveSection copy={copy} />
        <hr className={pageSectionDividerClass} />
        <VisitSection copy={copy} language={language} />
        <hr className={pageSectionDividerClass} />
        <GroupsSection copy={copy} language={language} groupCards={groupCards} />
        <hr className={pageSectionDividerClass} />
        <EventsSection copy={copy} language={language} upcomingEvents={upcomingEvents} />
        <hr className={pageSectionDividerClass} />
        <RecentSermonsSection copy={copy} language={language} sermons={recentSermons} />
        <hr className={pageSectionDividerClass} />
        <LocationSection copy={copy} />
      </main>
      <HomeFooter copy={copy} navItems={sanitizedNavItems} />
    </div>
  )
}

export default HomeView
