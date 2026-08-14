import bootstrapJson from '../generated/publicHomeBootstrap.json'
import type { PageDetailDto, PageSummaryDto } from '../types'
import { normalizePageDetail } from '../utils/pageDetail'

type PublicHomeBootstrap = {
  generatedAt: number
  pages: PageSummaryDto[]
  homePage: PageDetailDto | null
}

type RawBootstrap = {
  generatedAt?: unknown
  pages?: unknown
  homePage?: unknown
}

const rawBootstrap = bootstrapJson as RawBootstrap

const isPublicPageSummary = (value: unknown): value is PageSummaryDto => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const page = value as Partial<PageSummaryDto>
  return typeof page.id === 'string' &&
    Boolean(page.id) &&
    page.visibility === 'public' &&
    Boolean(page.title && typeof page.title === 'object')
}

const pages = Array.isArray(rawBootstrap.pages)
  ? rawBootstrap.pages.filter(isPublicPageSummary)
  : []

const normalizePublicHomePage = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const page = normalizePageDetail(value as PageDetailDto & { tagsJson?: string })
  return page.visibility === 'public' && pages.some((summary) => summary.id === page.id)
    ? page
    : null
}

const generatedAt = typeof rawBootstrap.generatedAt === 'string'
  ? Date.parse(rawBootstrap.generatedAt)
  : Number.NaN

export const publicHomeBootstrap: PublicHomeBootstrap = {
  generatedAt: Number.isFinite(generatedAt) ? generatedAt : 0,
  pages,
  homePage: normalizePublicHomePage(rawBootstrap.homePage),
}
