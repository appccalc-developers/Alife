import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { CircleX, Eye, Globe2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
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
    en: 'Review pages across draft, group, and public visibility before publication decisions.',
    zh: '查看草稿、组内可见、公开等所有状态的页面，再做发布审核决定。',
  },
  refresh: { en: 'Refresh', zh: '刷新' },
  loading: { en: 'Loading pages for review...', zh: '正在加载审核页面...' },
  emptyTitle: { en: 'No pages available for review', zh: '没有可审核页面' },
  emptyBody: {
    en: 'Group and global pages will appear here whether they are draft, group-visible, or public.',
    zh: '小组页面和全站页面无论是草稿、组内可见或公开，都会显示在这里。',
  },
  queue: { en: 'Pages for review', zh: '审核页面' },
  queueHint: {
    en: 'Open any page status to preview it. Global promotion and refusal actions are available only for public group pages.',
    zh: '可打开任何状态的页面预览。设为 global 和拒绝仅适用于公开小组页面。',
  },
  groupPage: { en: 'group page', zh: '小组页面' },
  draftStatus: { en: 'Draft', zh: '草稿' },
  groupStatus: { en: 'Group visible', zh: '组内可见' },
  publicStatus: { en: 'Public', zh: '公开' },
  globalPage: { en: 'global page', zh: '全站页面' },
  promote: { en: 'Set global', zh: '设为 global' },
  refuse: { en: 'Refuse', zh: '拒绝' },
  refuseTitle: { en: 'Refuse global publication', zh: '拒绝全站发布' },
  refusalReason: { en: 'Reason', zh: '拒绝原因' },
  refusalReasonPlaceholder: {
    en: 'Explain what the group should revise before submitting again.',
    zh: '说明小组需要修改或补充的内容。',
  },
  refusalReasonRequired: { en: 'Please enter a refusal reason.', zh: '请填写拒绝原因。' },
  submitRefuse: { en: 'Submit refusal', zh: '提交拒绝' },
  cancel: { en: 'Cancel', zh: '取消' },
  open: { en: 'Open', zh: '查看' },
  group: { en: 'Group', zh: '小组' },
  author: { en: 'Author', zh: '作者' },
  updated: { en: 'Updated', zh: '更新' },
  promoted: { en: 'Page promoted to global.', zh: '页面已设为 global。' },
  refused: { en: 'Page refused for global publication.', zh: '已拒绝此页面的全站发布申请。' },
  promoteConfirm: {
    en: 'Promote this group page to a global public page?',
    zh: '确定把这个小组页面提升为全站公共页面吗？',
  },
  actionFailed: { en: 'Review action failed.', zh: '审核操作失败。' },
  loadFailed: { en: 'Unable to load page review queue.', zh: '无法加载页面审核队列。' },
}

const text = (language: string, key: keyof typeof copy) => copy[key][language === 'zh' ? 'zh' : 'en']

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

