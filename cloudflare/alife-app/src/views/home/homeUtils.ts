import type { MouseEvent } from 'react'
import type { GroupSummaryDto, PageDetailDto, PageSummaryDto } from '../../types'
import { defaultContactLocationMapEmbedUrl, defaultContactLocationMapUrl } from '../../utils/contactLocation'
import { localizeText } from '../../utils/localizedText'

export const media = {
  hero: '/media/alife-church-community-hero.jpg',
  message: '/media/alife-message-poster.jpg',
  visit: '/media/alife-visit.jpg',
  groups: '/media/alife-groups.jpg',
}

export const homepageHeroVideo = '/media/homepage-hero.mp4'
export const churchMapUrl = defaultContactLocationMapUrl
export const churchMapEmbedUrl = defaultContactLocationMapEmbedUrl
export const youtubeLiveUrl = 'https://www.youtube.com/@ChineseAbundantLifeChurch/live'
export const youtubeVideosUrl = 'https://www.youtube.com/@ChineseAbundantLifeChurch/videos'

export const fallbackGroupImages = [media.groups, media.visit, media.hero, media.message]

export type HomeGroupCard = {
  group: GroupSummaryDto
  imageUrl: string
}

export type HomeNavLinkItem = { href: string; label: string }
export type HomeNavDropdownChild = { to: string; label: string }
export type HomeNavDropdownItem = { key: string; label: string; items: HomeNavDropdownChild[] }
export type HomeNavItem = HomeNavLinkItem | HomeNavDropdownItem

export const isDropdownNavItem = (item: HomeNavItem): item is HomeNavDropdownItem =>
  'items' in item

export type ServiceCountdown = {
  totalMs: number
  isLive: boolean
  days: number
  hours: number
  minutes: number
  seconds: number
}

export const readContentMedia = (content: Record<string, unknown> | undefined) => {
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

export const readSectionImage = (page: PageDetailDto) => {
  for (const section of page.sections ?? []) {
    const candidate = readContentMedia(section.contentJson)
    if (candidate) return candidate
  }
  return ''
}

const localizedPageTitle = (page: PageSummaryDto, language: string) =>
  localizeText(page.title, language) || page.title?.en || page.title?.zh || page.id

export const buildMinistriesNavItem = (
  pages: PageSummaryDto[],
  language: string,
  label: string,
): HomeNavDropdownItem | null => {
  const byId = new Map<string, PageSummaryDto>()
  pages.forEach((page) => {
    if (page.visibility === 'public' && !byId.has(page.id)) {
      byId.set(page.id, page)
    }
  })

  const locale = language === 'zh' ? 'zh-Hans' : 'en'
  const items = Array.from(byId.values())
    .sort((left, right) => {
      const leftLabel = localizedPageTitle(left, language)
      const rightLabel = localizedPageTitle(right, language)
      return leftLabel.localeCompare(rightLabel, locale, { sensitivity: 'base' }) ||
        left.id.localeCompare(right.id)
    })
    .map((page) => ({
      to: `/public/pages/${page.id}`,
      label: localizedPageTitle(page, language),
    }))

  return items.length > 0 ? { key: 'ministries', label, items } : null
}

export const insertMinistriesNavItem = (
  navItems: HomeNavLinkItem[],
  ministriesItem: HomeNavDropdownItem | null,
): HomeNavItem[] => {
  if (!ministriesItem) {
    return navItems
  }

  const groupIndex = navItems.findIndex((item) => item.href === '#groups' || item.href === '/#groups')
  const insertAt = groupIndex >= 0
    ? groupIndex + 1
    : Math.max(0, navItems.findIndex((item) => item.href === '#events' || item.href === '/#events'))

  return [
    ...navItems.slice(0, insertAt),
    ministriesItem,
    ...navItems.slice(insertAt),
  ]
}

export const getNextSundayServiceTime = (now = new Date()) => {
  const next = new Date(now)
  const daysUntilSunday = (7 - next.getDay()) % 7
  next.setDate(next.getDate() + daysUntilSunday)
  next.setHours(10, 0, 0, 0)

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 7)
  }

  return next
}

export const isSundayServiceLive = (now = new Date()) => {
  if (now.getDay() !== 0) return false
  const start = new Date(now)
  start.setHours(9, 45, 0, 0)
  const end = new Date(now)
  end.setHours(12, 0, 0, 0)
  return now.getTime() >= start.getTime() && now.getTime() <= end.getTime()
}

export const getServiceCountdown = (now = new Date()): ServiceCountdown => {
  const isLive = isSundayServiceLive(now)
  if (isLive) {
    return { totalMs: 0, isLive, days: 0, hours: 0, minutes: 0, seconds: 0 }
  }

  const totalMs = Math.max(0, getNextSundayServiceTime(now).getTime() - now.getTime())
  const totalSeconds = Math.floor(totalMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return { totalMs, isLive, days, hours, minutes, seconds }
}

export const createSectionHandler = (closeMenu?: () => void) => (event: MouseEvent<HTMLAnchorElement>, href: string) => {
  if (!href.startsWith('#')) return
  event.preventDefault()
  closeMenu?.()
  const target = document.querySelector(href)
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }
  window.location.href = `/${href}`
}

export const entranceAnimation = (prefersReducedMotion: boolean | null) =>
  prefersReducedMotion
    ? {}
    : {
      initial: { opacity: 0, y: 24 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true, margin: '-80px' },
      transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
    }
