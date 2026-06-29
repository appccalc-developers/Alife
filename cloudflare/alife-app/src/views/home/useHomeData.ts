import { useEffect, useMemo, useState } from 'react'
import { groupService } from '../../services/groupService'
import { eventService } from '../../services/eventService'
import { pageService } from '../../services/pageService'
import { sermonService, type SermonDto } from '../../services/sermonService'
import type { GroupDto, PageDetailDto, PageSummaryDto } from '../../types'
import type { GroupEventRecord } from '../../types/event'
import { fallbackGroupImages, readSectionImage } from './homeUtils'
import type { HomeGroupCard } from './homeUtils'

export const useHomeData = () => {
  const [church, setChurch] = useState<GroupDto | null>(null)
  const [pages, setPages] = useState<PageSummaryDto[]>([])
  const [homePage, setHomePage] = useState<PageDetailDto | null>(null)
  const [events, setEvents] = useState<GroupEventRecord[]>([])
  const [groupCards, setGroupCards] = useState<HomeGroupCard[]>([])
  const [sermons, setSermons] = useState<SermonDto[]>([])

  // --- Phase 1: Load church + pages in parallel ---
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const [churchResult, pagesResult, sermonsResult] = await Promise.allSettled([
        groupService.getChurch(),
        groupService.getGlobalPages(),
        sermonService.getLatest(),
      ])

      if (cancelled) return

      if (pagesResult.status === 'fulfilled') setPages(pagesResult.value)
      if (sermonsResult.status === 'fulfilled') setSermons(sermonsResult.value)

      if (churchResult.status !== 'fulfilled') return
      const churchData = churchResult.value
      setChurch(churchData)

      // --- Phase 2: Load events + subgroups in parallel (both depend on church id) ---
      const [eventsResult, subgroupsResult] = await Promise.allSettled([
        eventService.getGroupEvents(churchData.id),
        groupService.getSubgroups(churchData.id),
      ])

      if (cancelled) return

      if (eventsResult.status === 'fulfilled') {
        setEvents(eventsResult.value)
      }

      // --- Build group cards from subgroups (now works for anonymous users too) ---
      const groups = (subgroupsResult.status === 'fulfilled'
        ? subgroupsResult.value.filter((group) => group.id !== churchData.id)
        : []
      ).slice(0, 6)

      // Show cards immediately with fallback images
      const initialCards = groups.map((group, index) => ({
        group,
        imageUrl: fallbackGroupImages[index % fallbackGroupImages.length],
      }))
      if (!cancelled) setGroupCards(initialCards)

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

  // --- Home page detail (depends on pages list) ---
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

  return { church, pages, homePage, events, groupCards, upcomingEvents, recentSermons }
}
