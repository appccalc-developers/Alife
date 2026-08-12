import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronRight, Eye, MessageCircle, Pin, Plus, RefreshCcw, Send, Sparkles, UsersRound } from 'lucide-react'
import AppActionButton from '../components/layout/AppActionButton'
import AppBadge from '../components/layout/AppBadge'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import { queryClient } from '../db/queryClient'
import { forumQueryKeys, forumService } from '../services/forumService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import type { ForumPostVisibilityRequest } from '../types/forum'
import { ForumMediaGrid, ForumMediaPicker, selectForumMedia, type PendingForumMedia, uploadPendingForumMedia } from './forum/ForumMediaControls'
import { forumCopy, visibilityLabel } from './forum/forumCopy'
import { categoryName, formatForumDate, localizedJsonExcerpt, localizedJsonText, oneLanguagePayload, parseForumMedia } from './forum/forumUtils'
import ForumSermonEmbed from './forum/ForumSermonEmbed'

const avatarLetter = (value?: string | null) => (value || 'A').slice(0, 1).toUpperCase()

const isPublicVisibility = (visibility: unknown) =>
  visibility === 1 || visibility === 'Public' || visibility === 'public'

const ForumComposer = ({
  defaultCategoryId,
  groupId,
  onCreated,
  onCancel,
}: {
  defaultCategoryId: string
  groupId?: string
  onCreated: (postId: string) => void
  onCancel: () => void
}) => {
  const { language, me } = useAuthStore()
  const text = forumCopy(language)
  const [categoryId, setCategoryId] = useState(defaultCategoryId)
  const [visibility, setVisibility] = useState<ForumPostVisibilityRequest>(groupId ? 'GroupOnly' : 'MembersOnly')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [media, setMedia] = useState<PendingForumMedia[]>([])
  const [message, setMessage] = useState('')
  const categoriesQuery = useQuery({
    queryKey: forumQueryKeys.categories,
    queryFn: forumService.listCategories,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const uploadedMedia = await uploadPendingForumMedia(media, `forum/posts/${Date.now()}`)
      return forumService.createPost({
        categoryId,
        groupId: groupId || null,
        title: oneLanguagePayload(language, title),
        body: oneLanguagePayload(language, body),
        media: uploadedMedia,
        visibility,
      })
    },
    onSuccess: async (post) => {
      await queryClient.invalidateQueries({ queryKey: ['forum'] })
      onCreated(post.id)
    },
    onError: (error) => setMessage(normalizeApiError(error).message),
  })

  const submit = () => {
    setMessage('')
    if (!categoryId) {
      setMessage(text.chooseCategory)
      return
    }
    if (!title.trim()) {
      setMessage(text.emptyTitle)
      return
    }
    if (!body.trim()) {
      setMessage(text.emptyBody)
      return
    }
    createMutation.mutate()
  }

  const categories = categoriesQuery.data ?? []

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#176b5a] text-sm font-black text-white shadow-[0_10px_24px_rgba(23,107,90,0.2)]">
          {avatarLetter(me?.displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black text-slate-950">{text.quickShare}</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">{text.composerHint}</p>
            </div>
            <button type="button" className="min-h-9 rounded-full px-3 text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" onClick={onCancel}>
              {text.cancel}
            </button>
          </div>
          {message ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{message}</p> : null}
          <input
            className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-black text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#176b5a] focus:bg-white focus:ring-4 focus:ring-[#176b5a]/10"
            value={title}
            placeholder={text.title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={180}
          />
          <textarea
            className="mt-3 min-h-32 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#176b5a] focus:bg-white focus:ring-4 focus:ring-[#176b5a]/10"
            value={body}
            placeholder={text.body}
            onChange={(event) => setBody(event.target.value)}
          />
          <ForumMediaPicker
            items={media}
            language={language}
            mode="post"
            disabled={createMutation.isPending}
            onAdd={(files) => {
              const result = selectForumMedia(files, media, language, 'post')
              setMessage(result.error)
              setMedia(result.items)
            }}
            onRemove={(id) => setMedia((items) => items.filter((item) => item.id !== id))}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
              <label className="sr-only" htmlFor="forum-category">{text.category}</label>
              <select id="forum-category" className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">{text.chooseCategory}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{localizedJsonText(category.nameJson, language)}</option>
                ))}
              </select>
              <label className="sr-only" htmlFor="forum-visibility">{text.visibility}</label>
              <select id="forum-visibility" className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 shadow-sm" value={visibility} onChange={(event) => setVisibility(event.target.value as ForumPostVisibilityRequest)}>
                {groupId ? <option value="GroupOnly">{text.groupOnly}</option> : <option value="MembersOnly">{text.membersOnly}</option>}
                <option value="Public">{text.public}</option>
              </select>
            </div>
            <AppActionButton variant="primary" disabled={createMutation.isPending} onClick={submit}>
              <Send className="mr-2 h-4 w-4" aria-hidden="true" />
              {createMutation.isPending ? (media.length > 0 ? text.mediaUploading : text.publishing) : text.publish}
            </AppActionButton>
          </div>
        </div>
      </div>
    </section>
  )
}

