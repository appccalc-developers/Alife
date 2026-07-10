import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, CircleX, Clock3, Eye, Globe2, Loader2, PencilLine, RefreshCw, ShieldCheck } from 'lucide-react'
import AppActionButton from '../components/layout/AppActionButton'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import { activeEntityService } from '../services/activeEntityService'
import { groupService, type AdminPageReviewDto } from '../services/groupService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import { localizeText } from '../utils/localizedText'

const copy = {
  title: { en: 'Page Publication Review', zh: '页面发布审核' },
  subtitle: {
    en: 'Review public pages by their current publication approval status.',
    zh: '只审核公开状态的页面，并按当前发布审核状态查看。',
  },
  refresh: { en: 'Refresh', zh: '刷新' },
  loading: { en: 'Loading pages for review...', zh: '正在加载审核页面...' },
  emptyTitle: { en: 'No pages available for review', zh: '没有可审核页面' },
  emptyBody: {
    en: 'Only public pages appear in the publication review queue.',
    zh: '发布审核队列只显示公开状态的页面。',
  },
  tabEmptyTitle: { en: 'No pages in this status', zh: '此状态下没有页面' },
  tabEmptyBody: {
    en: 'Choose another review status or refresh the queue.',
    zh: '可以切换其他审核状态，或刷新审核队列。',
  },
  queue: { en: 'Pages for review', zh: '审核页面' },
  queueHint: {
    en: 'Pending public pages submitted by groups can be approved with a bilingual menu name, ministry card image, and ministry card text, or returned for revision.',
    zh: '小组提交的待审核公开页面可以填写双语菜单名、事工卡片图片和事工卡片文字后批准，或退回修改。',
  },
  groupPage: { en: 'group page', zh: '小组页面' },
  draftStatus: { en: 'Draft', zh: '草稿' },
  groupStatus: { en: 'Group visible', zh: '组内可见' },
  publicStatus: { en: 'Public', zh: '公开' },
  pendingTab: { en: 'Pending', zh: '待审核' },
  approvedTab: { en: 'Approved', zh: '已批准' },
  returnedTab: { en: 'Returned', zh: '已退回' },
  pendingStatus: { en: 'Pending review', zh: '待审核' },
  approvedStatus: { en: 'Approved', zh: '已批准' },
  returnedStatus: { en: 'Returned', zh: '已退回' },
  approve: { en: 'Approve', zh: '批准' },
  approveTitle: { en: 'Approve publication', zh: '批准发布' },
  accessNameEn: { en: 'English menu name', zh: '英文菜单名' },
  accessNameZh: { en: 'Chinese menu name', zh: '中文菜单名' },
  accessNameRequired: { en: 'Please enter both English and Chinese menu names.', zh: '请填写英文和中文菜单名。' },
  cardImageUrl: { en: 'Card image URL', zh: '卡片图片 URL' },
  cardImageUrlPlaceholder: { en: 'https://...', zh: 'https://...' },
  cardTextEn: { en: 'English card text', zh: '英文卡片文字' },
  cardTextZh: { en: 'Chinese card text', zh: '中文卡片文字' },
  cardDetailsRequired: {
    en: 'Please enter a card image URL and both English and Chinese card text.',
    zh: '请填写卡片图片 URL，以及英文和中文卡片文字。',
  },
  cardPreview: { en: 'Ministry card preview', zh: '事工卡片预览' },
  cardText: { en: 'Card text', zh: '卡片文字' },
  cardImage: { en: 'Card image', zh: '卡片图片' },
  submitApprove: { en: 'Approve publication', zh: '批准发布' },
  menuName: { en: 'Menu name', zh: '菜单名' },
  return: { en: 'Return', zh: '退回' },
  returnTitle: { en: 'Return publication request', zh: '退回发布申请' },
  returnReason: { en: 'Reason', zh: '退回原因' },
  returnReasonPlaceholder: {
    en: 'Explain what the group should revise before submitting again.',
    zh: '说明小组需要修改或补充的内容。',
  },
  returnReasonRequired: { en: 'Please enter a return reason.', zh: '请填写退回原因。' },
  submitReturn: { en: 'Submit return', zh: '提交退回' },
  returnedReason: { en: 'Return reason', zh: '退回原因' },
  cancel: { en: 'Cancel', zh: '取消' },
  open: { en: 'Open', zh: '查看' },
  edit: { en: 'Edit', zh: '编辑' },
  group: { en: 'Group', zh: '小组' },
  author: { en: 'Author', zh: '作者' },
  updated: { en: 'Updated', zh: '更新' },
  promoted: { en: 'Page publication approved.', zh: '已批准此页面的发布申请。' },
  returned: { en: 'Page returned for revision.', zh: '已退回此页面的发布申请。' },
  actionFailed: { en: 'Review action failed.', zh: '审核操作失败。' },
  loadFailed: { en: 'Unable to load page review queue.', zh: '无法加载页面审核队列。' },
}

