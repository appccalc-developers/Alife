import type { MouseEvent } from 'react'
import type { GroupSummaryDto, PageDetailDto, PageSummaryDto } from '../../types'
import { defaultContactLocationMapEmbedUrl, defaultContactLocationMapUrl } from '../../utils/contactLocation'
import { localizeText } from '../../utils/localizedText'
import {
  publicPageHomePath,
  publicPageMenuName,
  sortPublicReviewedPages,
} from '../../utils/publicPageMenus'

export {
  getPublicReviewedPages,
  publicPageHomePath,
  publicPageMenuName,
  sortPublicReviewedPages,
} from '../../utils/publicPageMenus'

export const media = {
  hero: '/media/alife-church-community-hero.jpg',
  message: '/media/alife-message-poster.jpg',
  visit: '/media/alife-visit.jpg',
  groups: '/media/alife-groups.jpg',
}

export const homepageHeroVideo = '/media/homepage-hero.mp4'
export const churchMapUrl = defaultContactLocationMapUrl
export const churchMapEmbedUrl = defaultContactLocationMapEmbedUrl
export const youtubeChannelId = 'UCtcwkfeJL45qwR4MEJSHhYw'
export const youtubeLiveUrl = 'https://www.youtube.com/@ChineseAbundantLifeChurch/live'
export const youtubeVideosUrl = 'https://www.youtube.com/@ChineseAbundantLifeChurch/videos'
export const youtubeLiveEmbedUrl = `https://www.youtube.com/embed/live_stream?channel=${youtubeChannelId}&rel=0&playsinline=1`

export const fallbackGroupImages = [media.groups, media.visit, media.hero, media.message]

export type HomeGroupCard = {
  group: GroupSummaryDto
  imageUrl: string
}

export type HomeNavLinkItem = { href: string; label: string }
export type HomeNavRouteItem = { to: string; label: string }
export type HomeNavDropdownChild = { to: string; label: string }
export type HomeNavDropdownItem = { key: string; label: string; items: HomeNavDropdownChild[] }
export type HomeNavItem = HomeNavLinkItem | HomeNavRouteItem | HomeNavDropdownItem

export const isDropdownNavItem = (item: HomeNavItem): item is HomeNavDropdownItem =>
  'items' in item

export const isRouteNavItem = (item: HomeNavItem): item is HomeNavRouteItem =>
  'to' in item && !('items' in item)

export type ServiceCountdown = {
  totalMs: number
  isLive: boolean
  targetDateTime: string
  days: number
  hours: number
  minutes: number
  seconds: number
}

