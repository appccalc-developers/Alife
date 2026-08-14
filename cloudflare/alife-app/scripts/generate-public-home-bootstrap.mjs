import { access, mkdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const outputPath = path.resolve(scriptDirectory, '../src/generated/publicHomeBootstrap.json')
const publicSiteOrigin = (process.env.ALIFE_PUBLIC_SITE_ORIGIN || 'https://ccalc.live').replace(/\/$/, '')

const stableOrder = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER

const fetchJson = async (pathname) => {
  const response = await fetch(`${publicSiteOrigin}${pathname}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`${pathname} returned HTTP ${response.status}`)
  }

  return response.json()
}

const generate = async () => {
  const publicPagesResponse = await fetchJson('/api/pages/public')
  if (!Array.isArray(publicPagesResponse)) {
    throw new Error('/api/pages/public did not return an array')
  }

  const publicPages = publicPagesResponse.filter((page) =>
    page && typeof page.id === 'string' && page.visibility === 'public',
  )
  const homePageSummary = publicPages
    .filter((page) => typeof page.primaryMenuId === 'string' && page.primaryMenuId.trim())
    .sort((left, right) =>
      stableOrder(left.primaryMenuSortOrder) - stableOrder(right.primaryMenuSortOrder) ||
      stableOrder(left.menuSortOrder) - stableOrder(right.menuSortOrder) ||
      left.id.localeCompare(right.id),
    )[0]

  if (!homePageSummary) {
    throw new Error('No public page is assigned to a primary menu')
  }

  const homePage = await fetchJson(`/api/pages/${encodeURIComponent(homePageSummary.id)}`)
  if (!homePage || homePage.id !== homePageSummary.id || homePage.visibility !== 'public') {
    throw new Error('The selected homepage detail is not a matching public page')
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    pages: publicPages,
    homePage,
  }
  const temporaryPath = `${outputPath}.${process.pid}.tmp`

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, outputPath)

  console.log(
    `Generated public homepage bootstrap for ${homePageSummary.id} with ${publicPages.length} public pages.`,
  )
}

try {
  await generate()
} catch (error) {
  try {
    await access(outputPath)
    console.warn(
      `Could not refresh the public homepage bootstrap; keeping the checked-in snapshot. ${error instanceof Error ? error.message : error}`,
    )
  } catch {
    throw error
  }
}
