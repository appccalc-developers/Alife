import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, ExternalLink, FileQuestion } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { richTextBodyClass, sanitizeRichTextHtml } from '../components/rich-text/richTextHtml'
import { contentPostService, contentPostQueryKeys } from '../services/contentPostService'
import { useAuthStore } from '../stores/auth'
import { localizeText } from '../utils/localizedText'
import { articleCopy, contentPostCategoryLabel } from './articles/articleCopy'

const articleDate = (value: string, language: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-NZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

const ArticleDetailView = () => {
  const { slug = '' } = useParams<{ slug: string }>()
  const { language } = useAuthStore()
  const copy = articleCopy(language)
  const articleQuery = useQuery({
    queryKey: contentPostQueryKeys.publicDetail(slug),
    queryFn: () => contentPostService.getPublicBySlug(slug),
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
  })
  const article = articleQuery.data
  const title = localizeText(article?.title, language)
  const bodyHtml = useMemo(
    () => sanitizeRichTextHtml(localizeText(article?.body, language)),
    [article?.body, language],
  )

  if (articleQuery.isLoading) {
    return (
      <main className="mx-auto min-h-[60vh] max-w-4xl py-16" aria-live="polite">
        <div className="animate-pulse rounded-[2rem] bg-white p-7 shadow-sm sm:p-12">
          <div className="h-4 w-32 rounded bg-[#e8e3d8]" />
          <div className="mt-6 h-10 w-4/5 rounded bg-[#ddd7ca]" />
          <div className="mt-4 h-5 w-52 rounded bg-[#e8e3d8]" />
          <div className="mt-12 space-y-4">
            <div className="h-4 rounded bg-[#e8e3d8]" />
            <div className="h-4 rounded bg-[#e8e3d8]" />
            <div className="h-4 w-3/4 rounded bg-[#e8e3d8]" />
          </div>
        </div>
        <span className="sr-only">{copy.detailLoading}</span>
      </main>
    )
  }

  if (articleQuery.isError || !article) {
    return (
      <main className="mx-auto grid min-h-[60vh] max-w-3xl place-items-center py-16 text-center">
        <div>
          <FileQuestion className="mx-auto h-12 w-12 text-[#718079]" strokeWidth={1.5} />
          <h1 className="mt-5 text-3xl font-bold text-[#18332d]">{copy.detailErrorTitle}</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#718079]">{copy.detailErrorBody}</p>
          <Link className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#18332d] px-5 py-3 text-sm font-bold text-white" to="/articles">
            <ArrowLeft className="h-4 w-4" />
            {copy.backToArchive}
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl pb-12">
      <Link
        className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-[#31594e] transition hover:text-[#9b792c]"
        to={`/articles?category=${article.category}`}
      >
        <ArrowLeft className="h-4 w-4" />
        {copy.backToArchive}
      </Link>
      <article className="overflow-hidden rounded-[2rem] border border-[#18332d]/8 bg-white shadow-[0_18px_60px_rgba(24,51,45,0.08)]">
        <header className="border-b border-[#18332d]/8 bg-[linear-gradient(145deg,#18332d,#264d43)] px-6 py-10 text-white sm:px-12 sm:py-14">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d6bc72]">
            {contentPostCategoryLabel(article.category, language)}
          </p>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-5xl">{title}</h1>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/65">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {copy.published} {articleDate(article.publishedUtc, language)}
            </span>
            {article.byline ? <span>{copy.byline} {article.byline}</span> : null}
          </div>
        </header>
        <div className="px-6 py-9 sm:px-12 sm:py-12">
          <div
            className={`${richTextBodyClass} text-base leading-8 text-[#334b44] [&_a]:text-[#31594e] [&_img]:mx-auto`}
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
          {article.sourceUrl ? (
            <div className="mt-10 border-t border-[#18332d]/10 pt-7">
              <a
                className="inline-flex items-center gap-2 text-sm font-bold text-[#31594e] transition hover:text-[#9b792c]"
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {copy.source}
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          ) : null}
        </div>
      </article>
    </main>
  )
}

export default ArticleDetailView
