import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { groupService } from '../api/groupService'
import { pageService } from '../services/pageService'
import { useAuthStore } from '../stores/auth'
import type { GroupPageDto } from '../types/group'
import type { SectionEditModel } from '../types/page-editor'

const readText = (source: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
  }

  return ''
}

const parseLimit = (source: Record<string, unknown>, key: string, fallback = 5) => {
  const raw = source[key]
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw)
  }

  if (typeof raw === 'string') {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return fallback
}

const toYouTubeEmbedUrl = (rawUrl: string) => {
  const value = rawUrl.trim()
  if (!value) {
    return ''
  }

  try {
    const url = new URL(value)
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.replace('/', '').trim()
      return id ? `https://www.youtube.com/embed/${id}` : ''
    }
    if (url.hostname.includes('youtube.com')) {
      const id = url.searchParams.get('v')?.trim()
      if (id) {
        return `https://www.youtube.com/embed/${id}`
      }
      const shortsMatch = url.pathname.match(/\/shorts\/([^/]+)/)
      if (shortsMatch?.[1]) {
        return `https://www.youtube.com/embed/${shortsMatch[1]}`
      }
    }
  } catch {
    return ''
  }

  return ''
}

const PageView = () => {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const auth = useAuthStore()

  const [page, setPage] = useState<GroupPageDto | null>(null)
  const [sections, setSections] = useState<SectionEditModel[]>([])
  const [subgroupItems, setSubgroupItems] = useState<Array<{ id: string; name: string; accessType: string }>>([])
  const [groupPageItems, setGroupPageItems] = useState<Array<{ id: string; title: string; slug: string; visibility: string }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    if (!slug) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const nextPage = await groupService.getPageBySlug(slug, auth.language)
      setPage(nextPage)

      const nextSections = nextPage?.id ? await pageService.getPageSections(nextPage.id) : []
      setSections(nextSections)

      if (nextPage?.ownerGroupId) {
        const [subgroups, pages] = await Promise.all([
          groupService.getSubgroups(nextPage.ownerGroupId),
          groupService.getGroupPages(nextPage.ownerGroupId, auth.language),
        ])
        setSubgroupItems(subgroups)
        setGroupPageItems(pages)
      } else {
        setSubgroupItems([])
        setGroupPageItems([])
      }
    } catch {
      setError('Page not found or not accessible for your membership.')
      setSections([])
      setSubgroupItems([])
      setGroupPageItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, auth.language])

  const sectionItems = useMemo(() => sections, [sections])

  return (
    <section className="mx-auto w-full max-w-5xl space-y-4 px-3 sm:px-4">
      {loading ? <p className="rounded-lg border border-slate-200 bg-white p-3 text-slate-600">Loading page...</p> : null}
      {!loading && error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</p> : null}

      {!loading && !error && page ? (
        <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <header className="space-y-2 border-b border-slate-200 pb-3">
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{page.title}</h1>
            <p className="text-sm text-slate-600">{page.description || 'No description for this page yet.'}</p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">Slug: {page.slug}</span>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">Visibility: {page.visibility}</span>
            </div>
          </header>

          <div className="space-y-4">
            {sectionItems.map((section) => {
              const key = section.id || `${section.order}-${section.type}`

              if (section.type === 'IconFeatureGrid' || section.type === 'SermonSpotlight') {
                const headline = readText(section.contentJson, 'title', 'headline')
                const subheadline = readText(section.contentJson, 'subtitle', 'subheadline')
                const bg = readText(section.contentJson, 'backgroundImage', 'backgroundImageUrl')
                const layout = section.type === 'SermonSpotlight' ? 'sermonSpotlight' : 'iconFeatureGrid'
                const youtubeUrl = readText(section.contentJson, 'youtubeUrl')
                const youtubeEmbedUrl = toYouTubeEmbedUrl(youtubeUrl)
                const linkUrl = readText(section.contentJson, 'linkUrl', 'ctaUrl', 'href')
                const body = readText(section.contentJson, 'centerText', 'body')
                const displayStyle = readText(section.styleJson, 'displayStyle') === 'newsGrid' ? 'newsGrid' : 'iconGrid'
                const imageShape = readText(section.styleJson, 'imageShape') === 'circle' ? 'circle' : 'square'
                const rawItems = Array.isArray(section.contentJson.iconItems) ? section.contentJson.iconItems : []
                const items = rawItems
                  .map((item) => {
                    if (!item || typeof item !== 'object') {
                      return { imageUrl: '', label: '', linkUrl: '' }
                    }
                    const record = item as Record<string, unknown>
                    return {
                      imageUrl: typeof record.imageUrl === 'string' ? record.imageUrl : '',
                      label: typeof record.label === 'string' ? record.label : '',
                      linkUrl: typeof record.linkUrl === 'string' ? record.linkUrl : '',
                    }
                  })
                  .filter((item) => item.imageUrl || item.label || item.linkUrl)

                if (layout === 'sermonSpotlight') {
                  return (
                    <section key={key} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                      <div className="px-5 py-8">
                        <div className="mx-auto max-w-4xl text-center">
                          <h2 className="text-2xl font-semibold text-slate-700 sm:text-4xl">{headline || "Today's Sermon"}</h2>
                          <p className="mt-1 text-base text-slate-500 sm:text-xl">{subheadline || 'God loves us all'}</p>
                        </div>
                        <div className="mt-8 grid gap-4 md:grid-cols-[1fr_1.2fr] md:items-center">
                          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                            {youtubeEmbedUrl ? (
                              <iframe
                                src={youtubeEmbedUrl}
                                title="Sermon video"
                                className="aspect-video w-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            ) : (
                              <div className="flex aspect-video items-center justify-center text-sm text-slate-500">No YouTube video linked yet.</div>
                            )}
                          </div>
                          <div className="space-y-4 text-center md:text-left">
                            <p className="whitespace-pre-wrap text-lg font-semibold text-indigo-900 sm:text-2xl">{body || 'Sermon title and summary'}</p>
                            {linkUrl ? (
                              <a
                                href={linkUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex rounded bg-red-500 px-6 py-2 text-sm font-medium text-white shadow hover:bg-red-400"
                              >
                                View
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </section>
                  )
                }

                if (displayStyle === 'newsGrid') {
                  return (
                    <section key={key} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      <div className="px-5 py-8">
                        <div className="mx-auto max-w-5xl text-center">
                          <h2 className="text-2xl font-semibold text-slate-700 sm:text-4xl">{headline || 'Latest News'}</h2>
                          <p className="mt-1 text-base text-slate-500 sm:text-lg">{subheadline || 'God loves us all'}</p>
                          <div className="mt-8 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
                            {items.map((item, idx) => (
                              <a
                                key={`${key}-news-${idx}`}
                                href={item.linkUrl || undefined}
                                target={item.linkUrl ? '_blank' : undefined}
                                rel={item.linkUrl ? 'noopener noreferrer' : undefined}
                                className="flex flex-col items-center gap-3"
                              >
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt=""
                                    className={
                                      imageShape === 'circle'
                                        ? 'h-24 w-24 rounded-full object-cover sm:h-32 sm:w-32'
                                        : 'h-28 w-full rounded-sm object-cover sm:h-40'
                                    }
                                  />
                                ) : null}
                                <span className="text-center text-xl text-slate-800 sm:text-3xl">{item.label || '[title]'}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>
                  )
                }

                return (
                  <section key={key} className="overflow-hidden rounded-lg border border-slate-200">
                    <div
                      className="bg-cover bg-center px-5 py-10 text-white"
                      style={{ backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.7), rgba(2, 6, 23, 0.7)), url(${bg || ''})` }}
                    >
                      <div className="mx-auto max-w-4xl text-center">
                        <h2 className="text-2xl font-semibold sm:text-4xl">{headline || 'Our Church main activities'}</h2>
                        <p className="mt-2 text-base text-slate-200 sm:text-lg">{subheadline || 'God loves us all'}</p>
                        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
                          {items.map((item, idx) => (
                            <a
                              key={`${key}-icon-${idx}`}
                              href={item.linkUrl || undefined}
                              target={item.linkUrl ? '_blank' : undefined}
                              rel={item.linkUrl ? 'noopener noreferrer' : undefined}
                              className="flex flex-col items-center gap-2 rounded px-2 py-2 hover:bg-white/10"
                            >
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt=""
                                  className={imageShape === 'circle' ? 'h-10 w-10 rounded-full object-cover' : 'h-10 w-10 object-contain'}
                                />
                              ) : null}
                              <span className="text-sm text-slate-100">{item.label || 'Untitled'}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                )
              }

              if (section.type === 'Hero' || section.type === 'MediaSpotlight') {
                const headline = readText(section.contentJson, 'title', 'headline')
                const subheadline = readText(section.contentJson, 'subtitle', 'subheadline')
                const centerText = readText(section.contentJson, 'centerText', 'body')
                const linkUrl = readText(section.contentJson, 'linkUrl', 'ctaUrl', 'href')
                const linkLabel = readText(section.contentJson, 'linkLabel', 'linkText', 'ctaLabel')
                const rawLayout = readText(section.styleJson, 'layout')
                const layout =
                  section.type === 'MediaSpotlight'
                    ? 'mediaSpotlight'
                    : rawLayout === 'split'
                      ? 'mediaSpotlight'
                      : rawLayout || 'featured'
                const imagePosition = readText(section.styleJson, 'imagePosition') === 'left' ? 'left' : 'right'
                const featured = layout === 'featured' || (!layout && Boolean(centerText.trim() || linkUrl.trim()))

                if (layout === 'mediaSpotlight') {
                  return (
                    <section key={key} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-2 md:items-center">
                        <div className={`order-2 ${imagePosition === 'left' ? 'md:order-2' : ''}`}>
                          <h2 className="text-2xl font-semibold text-slate-800 sm:text-4xl">{headline || 'Hero Section'}</h2>
                          <p className="mt-2 whitespace-pre-wrap text-base text-slate-700">
                            {centerText || subheadline || 'No hero content yet.'}
                          </p>
                          {linkUrl ? (
                            <a
                              href={linkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-4 inline-flex rounded bg-red-500 px-5 py-2 text-sm font-medium text-white shadow hover:bg-red-400"
                            >
                              {linkLabel.trim() || linkUrl}
                            </a>
                          ) : null}
                        </div>
                        <div className={`order-1 ${imagePosition === 'left' ? 'md:order-1' : ''}`}>
                          {readText(section.contentJson, 'backgroundImage', 'backgroundImageUrl') ? (
                            <img
                              src={readText(section.contentJson, 'backgroundImage', 'backgroundImageUrl')}
                              alt=""
                              className="h-48 w-full rounded-lg object-cover sm:h-[220px] md:h-[280px]"
                            />
                          ) : (
                            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500 sm:h-[220px] md:h-[280px]">
                              No image yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  )
                }

                return (
                  <section key={key} className="overflow-hidden rounded-lg border border-slate-200">
                    <div
                      className={`relative bg-cover bg-center px-5 py-8 text-white sm:py-12 ${featured ? 'min-h-[240px] sm:min-h-[320px]' : ''}`}
                      style={{
                        backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.45)), url(${readText(section.contentJson, 'backgroundImage', 'backgroundImageUrl') || ''})`,
                      }}
                    >
                      {featured ? (
                        <div className="flex h-full max-w-lg flex-col items-center justify-center gap-3 text-center">
                          <h2 className="text-3xl font-semibold tracking-wide text-yellow-300 sm:text-5xl">{headline || 'Hero Section'}</h2>
                          <p className="whitespace-pre-wrap text-sm text-slate-100">
                            {centerText || subheadline || 'No hero content yet.'}
                          </p>
                        </div>
                      ) : (
                        <>
                          <h2 className="text-2xl font-bold">{headline || 'Hero Section'}</h2>
                          <p className="mt-2 text-sm text-slate-100">{subheadline || 'No subtitle yet.'}</p>
                        </>
                      )}
                      {linkUrl ? (
                        <a
                          href={linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-4 inline-flex rounded bg-red-500 px-5 py-2 text-sm font-medium text-white shadow hover:bg-red-400 sm:absolute sm:bottom-5 sm:left-1/2 sm:mt-0 sm:-translate-x-1/2"
                        >
                          {linkLabel.trim() || linkUrl}
                        </a>
                      ) : null}
                    </div>
                  </section>
                )
              }

              if (section.type === 'RichText') {
                const variant = readText(section.styleJson, 'variant')
                if (variant === 'quoteOverlay' || Boolean(readText(section.contentJson, 'backgroundImage', 'backgroundImageUrl'))) {
                  const bg = readText(section.contentJson, 'backgroundImage', 'backgroundImageUrl')
                  return (
                    <section key={key} className="overflow-hidden rounded-lg border border-slate-200">
                      <div
                        className="bg-cover bg-center px-5 py-10 text-white"
                        style={{ backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.7), rgba(2, 6, 23, 0.7)), url(${bg || ''})` }}
                      >
                        <div className="mx-auto max-w-4xl text-center">
                          <h2 className="text-2xl font-semibold sm:text-4xl">{readText(section.contentJson, 'title') || 'Quote of the day'}</h2>
                          <p className="mt-1 text-base text-slate-200 sm:text-lg">{readText(section.contentJson, 'subtitle') || 'God loves us all'}</p>
                          <p className="mt-6 whitespace-pre-wrap text-2xl italic leading-relaxed text-slate-100 sm:mt-8 sm:text-4xl">
                            {readText(section.contentJson, 'text') || 'No quote content yet.'}
                          </p>
                          <p className="mt-4 text-xl font-medium text-yellow-300 sm:text-3xl">{readText(section.contentJson, 'quoteAuthor') || ''}</p>
                        </div>
                      </div>
                    </section>
                  )
                }

                return (
                  <section key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-700">
                    <p className="whitespace-pre-wrap">{readText(section.contentJson, 'text') || 'No rich text content yet.'}</p>
                  </section>
                )
              }

              if (section.type === 'GroupList') {
                return (
                  <section key={key} className="rounded-lg border border-slate-200 bg-white p-4">
                    <h3 className="text-lg font-semibold text-slate-900">{readText(section.contentJson, 'title') || 'Groups'}</h3>
                    {readText(section.contentJson, 'description') ? (
                      <p className="mt-1 text-sm text-slate-600">{readText(section.contentJson, 'description')}</p>
                    ) : null}
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {subgroupItems.slice(0, parseLimit(section.contentJson, 'limit', 6)).map((group) => (
                        <li key={group.id} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="font-medium text-slate-900">{group.name}</p>
                          <p className="text-xs text-slate-500">Access: {group.accessType}</p>
                        </li>
                      ))}
                    </ul>
                    {subgroupItems.length === 0 ? <p className="mt-3 text-sm text-slate-500">No groups available.</p> : null}
                  </section>
                )
              }

              if (section.type === 'PageList') {
                return (
                  <section key={key} className="rounded-lg border border-slate-200 bg-white p-4">
                    <h3 className="text-lg font-semibold text-slate-900">{readText(section.contentJson, 'title') || 'Pages'}</h3>
                    <ul className="mt-3 space-y-2">
                      {groupPageItems.slice(0, parseLimit(section.contentJson, 'limit', 8)).map((item) => (
                        <li key={item.id} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                          <Link className="font-medium text-blue-700 hover:underline" to={`/pages/${item.slug}`}>
                            {item.title}
                          </Link>
                          <p className="text-xs text-slate-500">Visibility: {item.visibility}</p>
                        </li>
                      ))}
                    </ul>
                    {groupPageItems.length === 0 ? <p className="mt-3 text-sm text-slate-500">No pages available.</p> : null}
                  </section>
                )
              }

              if (section.type === 'SermonList') {
                return (
                  <section key={key} className="rounded-lg border border-slate-200 bg-white p-4">
                    <h3 className="text-lg font-semibold text-slate-900">{readText(section.contentJson, 'title') || 'Sermons'}</h3>
                    <p className="mt-1 text-sm text-slate-600">Sermons are synced into this section. Set a YouTube channel to drive updates.</p>
                    {readText(section.contentJson, 'youtubeChannelId') ? (
                      <a
                        className="mt-3 inline-flex rounded border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                        href={`https://www.youtube.com/channel/${readText(section.contentJson, 'youtubeChannelId')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open YouTube Channel
                      </a>
                    ) : null}
                  </section>
                )
              }

              return (
                <section key={key} className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  {section.type} section configured.
                </section>
              )
            })}

            {sections.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">No sections yet.</div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {page.ownerGroupId ? (
              <button
                className="rounded border border-blue-300 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
                type="button"
                onClick={() => {
                  navigate(`/pages/${page.id}/edit?groupId=${page.ownerGroupId}`)
                }}
              >
                Edit Page
              </button>
            ) : null}
          </div>
        </article>
      ) : null}
    </section>
  )
}

export default PageView
