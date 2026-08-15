import { generatedArticleCoverSlugs } from './articleCoverManifest.ts'

const generatedArticleCoverBasePath = '/article-covers/generated'
const generatedArticleCoverSlugSet = new Set<string>(generatedArticleCoverSlugs)

export const generatedArticleCoverUrl = (slug: string) => {
  const normalizedSlug = slug.trim().toLowerCase()
  if (!generatedArticleCoverSlugSet.has(normalizedSlug)) return null

  return `${generatedArticleCoverBasePath}/${encodeURIComponent(normalizedSlug)}.webp`
}
