import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, MessageCircle, MessageSquareReply, Send } from 'lucide-react'
import AppActionButton from '../components/layout/AppActionButton'
import AppBadge from '../components/layout/AppBadge'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import AiLanguageAutofill from '../components/ai/AiLanguageAutofill'
import { siteForumEntryEnabled } from '../app/forumAvailability'
import { SermonTranscriptPanel } from '../components/sermons/SermonTranscriptPanel'
import { getCachedSermons } from '../db/collections/sermonsCollection'
import { queryClient } from '../db/queryClient'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { useUiText } from '../i18n/uiText'
import { forumQueryKeys, forumService } from '../services/forumService'
import { normalizeApiError } from '../services/http'
import { sermonService, type SermonDto } from '../services/sermonService'
import { useAuthStore } from '../stores/auth'
import type { ForumCommentDto } from '../types/forum'
import { extractYouTubeVideoId, toYouTubeEmbedUrl } from '../utils/youtube'
import { ForumMediaGrid, ForumMediaPicker, selectForumMedia, type PendingForumMedia, uploadPendingForumMedia } from './forum/ForumMediaControls'
import { forumCopy } from './forum/forumCopy'
import { formatForumDate, localizedJsonText, parseForumMedia } from './forum/forumUtils'
import { compactBilingualText, validateRequiredBilingualFields, type LanguageCode } from '../utils/bilingualValidation'

