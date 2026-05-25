import { Link } from 'react-router-dom'
import { readText, parseLimit } from '../../utils/pageSectionContent'
import { GroupListSection } from '../sections/GroupListSection'
import type { SectionEditModel } from '../../types/page-editor'

export type GroupPagePreviewSubgroup = { id: string; name: string; accessType: string }
export type GroupPagePreviewPageItem = { id: string; title: string; visibility: string }

type Props = {
  title: string
  description: string
  visibility?: string
  sections: SectionEditModel[]
  subgroupItems?: GroupPagePreviewSubgroup[]
  groupPageItems?: GroupPagePreviewPageItem[]
  /** When true, used inside a compact panel (smaller typography) */
  compact?: boolean
  /** Resolves GroupList smart sections (subgroups/members/group pages) when not on /groups/:id route */
  previewGroupId?: string
}

const GroupPagePreview = ({
  title,
  description,
  sections,
  groupPageItems = [],
  compact,
  previewGroupId,
}: Props) => {
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
      }
    } catch {
      return ''
    }
    return ''
  }

  const h1 = compact ? 'text-xl font-bold text-slate-900' : 'text-3xl font-bold text-slate-900'
  const desc = compact ? 'text-xs text-slate-600' : 'text-sm text-slate-600'

  return (
    <article className="space-y-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className={`space-y-2 border-b border-slate-200 bg-white ${compact ? 'p-3 pb-2' : 'p-5 pb-3'}`}>
        <h1 className={h1}>{title.trim() || '（尚未填写标题）'}</h1>
        <p className={desc}>{description.trim() || '（尚未填写页面摘要）'}</p>
        <div />
      </header>

      <div className={`space-y-3 ${compact ? 'p-3 pt-0' : 'space-y-4 p-5 pt-0'}`}>
        {sections.map((section) => {
          const key = section.id || `${section.order}-${section.type}`

          if (section.type === 'IconFeatureGrid' || section.type === 'SermonSpotlight') {
            const bg = readText(section.contentJson, 'backgroundImage', 'backgroundImageUrl')
            const headline = readText(section.contentJson, 'title', 'headline')
            const sub = readText(section.contentJson, 'subtitle', 'subheadline')
            const layout = section.type === 'SermonSpotlight' ? 'sermonSpotlight' : 'iconFeatureGrid'
            const youtubeEmbedUrl = toYouTubeEmbedUrl(readText(section.contentJson, 'youtubeUrl'))
            const body = readText(section.contentJson, 'centerText', 'body')
            const linkUrl = readText(section.contentJson, 'linkUrl', 'ctaUrl', 'href')
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
                  <div className={compact ? 'px-3 py-5' : 'px-5 py-8'}>
                    <div className="mx-auto max-w-4xl text-center">
                      <h2 className={compact ? 'text-xl font-semibold text-slate-700' : 'text-3xl font-semibold text-slate-700'}>
                        {headline || "Today's Sermon"}
                      </h2>
                      <p className={compact ? 'mt-1 text-xs text-slate-500' : 'mt-1 text-lg text-slate-500'}>{sub || 'God loves us all'}</p>
                    </div>
                    <div className={`mt-5 grid gap-3 ${compact ? '' : 'md:grid-cols-[1fr_1.2fr] md:items-center'}`}>
                      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        {youtubeEmbedUrl ? (
                          <iframe
                            src={youtubeEmbedUrl}
                            referrerPolicy="strict-origin-when-cross-origin"
                            title="Sermon video preview"
                            className="aspect-video w-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <div className={`flex aspect-video items-center justify-center text-slate-500 ${compact ? 'text-[11px]' : 'text-sm'}`}>
                            YouTube URL 未填写
                          </div>
                        )}
                      </div>
                      <div className="space-y-3 text-center md:text-left">
                        <p className={`${compact ? 'text-sm' : 'text-2xl'} whitespace-pre-wrap font-semibold text-indigo-900`}>
                          {body || 'Sermon title and summary'}
                        </p>
                        {linkUrl ? (
                          <a
                            href={linkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={
                              compact
                                ? 'inline-flex rounded bg-red-500 px-3 py-1 text-[11px] font-medium text-white shadow hover:bg-red-400'
                                : 'inline-flex rounded bg-red-500 px-5 py-2 text-sm font-medium text-white shadow hover:bg-red-400'
                            }
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
                  <div className={compact ? 'px-3 py-5' : 'px-5 py-8'}>
                    <div className="mx-auto max-w-5xl text-center">
                      <h2 className={compact ? 'text-xl font-semibold text-slate-700' : 'text-3xl font-semibold text-slate-700'}>
                        {headline || 'Latest News'}
                      </h2>
                      <p className={compact ? 'mt-1 text-xs text-slate-500' : 'mt-1 text-lg text-slate-500'}>{sub || 'God loves us all'}</p>
                      <div className={`mt-5 grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
                        {items.map((item, idx) => (
                          <a
                            key={`${key}-news-${idx}`}
                            href={item.linkUrl || undefined}
                            target={item.linkUrl ? '_blank' : undefined}
                            rel={item.linkUrl ? 'noopener noreferrer' : undefined}
                            className="flex flex-col items-center gap-2"
                          >
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt=""
                                className={
                                  imageShape === 'circle'
                                    ? compact
                                      ? 'h-20 w-20 rounded-full object-cover'
                                      : 'h-28 w-28 rounded-full object-cover'
                                    : compact
                                      ? 'h-20 w-full rounded-sm object-cover'
                                      : 'h-32 w-full rounded-sm object-cover'
                                }
                              />
                            ) : null}
                            <span className={compact ? 'text-[11px] text-slate-800' : 'text-sm text-slate-800'}>{item.label || '[title]'}</span>
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
                  className={`${compact ? 'px-3 py-5' : 'px-5 py-8'} bg-cover bg-center text-white`}
                  style={{ backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.7), rgba(2, 6, 23, 0.7)), url(${bg || ''})` }}
                >
                  <div className="mx-auto max-w-4xl text-center">
                    <h2 className={compact ? 'text-xl font-semibold' : 'text-3xl font-semibold'}>{headline || 'Our Church main activities'}</h2>
                    <p className={compact ? 'mt-1 text-xs text-slate-200' : 'mt-2 text-base text-slate-200'}>{sub || 'God loves us all'}</p>
                    <div className={`mt-5 grid gap-3 ${compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-6'}`}>
                      {items.map((item, idx) => (
                        <a
                          key={`${key}-icon-${idx}`}
                          href={item.linkUrl || undefined}
                          target={item.linkUrl ? '_blank' : undefined}
                          rel={item.linkUrl ? 'noopener noreferrer' : undefined}
                          className="flex flex-col items-center gap-1 rounded px-1 py-1 hover:bg-white/10"
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className={
                                imageShape === 'circle'
                                  ? compact
                                    ? 'h-7 w-7 rounded-full object-cover'
                                    : 'h-10 w-10 rounded-full object-cover'
                                  : compact
                                    ? 'h-7 w-7 object-contain'
                                    : 'h-10 w-10 object-contain'
                              }
                            />
                          ) : null}
                          <span className={compact ? 'text-[11px] text-slate-100' : 'text-sm text-slate-100'}>{item.label || 'Untitled'}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )
          }

          if (section.type === 'Hero' || section.type === 'MediaSpotlight') {
            const img = readText(section.contentJson, 'backgroundImage', 'backgroundImageUrl')
            const centerText = readText(section.contentJson, 'centerText', 'body')
            const linkUrl = readText(section.contentJson, 'linkUrl', 'ctaUrl', 'href')
            const linkLabel = readText(section.contentJson, 'linkLabel', 'linkText', 'ctaLabel')
            const headline = readText(section.contentJson, 'title', 'headline')
            const sub = readText(section.contentJson, 'subtitle', 'subheadline')
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
                  <div className={`grid gap-3 ${compact ? 'p-3' : 'p-4'} md:grid-cols-2 md:items-center`}>
                    <div className={`order-2 ${imagePosition === 'left' ? 'md:order-2' : ''}`}>
                      <h2 className={compact ? 'text-lg font-semibold text-slate-800' : 'text-3xl font-semibold text-slate-800'}>
                        {headline || '（主标题）'}
                      </h2>
                      <p className={`mt-1 whitespace-pre-wrap text-slate-700 ${compact ? 'text-xs' : 'text-sm'}`}>
                        {centerText || sub || '（尚无正文）'}
                      </p>
                      {linkUrl ? (
                        <a
                          href={linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={
                            compact
                              ? 'mt-2 inline-flex rounded bg-red-500 px-3 py-1 text-[11px] font-medium text-white shadow hover:bg-red-400'
                              : 'mt-3 inline-flex rounded bg-red-500 px-5 py-2 text-sm font-medium text-white shadow hover:bg-red-400'
                          }
                        >
                          {linkLabel.trim() || linkUrl}
                        </a>
                      ) : null}
                    </div>
                    <div className={`order-1 ${imagePosition === 'left' ? 'md:order-1' : ''}`}>
                      {img ? (
                        <img src={img} alt="" className={`w-full rounded-lg object-cover ${compact ? 'h-28' : 'h-64'}`} />
                      ) : (
                        <div
                          className={`flex w-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-slate-500 ${
                            compact ? 'h-28 text-[11px]' : 'h-64 text-sm'
                          }`}
                        >
                          （图片待上传）
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )
            }

            const bgStyle = img
              ? `linear-gradient(rgba(15, 23, 42, 0.5), rgba(15, 23, 42, 0.58)), url(${img})`
              : 'linear-gradient(135deg, rgb(30 41 59), rgb(51 65 85))'

            const pad = compact ? 'px-4 py-8' : 'px-6 py-12'
            const minH = featured ? (compact ? 'min-h-[220px]' : 'min-h-[320px]') : ''

            return (
              <section key={key} className="overflow-hidden rounded-lg border border-slate-200">
                <div
                  className={`relative flex bg-cover bg-center ${minH} ${featured ? 'items-center justify-center text-center' : ''} text-white ${pad}`}
                  style={{ backgroundImage: bgStyle }}
                >
                  {featured ? (
                    <div className={`flex max-w-lg flex-col items-center gap-2 ${compact ? 'gap-2' : 'gap-3'}`}>
                      {headline ? (
                        <p
                          className={
                            compact
                              ? 'text-[10px] font-semibold uppercase tracking-wide text-slate-200'
                              : 'text-xs font-semibold uppercase tracking-wide text-slate-200'
                          }
                        >
                          {headline}
                        </p>
                      ) : null}
                      {centerText ? (
                        <p
                          className={
                            compact
                              ? 'whitespace-pre-wrap text-xs leading-relaxed text-white'
                              : 'whitespace-pre-wrap text-sm leading-relaxed text-white sm:text-base'
                          }
                        >
                          {centerText}
                        </p>
                      ) : null}
                      {!centerText && !linkUrl && sub ? (
                        <p className={compact ? 'text-[11px] text-slate-100' : 'text-sm text-slate-100'}>{sub}</p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="w-full text-left">
                      <h2 className={compact ? 'text-base font-bold' : 'text-2xl font-bold'}>
                        {headline || '（主标题）'}
                      </h2>
                      <p className={`mt-1 text-slate-100 ${compact ? 'text-[11px]' : 'text-sm'}`}>{sub || '（副标题）'}</p>
                      {linkUrl ? (
                        <a
                          href={linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={
                            compact
                              ? 'mt-2 inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-900 shadow hover:bg-slate-100'
                              : 'mt-3 inline-flex rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow hover:bg-slate-100'
                          }
                        >
                          {linkLabel.trim() || linkUrl}
                        </a>
                      ) : null}
                    </div>
                  )}
                  {linkUrl ? (
                    <a
                      href={linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={
                        compact
                          ? 'mt-3 inline-flex rounded bg-red-500 px-3 py-1 text-[11px] font-medium text-white shadow hover:bg-red-400'
                          : 'mt-4 inline-flex rounded bg-red-500 px-5 py-2 text-sm font-medium text-white shadow hover:bg-red-400 md:absolute md:bottom-5 md:left-1/2 md:mt-0 md:-translate-x-1/2'
                      }
                    >
                      {linkLabel.trim() || linkUrl}
                    </a>
                  ) : null}
                </div>
              </section>
            )
          }

          if (section.type === 'RichText') {
            const isNotice = readText(section.styleJson, 'variant') === 'announcement'
            const isQuoteOverlay =
              readText(section.styleJson, 'variant') === 'quoteOverlay' ||
              Boolean(readText(section.contentJson, 'backgroundImage', 'backgroundImageUrl'))
            const isImageArticle =
              readText(section.styleJson, 'variant') === 'imageArticle' || Boolean(readText(section.contentJson, 'imageUrl'))
            const imageUrl = readText(section.contentJson, 'imageUrl')
            const rtTitle = readText(section.contentJson, 'title')
            const body = readText(section.contentJson, 'text')
            const linkUrl = readText(section.contentJson, 'linkUrl', 'href')
            const linkLabel = readText(section.contentJson, 'linkLabel', 'linkText')

            if (isQuoteOverlay) {
              const bg = readText(section.contentJson, 'backgroundImage', 'backgroundImageUrl')
              return (
                <section key={key} className="overflow-hidden rounded-lg border border-slate-200">
                  <div
                    className={`${compact ? 'px-3 py-5' : 'px-5 py-8'} bg-cover bg-center text-white`}
                    style={{ backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.7), rgba(2, 6, 23, 0.7)), url(${bg || ''})` }}
                  >
                    <div className="mx-auto max-w-4xl text-center">
                      <h2 className={compact ? 'text-xl font-semibold' : 'text-3xl font-semibold'}>
                        {readText(section.contentJson, 'title') || 'Quote of the day'}
                      </h2>
                      <p className={compact ? 'mt-1 text-xs text-slate-200' : 'mt-1 text-lg text-slate-200'}>
                        {readText(section.contentJson, 'subtitle') || 'God loves us all'}
                      </p>
                      <p className={`${compact ? 'mt-4 text-lg' : 'mt-6 text-3xl'} whitespace-pre-wrap italic leading-relaxed text-slate-100`}>
                        {body || '（尚无正文）'}
                      </p>
                      <p className={compact ? 'mt-3 text-base font-medium text-yellow-300' : 'mt-4 text-2xl font-medium text-yellow-300'}>
                        {readText(section.contentJson, 'quoteAuthor')}
                      </p>
                    </div>
                  </div>
                </section>
              )
            }

            if (isImageArticle) {
              return (
                <section key={key} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt=""
                      className={`w-full object-cover ${compact ? 'max-h-32' : 'max-h-56'}`}
                    />
                  ) : null}
                  <div className={compact ? 'space-y-2 p-3' : 'space-y-3 p-4'}>
                    {rtTitle ? (
                      <h3 className={`font-semibold text-slate-900 ${compact ? 'text-sm' : 'text-lg'}`}>{rtTitle}</h3>
                    ) : null}
                    <p className={`whitespace-pre-wrap text-slate-700 ${compact ? 'text-xs' : 'text-sm'}`}>
                      {body || '（尚无正文）'}
                    </p>
                    {linkUrl ? (
                      <a
                        href={linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex font-medium text-blue-700 hover:underline ${compact ? 'text-xs' : 'text-sm'}`}
                      >
                        {linkLabel.trim() || linkUrl}
                      </a>
                    ) : null}
                  </div>
                </section>
              )
            }

            return (
              <section
                key={key}
                className={`rounded-lg border text-slate-700 ${
                  isNotice
                    ? 'border-amber-200 bg-amber-50/80 p-3'
                    : 'border border-slate-200 bg-slate-50 p-3'
                }`}
              >
                <p className={`whitespace-pre-wrap ${compact ? 'text-xs' : 'text-sm'}`}>
                  {body || '（尚无正文）'}
                </p>
              </section>
            )
          }

          if (section.type === 'GroupList') {
            // The smart GroupListSection resolves data via useListSourceResolver
            return (
              <GroupListSection
                key={key}
                metadata={section.contentJson as Record<string, unknown>}
                groupId={previewGroupId}
                compact={compact}
              />
            )
          }

          if (section.type === 'PageList') {
            return (
              <section key={key} className="rounded-lg border border-slate-200 bg-white p-3">
                <h3 className={`font-semibold text-slate-900 ${compact ? 'text-sm' : 'text-lg'}`}>
                  {readText(section.contentJson, 'title') || '页面'}
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {groupPageItems.slice(0, parseLimit(section.contentJson, 'limit', 8)).map((item) => (
                    <li key={item.id} className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                      <Link className={`font-medium text-blue-700 hover:underline ${compact ? 'text-xs' : 'text-sm'}`} to={`/pages/${item.id}`}>
                        {item.title}
                      </Link>
                      <p className="text-[10px] text-slate-500">Visibility: {item.visibility}</p>
                    </li>
                  ))}
                </ul>
                {groupPageItems.length === 0 ? (
                  <p className={`mt-2 text-slate-500 ${compact ? 'text-[11px]' : 'text-sm'}`}>
                    （发布后，读者将在此看到本团其他页面）
                  </p>
                ) : null}
              </section>
            )
          }

          if (section.type === 'SermonList') {
            return (
              <section key={key} className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
                讲道列表区块预览
              </section>
            )
          }

          return (
            <section key={key} className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2 text-[11px] text-slate-600">
              {section.type || '（未指定类型）'} 区块
            </section>
          )
        })}

        {sections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs text-slate-500">
            尚无内容区块
          </div>
        ) : null}
      </div>
    </article>
  )
}

export default GroupPagePreview