const PageReviewView = () => {
  const auth = useAuthStore()
  const navigate = useNavigate()
  const language = auth.language
  const [items, setItems] = useState<AdminPageReviewDto[]>([])
  const [loading, setLoading] = useState(false)
  const [actingPageId, setActingPageId] = useState<string | null>(null)
  const [refusingPage, setRefusingPage] = useState<AdminPageReviewDto | null>(null)
  const [refusalReason, setRefusalReason] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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

  if (!auth.canReviewPages) {
    return <Navigate to="/" replace />
  }

  const promote = async (pageId: string) => {
    if (!window.confirm(text(language, 'promoteConfirm'))) return
    setActingPageId(pageId)
    setError('')
    setMessage('')
    try {
      await groupService.promotePageToGlobal(pageId)
      await load()
      setMessage(text(language, 'promoted'))
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setError(`${text(language, 'actionFailed')} ${apiError.message}`)
    } finally {
      setActingPageId(null)
    }
  }

  const openRefuseDialog = (page: AdminPageReviewDto) => {
    setRefusingPage(page)
    setRefusalReason('')
    setError('')
    setMessage('')
  }

  const closeRefuseDialog = () => {
    if (actingPageId) {
      return
    }

    setRefusingPage(null)
    setRefusalReason('')
  }

  const submitRefusal = async () => {
    if (!refusingPage) {
      return
    }

    const reason = refusalReason.trim()
    if (!reason) {
      setError(text(language, 'refusalReasonRequired'))
      return
    }

    setActingPageId(refusingPage.id)
    setError('')
    setMessage('')
    try {
      await groupService.refusePageGlobalReview(refusingPage.id, { reason })
      await load()
      setMessage(text(language, 'refused'))
      setRefusingPage(null)
      setRefusalReason('')
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setError(`${text(language, 'actionFailed')} ${apiError.message}`)
    } finally {
      setActingPageId(null)
    }
  }

  const openPage = (page: AdminPageReviewDto) => {
    activeEntityService.setPage(page.id, page.ownerGroupId || undefined)
    navigate(`/pages/${page.id}`)
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
        {loading ? (
          <div className="flex items-center gap-2 p-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {text(language, 'loading')}
          </div>
        ) : items.length === 0 ? (
          <AppEmptyState title={text(language, 'emptyTitle')} description={text(language, 'emptyBody')} />
        ) : (
          <div className="grid gap-3">
            {items.map((page) => {
              const title = localizeText(page.title, language) || page.id
              const groupName = page.ownerGroupId
                ? localizeText(page.ownerGroupName, language) || page.ownerGroupId
                : text(language, 'globalPage')
              const disabled = actingPageId === page.id
              const canReviewGlobalPromotion = page.scope === 'group' && page.visibility === 'public'

              return (
                <article key={page.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black ${visibilityTone(page.visibility)}`}>
                          <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                          {visibilityText(language, page.visibility)}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-500">
                          {page.scope === 'global' ? text(language, 'globalPage') : text(language, 'groupPage')}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-500">
                          {text(language, 'updated')}: {formatDate(page.updatedUtc, language)}
                        </span>
                      </div>
                      <h2 className="mt-3 text-lg font-black leading-7 text-slate-950">{title}</h2>
                      {page.description ? (
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{localizeText(page.description, language)}</p>
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
                      </dl>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <AppActionButton size="sm" variant="secondary" onClick={() => openPage(page)}>
                        <Eye className="mr-1.5 h-4 w-4" />
                        {text(language, 'open')}
                      </AppActionButton>
                      {canReviewGlobalPromotion ? (
                        <>
                          <AppActionButton size="sm" variant="primary" disabled={disabled} onClick={() => promote(page.id).catch(() => undefined)}>
                            {disabled ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Globe2 className="mr-1.5 h-4 w-4" />}
                            {text(language, 'promote')}
                          </AppActionButton>
                          <AppActionButton size="sm" variant="secondary" disabled={disabled} onClick={() => openRefuseDialog(page)}>
                            <CircleX className="mr-1.5 h-4 w-4" />
                            {text(language, 'refuse')}
                          </AppActionButton>
                        </>
                      ) : null}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </AppSectionCard>

      {refusingPage ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/45 px-4 py-5 sm:items-center sm:justify-center">
          <button type="button" className="absolute inset-0" aria-label={text(language, 'cancel')} onClick={closeRefuseDialog} />
          <section className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-black text-slate-950">{text(language, 'refuseTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {localizeText(refusingPage.title, language) || refusingPage.id}
            </p>
            <label className="mt-5 block text-sm font-bold text-slate-700" htmlFor="page-refusal-reason">
              {text(language, 'refusalReason')}
            </label>
            <textarea
              id="page-refusal-reason"
              className="mt-2 min-h-32 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-6 text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              value={refusalReason}
              maxLength={1000}
              placeholder={text(language, 'refusalReasonPlaceholder')}
              onChange={(event) => {
                setRefusalReason(event.target.value)
                if (error === text(language, 'refusalReasonRequired')) {
                  setError('')
                }
              }}
            />
            {error ? <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AppActionButton variant="secondary" disabled={Boolean(actingPageId)} onClick={closeRefuseDialog}>
                {text(language, 'cancel')}
              </AppActionButton>
              <AppActionButton variant="primary" disabled={Boolean(actingPageId)} onClick={() => submitRefusal().catch(() => undefined)}>
                {actingPageId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CircleX className="mr-2 h-4 w-4" />}
                {text(language, 'submitRefuse')}
              </AppActionButton>
            </div>
          </section>
        </div>
      ) : null}
    </AppPageShell>
  )
}

export default PageReviewView
