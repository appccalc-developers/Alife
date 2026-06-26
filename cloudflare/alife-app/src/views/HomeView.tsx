import { useAuthStore } from '../stores/auth'
import { localizeText } from '../utils/localizedText'
import PageContentRenderer, { normalizePageSections } from '../components/page/PageContentRenderer'
import { getCopy } from './home/homeCopy'
import { useHomeData } from './home/useHomeData'
import HomeNavHeader from './home/HomeNavHeader'
import HeroSection from './home/HeroSection'
import AboutAndLiveSection from './home/AboutAndLiveSection'
import VisitSection from './home/VisitSection'
import GroupsSection from './home/GroupsSection'
import EventsSection from './home/EventsSection'
import LocationSection from './home/LocationSection'
import HomeFooter from './home/HomeFooter'

const HomeView = () => {
  const auth = useAuthStore()
  const language = auth.language
  const { church, homePage, groupCards, upcomingEvents } = useHomeData()

  const churchDescription = localizeText(church?.description, language)
  const copy = getCopy(language, churchDescription)

  const navItems = [
    { href: '#about', label: copy.nav.about },
    { href: '#visit', label: copy.nav.visit },
    { href: '#groups', label: copy.nav.groups },
    { href: '#events', label: language === 'zh' ? '近期活动' : 'Events' },
    { href: '#location', label: copy.nav.location },
  ]

  const hasPublishedHomePage = homePage && homePage.visibility === 'public' && homePage.sections?.length > 0

  return (
    <div className="min-h-screen overflow-hidden bg-home-surface text-home-gold-text">
      <HomeNavHeader copy={copy} language={language} />
      <main>
        <HeroSection copy={copy} language={language} />
        {hasPublishedHomePage ? (
          <section className="px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
            <div className="mx-auto max-w-[88rem]">
              <PageContentRenderer
                page={homePage}
                sections={normalizePageSections(homePage.sections)}
                subgroupItems={[]}
                groupPageItems={[]}
                showHeader={false}
                framed={false}
              />
            </div>
          </section>
        ) : (
          <>
            <AboutAndLiveSection copy={copy} language={language} />
            <hr className="mx-auto max-w-6xl border-t border-home-border/40" />
            <VisitSection copy={copy} />
            <hr className="mx-auto max-w-6xl border-t border-home-border/40" />
            <GroupsSection copy={copy} language={language} groupCards={groupCards} />
            <hr className="mx-auto max-w-6xl border-t border-home-border/40" />
            <EventsSection copy={copy} language={language} upcomingEvents={upcomingEvents} />
            <hr className="mx-auto max-w-6xl border-t border-home-border/40" />
            <LocationSection copy={copy} />
          </>
        )}
      </main>
      <HomeFooter copy={copy} navItems={navItems} />
    </div>
  )
}

export default HomeView