const SERVICE_TIME_ZONE = 'Pacific/Auckland'
const SUNDAY_INDEX = 0
const SERVICE_START_MINUTES = 9 * 60 + 45
const SERVICE_END_MINUTES = 12 * 60
const COUNTDOWN_TARGET_MINUTES = 10 * 60
const weekdayIndexes: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}
const serviceTimeFormatter = new Intl.DateTimeFormat('en-NZ', {
  timeZone: SERVICE_TIME_ZONE,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

type ServiceTimeParts = {
  weekday: number
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const getServiceTimeParts = (date: Date): ServiceTimeParts => {
  const parts = Object.fromEntries(
    serviceTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )

  return {
    weekday: weekdayIndexes[parts.weekday] ?? SUNDAY_INDEX,
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

const getServiceTimeZoneOffsetMs = (date: Date) => {
  const parts = getServiceTimeParts(date)
  const zonedClockAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  return zonedClockAsUtc - date.getTime()
}

const createServiceDate = (year: number, month: number, day: number, hour: number, minute: number) => {
  const targetClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
  let timestamp = targetClockAsUtc

  // A second pass handles a DST offset change between the initial estimate and target date.
  for (let pass = 0; pass < 2; pass += 1) {
    timestamp = targetClockAsUtc - getServiceTimeZoneOffsetMs(new Date(timestamp))
  }

  return new Date(timestamp)
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

const primaryMenuLookupKey = (page: PageSummaryDto, fallbackLabel: string) => {
  if (page.primaryMenuId) return page.primaryMenuId
  const en = page.primaryMenuName?.en?.trim() || fallbackLabel
  const zh = page.primaryMenuName?.zh?.trim() || fallbackLabel
  return JSON.stringify([publicPageLookupKey(en), publicPageLookupKey(zh)])
}

export const buildPageMenuNavItems = (
  pages: PageSummaryDto[],
  language: string,
  fallbackLabel: string,
): HomeNavItem[] => {
  const groups = new Map<string, { label: string; sortOrder: number; items: HomeNavDropdownChild[] }>()
  const sortedMenuPages = sortPublicReviewedPages(pages, language)
    .filter((page) => page.primaryMenuId && localizeText(page.primaryMenuName, language))
  const homePageId = sortedMenuPages[0]?.id

  sortedMenuPages.forEach((page) => {
    const key = primaryMenuLookupKey(page, fallbackLabel)
    const label = localizeText(page.primaryMenuName, language) || fallbackLabel
    const group = groups.get(key) ?? { label, sortOrder: page.primaryMenuSortOrder ?? Number.MAX_SAFE_INTEGER, items: [] }
    group.items.push({
      to: page.id === homePageId ? '/' : publicPageHomePath(page, language),
      label: publicPageMenuName(page, language),
    })
    groups.set(key, group)
  })

  const locale = language === 'zh' ? 'zh-Hans' : 'en'
  return Array.from(groups.entries())
    .sort(([, left], [, right]) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, locale, { sensitivity: 'base' }))
    .map(([key, group]) => group.items.length === 1
      ? { to: group.items[0].to, label: group.label }
      : { key: `pages:${key}`, label: group.label, items: group.items })
}

export const getFirstPageMenuPage = (pages: PageSummaryDto[], language: string) =>
  sortPublicReviewedPages(pages, language).find((page) =>
    Boolean(page.primaryMenuId && localizeText(page.primaryMenuName, language)),
  ) ?? null

const publicPageLookupKey = (value: string | null | undefined) =>
  value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase() ?? ''

export const findPublicPageByMenuName = (
  pages: PageSummaryDto[],
  menuName: string | null | undefined,
  language: string,
) => {
  const target = publicPageLookupKey(menuName)
  if (!target) {
    return null
  }

  const preferredMatch = pages.find((page) =>
    publicPageLookupKey(publicPageMenuName(page, language)) === target,
  )
  if (preferredMatch) {
    return preferredMatch
  }

  return pages.find((page) => [
    page.accessName?.en,
    page.accessName?.zh,
    page.title?.en,
    page.title?.zh,
    page.id,
  ].some((candidate) => publicPageLookupKey(candidate) === target)) ?? null
}

export const getNextSundayServiceTime = (now = new Date()) => {
  const parts = getServiceTimeParts(now)
  const localCalendarDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  const daysUntilSunday = (7 - parts.weekday) % 7
  localCalendarDate.setUTCDate(localCalendarDate.getUTCDate() + daysUntilSunday)

  let next = createServiceDate(
    localCalendarDate.getUTCFullYear(),
    localCalendarDate.getUTCMonth() + 1,
    localCalendarDate.getUTCDate(),
    Math.floor(COUNTDOWN_TARGET_MINUTES / 60),
    COUNTDOWN_TARGET_MINUTES % 60,
  )

  if (next.getTime() <= now.getTime()) {
    localCalendarDate.setUTCDate(localCalendarDate.getUTCDate() + 7)
    next = createServiceDate(
      localCalendarDate.getUTCFullYear(),
      localCalendarDate.getUTCMonth() + 1,
      localCalendarDate.getUTCDate(),
      Math.floor(COUNTDOWN_TARGET_MINUTES / 60),
      COUNTDOWN_TARGET_MINUTES % 60,
    )
  }

  return next
}

export const isSundayServiceLive = (now = new Date()) => {
  const parts = getServiceTimeParts(now)
  if (parts.weekday !== SUNDAY_INDEX) return false
  const minutes = parts.hour * 60 + parts.minute
  return minutes >= SERVICE_START_MINUTES && minutes <= SERVICE_END_MINUTES
}

export const getServiceCountdown = (now = new Date()): ServiceCountdown => {
  const isLive = isSundayServiceLive(now)
  const serviceTimeParts = getServiceTimeParts(now)
  const targetDateTime = isLive
    ? createServiceDate(
        serviceTimeParts.year,
        serviceTimeParts.month,
        serviceTimeParts.day,
        Math.floor(COUNTDOWN_TARGET_MINUTES / 60),
        COUNTDOWN_TARGET_MINUTES % 60,
      )
    : getNextSundayServiceTime(now)

  if (isLive) {
    return {
      totalMs: 0,
      isLive,
      targetDateTime: targetDateTime.toISOString(),
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    }
  }

  const totalMs = Math.max(0, targetDateTime.getTime() - now.getTime())
  const totalSeconds = Math.floor(totalMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return {
    totalMs,
    isLive,
    targetDateTime: targetDateTime.toISOString(),
    days,
    hours,
    minutes,
    seconds,
  }
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