const formatSermonDate = (value: string | null | undefined, fallback: string) => {
  if (!value) return fallback
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

const avatarLetter = (value?: string | null) => (value || 'A').slice(0, 1).toUpperCase()

const displayName = (comment: ForumCommentDto) => comment.author.displayName || comment.author.id.slice(0, 8)

const sermonDiscussionCopy = (language: string) => language === 'zh'
  ? {
      title: '讲道讨论',
      openForum: '到论坛继续讨论',
      synced: '这里的评论会同步到论坛里的讲道帖。',
      firstResponse: '成为第一个回应这篇讲道的人。',
      join: '参与讨论',
      replyComposer: '回复评论',
      responses: '条回应',
      comments: '条讨论',
      commentRule: '可以只发文字，也可以只发一张图片或视频。',
    }
  : {
      title: 'Sermon discussion',
      openForum: 'Continue in forum',
      synced: 'Comments here stay synced with the sermon post in the forum.',
      firstResponse: 'Be the first to respond to this sermon.',
      join: 'Join the discussion',
      replyComposer: 'Reply to comment',
      responses: 'responses',
      comments: 'comments',
      commentRule: 'You can post text, or just one image or video.',
    }

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

const SermonVideoView = () => {
  const t = useUiText()
  const { language, isGuest, isRegistered, me } = useAuthStore()
  const forumText = forumCopy(language)
  const discussionText = sermonDiscussionCopy(language)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const { sermonId: routeSermonId } = useParams<{ sermonId: string }>()
  const { sermonId: activeSermonId } = useActiveEntityIds({ sermonId: routeSermonId })
  const [searchParams] = useSearchParams()
  const [cachedSermons, setCachedSermons] = useState<Awaited<ReturnType<typeof getCachedSermons>>>([])
  const [commentBody, setCommentBody] = useState({ en: '', zh: '' })
  const [commentMedia, setCommentMedia] = useState<PendingForumMedia[]>([])
  const [commentMessage, setCommentMessage] = useState('')
  const [replyTarget, setReplyTarget] = useState<ForumCommentDto | null>(null)
  const [commentPage, setCommentPage] = useState(1)
  const requestedVideoId = extractYouTubeVideoId(searchParams.get('videoId'))
  const sermonId = routeSermonId || (requestedVideoId ? '' : activeSermonId)
  const shouldUseVideoIdFallback = Boolean(requestedVideoId && !sermonId)

  useEffect(() => {
    let cancelled = false
    getCachedSermons().then((items) => {
      if (!cancelled) setCachedSermons(items)
    })
    return () => { cancelled = true }
  }, [])

  const sermonQuery = useQuery<SermonDto>({
    queryKey: ['sermons', sermonId],
    queryFn: () => sermonService.getById(sermonId),
    enabled: Boolean(sermonId),
    staleTime: 5 * 60_000,
  })

  const videoIdFallbackQuery = useQuery<SermonDto[]>({
    queryKey: ['sermons', 'video-id-fallback', requestedVideoId],
    queryFn: () => sermonService.getLatest(30),
    enabled: shouldUseVideoIdFallback && cachedSermons.length === 0,
    staleTime: 5 * 60_000,
  })

  const cachedSermon = sermonId ? cachedSermons.find((item) => item.id === sermonId) ?? null : null
  const videoIdFallbackSermons = cachedSermons.length > 0 ? cachedSermons : videoIdFallbackQuery.data ?? []
  const sermon = sermonId
    ? sermonQuery.data ?? cachedSermon ?? null
    : requestedVideoId
      ? videoIdFallbackSermons.find((item) => extractYouTubeVideoId(item.videoUrl) === requestedVideoId) ?? null
      : null
  const sermonLoading = sermonId ? sermonQuery.isLoading && !cachedSermon : videoIdFallbackQuery.isLoading
  const sermonError = sermonId ? sermonQuery.isError && !cachedSermon : videoIdFallbackQuery.isError

  const sermonVideoId = extractYouTubeVideoId(sermon?.videoUrl)
  const videoId = sermonId ? sermonVideoId || requestedVideoId : requestedVideoId || sermonVideoId
  const embedUrl = toYouTubeEmbedUrl(videoId)
  const pageTitle = sermon?.title || t('watchSermon')
  const forumViewerId = me?.id || 'guest'
  const sermonContext = (
    <>
      <span className="desktop:hidden">{language === 'zh' ? '教会生活 / 证道' : 'Church Life / Sermons'}</span>
      <span className="hidden desktop:inline">{language === 'zh' ? '教会生活 / 主日证道' : 'Church Life / Sunday Sermons'}</span>
    </>
  )

  const sermonDiscussionQuery = useQuery({
    queryKey: sermon?.id ? forumQueryKeys.sermonPost(sermon.id, forumViewerId) : ['forum', 'sermon-post', 'missing', forumViewerId],
    queryFn: () => forumService.getSermonPost(sermon?.id || ''),
    enabled: Boolean(sermon?.id),
    staleTime: 30_000,
  })

  const sermonPost = sermonDiscussionQuery.data ?? null
  const COMMENTS_PER_PAGE = 5
  const commentThreads = sermonPost ? buildCommentThreads(sermonPost.comments) : []
  const totalCommentPages = Math.max(1, Math.ceil(commentThreads.length / COMMENTS_PER_PAGE))
  const paginatedCommentThreads = commentThreads.slice((commentPage - 1) * COMMENTS_PER_PAGE, commentPage * COMMENTS_PER_PAGE)
  const canComment = Boolean(sermon?.id && !isGuest && isRegistered && !sermonPost?.isLocked)

  const createCommentMutation = useMutation({
    mutationFn: async () => {
      const uploadedMedia = await uploadPendingForumMedia(commentMedia, `forum/sermons/${sermon!.id}/${Date.now()}`)
      return forumService.createSermonComment(sermon!.id, {
        body: commentBody.en.trim() || commentBody.zh.trim() ? compactBilingualText(commentBody) : null,
        parentCommentId: replyTarget?.id ?? null,
        media: uploadedMedia,
      })
    },
    onSuccess: async (post) => {
      setCommentBody({ en: '', zh: '' })
      setCommentMedia([])
      setCommentMessage('')
      setReplyTarget(null)
      queryClient.setQueryData(forumQueryKeys.sermonPost(post.sermonId || sermon!.id, forumViewerId), post)
      await queryClient.invalidateQueries({ queryKey: ['forum', 'posts'] })
    },
    onError: (error) => setCommentMessage(normalizeApiError(error).message),
  })

  const submitComment = () => {
    setCommentMessage('')
    if (!commentBody.en.trim() && !commentBody.zh.trim() && commentMedia.length === 0) {
      setCommentMessage(forumText.emptyComment)
      return
    }

    createCommentMutation.mutate()
  }

  const editorLanguages: LanguageCode[] = language === 'zh' ? ['zh', 'en'] : ['en', 'zh']
  const missingCommentTranslations = validateRequiredBilingualFields(
    { body: commentBody },
    [{ field: 'body', textType: 'sermonCommentBody' }],
  ).missingTranslatableFields

  if (!sermonId && !requestedVideoId) {
    return <Navigate to="/sermons" replace />
  }

  if (!embedUrl && sermonLoading && !sermon) {
    return (
      <AppPageShell title={t('sermons')} context={sermonContext}>
        <AppSectionCard dense>
          <p className="text-sm text-slate-600">{t('loadingPage')}</p>
        </AppSectionCard>
      </AppPageShell>
    )
  }

  if (!embedUrl && sermonError && !sermon) {
    return (
      <AppPageShell title={t('sermons')} context={sermonContext}>
        <AppSectionCard dense>
          <p className="text-sm text-rose-700">{t('sermonsLoadFailed')}</p>
        </AppSectionCard>
      </AppPageShell>
    )
  }

  if (!sermon && !embedUrl) {
    return (
      <AppPageShell title={t('sermons')} context={sermonContext} backLink={{ to: '/sermons', label: `${t('back')} ${t('sermons')}` }}>
        <AppEmptyState title={t('sermonNotFound')} description={t('sermonNotFoundDescription')} />
      </AppPageShell>
    )
  }

  return (
    <AppPageShell
      title={pageTitle}
      context={sermonContext}
      subtitle={sermon ? `${sermon.speakerName || t('guestSpeaker')} · ${formatSermonDate(sermon.preachedAt, t('noDate'))}` : undefined}
      backLink={{ to: '/sermons', label: `${t('back')} ${t('sermons')}` }}
      status={<AppBadge variant={embedUrl ? 'success' : 'warning'}>{embedUrl ? (language === 'zh' ? '可观看' : 'Available') : (language === 'zh' ? '视频未连接' : 'Video unavailable')}</AppBadge>}
    >
      <section className="mx-auto max-w-5xl space-y-6">
        <article className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          <div className="bg-slate-950">
            {embedUrl ? (
              <div className="aspect-video w-full">
                <iframe
                  ref={iframeRef}
                  className="h-full w-full"
                  src={embedUrl}
                  title={pageTitle}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center px-6 text-center text-sm font-semibold text-slate-200">
                {t('noYoutubeVideoLinked')}
              </div>
            )}
          </div>

        </article>

        {/* Interactive Bilingual Transcript Panel */}
        <SermonTranscriptPanel
          sermonTitle={pageTitle}
          speakerName={sermon?.speakerName ?? undefined}
          iframeRef={iframeRef}
        />

        {sermon ? (
          <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
            <header className="border-b border-slate-200 bg-[#f8faf9] px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-black text-[#176b5a] ring-1 ring-[#176b5a]/10">
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    {discussionText.synced}
                  </p>
                  <h2 className="mt-3 text-2xl font-black text-slate-950">{discussionText.title}</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {sermonPost?.commentCount ?? 0} {discussionText.responses}
                  </p>
                </div>
                {sermonPost && siteForumEntryEnabled ? (
                  <Link
                    to={`/forum/posts/${sermonPost.id}`}
                    className="inline-flex min-h-10 items-center rounded-full border border-[#176b5a]/15 bg-white px-4 text-sm font-black text-[#176b5a] shadow-sm transition hover:bg-[#e3f0eb]"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                    {discussionText.openForum}
                  </Link>
                ) : null}
              </div>
            </header>

            <div className="space-y-5 px-5 py-5 sm:px-6">
              {canComment ? (
                <div className="rounded-[1.25rem] border border-[#176b5a]/15 bg-[#f6fbf8] p-4">
                  <div className="flex gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#176b5a] text-sm font-black text-white shadow-[0_10px_24px_rgba(23,107,90,0.2)]">
                      {avatarLetter(me?.displayName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-black text-slate-950">{replyTarget ? discussionText.replyComposer : discussionText.join}</p>
                          <p className="mt-0.5 text-xs font-bold text-slate-500">
                            {replyTarget ? `${forumText.replyingTo} ${displayName(replyTarget)}` : discussionText.commentRule}
                          </p>
                        </div>
                        {replyTarget ? (
                          <button
                            type="button"
                            className="min-h-9 rounded-full px-3 text-xs font-black text-slate-500 transition hover:bg-white hover:text-slate-900"
                            onClick={() => setReplyTarget(null)}
                          >
                            {forumText.cancelReply}
                          </button>
                        ) : null}
                      </div>
                      {commentMessage ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{commentMessage}</p> : null}
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {editorLanguages.map((editorLanguage) => (
                          <label key={editorLanguage} className="text-xs font-black text-slate-500">
                            {editorLanguage === 'zh' ? '中文' : 'English'}
                            <textarea
                              className="mt-1 min-h-24 w-full resize-y rounded-2xl border border-[#176b5a]/15 bg-white px-4 py-3 text-sm font-normal leading-7 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#176b5a] focus:ring-4 focus:ring-[#176b5a]/10"
                              value={commentBody[editorLanguage]}
                              placeholder={editorLanguage === 'zh' ? '写下你的回应…' : 'Write a thoughtful response…'}
                              disabled={createCommentMutation.isPending}
                              onChange={(event) => setCommentBody((current) => ({ ...current, [editorLanguage]: event.target.value }))}
                            />
                          </label>
                        ))}
                      </div>
                      <AiLanguageAutofill
                        className="mt-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3"
                        groupId={sermonPost?.groupId || undefined}
                        scope={sermonPost?.groupId ? 'group' : 'church'}
                        fields={missingCommentTranslations}
                        disabled={createCommentMutation.isPending}
                        onTranslated={(translations) => {
                          translations.forEach((translation) => {
                            if (translation.field !== 'body') return
                            setCommentBody((current) => current[translation.language].trim()
                              ? current
                              : { ...current, [translation.language]: translation.text })
                          })
                        }}
                      />
                      <ForumMediaPicker
                        items={commentMedia}
                        language={language}
                        mode="comment"
                        disabled={createCommentMutation.isPending}
                        onAdd={(files) => {
                          const result = selectForumMedia(files, commentMedia, language, 'comment')
                          setCommentMessage(result.error)
                          setCommentMedia(result.items)
                        }}
                        onRemove={(id) => setCommentMedia((items) => items.filter((item) => item.id !== id))}
                      />
                      <div className="mt-3 flex justify-end">
                        <AppActionButton variant="primary" disabled={createCommentMutation.isPending} onClick={submitComment}>
                          <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                          {createCommentMutation.isPending ? (commentMedia.length > 0 ? forumText.mediaUploading : forumText.postingComment) : forumText.postComment}
                        </AppActionButton>
                      </div>
                    </div>
                  </div>
                </div>
              ) : !sermonPost?.isLocked ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#176b5a]/15 bg-[#e3f0eb] px-4 py-3 text-sm font-bold text-[#0d4f43]">
                  <span>{forumText.loginToComment}</span>
                  <Link to="/onboarding" className="inline-flex min-h-10 items-center rounded-xl bg-[#176b5a] px-4 text-sm font-black text-white transition hover:bg-[#0d4f43]">
                    {forumText.login}
                  </Link>
                </div>
              ) : null}

              {sermonDiscussionQuery.isLoading ? (
                <div className="grid gap-3">
                  <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                  <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                </div>
              ) : null}

              {!sermonDiscussionQuery.isLoading && sermonDiscussionQuery.error ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                  {normalizeApiError(sermonDiscussionQuery.error).message}
                </p>
              ) : null}

              {!sermonDiscussionQuery.isLoading && !sermonDiscussionQuery.error && commentThreads.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <MessageCircle className="mx-auto h-7 w-7 text-slate-300" aria-hidden="true" />
                  <p className="mt-3 text-sm font-black text-slate-700">{forumText.noComments}</p>
                  <p className="mt-1 text-sm text-slate-500">{discussionText.firstResponse}</p>
                </div>
              ) : null}

              {commentThreads.length > 0 ? (
                <div className="space-y-5">
                  {paginatedCommentThreads.map(({ comment, replies, replyToById }) => (
                    <article key={comment.id} className="relative">
                      <div className="flex gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#e3f0eb] text-xs font-black text-[#176b5a]">
                          {avatarLetter(comment.author.displayName || comment.author.id)}
                        </span>
                        <div className="min-w-0 flex-1 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
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
                              className="mt-2 inline-flex min-h-8 items-center rounded-full px-2.5 text-xs font-black text-[#176b5a] transition hover:bg-[#e3f0eb]"
                              onClick={() => setReplyTarget(comment)}
                            >
                              <MessageSquareReply className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                              {forumText.replyAction}
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {replies.length > 0 ? (
                        <div className="mt-3 space-y-2 rounded-2xl bg-slate-50 px-4 py-3 sm:ml-14">
                          {replies.map((reply) => {
                            const replyTo = reply.parentCommentId ? replyToById.get(reply.parentCommentId) : null
                            return (
                              <div key={reply.id} className="rounded-xl px-2 py-1.5 text-sm leading-7 transition hover:bg-white">
                                <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                                  <button
                                    type="button"
                                    className="font-black text-[#176b5a] transition hover:text-[#0d4f43]"
                                    onClick={canComment ? () => setReplyTarget(reply) : undefined}
                                  >
                                    {displayName(reply)}
                                  </button>
                                  {replyTo ? (
                                    <>
                                      <span className="font-semibold text-slate-500">{forumText.replyAction}</span>
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
                                      className="inline-flex min-h-7 items-center rounded-full px-2 text-xs font-black text-[#176b5a] transition hover:bg-[#e3f0eb]"
                                      onClick={() => setReplyTarget(reply)}
                                    >
                                      {forumText.replyAction}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                    </article>
                  ))}

                  {/* Comment Pagination Controls */}
                  {totalCommentPages > 1 ? (
                    <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-bold text-slate-600">
                      <button
                        type="button"
                        disabled={commentPage <= 1}
                        onClick={() => setCommentPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        {language === 'zh' ? '上一页' : 'Previous'}
                      </button>

                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: totalCommentPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setCommentPage(page)}
                            className={`h-7 w-7 rounded-full text-xs font-black transition cursor-pointer ${
                              page === commentPage
                                ? 'bg-[#176b5a] text-white shadow-sm'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={commentPage >= totalCommentPages}
                        onClick={() => setCommentPage((p) => Math.min(totalCommentPages, p + 1))}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
                      >
                        {language === 'zh' ? '下一页' : 'Next'}
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </section>
    </AppPageShell>
  )
}

export default SermonVideoView