const text = (language: string, key: keyof typeof copy) => copy[key][language === 'zh' ? 'zh' : 'en']

type ReviewTab = AdminPageReviewDto['reviewStatus']

const reviewTabs: ReviewTab[] = ['pending', 'approved', 'returned']

const parseReviewTab = (value: string | null): ReviewTab | null =>
  value === 'pending' || value === 'approved' || value === 'returned' ? value : null

const tabCopyKey: Record<ReviewTab, keyof typeof copy> = {
  pending: 'pendingTab',
  approved: 'approvedTab',
  returned: 'returnedTab',
}

const reviewStatusCopyKey: Record<ReviewTab, keyof typeof copy> = {
  pending: 'pendingStatus',
  approved: 'approvedStatus',
  returned: 'returnedStatus',
}

const formatDate = (value: string, language: string) => {
  if (!value) return ''
  return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

const visibilityText = (language: string, visibility: string) => {
  if (visibility === 'public') return text(language, 'publicStatus')
  if (visibility === 'group') return text(language, 'groupStatus')
  return text(language, 'draftStatus')
}

const visibilityTone = (visibility: string) => {
  if (visibility === 'public') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  if (visibility === 'group') {
    return 'border-sky-200 bg-sky-50 text-sky-700'
  }

  return 'border-amber-200 bg-amber-50 text-amber-700'
}

const reviewStatusTone = (status: ReviewTab) => {
  if (status === 'approved') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  if (status === 'returned') {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }

  return 'border-amber-200 bg-amber-50 text-amber-700'
}

const ReviewStatusIcon = ({ status }: { status: ReviewTab }) => {
  if (status === 'approved') {
    return <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
  }

  if (status === 'returned') {
    return <CircleX className="mr-1 h-3.5 w-3.5" />
  }

  return <Clock3 className="mr-1 h-3.5 w-3.5" />
}

const initialAccessName = (page: AdminPageReviewDto) => ({
  en: page.accessName?.en || page.title?.en || page.title?.zh || '',
  zh: page.accessName?.zh || page.title?.zh || page.title?.en || '',
})

const initialCardText = (page: AdminPageReviewDto) => ({
  en: page.cardText?.en || page.description?.en || page.description?.zh || page.title?.en || page.title?.zh || '',
  zh: page.cardText?.zh || page.description?.zh || page.description?.en || page.title?.zh || page.title?.en || '',
})

const PageReviewView = () => {
  const auth = useAuthStore()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const language = auth.language
  const [items, setItems] = useState<AdminPageReviewDto[]>([])
  const [activeTab, setActiveTab] = useState<ReviewTab>(() => parseReviewTab(searchParams.get('status')) ?? 'pending')
  const [loading, setLoading] = useState(false)
  const [actingPageId, setActingPageId] = useState<string | null>(null)
  const [approvingPage, setApprovingPage] = useState<AdminPageReviewDto | null>(null)
  const [accessName, setAccessName] = useState({ en: '', zh: '' })
  const [cardImageUrl, setCardImageUrl] = useState('')
  const [cardText, setCardText] = useState({ en: '', zh: '' })
  const [returningPage, setReturningPage] = useState<AdminPageReviewDto | null>(null)
  const [returnReason, setReturnReason] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const publicItems = useMemo(() => items.filter((page) => page.visibility === 'public'), [items])
  const reviewCounts = useMemo(
    () =>
      reviewTabs.reduce<Record<ReviewTab, number>>(
        (counts, tab) => ({
          ...counts,
          [tab]: publicItems.filter((page) => page.reviewStatus === tab).length,
        }),
        { pending: 0, approved: 0, returned: 0 },
      ),
    [publicItems],
  )
  const visibleItems = useMemo(
    () => publicItems.filter((page) => page.reviewStatus === activeTab),
    [activeTab, publicItems],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await groupService.getPageReviewCandidates())
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setError(`${text(language, 'loadFailed')} ${apiError.message}`)
    } finally {
      setLoading(false)
    }
  }, [language])

  useEffect(() => {
    load().catch(() => undefined)
  }, [load])

  useEffect(() => {
    const status = parseReviewTab(searchParams.get('status'))
    if (status && status !== activeTab) {
      setActiveTab(status)
    }
  }, [activeTab, searchParams])

  if (!auth.canReviewPages) {
    return <Navigate to="/" replace />
  }

  const openApproveDialog = (page: AdminPageReviewDto) => {
    setApprovingPage(page)
    setAccessName(initialAccessName(page))
    setCardImageUrl(page.cardImageUrl || '')
    setCardText(initialCardText(page))
    setError('')
    setMessage('')
  }

  const closeApproveDialog = () => {
    if (actingPageId) {
      return
    }

    setApprovingPage(null)
    setAccessName({ en: '', zh: '' })
    setCardImageUrl('')
    setCardText({ en: '', zh: '' })
  }

  const submitApproval = async () => {
    if (!approvingPage) {
      return
    }

    const nextAccessName = {
      en: accessName.en.trim(),
      zh: accessName.zh.trim(),
    }
    const nextCardText = {
      en: cardText.en.trim(),
      zh: cardText.zh.trim(),
    }
    const nextCardImageUrl = cardImageUrl.trim()
    if (!nextAccessName.en || !nextAccessName.zh) {
      setError(text(language, 'accessNameRequired'))
      return
    }
    if (!nextCardImageUrl || !nextCardText.en || !nextCardText.zh) {
      setError(text(language, 'cardDetailsRequired'))
      return
    }

    setActingPageId(approvingPage.id)
    setError('')
    setMessage('')
    try {
      await groupService.approvePagePublicationReview(approvingPage.id, {
        accessName: nextAccessName,
        cardImageUrl: nextCardImageUrl,
        cardText: nextCardText,
      })
      await load()
      setMessage(text(language, 'promoted'))
      setApprovingPage(null)
      setAccessName({ en: '', zh: '' })
      setCardImageUrl('')
      setCardText({ en: '', zh: '' })
      selectReviewTab('approved')
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setError(`${text(language, 'actionFailed')} ${apiError.message}`)
    } finally {
      setActingPageId(null)
    }
  }

  const openReturnDialog = (page: AdminPageReviewDto) => {
    setReturningPage(page)
    setReturnReason('')
    setError('')
    setMessage('')
  }

  const closeReturnDialog = () => {
    if (actingPageId) {
      return
    }

    setReturningPage(null)
    setReturnReason('')
  }

  const submitReturn = async () => {
    if (!returningPage) {
      return
    }

    const reason = returnReason.trim()
    if (!reason) {
      setError(text(language, 'returnReasonRequired'))
      return
    }

    setActingPageId(returningPage.id)
    setError('')
    setMessage('')
    try {
      await groupService.returnPagePublicationReview(returningPage.id, { reason })
      await load()
      setMessage(text(language, 'returned'))
      setReturningPage(null)
      setReturnReason('')
      selectReviewTab('returned')
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setError(`${text(language, 'actionFailed')} ${apiError.message}`)
    } finally {
      setActingPageId(null)
    }
  }

  const selectReviewTab = (tab: ReviewTab) => {
    setActiveTab(tab)
    setSearchParams({ status: tab }, { replace: true })
  }

  const canEditReviewPage = (page: AdminPageReviewDto) =>
    auth.canReviewPages &&
    page.visibility === 'public' &&
    auth.hasLeaderAccess(page.ownerGroupId)

  const reviewEditorPath = (page: AdminPageReviewDto) => {
    const params = new URLSearchParams({
      preservePublicationReviewStatus: 'true',
      fromReview: 'true',
      reviewStatus: page.reviewStatus,
    })
    return `/pages/${page.id}/edit?${params.toString()}`
  }

  const openPage = (page: AdminPageReviewDto) => {
    activeEntityService.setPage(page.id, page.ownerGroupId || undefined)
    navigate(canEditReviewPage(page) ? reviewEditorPath(page) : `/pages/${page.id}`)
  }

  return (
    <AppPageShell>
      <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
        <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-amber-50 px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                {language === 'zh' ? '平台审核' : 'Platform review'}
              </p>
              <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">{text(language, 'title')}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{text(language, 'subtitle')}</p>
            </div>
            <AppActionButton variant="secondary" disabled={loading} onClick={() => load().catch(() => undefined)}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {text(language, 'refresh')}
            </AppActionButton>
          </div>
        </div>
      </section>

      {message ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>
      ) : null}
      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">{error}</p>
      ) : null}

      <AppSectionCard dense title={text(language, 'queue')} subtitle={text(language, 'queueHint')}>
        {!loading && publicItems.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label={text(language, 'queue')}>
            {reviewTabs.map((tab) => {
              const selected = activeTab === tab
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`inline-flex min-h-10 items-center rounded-xl border px-3 py-2 text-sm font-black transition ${
                    selected
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                  onClick={() => selectReviewTab(tab)}
                >
                  {text(language, tabCopyKey[tab])}
                  <span
                    className={`ml-2 inline-flex min-w-6 justify-center rounded-full px-2 py-0.5 text-xs ${
                      selected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {reviewCounts[tab]}
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}
        {loading ? (
          <div className="flex items-center gap-2 p-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {text(language, 'loading')}
          </div>
        ) : publicItems.length === 0 ? (
          <AppEmptyState title={text(language, 'emptyTitle')} description={text(language, 'emptyBody')} />
        ) : visibleItems.length === 0 ? (
          <AppEmptyState title={text(language, 'tabEmptyTitle')} description={text(language, 'tabEmptyBody')} />
        ) : (
          <div className="grid gap-3">
            {visibleItems.map((page) => {
              const title = localizeText(page.title, language) || page.id
              const groupName = localizeText(page.ownerGroupName, language) || page.ownerGroupId
              const disabled = actingPageId === page.id
              const canReviewPublication = page.visibility === 'public'
              const canApprove = canReviewPublication && page.reviewStatus !== 'approved'
              const canReturn = canReviewPublication && page.reviewStatus !== 'returned'
              const canEditPage = canEditReviewPage(page)
              const accessLabel = localizeText(page.accessName, language)
              const cardLabel = localizeText(page.cardText, language)

              return (
                <article key={page.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black ${reviewStatusTone(page.reviewStatus)}`}>
                          <ReviewStatusIcon status={page.reviewStatus} />
                          {text(language, reviewStatusCopyKey[page.reviewStatus])}
                        </span>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black ${visibilityTone(page.visibility)}`}>
                          <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                          {visibilityText(language, page.visibility)}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-500">
                          {text(language, 'groupPage')}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-500">
                          {text(language, 'updated')}: {formatDate(page.updatedUtc, language)}
                        </span>
                      </div>
                      <h2 className="mt-3 text-lg font-black leading-7 text-slate-950">{title}</h2>
                      {page.description ? (
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{localizeText(page.description, language)}</p>
                      ) : null}
                      {(page.cardImageUrl || cardLabel) ? (
                        <div className="mt-3 flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          {page.cardImageUrl ? (
                            <img
                              src={page.cardImageUrl}
                              alt=""
                              className="h-16 w-24 shrink-0 rounded-xl object-cover"
                              loading="lazy"
                            />
                          ) : null}
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                              {text(language, 'cardPreview')}
                            </p>
                            {cardLabel ? <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{cardLabel}</p> : null}
                          </div>
                        </div>
                      ) : null}
                      <dl className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                        <div>
                          <dt className="font-bold text-slate-700">{text(language, 'group')}</dt>
                          <dd className="mt-0.5 break-words">{groupName}</dd>
                        </div>
                        <div>
                          <dt className="font-bold text-slate-700">{text(language, 'author')}</dt>
                          <dd className="mt-0.5 break-words">{page.creatorDisplayName || page.createdByMemberId}</dd>
                        </div>
                        {accessLabel ? (
                          <div>
                            <dt className="font-bold text-slate-700">{text(language, 'menuName')}</dt>
                            <dd className="mt-0.5 break-words">{accessLabel}</dd>
                          </div>
                        ) : null}
                        {page.cardImageUrl ? (
                          <div>
                            <dt className="font-bold text-slate-700">{text(language, 'cardImage')}</dt>
                            <dd className="mt-0.5 break-all">{page.cardImageUrl}</dd>
                          </div>
                        ) : null}
                        {cardLabel ? (
                          <div>
                            <dt className="font-bold text-slate-700">{text(language, 'cardText')}</dt>
                            <dd className="mt-0.5 break-words">{cardLabel}</dd>
                          </div>
                        ) : null}
                        {page.returnReason ? (
                          <div>
                            <dt className="font-bold text-slate-700">{text(language, 'returnedReason')}</dt>
                            <dd className="mt-0.5 break-words">{page.returnReason}</dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <AppActionButton size="sm" variant="secondary" onClick={() => openPage(page)}>
                        {canEditPage ? <PencilLine className="mr-1.5 h-4 w-4" /> : <Eye className="mr-1.5 h-4 w-4" />}
                        {text(language, canEditPage ? 'edit' : 'open')}
                      </AppActionButton>
                      {canApprove ? (
                        <AppActionButton size="sm" variant="primary" disabled={disabled} onClick={() => openApproveDialog(page)}>
                          {disabled ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Globe2 className="mr-1.5 h-4 w-4" />}
                          {text(language, 'approve')}
                        </AppActionButton>
                      ) : null}
                      {canReturn ? (
                        <AppActionButton size="sm" variant="secondary" disabled={disabled} onClick={() => openReturnDialog(page)}>
                          <CircleX className="mr-1.5 h-4 w-4" />
                          {text(language, 'return')}
                        </AppActionButton>
                      ) : null}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </AppSectionCard>

      {approvingPage ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/45 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:items-center sm:justify-center sm:pb-4">
          <button type="button" className="absolute inset-0" aria-label={text(language, 'cancel')} onClick={closeApproveDialog} />
          <section className="relative z-10 max-h-[calc(100vh-7rem)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-black text-slate-950">{text(language, 'approveTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {localizeText(approvingPage.title, language) || approvingPage.id}
            </p>
            <label className="mt-5 block text-sm font-bold text-slate-700" htmlFor="page-access-name-en">
              {text(language, 'accessNameEn')}
            </label>
            <input
              id="page-access-name-en"
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-6 text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              value={accessName.en}
              maxLength={120}
              onChange={(event) => {
                setAccessName((current) => ({ ...current, en: event.target.value }))
                if (error === text(language, 'accessNameRequired')) {
                  setError('')
                }
              }}
            />
            <label className="mt-4 block text-sm font-bold text-slate-700" htmlFor="page-access-name-zh">
              {text(language, 'accessNameZh')}
            </label>
            <input
              id="page-access-name-zh"
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-6 text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              value={accessName.zh}
              maxLength={120}
              onChange={(event) => {
                setAccessName((current) => ({ ...current, zh: event.target.value }))
                if (error === text(language, 'accessNameRequired')) {
                  setError('')
                }
              }}
            />
            <label className="mt-4 block text-sm font-bold text-slate-700" htmlFor="page-card-image-url">
              {text(language, 'cardImageUrl')}
            </label>
            <input
              id="page-card-image-url"
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-6 text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              value={cardImageUrl}
              maxLength={1200}
              placeholder={text(language, 'cardImageUrlPlaceholder')}
              onChange={(event) => {
                setCardImageUrl(event.target.value)
                if (error === text(language, 'cardDetailsRequired')) {
                  setError('')
                }
              }}
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-bold text-slate-700" htmlFor="page-card-text-en">
                {text(language, 'cardTextEn')}
                <textarea
                  id="page-card-text-en"
                  className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal leading-6 text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  value={cardText.en}
                  maxLength={280}
                  onChange={(event) => {
                    setCardText((current) => ({ ...current, en: event.target.value }))
                    if (error === text(language, 'cardDetailsRequired')) {
                      setError('')
                    }
                  }}
                />
              </label>
              <label className="block text-sm font-bold text-slate-700" htmlFor="page-card-text-zh">
                {text(language, 'cardTextZh')}
                <textarea
                  id="page-card-text-zh"
                  className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal leading-6 text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  value={cardText.zh}
                  maxLength={280}
                  onChange={(event) => {
                    setCardText((current) => ({ ...current, zh: event.target.value }))
                    if (error === text(language, 'cardDetailsRequired')) {
                      setError('')
                    }
                  }}
                />
              </label>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {cardImageUrl.trim() ? (
                <img src={cardImageUrl.trim()} alt="" className="h-40 w-full object-cover" />
              ) : null}
              <div className="p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{text(language, 'cardPreview')}</p>
                <p className="mt-1 text-base font-black text-slate-950">{localizeText(accessName, language) || localizeText(approvingPage.title, language)}</p>
                <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-600">{localizeText(cardText, language)}</p>
              </div>
            </div>
            {error ? <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AppActionButton variant="secondary" disabled={Boolean(actingPageId)} onClick={closeApproveDialog}>
                {text(language, 'cancel')}
              </AppActionButton>
              <AppActionButton variant="primary" disabled={Boolean(actingPageId)} onClick={() => submitApproval().catch(() => undefined)}>
                {actingPageId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe2 className="mr-2 h-4 w-4" />}
                {text(language, 'submitApprove')}
              </AppActionButton>
            </div>
          </section>
        </div>
      ) : null}

      {returningPage ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/45 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:items-center sm:justify-center sm:pb-4">
          <button type="button" className="absolute inset-0" aria-label={text(language, 'cancel')} onClick={closeReturnDialog} />
          <section className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-black text-slate-950">{text(language, 'returnTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {localizeText(returningPage.title, language) || returningPage.id}
            </p>
            <label className="mt-5 block text-sm font-bold text-slate-700" htmlFor="page-return-reason">
              {text(language, 'returnReason')}
            </label>
            <textarea
              id="page-return-reason"
              className="mt-2 min-h-32 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-6 text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              value={returnReason}
              maxLength={1000}
              placeholder={text(language, 'returnReasonPlaceholder')}
              onChange={(event) => {
                setReturnReason(event.target.value)
                if (error === text(language, 'returnReasonRequired')) {
                  setError('')
                }
              }}
            />
            {error ? <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AppActionButton variant="secondary" disabled={Boolean(actingPageId)} onClick={closeReturnDialog}>
                {text(language, 'cancel')}
              </AppActionButton>
              <AppActionButton variant="primary" disabled={Boolean(actingPageId)} onClick={() => submitReturn().catch(() => undefined)}>
                {actingPageId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CircleX className="mr-2 h-4 w-4" />}
                {text(language, 'submitReturn')}
              </AppActionButton>
            </div>
          </section>
        </div>
      ) : null}
    </AppPageShell>
  )
}

export default PageReviewView
