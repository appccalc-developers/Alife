import { useEffect, useMemo, useState } from 'react'
import { groupService } from '../../services/groupService'
import { eventService } from '../../services/eventService'
import { pageService } from '../../services/pageService'
import { sermonService, type SermonDto } from '../../services/sermonService'
import type { GroupDto, PageSummaryDto } from '../../types'
import type { GroupEventRecord } from '../../types/event'
import { fallbackGroupImages, readSectionImage } from './homeUtils'
import type { HomeGroupCard } from './homeUtils'

export const useHomeData = () => {
  const [church, setChurch] = useState<GroupDto | null>(null)
  const [publicPages, setPublicPages] = useState<PageSummaryDto[]>([])
  const [events, setEvents] = useState<GroupEventRecord[]>([])
  const [groupCards, setGroupCards] = useState<HomeGroupCard[]>([])
  const [sermons, setSermons] = useState<SermonDto[]>([])

  // --- Phase 1: Load church + public website data in parallel ---
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const [churchResult, publicPagesResult, sermonsResult, groupsResult] = await Promise.allSettled([
        groupService.getChurch(),
        pageService.getPublicPages(),
        sermonService.getLatest(3),
        groupService.getVisibleGroups(),
      ])

      if (cancelled) return

      if (publicPagesResult.status === 'fulfilled') setPublicPages(publicPagesResult.value)
      if (sermonsResult.status === 'fulfilled') setSermons(sermonsResult.value)

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

        const eventsResult = await eventService.getGroupEvents(churchData.id)
          .then((value) => ({ status: 'fulfilled' as const, value }))
          .catch((reason) => ({ status: 'rejected' as const, reason }))

        if (cancelled) return
        if (eventsResult.status === 'fulfilled') {
          setEvents(eventsResult.value)
        }
      }

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

  return { church, publicPages, events, groupCards, upcomingEvents, recentSermons }
}