const ForumView = () => {
  const { groupId: groupIdParam } = useParams<{ groupId?: string }>()
  const { language, isGuest, isRegistered, me, memberships } = useAuthStore()
  const text = forumCopy(language)
  const churchForum = useLocation().pathname.startsWith('/church/forum')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const groupId = groupIdParam?.trim() || ''
  const forumBasePath = groupId ? `/groups/${encodeURIComponent(groupId)}/forum` : churchForum ? '/church/forum' : '/forum'
  const categoryId = searchParams.get('categoryId') || ''
  const [composerOpen, setComposerOpen] = useState(false)

  const categoriesQuery = useQuery({
    queryKey: forumQueryKeys.categories,
    queryFn: forumService.listCategories,
    staleTime: 5 * 60_000,
  })
  const postsQuery = useQuery({
    queryKey: forumQueryKeys.posts(categoryId, groupId),
    queryFn: () => forumService.listPosts({ categoryId: categoryId || undefined, groupId: groupId || undefined, page: 1, pageSize: 30 }),
    staleTime: 30_000,
  })

  const categories = categoriesQuery.data ?? []
  const posts = postsQuery.data?.items ?? []
  const firstCategoryId = categories[0]?.id ?? ''
  const defaultCategoryId = categoryId || firstCategoryId
  const groupMembership = groupId ? memberships.find((membership) => membership.groupId === groupId) : null
  const canPost = !isGuest && isRegistered && (!groupId || groupMembership?.status === 'approved')

  const categoryOptions = useMemo(() => [
    { id: '', label: text.allCategories },
    ...categories.map((category) => ({ id: category.id, label: localizedJsonText(category.nameJson, language) })),
  ], [categories, language, text.allCategories])

  const activeCategoryLabel = categoryOptions.find((item) => item.id === categoryId)?.label || text.allCategories
  const publicCount = posts.filter((post) => isPublicVisibility(post.visibility)).length

  return (
    <AppPageShell>
      <div className="mx-auto w-full max-w-7xl">
        <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <header className="relative border-b border-slate-200 bg-[#f8faf9] px-5 py-6 sm:px-7 lg:px-8">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-[4rem] bg-[#176b5a]/10" aria-hidden="true" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#176b5a]/15 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#176b5a] shadow-sm">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  {groupId ? text.groupSpace : churchForum ? text.churchSpace : text.communitySpace}
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{groupId ? text.groupForum : churchForum ? text.churchForum : text.forum}</h1>
                <p className="mt-3 text-base leading-7 text-slate-600">{groupId ? text.groupForumSubtitle : churchForum ? text.churchForumSubtitle : text.forumSubtitle}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:border-[#176b5a]/30 hover:text-[#176b5a] disabled:opacity-50"
                  onClick={() => void postsQuery.refetch()}
                  disabled={postsQuery.isFetching}
                >
                  <RefreshCcw className={['mr-2 h-4 w-4', postsQuery.isFetching ? 'animate-spin' : ''].join(' ')} aria-hidden="true" />
                  {text.refresh}
                </button>
                {canPost ? (
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#176b5a] px-4 text-sm font-black text-white shadow-[0_14px_30px_rgba(23,107,90,0.22)] transition hover:bg-[#0d4f43]"
                    onClick={() => setComposerOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    {text.newPost}
                  </button>
                ) : null}
              </div>
            </div>
          </header>

          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <main className="min-w-0 border-slate-200 lg:border-r">
              <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 px-5 py-3 sm:px-7" aria-label={text.category}>
                {categoryOptions.map((category) => {
                  const active = category.id === categoryId
                  return (
                    <button
                      key={category.id || 'all'}
                      type="button"
                      className={[
                        'min-h-10 shrink-0 rounded-full px-4 text-sm font-black transition',
                        active ? 'bg-slate-950 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-[#e3f0eb] hover:text-[#176b5a]',
                      ].join(' ')}
                      onClick={() => {
                        const next = new URLSearchParams(searchParams)
                        if (category.id) next.set('categoryId', category.id)
                        else next.delete('categoryId')
                        setSearchParams(next)
                      }}
                    >
                      {category.label}
                    </button>
                  )
                })}
              </nav>

              <div className="border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
                {canPost ? (
                  composerOpen ? (
                    <ForumComposer
                      defaultCategoryId={defaultCategoryId}
                      groupId={groupId || undefined}
                      onCancel={() => setComposerOpen(false)}
                      onCreated={(postId) => navigate(`${forumBasePath}/posts/${postId}`)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-[#176b5a]/30 hover:bg-white hover:shadow-sm"
                      onClick={() => setComposerOpen(true)}
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-black text-[#176b5a] shadow-sm">
                        {avatarLetter(me?.displayName)}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-bold text-slate-500">{text.quickShare}</span>
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#176b5a] text-white">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </button>
                  )
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#176b5a]/15 bg-[#e3f0eb] px-4 py-3 text-sm font-bold text-[#0d4f43]">
                    <span>{groupId ? text.groupMemberToPost : text.loginToPost}</span>
                    <Link to="/onboarding" className="inline-flex min-h-10 items-center rounded-xl bg-[#176b5a] px-4 text-sm font-black text-white transition hover:bg-[#0d4f43]">
                      {text.login}
                    </Link>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3 sm:px-7">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{text.feed}</p>
                  <p className="mt-0.5 text-sm font-black text-slate-900">{activeCategoryLabel}</p>
                </div>
                <p className="text-sm font-black text-slate-500">{posts.length} {text.conversations}</p>
              </div>

              {postsQuery.isLoading || categoriesQuery.isLoading ? (
                <div className="grid gap-0">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-36 animate-pulse border-b border-slate-200 bg-white" />
                  ))}
                </div>
              ) : null}

              {!postsQuery.isLoading && postsQuery.error ? (
                <div className="p-5 sm:p-7">
                  <AppEmptyState title={text.loadFailed} description={normalizeApiError(postsQuery.error).message} actionLabel={text.retry} onAction={() => void postsQuery.refetch()} />
                </div>
              ) : null}

              {!postsQuery.isLoading && !postsQuery.error && posts.length === 0 ? (
                <div className="p-5 sm:p-7">
                  <AppEmptyState title={text.noPosts} description={text.noPostsDescription} actionLabel={canPost ? text.newPost : undefined} onAction={canPost ? () => setComposerOpen(true) : undefined} />
                </div>
              ) : null}

              <div className="divide-y divide-slate-200">
                {posts.map((post) => {
                  const title = localizedJsonText(post.titleJson, language) || text.untitled
                  const excerpt = localizedJsonExcerpt(post.bodyJson, language)
                  const media = parseForumMedia(post.mediaJson)
                  const commentsLabel = `${post.commentCount} ${post.commentCount === 1 && language !== 'zh' ? text.reply : text.replies}`
                  return (
                    <Link key={post.id} to={`${forumBasePath}/posts/${post.id}`} className="group block bg-white px-5 py-5 transition hover:bg-[#fbfcfa] sm:px-7">
                      <article className="flex gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#e3f0eb] text-sm font-black text-[#176b5a]">
                          {avatarLetter(post.author.displayName || title)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-black text-slate-950">{post.author.displayName || post.author.id.slice(0, 8)}</span>
                            <span className="text-xs font-semibold text-slate-400">{formatForumDate(post.lastCommentUtc || post.updatedUtc, language)}</span>
                            {post.isPinned ? <AppBadge variant="warning"><Pin className="mr-1 h-3 w-3" />{text.pinned}</AppBadge> : null}
                          </div>
                          <h2 className="mt-2 text-lg font-black leading-snug text-slate-950 transition group-hover:text-[#176b5a] sm:text-xl">{title}</h2>
                          {excerpt ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{excerpt}</p> : null}
                          {post.sermon ? <ForumSermonEmbed sermon={post.sermon} mode="compact" /> : null}
                          <ForumMediaGrid media={media.slice(0, 3)} />
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{categoryName(categories, post.categoryId, language)}</span>
                            <AppBadge variant={isPublicVisibility(post.visibility) ? 'info' : 'neutral'}>
                              <Eye className="mr-1 h-3 w-3" aria-hidden="true" />
                              {visibilityLabel(post.visibility, language)}
                            </AppBadge>
                            {post.isLocked ? <AppBadge>{text.locked}</AppBadge> : null}
                          </div>
                        </div>
                        <div className="hidden shrink-0 flex-col items-end justify-between sm:flex">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-black text-slate-600">
                            <MessageCircle className="h-4 w-4" aria-hidden="true" />
                            {commentsLabel}
                          </span>
                          <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#176b5a]" aria-hidden="true" />
                        </div>
                      </article>
                    </Link>
                  )
                })}
              </div>
            </main>

            <aside className="bg-slate-50 p-5 sm:p-7 lg:p-6">
              <div className="grid gap-4">
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-slate-950">{text.activeNow}</p>
                    <UsersRound className="h-4 w-4 text-[#176b5a]" aria-hidden="true" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-2xl font-black text-slate-950">{posts.length}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{text.conversations}</p>
                    </div>
                    <div className="rounded-2xl bg-[#e3f0eb] p-3">
                      <p className="text-2xl font-black text-[#0d4f43]">{publicCount}</p>
                      <p className="mt-1 text-xs font-bold text-[#176b5a]">{text.public}</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-black text-slate-950">{text.availableTopics}</p>
                  <div className="mt-3 grid gap-1">
                    {categoryOptions.map((category) => {
                      const active = category.id === categoryId
                      return (
                        <button
                          key={category.id || 'all-side'}
                          type="button"
                          className={[
                            'flex min-h-11 items-center justify-between rounded-xl px-3 text-left text-sm font-black transition',
                            active ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
                          ].join(' ')}
                          onClick={() => {
                            const next = new URLSearchParams(searchParams)
                            if (category.id) next.set('categoryId', category.id)
                            else next.delete('categoryId')
                            setSearchParams(next)
                          }}
                        >
                          <span>{category.label}</span>
                          {active ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : null}
                        </button>
                      )
                    })}
                  </div>
                </section>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </AppPageShell>
  )
}

export default ForumView
