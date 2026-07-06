import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Eye, Lock, MessageCircle, MessageSquareReply, Pin, Send } from 'lucide-react'
import AppActionButton from '../components/layout/AppActionButton'
import AppBadge from '../components/layout/AppBadge'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import { queryClient } from '../db/queryClient'
import { forumQueryKeys, forumService } from '../services/forumService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import type { ForumCommentDto } from '../types/forum'
import { ForumMediaGrid, ForumMediaPicker, selectForumMedia, type PendingForumMedia, uploadPendingForumMedia } from './forum/ForumMediaControls'
import { forumCopy, visibilityLabel } from './forum/forumCopy'
import { categoryName, formatForumDate, localizedJsonText, oneLanguagePayload, parseForumMedia } from './forum/forumUtils'

const avatarLetter = (value?: string | null) => (value || 'A').slice(0, 1).toUpperCase()

const isPublicVisibility = (visibility: unknown) =>
  visibility === 1 || visibility === 'Public' || visibility === 'public'

const displayName = (comment: ForumCommentDto) => comment.author.displayName || comment.author.id.slice(0, 8)

const buildCommentThreads = (comments: ForumCommentDto[]) => {
  const byId = new Map(comments.map((comment) => [comment.id, comment]))
  const repliesByRoot = new Map<string, ForumCommentDto[]>()
  const roots: ForumCommentDto[] = []

  const rootIdFor = (comment: ForumCommentDto): string | null => {
    let current = comment
    const seen = new Set<string>()

    while (current.parentCommentId) {
      if (seen.has(current.id)) return null
      seen.add(current.id)

      const parent = byId.get(current.parentCommentId)
      if (!parent) return null
      current = parent
    }

    return current.id
  }

  comments.forEach((comment) => {
    if (!comment.parentCommentId) {
      roots.push(comment)
      return
    }

    const rootId = rootIdFor(comment)
    if (!rootId) {
      roots.push(comment)
      return
    }

    const replies = repliesByRoot.get(rootId) ?? []
    replies.push(comment)
    repliesByRoot.set(rootId, replies)
  })

  return roots.map((comment) => ({
    comment,
    replies: repliesByRoot.get(comment.id) ?? [],
    replyToById: byId,
  }))
}

