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

const sectionTypeFallback = (section: SectionEditModel, language: string) => {
  if (section.type === 'Hero') return language === 'zh' ? '首页介绍' : 'Intro'
  if (section.type === 'Spotlight') return language === 'zh' ? '重点内容' : 'Highlight'
  if (section.type === 'RichText') return language === 'zh' ? '说明' : 'Info'
  if (section.type === 'ListView') {
    const source = String(section.contentJson.source ?? section.contentJson.sourceType ?? '')
    if (source === 'events') return language === 'zh' ? '近期活动' : 'Events'
    if (source === 'groups') return language === 'zh' ? '小组生活' : 'Groups'
    if (source === 'pages') return language === 'zh' ? '页面' : 'Pages'
    if (source === 'members') return language === 'zh' ? '成员' : 'Members'
    return language === 'zh' ? '列表' : 'List'
  }
  if (section.type === 'Sermon') return language === 'zh' ? '主日信息' : 'Sermon'
  return language === 'zh' ? '内容' : 'Section'
}

const cleanSectionTypeFallback = (section: SectionEditModel, language: string) => {
  if (section.type === 'Hero') return language === 'zh' ? '首页介绍' : 'Intro'
  if (section.type === 'Spotlight') return language === 'zh' ? '重点内容' : 'Highlight'
  if (section.type === 'RichText') return language === 'zh' ? '说明' : 'Info'
  if (section.type === 'ListView') {
    const source = String(section.contentJson.source ?? section.contentJson.sourceType ?? '')
    if (source === 'events') return language === 'zh' ? '近期活动' : 'Events'
    if (source === 'groups') return language === 'zh' ? '小组生活' : 'Groups'
    if (source === 'pages') return language === 'zh' ? '页面' : 'Pages'
    if (source === 'members') return language === 'zh' ? '成员' : 'Members'
    return language === 'zh' ? '列表' : 'List'
  }
  if (section.type === 'Sermon') return language === 'zh' ? '主日信息' : 'Sermon'
  return language === 'zh' ? '内容' : 'Section'
}

const readSectionNavLabel = (section: SectionEditModel, language: string) => {
  const header = section.contentJson.header
  if (header && typeof header === 'object' && !Array.isArray(header)) {
    const title = (header as { title?: unknown }).title
    const localized = localizeText(title as never, language)
    if (localized) return localized
  }

  const direct = localizeText((section.contentJson.title ?? section.contentJson.headline) as never, language)
  return direct || cleanSectionTypeFallback(section, language) || sectionTypeFallback(section, language)
}

const HomeView = () => {
  const auth = useAuthStore()
  const language = auth.language
  const { church, homePage, groupCards, upcomingEvents, recentSermons } = useHomeData()

  const churchDescription = localizeText(church?.description, language)
  const copy = getCopy(language, churchDescription)
  const eventsNavLabel = language === 'zh' ? '近期活动' : 'Events'

  const rawDefaultNavItems = [
    { href: '#about', label: copy.nav.about },
    { href: '#visit', label: copy.nav.visit },
    { href: '#groups', label: copy.nav.groups },
    { href: '#events', label: language === 'zh' ? '近期活动' : 'Events' },
    { href: '#sermons', label: copy.nav.sermons },
    { href: '#location', label: copy.nav.location },
  ]

  const hasPublishedHomePage = homePage && homePage.visibility === 'public' && homePage.sections?.length > 0
  const normalizedHomeSections = hasPublishedHomePage ? normalizePageSections(homePage.sections) : []
  const navItems = hasPublishedHomePage
    ? [
      ...normalizedHomeSections.slice(0, 4).map((section, index) => ({
        href: `#${getPageSectionDomId(section, index)}`,
        label: readSectionNavLabel(section, language),
      })),
      { href: '#groups', label: copy.nav.groups },
      { href: '#events', label: language === 'zh' ? '近期活动' : 'Events' },
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
            <AboutAndLiveSection copy={copy} language={language} />
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
