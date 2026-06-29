import type { MouseEvent } from 'react'
import type { GroupSummaryDto, PageDetailDto } from '../../types'

export const media = {
  hero: '/media/alife-church-community-hero.jpg',
  message: '/media/alife-message-poster.jpg',
  visit: '/media/alife-visit.jpg',
  groups: '/media/alife-groups.jpg',
}

export const homepageHeroVideo = '/media/homepage-hero.mp4'
export const churchMapUrl = 'https://maps.app.goo.gl/VUdzffqEkKiq2Jy29'
export const churchMapEmbedUrl = 'https://maps.google.com/maps?q=-43.5498482,172.5624243&z=16&output=embed'
export const youtubeLiveUrl = 'https://www.youtube.com/@ChineseAbundantLifeChurch/live'
export const youtubeVideosUrl = 'https://www.youtube.com/@ChineseAbundantLifeChurch/videos'

export const fallbackGroupImages = [media.groups, media.visit, media.hero, media.message]

export type HomeGroupCard = {
  group: GroupSummaryDto
  imageUrl: string
}

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
