import { useAuthStore } from '../stores/auth'
import { localizeText } from '../utils/localizedText'
import PageContentRenderer, { getPageSectionDomId, normalizePageSections } from '../components/page/PageContentRenderer'
import type { SectionEditModel } from '../types/page-editor'
import { getCopy } from './home/homeCopy'
import { useHomeData } from './home/useHomeData'
import HomeNavHeader from './home/HomeNavHeader'
import HeroSection from './home/HeroSection'
import AboutAndLiveSection from './home/AboutAndLiveSection'
import VisitSection from './home/VisitSection'
import GroupsSection from './home/GroupsSection'
import EventsSection from './home/EventsSection'
import RecentSermonsSection from './home/RecentSermonsSection'
import LocationSection from './home/LocationSection'
import HomeFooter from './home/HomeFooter'

const sectionTypeFallback = (section: SectionEditModel, copy: ReturnType<typeof getCopy>) => {
  if (section.type === 'LandingHero') return copy.sectionFallback.intro
  if (section.type === 'Hero') return copy.sectionFallback.intro
  if (section.type === 'Countdown') return copy.sectionFallback.events
  if (section.type === 'ContactLocation') return copy.nav.location
  if (section.type === 'Spotlight') return copy.sectionFallback.highlight
  if (section.type === 'RichText') return copy.sectionFallback.info
  if (section.type === 'ListView') {
    const source = String(section.contentJson.source ?? section.contentJson.sourceType ?? '')
    if (source === 'events') return copy.sectionFallback.events
    if (source === 'groups') return copy.sectionFallback.groups
    if (source === 'pages') return copy.sectionFallback.pages
    if (source === 'members') return copy.sectionFallback.members
    return copy.sectionFallback.list
  }
  if (section.type === 'Sermon') return copy.sectionFallback.sermon
  return copy.sectionFallback.section
}

const readSectionNavLabel = (section: SectionEditModel, language: string, copy: ReturnType<typeof getCopy>) => {
  const header = section.contentJson.header
  if (header && typeof header === 'object' && !Array.isArray(header)) {
    const title = (header as { title?: unknown }).title
    const localized = localizeText(title as never, language)
    if (localized) return localized
  }

  const direct = localizeText((section.contentJson.title ?? section.contentJson.headline) as never, language)
  return direct || sectionTypeFallback(section, copy)
}

const HomeView = () => {
  const auth = useAuthStore()
  const language = auth.language
  const { church, homePage, groupCards, upcomingEvents, recentSermons } = useHomeData()

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

  const hasPublishedHomePage = homePage && homePage.visibility === 'public' && homePage.sections?.length > 0
  const normalizedHomeSections = hasPublishedHomePage ? normalizePageSections(homePage.sections) : []
  const navItems = hasPublishedHomePage
    ? [
      ...normalizedHomeSections.slice(0, 4).map((section, index) => ({
        href: `#${getPageSectionDomId(section, index)}`,
        label: readSectionNavLabel(section, language, copy),
      })),
      { href: '#groups', label: copy.nav.groups },
      { href: '#events', label: copy.nav.events },
      { href: '#location', label: copy.nav.location },
    ]
    : rawDefaultNavItems
  const sanitizedNavItems = navItems.map((item) =>
    item.href === '#events' ? { ...item, label: eventsNavLabel } : item,
  )

  return (
    <div className="min-h-screen overflow-hidden bg-home-surface text-home-gold-text">
      <HomeNavHeader copy={copy} language={language} navItems={sanitizedNavItems} />
      <main>
        <HeroSection copy={copy} language={language} />
        {hasPublishedHomePage ? (
          <>
            <PageContentRenderer
              page={homePage}
              sections={normalizedHomeSections}
              subgroupItems={[]}
              groupPageItems={[]}
              contextGroupId={church?.id}
              showHeader={false}
              framed={false}
            />
            <hr className="mx-auto max-w-6xl border-t border-home-border/40" />
          </>
        ) : (
          <>
            <AboutAndLiveSection copy={copy} />
            <hr className="mx-auto max-w-6xl border-t border-home-border/40" />
            <VisitSection copy={copy} language={language} />
            <hr className="mx-auto max-w-6xl border-t border-home-border/40" />
          </>
        )}
        <GroupsSection copy={copy} language={language} groupCards={groupCards} />
        <hr className="mx-auto max-w-6xl border-t border-home-border/40" />
        <EventsSection copy={copy} language={language} upcomingEvents={upcomingEvents} />
        <hr className="mx-auto max-w-6xl border-t border-home-border/40" />
        <RecentSermonsSection copy={copy} language={language} sermons={recentSermons} />
        <hr className="mx-auto max-w-6xl border-t border-home-border/40" />
        <LocationSection copy={copy} />
      </main>
      <HomeFooter copy={copy} navItems={sanitizedNavItems} />
    </div>
  )
}

export default HomeView
