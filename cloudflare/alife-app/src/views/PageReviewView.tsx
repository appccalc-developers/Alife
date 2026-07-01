import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { CheckCircle2, Eye, Globe2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
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
    en: 'Review public group pages before promoting them into global public pages.',
    zh: '审核已设置为公开的小组页面，再决定是否提升为全站公共页面。',
  },
  refresh: { en: 'Refresh', zh: '刷新' },
  loading: { en: 'Loading review queue...', zh: '正在加载审核队列...' },
  emptyTitle: { en: 'No pages waiting for review', zh: '没有待审核页面' },
  emptyBody: {
    en: 'When a group page is set to public, it stays in the group and appears here for global review.',
    zh: '小组页面设置为公开后仍留在小组内，并会出现在这里等待全站审核。',
  },
  queue: { en: 'Review queue', zh: '审核队列' },
  queueHint: {
    en: 'Promoting changes the page scope to global. Ignoring leaves the group page unchanged and hides it until it is edited again.',
    zh: '通过后页面 scope 会变成 global。忽略不会修改小组页面，并会隐藏到页面再次被编辑。',
  },
  publicGroupPage: { en: 'public group page', zh: '公开小组页面' },
  promote: { en: 'Set global', zh: '设为 global' },
  ignore: { en: 'Ignore', zh: '暂不处理' },
  open: { en: 'Open', zh: '查看' },
  group: { en: 'Group', zh: '小组' },
  author: { en: 'Author', zh: '作者' },
  updated: { en: 'Updated', zh: '更新' },
  promoted: { en: 'Page promoted to global.', zh: '页面已设为 global。' },
  ignored: { en: 'Page ignored for now.', zh: '已暂不处理此页面。' },
  promoteConfirm: {
    en: 'Promote this group page to a global public page?',
    zh: '确定把这个小组页面提升为全站公共页面吗？',
  },
  ignoreConfirm: {
    en: 'Ignore this page until it is edited again?',
    zh: '暂不处理此页面，直到它再次被编辑后再进入审核？',
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

const PageReviewView = () => {
  const auth = useAuthStore()
  const navigate = useNavigate()
  const language = auth.language
  const [items, setItems] = useState<AdminPageReviewDto[]>([])
  const [loading, setLoading] = useState(false)
  const [actingPageId, setActingPageId] = useState<string | null>(null)
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

  const removeItem = (pageId: string) => {
    setItems((current) => current.filter((item) => item.id !== pageId))
  }

  const promote = async (pageId: string) => {
    if (!window.confirm(text(language, 'promoteConfirm'))) return
    setActingPageId(pageId)
    setError('')
    setMessage('')
    try {
      await groupService.promotePageToGlobal(pageId)
      removeItem(pageId)
      setMessage(text(language, 'promoted'))
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setError(`${text(language, 'actionFailed')} ${apiError.message}`)
    } finally {
      setActingPageId(null)
    }
  }

  const ignore = async (pageId: string) => {
    if (!window.confirm(text(language, 'ignoreConfirm'))) return
    setActingPageId(pageId)
    setError('')
    setMessage('')
    try {
      await groupService.ignorePageGlobalReview(pageId)
      removeItem(pageId)
      setMessage(text(language, 'ignored'))
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setError(`${text(language, 'actionFailed')} ${apiError.message}`)
    } finally {
      setActingPageId(null)
    }
  }

  const openPage = (page: AdminPageReviewDto) => {
    activeEntityService.setPage(page.id, page.ownerGroupId)
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
              const groupName = localizeText(page.ownerGroupName, language) || page.ownerGroupId
              const disabled = actingPageId === page.id

              return (
                <article key={page.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                          <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                          {text(language, 'publicGroupPage')}
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
                      <AppActionButton size="sm" variant="primary" disabled={disabled} onClick={() => promote(page.id).catch(() => undefined)}>
                        {disabled ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Globe2 className="mr-1.5 h-4 w-4" />}
                        {text(language, 'promote')}
                      </AppActionButton>
                      <AppActionButton size="sm" variant="secondary" disabled={disabled} onClick={() => ignore(page.id).catch(() => undefined)}>
                        <CheckCircle2 className="mr-1.5 h-4 w-4" />
                        {text(language, 'ignore')}
                      </AppActionButton>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </AppSectionCard>

      {auth.isAdmin ? (
        <Link className="text-sm font-bold text-emerald-700 transition hover:text-emerald-900" to="/admin">
          {language === 'zh' ? '返回平台工作台' : 'Back to platform workspace'}
        </Link>
      ) : null}
    </AppPageShell>
  )
}

export default PageReviewView
