import { useUiText } from '../../i18n/uiText'
import { readText } from '../../utils/pageSectionContent'
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
  /** Resolves ListView smart sections (subgroups/members/group pages) when not on /groups/:id route */
  previewGroupId?: string
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

const GroupPagePreview = ({
  title,
  description,
  sections,
  compact,
  previewGroupId,
}: Props) => {
  const t = useUiText()
  const h1 = compact ? 'text-xl font-bold text-slate-900' : 'text-3xl font-bold text-slate-900'
  const desc = compact ? 'text-xs text-slate-600' : 'text-sm text-slate-600'

  return (
    <article className="space-y-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className={`space-y-2 border-b border-slate-200 bg-white ${compact ? 'p-3 pb-2' : 'p-5 pb-3'}`}>
        <h1 className={h1}>{title.trim() || t('previewNoTitle')}</h1>
        <p className={desc}>{description.trim() || t('previewNoSummary')}</p>
        <div />
      </header>

      <div className={`space-y-3 ${compact ? 'p-3 pt-0' : 'space-y-4 p-5 pt-0'}`}>
        {sections.map((section) => {
          const key = section.id || `${section.order}-${section.type}`

          if (section.type === 'Hero') {
            const img = readText(section.contentJson, 'backgroundImage', 'backgroundImageUrl', 'imageUrl')
            const centerText = readText(section.contentJson, 'centerText', 'body')
            const linkUrl = readText(section.contentJson, 'linkUrl', 'ctaUrl', 'href')
            const linkLabel = readText(section.contentJson, 'linkLabel', 'linkText', 'ctaLabel')
            const headline = readText(section.contentJson, 'title', 'headline')
            const sub = readText(section.contentJson, 'subtitle', 'subheadline')
            const bgStyle = img
              ? `linear-gradient(rgba(15, 23, 42, 0.5), rgba(15, 23, 42, 0.58)), url(${img})`
              : 'linear-gradient(135deg, rgb(30 41 59), rgb(51 65 85))'
            const pad = compact ? 'px-4 py-8' : 'px-6 py-12'

            return (
              <section key={key} className="overflow-hidden rounded-lg border border-slate-200">
                <div className={`relative flex min-h-[220px] items-center justify-center bg-cover bg-center text-center text-white ${pad}`} style={{ backgroundImage: bgStyle }}>
                  <div className="flex max-w-lg flex-col items-center gap-2">
                    <h2 className={compact ? 'text-lg font-semibold' : 'text-3xl font-semibold'}>
                      {headline || t('previewNoHeadline')}
                    </h2>
                    <p className={`whitespace-pre-wrap text-slate-100 ${compact ? 'text-xs' : 'text-sm'}`}>
                      {centerText || sub || t('previewNoBody')}
                    </p>
                    {linkUrl ? (
                      <a
                        href={linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={compact ? 'mt-2 rounded bg-red-500 px-3 py-1 text-[11px] font-medium text-white' : 'mt-3 rounded bg-red-500 px-5 py-2 text-sm font-medium text-white'}
                      >
                        {linkLabel.trim() || linkUrl}
                      </a>
                    ) : null}
                  </div>
                </div>
              </section>
            )
          }

          if (section.type === 'Spotlight') {
            const headline = readText(section.contentJson, 'title', 'headline')
            const sub = readText(section.contentJson, 'subtitle', 'subheadline')
            const body = readText(section.contentJson, 'centerText', 'body', 'text')
            const imageUrl = readText(section.contentJson, 'imageUrl', 'backgroundImage', 'backgroundImageUrl')
            const youtubeEmbedUrl = toYouTubeEmbedUrl(readText(section.contentJson, 'youtubeUrl'))
            const linkUrl = readText(section.contentJson, 'linkUrl', 'ctaUrl', 'href')
            const linkLabel = readText(section.contentJson, 'linkLabel', 'linkText', 'ctaLabel')
            const mediaPosition = readText(section.styleJson, 'mediaPosition', 'imagePosition') === 'right' ? 'right' : 'left'

            return (
              <section key={key} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className={`grid gap-0 ${compact ? '' : 'md:grid-cols-2 md:items-stretch'}`}>
                  <div className={`overflow-hidden bg-slate-100 ${mediaPosition === 'right' ? 'md:order-2' : 'md:order-1'}`}>
                    {youtubeEmbedUrl ? (
                      <iframe
                        src={youtubeEmbedUrl}
                        referrerPolicy="strict-origin-when-cross-origin"
                        title={t('sermonVideoPreview')}
                        className="aspect-video w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : imageUrl ? (
                      <img src={imageUrl} alt="" className={`w-full object-cover ${compact ? 'h-32' : 'h-64 md:h-full'}`} />
                    ) : (
                      <div className={`flex aspect-video items-center justify-center text-slate-500 ${compact ? 'text-[11px]' : 'text-sm'}`}>
                        {t('previewImagePending')}
                      </div>
                    )}
                  </div>
                  <div className={`flex flex-col justify-center ${compact ? 'space-y-2 p-3' : 'space-y-3 p-5'} ${mediaPosition === 'right' ? 'md:order-1' : 'md:order-2'}`}>
                    <h2 className={compact ? 'text-lg font-semibold text-slate-900' : 'text-3xl font-semibold text-slate-900'}>
                      {headline || t('previewNoHeadline')}
                    </h2>
                    <p className={compact ? 'text-xs font-medium text-slate-500' : 'text-sm font-medium text-slate-500'}>{sub || t('previewNoSubtitle')}</p>
                    <p className={`whitespace-pre-wrap text-slate-700 ${compact ? 'text-xs' : 'text-sm'}`}>{body || t('previewNoBody')}</p>
                    {linkUrl ? (
                      <a
                        href={linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={compact ? 'w-fit rounded bg-red-500 px-3 py-1 text-[11px] font-medium text-white' : 'w-fit rounded bg-red-500 px-5 py-2 text-sm font-medium text-white'}
                      >
                        {linkLabel.trim() || linkUrl}
                      </a>
                    ) : null}
                  </div>
                </div>
              </section>
            )
          }

          if (section.type === 'RichText') {
            const bg = readText(section.contentJson, 'backgroundImage', 'backgroundImageUrl')
            const titleText = readText(section.contentJson, 'title')
            const subtitle = readText(section.contentJson, 'subtitle')
            const body = readText(section.contentJson, 'text')
            const author = readText(section.contentJson, 'quoteAuthor')

            if (bg) {
              return (
                <section key={key} className="overflow-hidden rounded-lg border border-slate-200">
                  <div className={`${compact ? 'px-3 py-5' : 'px-5 py-8'} bg-cover bg-center text-white`} style={{ backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.7), rgba(2, 6, 23, 0.7)), url(${bg})` }}>
                    <div className="mx-auto max-w-4xl text-center">
                      <h2 className={compact ? 'text-xl font-semibold' : 'text-3xl font-semibold'}>{titleText || t('quoteOfDay')}</h2>
                      <p className={compact ? 'mt-1 text-xs text-slate-200' : 'mt-1 text-lg text-slate-200'}>{subtitle || t('godLovesUsAll')}</p>
                      <p className={`${compact ? 'mt-4 text-lg' : 'mt-6 text-3xl'} whitespace-pre-wrap italic leading-relaxed text-slate-100`}>
                        {body || t('previewNoBody')}
                      </p>
                      {author ? <p className={compact ? 'mt-3 text-base font-medium text-yellow-300' : 'mt-4 text-2xl font-medium text-yellow-300'}>{author}</p> : null}
                    </div>
                  </div>
                </section>
              )
            }

            return (
              <section key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-700">
                <p className={`whitespace-pre-wrap ${compact ? 'text-xs' : 'text-sm'}`}>{body || titleText || t('previewNoBody')}</p>
              </section>
            )
          }

          if (section.type === 'Sermon') {
            const titleText = readText(section.contentJson, 'title') || t('sermons')
            const youtubeEmbedUrl = toYouTubeEmbedUrl(readText(section.contentJson, 'youtubeUrl'))

            return (
              <section key={key} className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className={compact ? 'text-sm font-semibold text-slate-900' : 'text-lg font-semibold text-slate-900'}>{titleText}</h3>
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  {youtubeEmbedUrl ? (
                    <iframe
                      src={youtubeEmbedUrl}
                      title={titleText}
                      className="aspect-video w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className={`flex aspect-video items-center justify-center text-slate-500 ${compact ? 'text-[11px]' : 'text-sm'}`}>
                      {t('previewYoutubeNotSet')}
                    </div>
                  )}
                </div>
              </section>
            )
          }

          if (section.type === 'ListView') {
            return (
              <GroupListSection
                key={key}
                metadata={section.contentJson as Record<string, unknown>}
                groupId={previewGroupId}
                compact={compact}
              />
            )
          }

          return (
            <section key={key} className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2 text-[11px] text-slate-600">
              {t('previewSectionLabel', { type: section.type || t('previewUnknownType') })}
            </section>
          )
        })}

        {sections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs text-slate-500">
            {t('previewNoSections')}
          </div>
        ) : null}
      </div>
    </article>
  )
}

export default GroupPagePreview
