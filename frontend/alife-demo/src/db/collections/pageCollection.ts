import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import type { PageSummaryDto } from '../../types'
import { conditionalGet, getCachedRecord } from '../httpCache'
import { queryClient } from '../queryClient'

// ---------- Global pages ----------

export const globalPagesQueryKey = (lang: string) => ['globalPages', lang] as const

export const globalPagesCollection = (lang: string) =>
  createCollection(
    queryCollectionOptions({
      queryClient,
      queryKey: globalPagesQueryKey(lang),
      getKey: (item: PageSummaryDto) => item.id,
      queryFn: async () =>
        conditionalGet<PageSummaryDto[]>({
          queryKey: globalPagesQueryKey(lang),
          path: '/api/pages/global',
        }),
    }),
  )

export const getCachedGlobalPages = async (lang: string) =>
  (await getCachedRecord<PageSummaryDto[]>(globalPagesQueryKey(lang)))?.data ?? []

// ---------- Page by slug (单个对象，只做缓存不做 collection) ----------

export const pageBySlugQueryKey = (slug: string, lang: string) => ['pageBySlug', slug, lang] as const

export const getCachedPageBySlug = async (slug: string, lang: string) =>
  (await getCachedRecord<{ id: string; title: string; slug: string }>(pageBySlugQueryKey(slug, lang)))?.data ?? null

// ---------- Page sections ----------

export const pageSectionsQueryKey = (pageId: string) => ['pageSections', pageId] as const

export type SectionDtoRaw = {
  id: string
  pageId: string
  order: number
  type: number | string
  contentJson: string
  styleJson: string
}

export const pageSectionsCollection = (pageId: string) =>
  createCollection(
    queryCollectionOptions({
      queryClient,
      queryKey: pageSectionsQueryKey(pageId),
      getKey: (item: SectionDtoRaw) => item.id,
      queryFn: async () =>
        conditionalGet<SectionDtoRaw[]>({
          queryKey: pageSectionsQueryKey(pageId),
          path: `/api/pages/${pageId}/sections`,
        }),
    }),
  )

export const getCachedPageSections = async (pageId: string) =>
  (await getCachedRecord<SectionDtoRaw[]>(pageSectionsQueryKey(pageId)))?.data ?? []
