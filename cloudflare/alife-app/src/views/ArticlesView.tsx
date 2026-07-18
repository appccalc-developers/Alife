import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, FileText } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { contentPostService, contentPostQueryKeys } from '../services/contentPostService'
import { useAuthStore } from '../stores/auth'
import type { ContentPostCategory, ContentPostSummaryDto } from '../types/contentPost'
import { localizeText } from '../utils/localizedText'
import { articleCopy, contentPostCategories, contentPostCategoryLabel } from './articles/articleCopy'

const PAGE_SIZE = 18

const isContentPostCategory = (value: string | null): value is ContentPostCategory =>
  Boolean(value && contentPostCategories.includes(value as ContentPostCategory))

const articleDate = (value: string, language: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-NZ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

const LoadingCards = () => (
  <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
    {Array.from({ length: 6 }, (_, index) => (
      <div key={index} className="overflow-hidden rounded-3xl border border-[#18332d]/8 bg-white shadow-sm">
        <div className="aspect-[16/10] animate-pulse bg-[#e8e3d8]" />
        <div className="space-y-3 p-6">
          <div className="h-3 w-28 animate-pulse rounded bg-[#e8e3d8]" />
          <div className="h-6 w-4/5 animate-pulse rounded bg-[#ddd7ca]" />
          <div className="h-4 w-full animate-pulse rounded bg-[#e8e3d8]" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-[#e8e3d8]" />
        </div>
      </div>
    ))}
  </div>
)

const ArticleCard = ({
  post,
  language,
  readLabel,
}: {
  post: ContentPostSummaryDto
  language: string
  readLabel: string
}) => {
  const title = localizeText(post.title, language)
  const summary = localizeText(post.summary, language)

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-[#18332d]/8 bg-white shadow-[0_14px_45px_rgba(24,51,45,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_55px_rgba(24,51,45,0.11)]">
      <Link className="block overflow-hidden bg-[#dce7df]" to={`/articles/${encodeURIComponent(post.slug)}`} tabIndex={-1}>
        {post.coverImageUrl ? (
          <img
            className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.025]"
            src={post.coverImageUrl}
            alt={title}
            loading="lazy"
          />
        ) : (
          <span className="grid aspect-[16/10] place-items-center bg-[linear-gradient(135deg,#dce7df,#eee5cf)] text-[#31594e]">
            <FileText className="h-11 w-11 opacity-55" strokeWidth={1.5} />
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#7b6a3d]">
          <span>{contentPostCategoryLabel(post.category, language)}</span>
          <span className="inline-flex items-center gap-1.5 normal-case tracking-normal text-[#718079]">
            <CalendarDays className="h-3.5 w-3.5" />
            {articleDate(post.publishedUtc, language)}
          </span>
        </div>
        <h2 className="mt-4 text-xl font-bold leading-snug text-[#18332d]">
          <Link className="transition hover:text-[#9b792c]" to={`/articles/${encodeURIComponent(post.slug)}`}>
            {title}
          </Link>
        </h2>
        {summary ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#63716b]">{summary}</p> : null}
        <Link
          className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-bold text-[#31594e] transition group-hover:text-[#9b792c]"
          to={`/articles/${encodeURIComponent(post.slug)}`}
        >
          {readLabel}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </Link>
      </div>
    </article>
  )
}

const ArticlesView = () => {
  const { language } = useAuthStore()
  const copy = articleCopy(language)
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedCategory = isContentPostCategory(searchParams.get('category'))
    ? searchParams.get('category') as ContentPostCategory
    : null
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const postsQuery = useQuery({
    queryKey: contentPostQueryKeys.publicIndex,
    queryFn: contentPostService.listPublic,
    staleTime: 5 * 60 * 1000,
  })

  const posts = postsQuery.data ?? []
  const counts = useMemo(() => posts.reduce<Record<ContentPostCategory, number>>(
    (result, post) => {
      result[post.category] += 1
      return result
    },
    { news: 0, sermonOutline: 0, testimony: 0, learning: 0, general: 0 },
  ), [posts])
  const filteredPosts = useMemo(
    () => selectedCategory ? posts.filter((post) => post.category === selectedCategory) : posts,
    [posts, selectedCategory],
  )
  const visiblePosts = filteredPosts.slice(0, visibleCount)

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [selectedCategory])

  const selectCategory = (category: ContentPostCategory | null) => {
    if (category) {
      setSearchParams({ category })
    } else {
      setSearchParams({})
    }
  }

  return (
    <main className="mx-auto max-w-7xl pb-10">
      <header className="overflow-hidden rounded-[2rem] bg-[#18332d] px-6 py-12 text-white shadow-[0_24px_70px_rgba(24,51,45,0.16)] sm:px-10 sm:py-16 lg:px-16">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#d6bc72]">{copy.eyebrow}</p>
        <h1 className="mt-4 max-w-3xl text-3xl font-bold leading-tight sm:text-5xl">{copy.title}</h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-white/68 sm:text-base">{copy.description}</p>
      </header>

      <section className="py-10 sm:py-12" aria-labelledby="article-archive-heading">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <h2 id="article-archive-heading" className="text-2xl font-bold text-[#18332d]">{copy.archive}</h2>
            {!postsQuery.isLoading && !postsQuery.isError ? (
              <p className="mt-1 text-sm text-[#718079]">{filteredPosts.length} {copy.articleCount}</p>
            ) : null}
          </div>
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1" aria-label={copy.archive}>
            <button
              type="button"
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                selectedCategory === null
                  ? 'border-[#18332d] bg-[#18332d] text-white'
                  : 'border-[#18332d]/15 bg-white text-[#465a53] hover:border-[#18332d]/35'
              }`}
              aria-pressed={selectedCategory === null}
              onClick={() => selectCategory(null)}
            >
              {copy.all} <span className="ml-1 opacity-65">{posts.length}</span>
            </button>
            {contentPostCategories.map((category) => (
              <button
                key={category}
                type="button"
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  selectedCategory === category
                    ? 'border-[#18332d] bg-[#18332d] text-white'
                    : 'border-[#18332d]/15 bg-white text-[#465a53] hover:border-[#18332d]/35'
                }`}
                aria-pressed={selectedCategory === category}
                onClick={() => selectCategory(category)}
              >
                {contentPostCategoryLabel(category, language)} <span className="ml-1 opacity-65">{counts[category]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          {postsQuery.isLoading ? <LoadingCards /> : null}
          {postsQuery.isError ? (
            <div className="rounded-3xl border border-[#18332d]/10 bg-white px-6 py-14 text-center">
              <FileText className="mx-auto h-10 w-10 text-[#718079]" />
              <h3 className="mt-4 text-xl font-bold">{copy.loadErrorTitle}</h3>
              <p className="mt-2 text-sm text-[#718079]">{copy.loadErrorBody}</p>
              <button
                className="mt-6 rounded-full bg-[#18332d] px-5 py-2.5 text-sm font-bold text-white"
                type="button"
                onClick={() => void postsQuery.refetch()}
              >
                {copy.retry}
              </button>
            </div>
          ) : null}
          {!postsQuery.isLoading && !postsQuery.isError && visiblePosts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#18332d]/20 px-6 py-14 text-center">
              <FileText className="mx-auto h-10 w-10 text-[#718079]" />
              <h3 className="mt-4 text-xl font-bold">{copy.emptyTitle}</h3>
              <p className="mt-2 text-sm text-[#718079]">{copy.emptyBody}</p>
            </div>
          ) : null}
          {visiblePosts.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {visiblePosts.map((post) => (
                <ArticleCard key={post.id} post={post} language={language} readLabel={copy.readArticle} />
              ))}
            </div>
          ) : null}
          {visibleCount < filteredPosts.length ? (
            <div className="mt-10 text-center">
              <button
                className="rounded-full border border-[#18332d]/20 bg-white px-6 py-3 text-sm font-bold text-[#18332d] transition hover:border-[#18332d]/40"
                type="button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              >
                {copy.loadMore}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}

export default ArticlesView
