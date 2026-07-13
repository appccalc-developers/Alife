import { useEffect, useMemo, useState } from 'react'
import { groupService } from '../../services/groupService'
import { eventService } from '../../services/eventService'
import { getCachedPublicPages, pageService } from '../../services/pageService'
import { sermonService, type SermonDto } from '../../services/sermonService'
import { getCachedChurch, getCachedVisibleGroups } from '../../db/collections/groupCollection'
import type { GroupDto, PageSummaryDto } from '../../types'
import type { GroupEventRecord } from '../../types/event'
import { fallbackGroupImages, readSectionImage } from './homeUtils'
import type { HomeGroupCard } from './homeUtils'

const retryDelaysMs = [250, 750]

const wait = (milliseconds: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, milliseconds)
})

const withRetry = async <T>(request: () => Promise<T>): Promise<T> => {
  let lastError: unknown
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      return await request()
    } catch (error) {
      lastError = error
      if (attempt < retryDelaysMs.length) {
        await wait(retryDelaysMs[attempt])
      }
    }
  }
  throw lastError
}

const withPublicCacheFallback = async <T>(request: () => Promise<T>, readCached: () => Promise<T | null>): Promise<T> => {
  try {
    return await withRetry(request)
  } catch (error) {
    const cached = await readCached()
    if (cached !== null && cached !== undefined && (!Array.isArray(cached) || cached.length > 0)) {
      return cached as T
    }
    throw error
  }
}

export const useHomeData = () => {
  const [church, setChurch] = useState<GroupDto | null>(null)
  const [publicPages, setPublicPages] = useState<PageSummaryDto[]>([])
  const [events, setEvents] = useState<GroupEventRecord[]>([])
  const [groupCards, setGroupCards] = useState<HomeGroupCard[]>([])
  const [sermons, setSermons] = useState<SermonDto[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [sermonsLoading, setSermonsLoading] = useState(true)

  // --- Phase 1: Load church + public website data in parallel ---
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const [churchResult, publicPagesResult, sermonsResult, groupsResult] = await Promise.allSettled([
        withPublicCacheFallback(() => groupService.getChurch(), getCachedChurch),
        withPublicCacheFallback(() => pageService.getPublicPages(), getCachedPublicPages),
        withPublicCacheFallback(() => sermonService.getLatest(3), () => sermonService.getCachedLatest(3)),
        withPublicCacheFallback(() => groupService.getVisibleGroups(), getCachedVisibleGroups),
      ])

      if (cancelled) return

      if (publicPagesResult.status === 'fulfilled') setPublicPages(publicPagesResult.value)
      if (sermonsResult.status === 'fulfilled') setSermons(sermonsResult.value)
      setSermonsLoading(false)

      // --- Build group cards from visible child groups (works for anonymous users too) ---
      const groups = (groupsResult.status === 'fulfilled'
        ? groupsResult.value.filter((group) => !group.isChurch && group.accessType !== 'private')
        : []
      ).slice(0, 6)

      // Show cards immediately with fallback images
      const initialCards = groups.map((group, index) => ({
        group,
        imageUrl: fallbackGroupImages[index % fallbackGroupImages.length],
      }))
      if (!cancelled) setGroupCards(initialCards)

      if (churchResult.status === 'fulfilled') {
        const churchData = churchResult.value
        setChurch(churchData)

        const eventsResult = await withRetry(() => eventService.getGroupEvents(churchData.id))
          .then((value) => ({ status: 'fulfilled' as const, value }))
          .catch((reason) => ({ status: 'rejected' as const, reason }))

        if (cancelled) return
        if (eventsResult.status === 'fulfilled') {
          setEvents(eventsResult.value)
        }
      }
      setEventsLoading(false)

      // --- Phase 3: Load real group card images in background ---
      Promise.all(
        groups.map(async (group, index) => {
          let imageUrl = fallbackGroupImages[index % fallbackGroupImages.length]
          try {
            const groupPages = await groupService.getGroupPages(group.id)
            const firstPage = groupPages[0]
            if (firstPage?.id) {
              const page = await pageService.getPageById(firstPage.id)
              imageUrl = readSectionImage(page) || imageUrl
            }
          } catch {
            // keep fallback
          }
          return { group, imageUrl }
        }),
      ).then((cards) => {
        if (!cancelled) setGroupCards(cards)
      }).catch(() => {})
    }

    load().catch((err) => console.error('[useHomeData] load failed:', err))
    return () => { cancelled = true }
  }, [])

  // --- Upcoming events (derived) ---
  const upcomingEvents = useMemo(
    () => [...events]
      .filter((event) => !event.endDate || new Date(event.endDate).getTime() >= Date.now())
      .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime())
      .slice(0, 3),
    [events],
  )

  const recentSermons = useMemo(
    () => [...sermons]
      .sort((left, right) => {
        const leftDate = left.preachedAt ? new Date(left.preachedAt).getTime() : 0
        const rightDate = right.preachedAt ? new Date(right.preachedAt).getTime() : 0
        return rightDate - leftDate
      })
      .slice(0, 3),
    [sermons],
  )

  return { church, publicPages, events, groupCards, upcomingEvents, recentSermons, eventsLoading, sermonsLoading }
}
