import type { PageSummaryDto } from '../types'
import { localizeText } from './localizedText'

export type PublicPrimaryMenuOption = {
  id: string
  label: string
  sortOrder: number
}

const stableOrder = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER

export const publicPageMenuName = (page: PageSummaryDto, language: string) =>
  localizeText(page.accessName, language) ||
  page.accessName?.en ||
  page.accessName?.zh ||
  localizeText(page.title, language) ||
  page.title?.en ||
  page.title?.zh ||
  page.id

export const publicPageHomePath = (page: PageSummaryDto, language: string) => {
  const params = new URLSearchParams({
    page: publicPageMenuName(page, language),
    pageId: page.id,
  })
  return `/home?${params.toString()}`
}

export const getPublicReviewedPages = (pages: PageSummaryDto[]) => {
  const byId = new Map<string, PageSummaryDto>()
  pages.forEach((page) => {
    if (page.visibility === 'public' && !byId.has(page.id)) {
      byId.set(page.id, page)
    }
  })

  return Array.from(byId.values())
}

export const sortPublicReviewedPages = (pages: PageSummaryDto[], _language?: string) =>
  getPublicReviewedPages(pages).sort((left, right) =>
    stableOrder(left.primaryMenuSortOrder) - stableOrder(right.primaryMenuSortOrder) ||
    stableOrder(left.menuSortOrder) - stableOrder(right.menuSortOrder) ||
    left.id.localeCompare(right.id),
  )

export const publicPrimaryMenuOptions = (
  pages: PageSummaryDto[],
  language: string,
): PublicPrimaryMenuOption[] => {
  const byId = new Map<string, PublicPrimaryMenuOption>()

  getPublicReviewedPages(pages).forEach((page) => {
    const id = page.primaryMenuId?.trim()
    if (!id) return

    const label =
      localizeText(page.primaryMenuName, language) ||
      page.primaryMenuName?.en ||
      page.primaryMenuName?.zh ||
      id
    const candidate = {
      id,
      label,
      sortOrder: stableOrder(page.primaryMenuSortOrder),
    }
    const existing = byId.get(id)
    const candidateHasLabel = candidate.label !== id
    const existingHasLabel = existing?.label !== id

    if (
      !existing ||
      candidate.sortOrder < existing.sortOrder ||
      (candidate.sortOrder === existing.sortOrder && candidateHasLabel && !existingHasLabel)
    ) {
      byId.set(id, candidate)
    }
  })

  const locale = language === 'zh' ? 'zh-Hans' : 'en'
  return Array.from(byId.values()).sort((left, right) =>
    left.sortOrder - right.sortOrder ||
    left.label.localeCompare(right.label, locale, { sensitivity: 'base' }) ||
    left.id.localeCompare(right.id),
  )
}

export const publicPagesForPrimaryMenu = (
  pages: PageSummaryDto[],
  primaryMenuId: string | undefined,
) => {
  const targetId = primaryMenuId?.trim()
  if (!targetId) return []

  return getPublicReviewedPages(pages)
    .filter((page) => page.primaryMenuId?.trim() === targetId)
    .sort((left, right) =>
      stableOrder(left.menuSortOrder) - stableOrder(right.menuSortOrder) ||
      left.id.localeCompare(right.id),
    )
}