const ForumCommentForm = ({
  postId,
  parentCommentId,
  replyingTo,
  disabled,
  onCancel,
}: {
  postId: string
  parentCommentId?: string | null
  replyingTo?: string | null
  disabled?: boolean
  onCancel?: () => void
}) => {
  const { language, me } = useAuthStore()
  const text = forumCopy(language)
  const [body, setBody] = useState('')
  const [media, setMedia] = useState<PendingForumMedia[]>([])
  const [message, setMessage] = useState('')
  const mutation = useMutation({
    mutationFn: async () => {
      const uploadedMedia = await uploadPendingForumMedia(media, `forum/comments/${postId}/${Date.now()}`)
      return forumService.createComment(postId, {
        body: body.trim() ? oneLanguagePayload(language, body) : null,
        parentCommentId: parentCommentId || null,
        media: uploadedMedia,
      })
    },
    onSuccess: async () => {
      setBody('')
      setMedia([])
      onCancel?.()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: forumQueryKeys.post(postId) }),
        queryClient.invalidateQueries({ queryKey: ['forum', 'posts'] }),
      ])
    },
    onError: (error) => setMessage(normalizeApiError(error).message),
  })

  const submit = () => {
    setMessage('')
    if (!body.trim() && media.length === 0) {
      setMessage(text.emptyComment)
      return
    }
    mutation.mutate()
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#176b5a] text-sm font-black text-white">
          {avatarLetter(me?.displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black text-slate-950">{parentCommentId ? text.replyAction : text.comment}</p>
              {replyingTo ? <p className="mt-0.5 text-xs font-bold text-slate-500">{text.replyingTo} {replyingTo}</p> : null}
            </div>
            {onCancel ? (
              <button type="button" className="min-h-9 rounded-full px-3 text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" onClick={onCancel}>
                {text.cancelReply}
              </button>
            ) : null}
          </div>
          {message ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{message}</p> : null}
          <textarea
            className="mt-3 min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#176b5a] focus:bg-white focus:ring-4 focus:ring-[#176b5a]/10"
            value={body}
            placeholder={text.commentPlaceholder}
            disabled={disabled || mutation.isPending}
            onChange={(event) => setBody(event.target.value)}
          />
          <ForumMediaPicker
            items={media}
            language={language}
            mode="comment"
            disabled={disabled || mutation.isPending}
            onAdd={(files) => {
              const result = selectForumMedia(files, media, language, 'comment')
              setMessage(result.error)
              setMedia(result.items)
            }}
            onRemove={(id) => setMedia((items) => items.filter((item) => item.id !== id))}
          />
          <div className="mt-3 flex justify-end">
            <AppActionButton variant="primary" disabled={disabled || mutation.isPending} onClick={submit}>
              <Send className="mr-2 h-4 w-4" aria-hidden="true" />
              {mutation.isPending ? (media.length > 0 ? text.mediaUploading : text.postingComment) : text.postComment}
            </AppActionButton>
          </div>
        </div>
      </div>
    </section>
  )
}

const ForumPostView = () => {
  const { postId } = useParams<{ postId: string }>()
  const { language, isGuest, isRegistered } = useAuthStore()
  const text = forumCopy(language)
  const [replyTarget, setReplyTarget] = useState<ForumCommentDto | null>(null)
  const postQuery = useQuery({
    queryKey: postId ? forumQueryKeys.post(postId) : ['forum', 'post', 'missing'],
    queryFn: () => forumService.getPost(postId || ''),
    enabled: Boolean(postId),
    staleTime: 30_000,
  })
  const categoriesQuery = useQuery({
    queryKey: forumQueryKeys.categories,
    queryFn: forumService.listCategories,
    staleTime: 5 * 60_000,
  })

  if (!postId) {
    return <Navigate to="/forum" replace />
  }

  const post = postQuery.data
  const categories = categoriesQuery.data ?? []
  const canComment = !isGuest && isRegistered && post && !post.isLocked
  const commentThreads = post ? buildCommentThreads(post.comments) : []

  return (
    <AppPageShell>
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link to="/forum" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:border-[#176b5a]/30 hover:text-[#176b5a]">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            {text.backToForum}
          </Link>
        </div>

        {postQuery.isLoading ? (
          <div className="grid gap-4">
            <div className="h-80 animate-pulse rounded-[1.75rem] border border-slate-200 bg-white" />
            <div className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          </div>
        ) : null}

        {!postQuery.isLoading && postQuery.error ? (
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <AppEmptyState
              title={text.postNotFound}
              description={normalizeApiError(postQuery.error).message || text.postNotFoundDescription}
              actionLabel={text.backToForum}
              onAction={() => window.history.back()}
            />
          </div>
        ) : null}

        {!postQuery.isLoading && !postQuery.error && !post ? (
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <AppEmptyState title={text.postNotFound} description={text.postNotFoundDescription} />
          </div>
        ) : null}

        {post ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <main className="min-w-0">
              <article className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
                <header className="border-b border-slate-200 bg-[#f8faf9] px-5 py-5 sm:px-7">
                  <div className="flex gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#176b5a] text-base font-black text-white shadow-[0_12px_26px_rgba(23,107,90,0.22)]">
                      {avatarLetter(post.author.displayName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-black text-slate-950">{post.author.displayName || post.author.id.slice(0, 8)}</span>
                        <span className="text-xs font-semibold text-slate-400">{formatForumDate(post.createdUtc, language)}</span>
                        {post.isPinned ? <AppBadge variant="warning"><Pin className="mr-1 h-3 w-3" />{text.pinned}</AppBadge> : null}
                        {post.isLocked ? <AppBadge><Lock className="mr-1 h-3 w-3" />{text.locked}</AppBadge> : null}
                      </div>

                      <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">
                        {localizedJsonText(post.titleJson, language) || text.untitled}
                      </h1>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">{categoryName(categories, post.categoryId, language)}</span>
                        <AppBadge variant={isPublicVisibility(post.visibility) ? 'info' : 'neutral'}>
                          <Eye className="mr-1 h-3 w-3" aria-hidden="true" />
                          {visibilityLabel(post.visibility, language)}
                        </AppBadge>
                        {post.isHidden ? <AppBadge variant="danger">{text.hidden}</AppBadge> : null}
                      </div>
                    </div>
                  </div>
                </header>

                <div className="px-5 py-6 sm:px-7">
                  <div className="whitespace-pre-wrap text-base leading-8 text-slate-700 sm:text-lg sm:leading-9">
                    {localizedJsonText(post.bodyJson, language)}
                  </div>
                  <ForumMediaGrid media={parseForumMedia(post.mediaJson)} />
                  <div className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-black text-slate-600">
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    {post.comments.length} {post.comments.length === 1 && language !== 'zh' ? text.reply : text.replies}
                  </div>
                </div>
              </article>

              {post.isLocked ? (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{text.lockedHint}</span>
                </div>
              ) : null}

              <section className="mt-5 rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
                <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-7">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{text.comments}</p>
                    <p className="mt-0.5 text-sm font-black text-slate-950">{post.comments.length} {post.comments.length === 1 && language !== 'zh' ? text.reply : text.replies}</p>
                  </div>
                </header>

                {post.comments.length === 0 ? (
                  <div className="px-5 py-10 text-center sm:px-7">
                    <MessageCircle className="mx-auto h-7 w-7 text-slate-300" aria-hidden="true" />
                    <p className="mt-3 text-sm font-black text-slate-700">{text.noComments}</p>
                    <p className="mt-1 text-sm text-slate-500">{text.noCommentsDescription}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {commentThreads.map(({ comment, replies, replyToById }) => (
                      <article key={comment.id} className="px-5 py-5 sm:px-7">
                        <div className="flex gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#e3f0eb] text-xs font-black text-[#176b5a]">
                            {avatarLetter(comment.author.displayName || comment.author.id)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="text-sm font-black text-slate-950">{displayName(comment)}</p>
                              <p className="text-xs font-semibold text-slate-400">{formatForumDate(comment.createdUtc, language)}</p>
                            </div>
                            {localizedJsonText(comment.bodyJson, language) ? (
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{localizedJsonText(comment.bodyJson, language)}</p>
                            ) : null}
                            <ForumMediaGrid media={parseForumMedia(comment.mediaJson)} />
                            {canComment ? (
                              <button
                                type="button"
                                className="mt-3 inline-flex min-h-9 items-center rounded-full px-3 text-xs font-black text-[#176b5a] transition hover:bg-[#e3f0eb]"
                                onClick={() => setReplyTarget(comment)}
                              >
                                <MessageSquareReply className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                {text.replyAction}
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {replyTarget?.id === comment.id ? (
                          <div className="mt-4 pl-11 sm:pl-14">
                            <ForumCommentForm
                              postId={post.id}
                              parentCommentId={comment.id}
                              replyingTo={displayName(comment)}
                              onCancel={() => setReplyTarget(null)}
                            />
                          </div>
                        ) : null}

                        {replies.length > 0 ? (
                          <div className="mt-4 grid gap-2 rounded-2xl bg-slate-50 px-4 py-3 sm:ml-14">
                            {replies.map((reply) => {
                              const replyTo = reply.parentCommentId ? replyToById.get(reply.parentCommentId) : null
                              return (
                                <div key={reply.id} className="rounded-xl px-2 py-1.5 transition hover:bg-white">
                                  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-sm leading-7">
                                    <button
                                      type="button"
                                      className="font-black text-[#176b5a] transition hover:text-[#0d4f43]"
                                      onClick={canComment ? () => setReplyTarget(reply) : undefined}
                                    >
                                      {displayName(reply)}
                                    </button>
                                    {replyTo ? (
                                      <>
                                        <span className="font-semibold text-slate-500">{text.replyAction}</span>
                                        <button
                                          type="button"
                                          className="font-black text-[#176b5a] transition hover:text-[#0d4f43]"
                                          onClick={canComment ? () => setReplyTarget(replyTo) : undefined}
                                        >
                                          {displayName(replyTo)}
                                        </button>
                                      </>
                                    ) : null}
                                    {localizedJsonText(reply.bodyJson, language) ? (
                                      <span className="text-slate-700">: {localizedJsonText(reply.bodyJson, language)}</span>
                                    ) : null}
                                  </div>
                                  <ForumMediaGrid media={parseForumMedia(reply.mediaJson)} />
                                  <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-400">{formatForumDate(reply.createdUtc, language)}</span>
                                    {canComment ? (
                                      <button
                                        type="button"
                                        className="inline-flex min-h-8 items-center rounded-full px-2.5 text-xs font-black text-[#176b5a] transition hover:bg-[#e3f0eb]"
                                        onClick={() => setReplyTarget(reply)}
                                      >
                                        <MessageSquareReply className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                                        {text.replyAction}
                                      </button>
                                    ) : null}
                                  </div>

                                  {replyTarget?.id === reply.id ? (
                                    <div className="mt-3">
                                      <ForumCommentForm
                                        postId={post.id}
                                        parentCommentId={reply.id}
                                        replyingTo={displayName(reply)}
                                        onCancel={() => setReplyTarget(null)}
                                      />
                                    </div>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <div className="mt-5">
                {canComment ? (
                  <ForumCommentForm postId={post.id} />
                ) : !post.isLocked ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#176b5a]/15 bg-[#e3f0eb] px-4 py-3 text-sm font-bold text-[#0d4f43]">
                    <span>{text.loginToComment}</span>
                    <Link to="/onboarding" className="inline-flex min-h-10 items-center rounded-xl bg-[#176b5a] px-4 text-sm font-black text-white transition hover:bg-[#0d4f43]">
                      {text.login}
                    </Link>
                  </div>
                ) : null}
              </div>
            </main>

            <aside className="grid content-start gap-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-black text-slate-950">{text.category}</p>
                <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-black text-slate-700">{categoryName(categories, post.categoryId, language)}</p>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-black text-slate-950">{text.visibility}</p>
                <div className="mt-3">
                  <AppBadge variant={isPublicVisibility(post.visibility) ? 'info' : 'neutral'}>
                    <Eye className="mr-1 h-3 w-3" aria-hidden="true" />
                    {visibilityLabel(post.visibility, language)}
                  </AppBadge>
                </div>
              </section>
            </aside>
          </div>
        ) : null}
      </div>
    </AppPageShell>
  )
}

export default ForumPostView
