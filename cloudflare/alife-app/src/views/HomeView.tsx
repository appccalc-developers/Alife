import { useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { ArrowRight, BookOpenText, CalendarDays, ExternalLink, HeartHandshake, MapPin, Menu, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageContentRenderer, { normalizePageSections } from '../components/page/PageContentRenderer'
import logo from '../assets/logo.png'
import { activeEntityService } from '../services/activeEntityService'
import { eventService } from '../services/eventService'
import { groupService } from '../services/groupService'
import { pageService } from '../services/pageService'
import { useAuthStore } from '../stores/auth'
import type { GroupDto, GroupSummaryDto, PageDetailDto, PageSummaryDto } from '../types'
import type { GroupEventRecord } from '../types/event'
import { localizeText } from '../utils/localizedText'
import { DEFAULT_HERO_IMAGE } from '../components/page-sections/sectionUtils'

const media = {
  hero: '/media/alife-church-community-hero.jpg',
  message: '/media/alife-message-poster.jpg',
  visit: '/media/alife-visit.jpg',
  groups: '/media/alife-groups.jpg',
}

const churchMapUrl = 'https://maps.app.goo.gl/VUdzffqEkKiq2Jy29'
const churchMapEmbedUrl = 'https://maps.google.com/maps?q=-43.5498482,172.5624243&z=16&output=embed'
const homepageHeroVideo = '/media/homepage-hero.mp4'

type HomeGroupCard = {
  group: GroupSummaryDto
  imageUrl: string
}

const fallbackGroupImages = [media.groups, media.visit, media.hero, media.message]

const readContentMedia = (content: Record<string, unknown> | undefined) => {
  const source = content ?? {}
  const mediaValue = source.media && typeof source.media === 'object' && !Array.isArray(source.media)
    ? source.media as Record<string, unknown>
    : null
  const candidate =
    source.backgroundImageUrl ||
    source.backgroundImage ||
    source.imageUrl ||
    mediaValue?.url
  return typeof candidate === 'string' ? candidate.trim() : ''
}

const readSectionImage = (page: PageDetailDto) => {
  for (const section of page.sections ?? []) {
    const candidate = readContentMedia(section.contentJson)
    if (candidate) {
      return candidate
    }
  }
  return ''
}

const HomeView = () => {
  const auth = useAuthStore()
  const language = auth.language
  const [church, setChurch] = useState<GroupDto | null>(null)
  const [pages, setPages] = useState<PageSummaryDto[]>([])
  const [homePage, setHomePage] = useState<PageDetailDto | null>(null)
  const [events, setEvents] = useState<GroupEventRecord[]>([])
  const [groupCards, setGroupCards] = useState<HomeGroupCard[]>([])
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([groupService.getChurch(), groupService.getGlobalPages()])
      .then(([churchResult, pagesResult]) => {
        if (cancelled) return
        if (pagesResult.status === 'fulfilled') setPages(pagesResult.value)
        if (churchResult.status !== 'fulfilled') return
        setChurch(churchResult.value)
        eventService.getGroupEvents(churchResult.value.id)
          .then((items) => { if (!cancelled) setEvents(items) })
          .catch(() => { if (!cancelled) setEvents([]) })
        Promise.allSettled([
          groupService.getSubgroups(churchResult.value.id),
          groupService.getVisibleGroups(),
        ])
          .then(async ([subgroupsResult, visibleGroupsResult]) => {
            const groupMap = new Map<string, GroupSummaryDto>()
            if (subgroupsResult.status === 'fulfilled') {
              subgroupsResult.value.forEach((group) => groupMap.set(group.id, group))
            }
            if (visibleGroupsResult.status === 'fulfilled') {
              visibleGroupsResult.value
                .filter((group) => group.id !== churchResult.value.id)
                .forEach((group) => groupMap.set(group.id, group))
            }
            const groups = Array.from(groupMap.values()).slice(0, 8)
            const cards = await Promise.all(groups.map(async (group, index) => {
              let imageUrl = fallbackGroupImages[index % fallbackGroupImages.length]
              try {
                const groupPages = await groupService.getGroupPages(group.id)
                const firstPage = groupPages[0]
                if (firstPage?.id) {
                  const page = await pageService.getPageById(firstPage.id)
                  imageUrl = readSectionImage(page) || imageUrl
                }
              } catch {
                imageUrl = fallbackGroupImages[index % fallbackGroupImages.length]
              }
              return { group, imageUrl }
            }))
            if (!cancelled) setGroupCards(cards)
          })
          .catch(() => { if (!cancelled) setGroupCards([]) })
      })

    return () => { cancelled = true }
  }, [])

  const homePageSummary = useMemo(() => {
    const readTags = (page: PageSummaryDto) => {
      try {
        return JSON.parse(page.tagsJson || '[]') as string[]
      } catch {
        return []
      }
    }
    return pages.find((page) => readTags(page).includes('home')) ??
      pages.find((page) => {
        const title = `${page.title?.en || ''} ${page.title?.zh || ''}`.toLowerCase()
        return title.includes('home') || title.includes('homepage') || title.includes('首页') || title.includes('主页')
      }) ??
      null
  }, [pages])

  useEffect(() => {
    if (!homePageSummary?.id) {
      setHomePage(null)
      return
    }
    let cancelled = false
    pageService.getPageById(homePageSummary.id)
      .then((page) => { if (!cancelled) setHomePage(page) })
      .catch(() => { if (!cancelled) setHomePage(null) })
    return () => { cancelled = true }
  }, [homePageSummary?.id])

  const upcomingEvents = useMemo(
    () => [...events]
      .filter((event) => !event.endDate || new Date(event.endDate).getTime() >= Date.now())
      .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime())
      .slice(0, 4),
    [events],
  )

  const activeGroupId = activeEntityService.getAll().groupId
  const churchName = language === 'zh' ? '华人丰盛生命教会' : 'Chinese Abundant Life Church'
  const churchDescription = localizeText(church?.description, language)
  const copy = language === 'zh'
    ? {
      about: '关于我们',
      visit: '首次来访',
      groups: '小组生活',
      events: '近期活动',
      sermons: '讲道信息',
      give: '奉献与支持',
      login: '登录',
      account: '进入 Alife',
      heroKicker: '一个给海外华人的信仰家',
      heroTitle: '在基督里相遇，\n在真实关系中成长。',
      heroBody: '我们是一间扎根基督城的华人教会，陪伴不同生命阶段的人认识耶稣、建立归属，并把信仰活进日常。',
      planVisit: '计划首次来访',
      findGroup: '寻找小组',
      missionTitle: '我们盼望每个人都能认识耶稣、找到归属，并活出使命。',
      missionBody: churchDescription || '无论你刚接触信仰、正在寻找教会，还是希望更深参与服事，这里都可以成为你重新出发的地方。',
      missionPillOne: '主日敬拜',
      missionPillTwo: '小组同行',
      missionPillThree: '城市见证',
      missionNote: '从第一次来访，到加入小组、参与服事，我们希望每一步都清楚、温暖，也真实连接到日常生活。',
      visitTitle: '第一次来，也可以很自然。',
      visitBody: '你可以先了解聚会地点、交通、语言环境和现场流程。我们欢迎你按照自己的节奏认识这个群体。',
      visitAction: '查看地点',
      groupsTitle: '信仰不是只在周日发生。',
      groupsBody: '小组让人可以围坐下来分享生活、彼此代祷、一起读经，也在需要时得到真实支持。',
      groupsAction: '浏览小组',
      sermonsTitle: '用讲道继续思想信仰与生活。',
      sermonsBody: '从近期信息开始，了解我们如何在圣经、家庭、工作、城市生活和个人成长中回应神。',
      sermonsAction: '浏览讲道',
      eventsTitle: '参与正在发生的事。',
      eventsEmpty: '新的公开活动即将发布。你也可以先加入一个小组，认识更多同行的人。',
      locationLabel: '教会地点',
      locationName: '基督城华人丰盛生命教会',
      openMap: '在 Google Maps 打开',
      givingTitle: '一起支持教会与社区的使命。',
      givingBody: '线上奉献入口正在准备中。正式开放后，这里会提供清晰、安全的奉献方式。',
      givingSoon: '奉献入口即将开放',
      footerLine: '认识耶稣，找到归属，活出使命。',
    }
    : {
      about: 'About',
      visit: 'Visit',
      groups: 'Groups',
      events: 'Events',
      sermons: 'Sermons',
      give: 'Give',
      login: 'Login',
      account: 'Open Alife',
      heroKicker: 'A faith home for Chinese communities overseas',
      heroTitle: 'Meet Christ here.\nGrow through real community.',
      heroBody: 'We are a Christchurch Chinese church helping people discover Jesus, find belonging, and live out faith in everyday life.',
      planVisit: 'Plan your visit',
      findGroup: 'Find a group',
      missionTitle: 'We want every person to know Jesus, find belonging, and live with purpose.',
      missionBody: churchDescription || 'Whether you are exploring faith, looking for a church, or ready to serve, this can be a place to begin again.',
      missionPillOne: 'Sunday worship',
      missionPillTwo: 'Group life',
      missionPillThree: 'City witness',
      missionNote: 'From a first visit to joining a group and serving, each step should feel clear, warm, and connected to everyday life.',
      visitTitle: 'Your first visit can feel simple.',
      visitBody: 'Learn where we meet, what to expect, and how to arrive. You can come at your own pace and get to know the community naturally.',
      visitAction: 'View location',
      groupsTitle: 'Faith is not only for Sundays.',
      groupsBody: 'Groups create space to share life, pray together, study Scripture, and receive practical support when it matters.',
      groupsAction: 'Browse groups',
      sermonsTitle: 'Keep reflecting on faith and life.',
      sermonsBody: 'Start with recent messages and see how Scripture speaks into family, work, city life, and personal growth.',
      sermonsAction: 'Browse sermons',
      eventsTitle: 'Be part of what is happening.',
      eventsEmpty: 'New public events are coming soon. You can also join a group and meet people walking in the same direction.',
      locationLabel: 'Church location',
      locationName: 'Chinese Abundant Life Church, Christchurch',
      openMap: 'Open in Google Maps',
      givingTitle: 'Help carry the mission of our church and community.',
      givingBody: 'Online giving is being prepared. A clear and secure giving experience will be available here when it opens.',
      givingSoon: 'Online giving coming soon',
      footerLine: 'Know Jesus. Find belonging. Live with purpose.',
    }

  const accountTo = activeGroupId ? '/groups' : '/groups/select'
  const accountLabel = auth.isGuest ? copy.login : copy.account
  const accountPath = auth.isGuest ? '/onboarding' : accountTo
  const locationAddress = '182 The Runway, Wigram, Christchurch 8042, New Zealand'
  const closeMenu = () => setMenuOpen(false)
  const scrollToSection = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith('#')) return
    const target = document.querySelector<HTMLElement>(href)
    if (!target) return
    event.preventDefault()
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.history.replaceState(null, '', href)
    closeMenu()
  }
  const navItems = [
    { label: copy.about, href: '#about' },
    { label: copy.visit, href: '#visit' },
    { label: copy.groups, href: '#groups' },
    { label: copy.events, href: '#events' },
    { label: copy.sermons, href: '#sermons' },
  ]
  const homePageSections = useMemo(() => {
    if (!homePage) {
      return []
    }

    return normalizePageSections(homePage.sections).map((section, index) => {
      if (index !== 0 || section.type !== 'Hero') {
        return section
      }

      const heroMedia = readContentMedia(section.contentJson)
      if (heroMedia && heroMedia !== DEFAULT_HERO_IMAGE) {
        return section
      }

      return {
        ...section,
        contentJson: {
          ...section.contentJson,
          backgroundImage: homepageHeroVideo,
          backgroundImageUrl: homepageHeroVideo,
        },
      }
    })
  }, [homePage])

  if (homePage) {
    return (
      <main className="min-h-screen bg-[#f5f1e8] text-[#172d28]">
        <PageContentRenderer
          page={homePage}
          sections={homePageSections}
          subgroupItems={[]}
          groupPageItems={pages.map((page) => ({
            id: page.id,
            title: localizeText(page.title, language),
            visibility: page.visibility,
          }))}
          showHeader={false}
          framed={false}
        />
      </main>
    )
  }

  return (
    <div className="bg-[#f6f2ea] text-[#172d28]">
      <header className="absolute inset-x-0 top-0 z-50 text-white">
        <div className="mx-auto flex min-h-24 max-w-[96rem] items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
          <Link className="flex min-w-0 max-w-[17rem] items-center gap-3 xl:max-w-none" to="/" onClick={closeMenu}>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
              <img src={logo} alt="" className="h-9 w-9 object-contain" />
            </span>
            <span className="max-w-[14rem] truncate text-base font-black tracking-[-0.03em] sm:max-w-none sm:text-lg">{churchName}</span>
          </Link>
          <nav className="hidden items-center gap-1 rounded-full border border-white/15 bg-white/10 p-1 text-xs font-black uppercase tracking-wide backdrop-blur lg:flex xl:text-sm">
            {navItems.map((item) => (
              <a key={item.href} className="rounded-full px-3.5 py-2 text-white/78 transition hover:bg-white/12 hover:text-white xl:px-4" href={item.href} onClick={(event) => scrollToSection(event, item.href)}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button className="rounded-full px-3 py-2 text-sm font-black text-white/80 transition hover:bg-white/10 hover:text-white" type="button" onClick={() => void auth.updateLanguage(language === 'zh' ? 'en' : 'zh')}>
              {language === 'zh' ? 'EN' : '中文'}
            </button>
            <Link className="hidden rounded-full border border-white/45 px-5 py-2.5 text-sm font-black text-white transition hover:bg-white hover:text-[#172d28] sm:inline-flex" to={accountPath}>
              {accountLabel}
            </Link>
            <button className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/10 lg:hidden" type="button" aria-label="Menu" onClick={() => setMenuOpen((open) => !open)}>
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {menuOpen ? (
          <div className="mx-4 rounded-2xl bg-emerald-800 p-5 shadow-2xl lg:hidden">
            <nav className="grid">
              {navItems.map((item) => <a key={item.href} className="border-b border-white/10 px-2 py-4 text-lg font-black" href={item.href} onClick={(event) => scrollToSection(event, item.href)}>{item.label}</a>)}
              <Link className="mt-5 rounded-full bg-[#e8664b] px-5 py-3 text-center font-black text-white" to={accountPath} onClick={closeMenu}>{accountLabel}</Link>
            </nav>
          </div>
        ) : null}
      </header>

      <main>
        <section className="relative min-h-[780px] overflow-hidden rounded-b-[3rem] bg-[#1f4f43] shadow-[0_28px_80px_rgba(31,79,67,0.18)] lg:min-h-screen">
          <img src={media.hero} alt="" className="absolute inset-0 h-full w-full object-cover object-[68%_center]" />
          <video
            className="absolute inset-0 h-full w-full object-cover object-[68%_center]"
            src={homepageHeroVideo}
            poster={media.hero}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#10231f]/95 via-[#10231f]/64 to-[#10231f]/14" />
          <div className="relative mx-auto flex min-h-[780px] max-w-[96rem] items-end px-5 pb-24 pt-36 sm:px-8 lg:min-h-screen lg:items-center lg:px-12 lg:pb-0">
            <div className="max-w-3xl text-white">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f39c85]">{copy.heroKicker}</p>
              <h1 className="mt-6 whitespace-pre-line text-5xl font-black leading-[0.98] tracking-[-0.05em] sm:text-7xl lg:text-[6rem]">{copy.heroTitle}</h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-white/78">{copy.heroBody}</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a className="inline-flex items-center gap-2 rounded-full bg-[#e8664b] px-6 py-3.5 font-black text-white shadow-[0_12px_30px_rgba(232,102,75,0.28)] transition hover:-translate-y-0.5" href="#visit" onClick={(event) => scrollToSection(event, '#visit')}>
                  {copy.planVisit} <ArrowRight className="h-4 w-4" />
                </a>
                <Link className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-6 py-3.5 font-black text-emerald-900 transition hover:-translate-y-0.5 hover:bg-white" to="/groups/select">
                  {copy.findGroup} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="px-4 py-14 sm:px-8 lg:py-20">
          <div className="mx-auto grid max-w-[88rem] gap-7 rounded-[2.25rem] border border-emerald-100 bg-white/78 p-6 shadow-[0_22px_60px_rgba(23,45,40,0.07)] backdrop-blur sm:p-8 lg:grid-cols-[0.56fr_0.44fr] lg:p-10">
            <div className="flex flex-col justify-center">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#e8664b]">{copy.about}</p>
              <h2 className="mt-4 text-3xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">{copy.missionTitle}</h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-[#63736d] sm:text-lg">{copy.missionBody}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {[copy.missionPillOne, copy.missionPillTwo, copy.missionPillThree].map((item) => (
                  <span key={item} className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800">{item}</span>
                ))}
              </div>
            </div>
            <div className="grid gap-4">
              <div className="rounded-[1.5rem] bg-[#f6f2ea] p-5">
                <p className="text-sm font-bold leading-7 text-[#50655e]">{copy.missionNote}</p>
              </div>
              <Feature icon={HeartHandshake} title={language === 'zh' ? '真实关系' : 'Real belonging'} body={language === 'zh' ? '从主日聚会到小组生活，让人被认识、被陪伴。' : 'From Sunday gathering to small groups, people are known and supported.'} />
              <Feature icon={BookOpenText} title={language === 'zh' ? '圣经扎根' : 'Rooted in Scripture'} body={language === 'zh' ? '让讲道、查经和日常决定都回到神的话语。' : 'Messages, studies, and everyday choices are shaped by God’s word.'} />
            </div>
          </div>
        </section>

        <section id="visit" className="px-4 py-16 sm:px-8 lg:py-24">
          <div className="mx-auto grid max-w-[88rem] overflow-hidden rounded-[2.5rem] bg-white shadow-[0_22px_70px_rgba(23,45,40,0.09)] lg:grid-cols-[0.48fr_0.52fr]">
            <div className="relative min-h-[28rem]">
              <img src={media.visit} alt="" className="absolute inset-0 h-full w-full object-cover" />
            </div>
            <div className="flex items-center p-7 sm:p-12 lg:p-16">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#e8664b]">{copy.visit}</p>
                <h2 className="mt-5 text-4xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">{copy.visitTitle}</h2>
                <p className="mt-5 text-lg leading-8 text-[#63736d]">{copy.visitBody}</p>
                <a className="mt-7 inline-flex items-center gap-2 rounded-full bg-emerald-700 px-6 py-3.5 font-black text-white shadow-sm transition hover:bg-emerald-800" href="#location" onClick={(event) => scrollToSection(event, '#location')}>
                  {copy.visitAction} <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="groups" className="px-4 py-16 sm:px-8 lg:py-24">
          <div className="mx-auto grid max-w-[88rem] items-center gap-12 lg:grid-cols-[0.42fr_0.58fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">{copy.groups}</p>
              <h2 className="mt-5 text-4xl font-black leading-tight tracking-[-0.04em] sm:text-6xl">{copy.groupsTitle}</h2>
              <p className="mt-6 text-lg leading-8 text-[#50655e]">{copy.groupsBody}</p>
              <Link className="mt-7 inline-flex items-center gap-2 rounded-full bg-emerald-700 px-6 py-3.5 font-black text-white shadow-sm transition hover:bg-emerald-800" to="/groups/select">
                {copy.groupsAction} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <img src={media.groups} alt="" className="min-h-[28rem] w-full rounded-[2.5rem] object-cover shadow-[0_22px_70px_rgba(23,45,40,0.12)]" />
          </div>
        </section>

        <section id="sermons" className="px-4 py-16 sm:px-8 lg:py-24">
          <div className="mx-auto grid max-w-[88rem] overflow-hidden rounded-[2.5rem] bg-[#efe8dc] lg:grid-cols-[0.46fr_0.54fr]">
            <div className="p-7 sm:p-12 lg:p-16">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#e8664b]">{copy.sermons}</p>
              <h2 className="mt-5 text-4xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">{copy.sermonsTitle}</h2>
              <p className="mt-5 text-lg leading-8 text-[#63736d]">{copy.sermonsBody}</p>
              <Link className="mt-7 inline-flex items-center gap-2 rounded-full bg-emerald-700 px-6 py-3.5 font-black text-white shadow-sm transition hover:bg-emerald-800" to="/sermons">
                {copy.sermonsAction} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="relative min-h-[28rem]">
              <img src={media.message} alt="" className="absolute inset-0 h-full w-full object-cover" />
            </div>
          </div>
        </section>

        <section id="events" className="px-4 py-16 sm:px-8 lg:py-24">
          <div className="mx-auto max-w-[88rem]">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#e8664b]">{copy.events}</p>
                <h2 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-6xl">{copy.eventsTitle}</h2>
              </div>
              <Link className="inline-flex items-center gap-2 self-start border-b-2 border-[#172d28] pb-1 font-black" to="/groups/select">
                {copy.groupsAction} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {upcomingEvents.length > 0 ? (
              <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                {upcomingEvents.map((event, index) => {
                  const start = new Date(event.startDate)
                  const eventImage = [media.visit, media.groups, media.message, media.hero][index % 4]
                  return (
                    <Link key={event.id} className="group relative min-h-[26rem] overflow-hidden rounded-[2rem] bg-emerald-800 shadow-[0_22px_60px_rgba(23,45,40,0.12)] transition duration-300 hover:-translate-y-1" to="/events" onClick={() => activeEntityService.setEvent(event.id, event.groupId)}>
                      <img src={eventImage} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#10231f]/95 via-[#10231f]/25 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-7 text-white">
                        <span className="inline-flex rounded-full bg-[#e8664b] px-3 py-1.5 text-xs font-black uppercase tracking-wide">{Number.isNaN(start.getTime()) ? '' : new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }).format(start)}</span>
                        <h3 className="mt-4 text-2xl font-black leading-tight tracking-[-0.03em]">{(language === 'zh' ? event.titleZh : event.titleEn) || event.titleEn || event.titleZh}</h3>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="mt-10 rounded-[2rem] border border-emerald-100 bg-white p-8 shadow-sm">
                <CalendarDays className="h-8 w-8 text-emerald-700" />
                <p className="mt-5 max-w-2xl text-lg leading-8 text-[#63736d]">{copy.eventsEmpty}</p>
              </div>
            )}
            {groupCards.length > 0 ? (
              <div className="mt-14 overflow-hidden rounded-[2.25rem] border border-emerald-100 bg-emerald-50/70 px-4 py-8 sm:px-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">{copy.groups}</p>
                    <h3 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#172d28]">{language === 'zh' ? '也可以先从一个小组开始' : 'You can also start with a group'}</h3>
                  </div>
                  <Link className="hidden items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-emerald-800 shadow-sm transition hover:bg-emerald-100 sm:inline-flex" to="/groups/select">
                    {copy.groupsAction} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="alife-home-groups-marquee mt-7 flex w-max gap-5">
                  {[...groupCards, ...groupCards].map((card, index) => (
                    <Link
                      key={`${card.group.id}-${index}`}
                      to="/groups"
                      onClick={() => activeEntityService.setGroup(card.group.id, { clearPage: true })}
                      className={`w-[18rem] shrink-0 overflow-hidden rounded-[1.5rem] border border-white bg-white shadow-[0_20px_55px_rgba(31,79,67,0.12)] transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(31,79,67,0.18)] ${index % groupCards.length === 0 ? 'sm:w-[23rem]' : ''}`}
                    >
                      <div className="relative h-36 overflow-hidden bg-emerald-100">
                        <img src={card.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                        <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-emerald-800 shadow-sm">
                          {card.group.accessType === 'public' ? (language === 'zh' ? '公开' : 'Public') : (language === 'zh' ? '小组' : 'Group')}
                        </span>
                      </div>
                      <div className="p-5">
                        <h4 className="line-clamp-2 text-xl font-black leading-tight tracking-[-0.03em] text-emerald-950">{localizeText(card.group.name, language)}</h4>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{localizeText(card.group.description, language) || (language === 'zh' ? '打开小组主页，了解聚会、页面、活动与成员内容。' : 'Open the group home to see pages, events, and member content.')}</p>
                        <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-sm font-black text-white">
                          {language === 'zh' ? '进入' : 'Enter'} <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section id="location" className="px-4 py-16 sm:px-8 lg:py-24">
          <div className="mx-auto grid max-w-[88rem] overflow-hidden rounded-[2.5rem] bg-emerald-900 text-white shadow-[0_20px_55px_rgba(23,45,40,0.16)] lg:grid-cols-[0.34fr_0.66fr]">
            <div className="flex items-center px-6 py-14 sm:px-12 lg:px-16">
              <div>
                <MapPin className="h-8 w-8 text-[#f39c85]" />
                <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-[#f39c85]">{copy.locationLabel}</p>
                <h3 className="mt-4 text-3xl font-black leading-tight tracking-[-0.04em]">{copy.locationName}</h3>
                <p className="mt-4 max-w-sm text-base font-bold leading-7 text-white/72">{locationAddress}</p>
                <a className="mt-7 inline-flex items-center gap-2 border-b-2 border-white pb-1 font-black" href={churchMapUrl} target="_blank" rel="noreferrer">
                  {copy.openMap} <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
            <div className="m-2 min-h-[28rem] overflow-hidden rounded-[1.5rem] bg-[#d9ddd8] sm:m-3 sm:rounded-[2.25rem]">
              <iframe title={copy.locationLabel} src={churchMapEmbedUrl} className="h-full min-h-[28rem] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
            </div>
          </div>
        </section>

        <section id="give" className="px-4 pb-20 sm:px-8 lg:pb-28">
          <div className="mx-auto grid max-w-[84rem] gap-10 overflow-hidden rounded-[2.5rem] bg-white px-6 py-16 shadow-[0_22px_70px_rgba(23,45,40,0.08)] sm:px-12 lg:grid-cols-[0.34fr_0.66fr] lg:px-20">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">{copy.give}</p>
            <div>
              <h2 className="text-4xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">{copy.givingTitle}</h2>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#63736d]">{copy.givingBody}</p>
              <span className="mt-8 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-6 py-3 text-sm font-black text-emerald-800">{copy.givingSoon}</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-emerald-950 px-5 py-16 text-white sm:px-8">
        <div className="mx-auto grid max-w-[84rem] gap-12 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white"><img src={logo} alt="" className="h-9 w-9" /></span>
              <span className="text-xl font-black">{churchName}</span>
            </div>
            <p className="mt-5 text-sm font-bold uppercase tracking-wide text-white/45">{copy.footerLine}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-sm font-black sm:grid-cols-3">
            {navItems.map((item) => <a key={item.href} className="text-white/65 transition hover:text-white" href={item.href}>{item.label}</a>)}
            <Link className="text-white/65 transition hover:text-white" to={accountPath}>{accountLabel}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

const Feature = ({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) => (
  <article className="group relative overflow-hidden rounded-[1.75rem] border border-emerald-100 bg-white p-6 shadow-[0_18px_50px_rgba(31,79,67,0.08)] transition hover:-translate-y-1 hover:shadow-[0_22px_70px_rgba(31,79,67,0.14)]">
    <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-[3rem] bg-emerald-50 transition group-hover:bg-emerald-100" />
    <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-sm"><Icon className="h-5 w-5" /></span>
    <h3 className="relative mt-6 text-xl font-black tracking-[-0.02em] text-[#172d28]">{title}</h3>
    <p className="relative mt-3 text-sm leading-6 text-[#63736d]">{body}</p>
  </article>
)

export default HomeView
