import { type DragEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { CheckCircle2, ChevronDown, CircleX, Clock3, Eye, Globe2, GripVertical, ImagePlus, Loader2, PencilLine, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import AppActionButton from '../components/layout/AppActionButton'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import { activeEntityService } from '../services/activeEntityService'
import { groupService, type AdminPagePrimaryMenuDto, type AdminPageReviewDto } from '../services/groupService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import type { PagePrimaryMenuHomePlacement } from '../types'
import { localizeText } from '../utils/localizedText'
import SystemManagementFrame from './admin/SystemManagementFrame'

const copy = {
  title: { en: 'Homepage Management', zh: '首页管理' },
  subtitle: {
    en: 'Review submitted copies and manage public navigation without changing the group working page.',
    zh: '审核小家提交的页面副本并管理公开导航，不改动小家的工作页面。',
  },
  refresh: { en: 'Refresh', zh: '刷新' },
  refreshSuccess: {
    en: 'Public page cache cleared and website data refreshed.',
    zh: '公开页面缓存已清除，网站数据已刷新。',
  },
  refreshFailed: {
    en: 'Unable to clear the public page cache.',
    zh: '无法清除公开页面缓存。',
  },
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
    en: 'Each item is a submitted copy. Approving replaces the website version; returning it leaves the current website version online.',
    zh: '每项都是提交的副本；批准后替换网站版本，退回时网站现有版本继续在线。',
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
  publishedVersionRetained: { en: 'Current website version stays published', zh: '网站现有版本继续发布' },
  approve: { en: 'Approve', zh: '批准' },
  editMenu: { en: 'Edit menu', zh: '编辑菜单' },
  saveMenu: { en: 'Save menu changes', zh: '保存菜单修改' },
  approveTitle: { en: 'Approve publication', zh: '批准发布' },
  editMenuTitle: { en: 'Edit menu configuration', zh: '编辑菜单配置' },
  primaryMenu: { en: 'Primary menu', zh: '一级菜单' },
  selectPrimaryMenu: { en: 'Select a primary menu', zh: '请选择一级菜单' },
  newPrimaryMenu: { en: 'Create a new primary menu', zh: '新建一级菜单' },
  primaryMenuEn: { en: 'English primary menu name', zh: '一级菜单英文名' },
  primaryMenuZh: { en: 'Chinese primary menu name', zh: '一级菜单中文名' },
  primaryMenuRequired: { en: 'Please select or enter both primary menu names.', zh: '请选择一级菜单，或填写一级菜单的中英文名称。' },
  accessNameEn: { en: 'English menu name', zh: '英文菜单名' },
  accessNameZh: { en: 'Chinese menu name', zh: '中文菜单名' },
  accessNameRequired: { en: 'Please enter both English and Chinese menu names.', zh: '请填写英文和中文菜单名。' },
  cardImageSourceHint: {
    en: 'Automatically taken from the first image in the page sections.',
    zh: '自动取自页面 section 列表中的第一张图。',
  },
  cardTextEn: { en: 'English card text', zh: '英文卡片文字' },
  cardTextZh: { en: 'Chinese card text', zh: '中文卡片文字' },
  cardTextRequired: {
    en: 'Please enter both English and Chinese card text.',
    zh: '请填写英文和中文卡片文字。',
  },
  cardPreview: { en: 'Ministry card preview', zh: '事工卡片预览' },
  cardText: { en: 'Card text', zh: '卡片文字' },
  cardImage: { en: 'Card image', zh: '卡片图片' },
  submitApprove: { en: 'Approve publication', zh: '批准发布' },
  menuName: { en: 'Menu name', zh: '菜单名' },
  return: { en: 'Return', zh: '退回' },
  withdrawReview: { en: 'Withdraw approval', zh: '撤回审核' },
  withdrawReviewTitle: { en: 'Withdraw publication approval', zh: '撤回页面发布审核' },
  withdrawReason: { en: 'Withdrawal reason', zh: '撤回原因' },
  withdrawReasonPlaceholder: {
    en: 'Explain why this publication approval is being withdrawn.',
    zh: '说明撤回此页面发布审核的原因。',
  },
  submitWithdrawReview: { en: 'Withdraw approval', zh: '确认撤回审核' },
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
  modifyPage: { en: 'Modify page', zh: '修改页面' },
  modifyInterface: { en: 'Modify page', zh: '修改界面' },
  confirmModifyInterface: { en: 'Confirm modification', zh: '确认修改界面' },
  group: { en: 'Group', zh: '小组' },
  author: { en: 'Author', zh: '作者' },
  updated: { en: 'Updated', zh: '更新' },
  promoted: { en: 'Page publication approved.', zh: '已批准此页面的发布申请。' },
  menuUpdated: { en: 'Menu configuration updated.', zh: '菜单配置已更新。' },
  returned: { en: 'Page returned for revision.', zh: '已退回此页面的发布申请。' },
  actionFailed: { en: 'Review action failed.', zh: '审核操作失败。' },
  loadFailed: { en: 'Unable to load page review queue.', zh: '无法加载页面审核队列。' },
  dragMenuHint: { en: 'Drag tabs to reorder menus. Drag cards to reorder them or move them to another tab.', zh: '拖动标签可调整一级菜单顺序；拖动卡片可调整二级菜单顺序，或移动到其他标签。' },
  editPrimaryMenu: { en: 'Edit primary menu', zh: '修改一级菜单' },
  savePrimaryMenu: { en: 'Save primary menu', zh: '保存一级菜单' },
  deletePrimaryMenu: { en: 'Delete empty menu', zh: '删除空菜单' },
  confirmDeletePrimaryMenu: { en: 'Confirm deletion', zh: '确认删除' },
  primaryMenuUpdated: { en: 'Primary menu updated.', zh: '一级菜单已更新。' },
  primaryMenuCreated: { en: 'Primary menu created.', zh: '一级菜单已建立。' },
  primaryMenuDeleted: { en: 'Empty primary menu deleted.', zh: '空的一级菜单已删除。' },
  menuLayoutUpdated: { en: 'Menu order updated.', zh: '菜单顺序已更新。' },
  menuActionFailed: { en: 'Unable to update the menu layout.', zh: '无法更新菜单布局。' },
  homePlacement: { en: 'Home page carousel', zh: '首页轮播用途' },
  homePlacementNone: { en: 'Not shown in a home carousel', zh: '不用于首页轮播' },
  homePlacementChurchOrganization: { en: 'Church organization', zh: '教会组成' },
  homePlacementRecentEvents: { en: 'Recent events', zh: '最近活动' },
  homePlacementHint: {
    en: 'Each home carousel can be assigned to only one primary menu.',
    zh: '每个首页轮播用途只能指定给一个一级菜单。',
  },
}

const text = (language: string, key: keyof typeof copy) => copy[key][language === 'zh' ? 'zh' : 'en']

const homePlacementCopyKey = (placement: PagePrimaryMenuHomePlacement) =>
  placement === 'churchOrganization'
    ? 'homePlacementChurchOrganization' as const
    : 'homePlacementRecentEvents' as const

type ReviewTab = AdminPageReviewDto['reviewStatus']
type DraggedReviewItem =
  | { kind: 'primary-menu'; primaryMenuId: string }
  | { kind: 'page'; pageId: string; primaryMenuId: string }

const reviewTabs: ReviewTab[] = ['approved', 'pending', 'returned']

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

const ReviewCardImage = ({ imageUrl, alt }: { imageUrl: string | null | undefined; alt: string }) => (
  <span className="flex h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-200 text-slate-500 sm:h-20 sm:w-28">
    {imageUrl ? (
      <img src={imageUrl} alt={alt} className="h-full w-full object-cover" loading="lazy" />
    ) : (
      <span className="flex h-full w-full items-center justify-center" role="img" aria-label={alt}>
        <ImagePlus className="h-6 w-6" />
      </span>
    )}
  </span>
)

const initialAccessName = (page: AdminPageReviewDto) => {
  const groupEn = page.ownerGroupName?.en || page.ownerGroupName?.zh || ''
  const groupZh = page.ownerGroupName?.zh || page.ownerGroupName?.en || ''
  const titleEn = page.title?.en || page.title?.zh || ''
  const titleZh = page.title?.zh || page.title?.en || ''

  return {
    en: page.accessName?.en || [groupEn, titleEn].filter(Boolean).join('-'),
    zh: page.accessName?.zh || [groupZh, titleZh].filter(Boolean).join('-'),
  }
}

const primaryMenuKey = (value: AdminPageReviewDto['primaryMenuName']) => {
  const en = value?.en?.trim().replace(/\s+/g, ' ').toLocaleLowerCase() || ''
  const zh = value?.zh?.trim().replace(/\s+/g, ' ').toLocaleLowerCase() || ''
  return en && zh ? JSON.stringify([en, zh]) : ''
}

const initialCardText = (page: AdminPageReviewDto) => ({
  en: page.cardText?.en || page.description?.en || page.description?.zh || page.title?.en || page.title?.zh || '',
  zh: page.cardText?.zh || page.description?.zh || page.description?.en || page.title?.zh || page.title?.en || '',
})

const PageReviewView = () => {
  const auth = useAuthStore()
  const navigate = useNavigate()
  const language = auth.language
  const [items, setItems] = useState<AdminPageReviewDto[]>([])
  const [primaryMenus, setPrimaryMenus] = useState<AdminPagePrimaryMenuDto[]>([])
  const [activeTab, setActiveTab] = useState<ReviewTab>('approved')
  const [activeApprovedMenuKey, setActiveApprovedMenuKey] = useState('')
  const [draggedReviewItem, setDraggedReviewItem] = useState<DraggedReviewItem | null>(null)
  const [layoutSaving, setLayoutSaving] = useState(false)
  const [editingPrimaryMenuId, setEditingPrimaryMenuId] = useState<string | null>(null)
  const [creatingPrimaryMenu, setCreatingPrimaryMenu] = useState(false)
  const [editingPrimaryMenuName, setEditingPrimaryMenuName] = useState({ en: '', zh: '' })
  const [editingPrimaryMenuHomePlacement, setEditingPrimaryMenuHomePlacement] = useState<PagePrimaryMenuHomePlacement | ''>('')
  const [confirmingPrimaryMenuDeleteId, setConfirmingPrimaryMenuDeleteId] = useState<string | null>(null)
  const [confirmingPageModificationId, setConfirmingPageModificationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [actingPageId, setActingPageId] = useState<string | null>(null)
  const [approvingPage, setApprovingPage] = useState<AdminPageReviewDto | null>(null)
  const [primaryMenuSelection, setPrimaryMenuSelection] = useState('')
  const [primaryMenuName, setPrimaryMenuName] = useState({ en: '', zh: '' })
  const [accessName, setAccessName] = useState({ en: '', zh: '' })
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
          [tab]: publicItems.filter((page) => tab === 'approved' ? page.isPublished : page.reviewStatus === tab).length,
        }),
        { pending: 0, approved: 0, returned: 0 },
      ),
    [publicItems],
  )
  const approvedMenuGroups = useMemo(() => {
    const approvedPages = publicItems.filter((page) => page.isPublished)
    return [...primaryMenus]
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
      .map((menu) => ({
        key: menu.id,
        name: menu.name,
        pages: approvedPages
          .filter((page) => page.primaryMenuId === menu.id)
          .sort((left, right) => left.menuSortOrder - right.menuSortOrder || left.id.localeCompare(right.id)),
      }))
  }, [primaryMenus, publicItems])
  const selectedApprovedMenuKey = approvedMenuGroups.some((group) => group.key === activeApprovedMenuKey)
    ? activeApprovedMenuKey
    : approvedMenuGroups[0]?.key || ''
  const editingPrimaryMenu = primaryMenus.find((menu) => menu.id === editingPrimaryMenuId) ?? null
  const editingPrimaryMenuPageCount = approvedMenuGroups.find((group) => group.key === editingPrimaryMenuId)?.pages.length ?? 0
  const visibleItems = useMemo(() => {
    if (activeTab === 'approved') {
      return approvedMenuGroups.find((group) => group.key === selectedApprovedMenuKey)?.pages || []
    }

    return publicItems.filter((page) => page.reviewStatus === activeTab)
  }, [activeTab, approvedMenuGroups, publicItems, selectedApprovedMenuKey])
  const primaryMenuOptions = useMemo(() => {
    const byKey = new Map<string, { key: string; name: { en: string; zh: string } }>()
    primaryMenus.forEach((menu) => {
      const key = primaryMenuKey(menu.name)
      if (key && !byKey.has(key)) {
        byKey.set(key, {
          key,
          name: { en: menu.name.en.trim(), zh: menu.name.zh.trim() },
        })
      }
    })
    return Array.from(byKey.values()).sort((left, right) =>
      localizeText(left.name, language).localeCompare(
        localizeText(right.name, language),
        language === 'zh' ? 'zh-Hans' : 'en',
        { sensitivity: 'base' },
      ),
    )
  }, [language, primaryMenus])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextItems, nextPrimaryMenus] = await Promise.all([
        groupService.getPageReviewCandidates(),
        groupService.getPagePrimaryMenus(),
      ])
      setItems(nextItems)
      setPrimaryMenus(nextPrimaryMenus)
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setError(`${text(language, 'loadFailed')} ${apiError.message}`)
    } finally {
      setLoading(false)
    }
  }, [language])

  const refreshWebsite = useCallback(async () => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      await groupService.refreshPublicPagesCache()
      const [nextItems, nextPrimaryMenus] = await Promise.all([
        groupService.getPageReviewCandidates(),
        groupService.getPagePrimaryMenus(),
      ])
      setItems(nextItems)
      setPrimaryMenus(nextPrimaryMenus)
      setMessage(text(language, 'refreshSuccess'))
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setError(`${text(language, 'refreshFailed')} ${apiError.message}`)
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

  const openApproveDialog = (page: AdminPageReviewDto) => {
    setApprovingPage(page)
    setConfirmingPageModificationId(null)
    const nextPrimaryMenuName = {
      en: page.primaryMenuName?.en || '',
      zh: page.primaryMenuName?.zh || '',
    }
    const nextPrimaryMenuKey = primaryMenuKey(nextPrimaryMenuName)
    setPrimaryMenuSelection(
      primaryMenuOptions.some((option) => option.key === nextPrimaryMenuKey)
        ? nextPrimaryMenuKey
        : nextPrimaryMenuKey ? '__new__' : '',
    )
    setPrimaryMenuName(nextPrimaryMenuName)
    setAccessName(initialAccessName(page))
    setCardText(initialCardText(page))
    setError('')
    setMessage('')
  }

  const closeApproveDialog = () => {
    if (actingPageId) {
      return
    }

    setApprovingPage(null)
    setPrimaryMenuSelection('')
    setPrimaryMenuName({ en: '', zh: '' })
    setAccessName({ en: '', zh: '' })
    setCardText({ en: '', zh: '' })
    setConfirmingPageModificationId(null)
  }

  const submitApproval = async () => {
    if (!approvingPage) {
      return
    }

    const nextAccessName = {
      en: accessName.en.trim(),
      zh: accessName.zh.trim(),
    }
    const nextPrimaryMenuName = {
      en: primaryMenuName.en.trim(),
      zh: primaryMenuName.zh.trim(),
    }
    const nextCardText = {
      en: cardText.en.trim(),
      zh: cardText.zh.trim(),
    }
    const editingApprovedMenuItem = approvingPage.reviewStatus === 'approved'
    if (!editingApprovedMenuItem && (!nextPrimaryMenuName.en || !nextPrimaryMenuName.zh)) {
      setError(text(language, 'primaryMenuRequired'))
      return
    }
    if (!nextAccessName.en || !nextAccessName.zh) {
      setError(text(language, 'accessNameRequired'))
      return
    }
    if (!nextCardText.en || !nextCardText.zh) {
      setError(text(language, 'cardTextRequired'))
      return
    }

    setActingPageId(approvingPage.id)
    setError('')
    setMessage('')
    try {
      await groupService.approvePagePublicationReview(approvingPage.id, {
        primaryMenuName: editingApprovedMenuItem ? undefined : nextPrimaryMenuName,
        accessName: nextAccessName,
        cardText: nextCardText,
      })
      await load()
      setMessage(text(language, approvingPage.reviewStatus === 'approved' ? 'menuUpdated' : 'promoted'))
      setApprovingPage(null)
      setPrimaryMenuSelection('')
      setPrimaryMenuName({ en: '', zh: '' })
      setAccessName({ en: '', zh: '' })
      setCardText({ en: '', zh: '' })
      setConfirmingPageModificationId(null)
      selectReviewTab('approved')
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setError(`${text(language, 'actionFailed')} ${apiError.message}`)
    } finally {
      setActingPageId(null)
    }
  }

  const openReturnDialog = (page: AdminPageReviewDto) => {
    setConfirmingPageModificationId(null)
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
    if (approvingPage?.reviewStatus === 'approved') {
      closeApproveDialog()
    }
    setActiveTab(tab)
  }

  const canEditReviewPage = (page: AdminPageReviewDto) =>
    auth.canReviewPages &&
    page.visibility === 'public' &&
    auth.hasLeaderAccess(page.ownerGroupId)

  const reviewEditorPath = (page: AdminPageReviewDto) => {
    const params = new URLSearchParams({
      fromReview: 'true',
    })
    return `/pages/${page.id}/edit?${params.toString()}`
  }

  const openPage = (page: AdminPageReviewDto) => {
    activeEntityService.setPage(page.id, page.ownerGroupId || undefined)
    navigate(canEditReviewPage(page) ? reviewEditorPath(page) : `/pages/${page.id}?fromReview=true`)
  }

  const requestPageModification = (page: AdminPageReviewDto) => {
    if (confirmingPageModificationId === page.id) {
      setConfirmingPageModificationId(null)
      openPage(page)
      return
    }

    setConfirmingPageModificationId(page.id)
  }

  const persistMenuLayout = async (
    nextPrimaryMenus: AdminPagePrimaryMenuDto[],
    nextItems: AdminPageReviewDto[],
  ) => {
    setLayoutSaving(true)
    setError('')
    setMessage('')
    try {
      await groupService.savePageMenuLayout(
        [...nextPrimaryMenus]
          .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
          .map((menu) => ({
            primaryMenuId: menu.id,
            pageIds: nextItems
              .filter((page) => page.isPublished && page.primaryMenuId === menu.id)
              .sort((left, right) => left.menuSortOrder - right.menuSortOrder || left.id.localeCompare(right.id))
              .map((page) => page.id),
          })),
      )
      setMessage(text(language, 'menuLayoutUpdated'))
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      const actionError = `${text(language, 'menuActionFailed')} ${apiError.message}`
      await load()
      setError(actionError)
    } finally {
      setLayoutSaving(false)
      setDraggedReviewItem(null)
    }
  }

  const startPrimaryMenuDrag = (event: DragEvent<HTMLElement>, primaryMenuId: string) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', primaryMenuId)
    setDraggedReviewItem({ kind: 'primary-menu', primaryMenuId })
  }

  const dropPrimaryMenu = (event: DragEvent<HTMLDivElement>, targetPrimaryMenuId: string) => {
    event.preventDefault()
    if (layoutSaving || draggedReviewItem?.kind !== 'primary-menu') {
      return
    }

    const sourceIndex = primaryMenus.findIndex((menu) => menu.id === draggedReviewItem.primaryMenuId)
    const targetIndex = primaryMenus.findIndex((menu) => menu.id === targetPrimaryMenuId)
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
      setDraggedReviewItem(null)
      return
    }

    const reordered = [...primaryMenus]
    const [moved] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    const nextPrimaryMenus = reordered.map((menu, index) => ({ ...menu, sortOrder: index }))
    setPrimaryMenus(nextPrimaryMenus)
    persistMenuLayout(nextPrimaryMenus, items).catch(() => undefined)
  }

  const startPageDrag = (event: DragEvent<HTMLElement>, page: AdminPageReviewDto) => {
    if (!page.primaryMenuId) {
      return
    }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', page.id)
    setDraggedReviewItem({ kind: 'page', pageId: page.id, primaryMenuId: page.primaryMenuId })
  }

  const movePageToMenu = (targetPrimaryMenuId: string, targetPageId?: string) => {
    if (layoutSaving || draggedReviewItem?.kind !== 'page') {
      return
    }

    const pagesByMenuId = new Map<string, string[]>()
    primaryMenus.forEach((menu) => {
      pagesByMenuId.set(
        menu.id,
        items
          .filter((page) => page.isPublished && page.primaryMenuId === menu.id)
          .sort((left, right) => left.menuSortOrder - right.menuSortOrder || left.id.localeCompare(right.id))
          .map((page) => page.id),
      )
    })

    const sourcePageIds = pagesByMenuId.get(draggedReviewItem.primaryMenuId)
    const targetPageIds = pagesByMenuId.get(targetPrimaryMenuId)
    if (!sourcePageIds || !targetPageIds) {
      setDraggedReviewItem(null)
      return
    }

    const sourceIndex = sourcePageIds.indexOf(draggedReviewItem.pageId)
    if (sourceIndex < 0) {
      setDraggedReviewItem(null)
      return
    }

    sourcePageIds.splice(sourceIndex, 1)
    let targetIndex = targetPageId ? targetPageIds.indexOf(targetPageId) : targetPageIds.length
    if (targetIndex < 0) targetIndex = targetPageIds.length
    targetPageIds.splice(targetIndex, 0, draggedReviewItem.pageId)

    const targetMenu = primaryMenus.find((menu) => menu.id === targetPrimaryMenuId)
    const pagePosition = new Map<string, { primaryMenuId: string; menuSortOrder: number }>()
    pagesByMenuId.forEach((pageIds, primaryMenuId) => {
      pageIds.forEach((pageId, index) => pagePosition.set(pageId, { primaryMenuId, menuSortOrder: index }))
    })
    const nextItems = items.map((page) => {
      const position = pagePosition.get(page.id)
      if (!position) return page
      const menu = primaryMenus.find((candidate) => candidate.id === position.primaryMenuId)
      return {
        ...page,
        primaryMenuId: position.primaryMenuId,
        primaryMenuName: menu?.name ?? page.primaryMenuName,
        menuSortOrder: position.menuSortOrder,
      }
    })

    setItems(nextItems)
    setActiveApprovedMenuKey(targetPrimaryMenuId)
    setDraggedReviewItem(null)
    if (targetMenu) {
      persistMenuLayout(primaryMenus, nextItems).catch(() => undefined)
    }
  }

  const dropPage = (event: DragEvent<HTMLElement>, targetPrimaryMenuId: string, targetPageId?: string) => {
    event.preventDefault()
    event.stopPropagation()
    movePageToMenu(targetPrimaryMenuId, targetPageId)
  }

  const openPrimaryMenuEditor = (menu: AdminPagePrimaryMenuDto) => {
    closeApproveDialog()
    setCreatingPrimaryMenu(false)
    setEditingPrimaryMenuId((current) => current === menu.id ? null : menu.id)
    setEditingPrimaryMenuName({ en: menu.name.en || '', zh: menu.name.zh || '' })
    setEditingPrimaryMenuHomePlacement(menu.homePlacement || '')
    setConfirmingPrimaryMenuDeleteId(null)
    setError('')
    setMessage('')
  }

  const openPrimaryMenuCreator = () => {
    closeApproveDialog()
    setEditingPrimaryMenuId(null)
    setCreatingPrimaryMenu(true)
    setEditingPrimaryMenuName({ en: '', zh: '' })
    setEditingPrimaryMenuHomePlacement('')
    setConfirmingPrimaryMenuDeleteId(null)
    setError('')
    setMessage('')
  }

  const savePrimaryMenu = async () => {
    if (!editingPrimaryMenuId && !creatingPrimaryMenu) return
    const name = { en: editingPrimaryMenuName.en.trim(), zh: editingPrimaryMenuName.zh.trim() }
    if (!name.en || !name.zh) {
      setError(text(language, 'primaryMenuRequired'))
      return
    }

    setLayoutSaving(true)
    setError('')
    try {
      if (creatingPrimaryMenu) {
        const created = await groupService.createPagePrimaryMenu(name, editingPrimaryMenuHomePlacement || null)
        setPrimaryMenus((current) => [...current, created])
        setActiveApprovedMenuKey(created.id)
        setCreatingPrimaryMenu(false)
        setMessage(text(language, 'primaryMenuCreated'))
        return
      }

      if (!editingPrimaryMenuId) return
      const updated = await groupService.updatePagePrimaryMenu(editingPrimaryMenuId, name, editingPrimaryMenuHomePlacement || null)
      setPrimaryMenus((current) => current.map((menu) => menu.id === updated.id ? updated : menu))
      setItems((current) => current.map((page) => page.primaryMenuId === updated.id ? { ...page, primaryMenuName: updated.name } : page))
      setEditingPrimaryMenuId(null)
      setCreatingPrimaryMenu(false)
      setMessage(text(language, 'primaryMenuUpdated'))
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setError(`${text(language, 'menuActionFailed')} ${apiError.message}`)
    } finally {
      setLayoutSaving(false)
    }
  }

  const deletePrimaryMenu = async (primaryMenuId: string) => {
    if (confirmingPrimaryMenuDeleteId !== primaryMenuId) {
      setConfirmingPrimaryMenuDeleteId(primaryMenuId)
      return
    }

    setLayoutSaving(true)
    setError('')
    try {
      await groupService.deletePagePrimaryMenu(primaryMenuId)
      setEditingPrimaryMenuId(null)
      setConfirmingPrimaryMenuDeleteId(null)
      await load()
      setMessage(text(language, 'primaryMenuDeleted'))
    } catch (reason) {
      const apiError = normalizeApiError(reason)
      setError(`${text(language, 'menuActionFailed')} ${apiError.message}`)
    } finally {
      setLayoutSaving(false)
    }
  }

  const renderApprovalEditor = (page: AdminPageReviewDto, inline = false) => {
    const fieldPrefix = `page-menu-${page.id}`

    return (
      <>
        {!inline ? (
          <>
            <h2 className="text-lg font-black text-slate-950">
              {text(language, page.reviewStatus === 'approved' ? 'editMenuTitle' : 'approveTitle')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {localizeText(page.title, language) || page.id}
            </p>
            <label className="mt-5 block text-sm font-bold text-slate-700" htmlFor={`${fieldPrefix}-primary`}>
              {text(language, 'primaryMenu')}
            </label>
            <select
          id={`${fieldPrefix}-primary`}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          value={primaryMenuSelection}
          onChange={(event) => {
            const key = event.target.value
            setPrimaryMenuSelection(key)
            const option = primaryMenuOptions.find((candidate) => candidate.key === key)
            if (option) {
              setPrimaryMenuName(option.name)
            } else {
              setPrimaryMenuName({ en: '', zh: '' })
            }
            if (error === text(language, 'primaryMenuRequired')) {
              setError('')
            }
          }}
        >
          <option value="">{text(language, 'selectPrimaryMenu')}</option>
          {primaryMenuOptions.map((option) => (
            <option key={option.key} value={option.key}>{localizeText(option.name, language)}</option>
          ))}
          <option value="__new__">{text(language, 'newPrimaryMenu')}</option>
            </select>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold text-slate-700" htmlFor={`${fieldPrefix}-primary-en`}>
            {text(language, 'primaryMenuEn')}
            <input
              id={`${fieldPrefix}-primary-en`}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal leading-6 text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              value={primaryMenuName.en}
              maxLength={120}
              onChange={(event) => {
                setPrimaryMenuSelection('__new__')
                setPrimaryMenuName((current) => ({ ...current, en: event.target.value }))
                if (error === text(language, 'primaryMenuRequired')) setError('')
              }}
            />
          </label>
          <label className="block text-sm font-bold text-slate-700" htmlFor={`${fieldPrefix}-primary-zh`}>
            {text(language, 'primaryMenuZh')}
            <input
              id={`${fieldPrefix}-primary-zh`}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal leading-6 text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              value={primaryMenuName.zh}
              maxLength={120}
              onChange={(event) => {
                setPrimaryMenuSelection('__new__')
                setPrimaryMenuName((current) => ({ ...current, zh: event.target.value }))
                if (error === text(language, 'primaryMenuRequired')) setError('')
              }}
            />
          </label>
            </div>
          </>
        ) : null}
        <div className={`${inline ? '' : 'mt-5'} grid gap-4 sm:grid-cols-2`}>
          <label className="block text-sm font-bold text-slate-700" htmlFor={`${fieldPrefix}-access-en`}>
            {text(language, 'accessNameEn')}
            <input
              id={`${fieldPrefix}-access-en`}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal leading-6 text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              value={accessName.en}
              maxLength={120}
              onChange={(event) => {
                setAccessName((current) => ({ ...current, en: event.target.value }))
                if (error === text(language, 'accessNameRequired')) setError('')
              }}
            />
          </label>
          <label className="block text-sm font-bold text-slate-700" htmlFor={`${fieldPrefix}-access-zh`}>
            {text(language, 'accessNameZh')}
            <input
              id={`${fieldPrefix}-access-zh`}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal leading-6 text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              value={accessName.zh}
              maxLength={120}
              onChange={(event) => {
                setAccessName((current) => ({ ...current, zh: event.target.value }))
                if (error === text(language, 'accessNameRequired')) setError('')
              }}
            />
          </label>
        </div>
        {!inline ? (
          <div className="mt-4">
            <p className="text-sm font-bold text-slate-700">{text(language, 'cardImage')}</p>
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <ReviewCardImage
                imageUrl={page.cardImageUrl}
                alt={localizeText(accessName, language) || localizeText(page.title, language)}
              />
              <p className="text-xs leading-5 text-slate-500">{text(language, 'cardImageSourceHint')}</p>
            </div>
          </div>
        ) : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold text-slate-700" htmlFor={`${fieldPrefix}-card-en`}>
            {text(language, 'cardTextEn')}
            <textarea
              id={`${fieldPrefix}-card-en`}
              className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal leading-6 text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              value={cardText.en}
              maxLength={280}
              onChange={(event) => {
                setCardText((current) => ({ ...current, en: event.target.value }))
                if (error === text(language, 'cardTextRequired')) {
                  setError('')
                }
              }}
            />
          </label>
          <label className="block text-sm font-bold text-slate-700" htmlFor={`${fieldPrefix}-card-zh`}>
            {text(language, 'cardTextZh')}
            <textarea
              id={`${fieldPrefix}-card-zh`}
              className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-normal leading-6 text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              value={cardText.zh}
              maxLength={280}
              onChange={(event) => {
                setCardText((current) => ({ ...current, zh: event.target.value }))
                if (error === text(language, 'cardTextRequired')) {
                  setError('')
                }
              }}
            />
          </label>
        </div>
        {!inline ? <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          {page.cardImageUrl ? (
            <img
              src={page.cardImageUrl}
              alt={localizeText(accessName, language) || localizeText(page.title, language)}
              className="h-40 w-full object-cover"
            />
          ) : null}
          <div className="p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{text(language, 'cardPreview')}</p>
            <p className="mt-1 text-base font-black text-slate-950">{localizeText(accessName, language) || localizeText(page.title, language)}</p>
            <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-600">{localizeText(cardText, language)}</p>
          </div>
        </div> : null}
        {error ? <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        <div className={`mt-5 flex flex-col gap-2 sm:flex-row sm:items-center ${inline ? 'sm:justify-between' : 'sm:justify-end'}`}>
          {inline ? (
            <div className="flex flex-wrap gap-2">
              {canEditReviewPage(page) ? (
                <AppActionButton variant="secondary" disabled={Boolean(actingPageId)} onClick={() => requestPageModification(page)}>
                  <PencilLine className="mr-1.5 h-4 w-4" />
                  {text(language, confirmingPageModificationId === page.id ? 'confirmModifyInterface' : 'modifyInterface')}
                </AppActionButton>
              ) : (
                <AppActionButton variant="secondary" disabled={Boolean(actingPageId)} onClick={() => openPage(page)}>
                  <Eye className="mr-1.5 h-4 w-4" />
                  {text(language, 'open')}
                </AppActionButton>
              )}
              <AppActionButton variant="secondary" disabled={Boolean(actingPageId)} onClick={() => openReturnDialog(page)}>
                <CircleX className="mr-1.5 h-4 w-4" />
                {text(language, 'withdrawReview')}
              </AppActionButton>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <AppActionButton variant="secondary" disabled={Boolean(actingPageId)} onClick={closeApproveDialog}>
              {text(language, 'cancel')}
            </AppActionButton>
            <AppActionButton variant="primary" disabled={Boolean(actingPageId)} onClick={() => submitApproval().catch(() => undefined)}>
              {actingPageId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe2 className="mr-2 h-4 w-4" />}
              {text(language, page.reviewStatus === 'approved' ? 'saveMenu' : 'submitApprove')}
            </AppActionButton>
          </div>
        </div>
      </>
    )
  }

  return (
    <AppPageShell>
      <SystemManagementFrame
        title={text(language, 'title')}
        subtitle={text(language, 'subtitle')}
        language={language}
        iconKey="pageReview"
        bodyClassName="space-y-5 p-4 sm:p-5 lg:p-6"
        actions={(
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading || layoutSaving || Boolean(actingPageId)}
            onClick={() => refreshWebsite().catch(() => undefined)}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {text(language, 'refresh')}
          </button>
        )}
      >
        {message ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>
        ) : null}
        {error ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">{error}</p>
        ) : null}

        <AppSectionCard dense title={text(language, 'queue')} subtitle={text(language, 'queueHint')}>
        {!loading ? (
          <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label={text(language, 'queue')}>
            {reviewTabs.map((tab) => {
              const selected = activeTab === tab
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  disabled={Boolean(actingPageId) || layoutSaving}
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
        {!loading && activeTab === 'approved' ? (
          <div className="mb-4">
            <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-px" role="tablist" aria-label={text(language, 'primaryMenu')}>
              {approvedMenuGroups.map((group) => {
                const selected = selectedApprovedMenuKey === group.key
                const menu = primaryMenus.find((candidate) => candidate.id === group.key)
                if (!menu) return null
                return (
                  <div
                    key={group.key}
                    className={`flex shrink-0 items-center border-b-2 transition ${
                      selected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                        : 'border-transparent text-slate-500 hover:border-emerald-200 hover:text-emerald-700'
                    }`}
                    onDragOver={(event) => {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                    }}
                    onDrop={(event) => {
                      if (draggedReviewItem?.kind === 'primary-menu') {
                        dropPrimaryMenu(event, group.key)
                      } else {
                        dropPage(event, group.key)
                      }
                    }}
                  >
                    <span
                      draggable={!layoutSaving && !actingPageId}
                      className="ml-1 cursor-grab text-slate-400"
                      onDragStart={(event) => startPrimaryMenuDrag(event, group.key)}
                      onDragEnd={() => setDraggedReviewItem(null)}
                    >
                      <GripVertical className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      disabled={Boolean(actingPageId) || layoutSaving}
                      className="px-2 py-2 text-sm font-black"
                      onClick={() => {
                        closeApproveDialog()
                        setActiveApprovedMenuKey(group.key)
                      }}
                    >
                      {localizeText(group.name, language)}
                      {menu.homePlacement ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          {text(language, homePlacementCopyKey(menu.homePlacement))}
                        </span>
                      ) : null}
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${selected ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                        {group.pages.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      draggable={false}
                      className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                      aria-label={`${text(language, 'editPrimaryMenu')}: ${localizeText(group.name, language)}`}
                      disabled={layoutSaving}
                      onDragStart={(event) => event.stopPropagation()}
                      onClick={() => openPrimaryMenuEditor(menu)}
                    >
                      <PencilLine className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
              <button
                type="button"
                className="inline-flex shrink-0 items-center border-b-2 border-transparent px-3 py-2 text-sm font-black text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                disabled={layoutSaving || Boolean(actingPageId)}
                onClick={openPrimaryMenuCreator}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                {text(language, 'newPrimaryMenu')}
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{text(language, 'dragMenuHint')}</p>
            {editingPrimaryMenu || creatingPrimaryMenu ? (
              <section className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                <h3 className="text-sm font-black text-slate-900">
                  {text(language, creatingPrimaryMenu ? 'newPrimaryMenu' : 'editPrimaryMenu')}
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-bold text-slate-700" htmlFor="primary-menu-name-en">
                    {text(language, 'primaryMenuEn')}
                    <input
                      id="primary-menu-name-en"
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      value={editingPrimaryMenuName.en}
                      maxLength={120}
                      disabled={layoutSaving}
                      onChange={(event) => setEditingPrimaryMenuName((current) => ({ ...current, en: event.target.value }))}
                    />
                  </label>
                  <label className="text-sm font-bold text-slate-700" htmlFor="primary-menu-name-zh">
                    {text(language, 'primaryMenuZh')}
                    <input
                      id="primary-menu-name-zh"
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      value={editingPrimaryMenuName.zh}
                      maxLength={120}
                      disabled={layoutSaving}
                      onChange={(event) => setEditingPrimaryMenuName((current) => ({ ...current, zh: event.target.value }))}
                    />
                  </label>
                </div>
                <label className="mt-3 block text-sm font-bold text-slate-700" htmlFor="primary-menu-home-placement">
                  {text(language, 'homePlacement')}
                  <select
                    id="primary-menu-home-placement"
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    value={editingPrimaryMenuHomePlacement}
                    disabled={layoutSaving}
                    onChange={(event) => setEditingPrimaryMenuHomePlacement(event.target.value as PagePrimaryMenuHomePlacement | '')}
                  >
                    <option value="">{text(language, 'homePlacementNone')}</option>
                    <option
                      value="churchOrganization"
                      disabled={primaryMenus.some((menu) => menu.id !== editingPrimaryMenuId && menu.homePlacement === 'churchOrganization')}
                    >
                      {text(language, 'homePlacementChurchOrganization')}
                    </option>
                    <option
                      value="recentEvents"
                      disabled={primaryMenus.some((menu) => menu.id !== editingPrimaryMenuId && menu.homePlacement === 'recentEvents')}
                    >
                      {text(language, 'homePlacementRecentEvents')}
                    </option>
                  </select>
                  <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{text(language, 'homePlacementHint')}</span>
                </label>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  {editingPrimaryMenu && editingPrimaryMenuPageCount === 0 ? (
                    <AppActionButton
                      size="sm"
                      variant="secondary"
                      disabled={layoutSaving}
                      onClick={() => deletePrimaryMenu(editingPrimaryMenu.id).catch(() => undefined)}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      {text(language, confirmingPrimaryMenuDeleteId === editingPrimaryMenu.id ? 'confirmDeletePrimaryMenu' : 'deletePrimaryMenu')}
                    </AppActionButton>
                  ) : null}
                  <AppActionButton
                    size="sm"
                    variant="secondary"
                    disabled={layoutSaving}
                    onClick={() => {
                      setEditingPrimaryMenuId(null)
                      setCreatingPrimaryMenu(false)
                    }}
                  >
                    {text(language, 'cancel')}
                  </AppActionButton>
                  <AppActionButton size="sm" variant="primary" disabled={layoutSaving} onClick={() => savePrimaryMenu().catch(() => undefined)}>
                    {layoutSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                    {text(language, creatingPrimaryMenu ? 'newPrimaryMenu' : 'savePrimaryMenu')}
                  </AppActionButton>
                </div>
              </section>
            ) : null}
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
              const canApprove = canReviewPublication
              const canReturn = canReviewPublication && page.reviewStatus !== 'returned'
              const canEditPage = canEditReviewPage(page)
              const primaryMenuLabel = localizeText(page.primaryMenuName, language)
              const accessLabel = localizeText(page.accessName, language)
              const cardLabel = localizeText(page.cardText, language)
              const displayedAccessLabel = accessLabel || `${groupName}-${title}`
              const displayedCardText = cardLabel || localizeText(page.description, language)

              if (activeTab === 'approved' && page.isPublished) {
                const publishedTitle = localizeText(page.publishedTitle, language) || title
                const publishedAccessLabel = accessLabel || `${groupName}-${publishedTitle}`
                const publishedCardText = cardLabel || localizeText(page.publishedDescription, language)
                const editorExpanded = approvingPage?.id === page.id
                const editorId = `approved-menu-editor-${page.id}`
                const approvedActionsDisabled = Boolean(actingPageId) || layoutSaving
                const publishedCopyHasPendingReview = page.reviewStatus !== 'approved'

                return (
                  <article
                    key={page.id}
                    className={`rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ${draggedReviewItem?.kind === 'page' && draggedReviewItem.pageId === page.id ? 'opacity-50' : ''}`}
                    onDragOver={(event) => {
                      if (draggedReviewItem?.kind === 'page') {
                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'move'
                      }
                    }}
                    onDrop={(event) => page.primaryMenuId ? dropPage(event, page.primaryMenuId, page.id) : undefined}
                  >
                    <div className="flex gap-3 rounded-xl bg-slate-50 p-3">
                      <span
                        draggable={!approvedActionsDisabled && !editorExpanded}
                        className="mt-1 shrink-0 cursor-grab text-slate-400"
                        onDragStart={(event) => startPageDrag(event, page)}
                        onDragEnd={() => setDraggedReviewItem(null)}
                      >
                        <GripVertical className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <ReviewCardImage
                        imageUrl={page.publishedCardImageUrl ?? page.cardImageUrl}
                        alt={publishedAccessLabel}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-black text-slate-800">{publishedAccessLabel}</p>
                          <button
                            type="button"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-emerald-100 hover:text-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                            aria-label={text(language, 'editMenu')}
                            aria-expanded={editorExpanded}
                            aria-controls={editorId}
                            disabled={approvedActionsDisabled || publishedCopyHasPendingReview}
                            onClick={() => editorExpanded ? closeApproveDialog() : openApproveDialog(page)}
                          >
                            {disabled ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ChevronDown className={`h-5 w-5 transition-transform ${editorExpanded ? 'rotate-180' : ''}`} />
                            )}
                          </button>
                        </div>
                        {publishedCardText ? <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{publishedCardText}</p> : null}
                        {publishedCopyHasPendingReview ? (
                          <p className="mt-2 text-xs font-bold text-amber-700">{text(language, 'publishedVersionRetained')}</p>
                        ) : null}
                      </div>
                    </div>
                    {editorExpanded ? (
                      <section id={editorId} className="mt-3 border-t border-slate-200 px-1 pb-1 pt-4">
                        {renderApprovalEditor(page, true)}
                      </section>
                    ) : null}
                  </article>
                )
              }

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
                      <div className="mt-3 flex gap-3 rounded-xl bg-slate-50 p-3">
                        <ReviewCardImage imageUrl={page.cardImageUrl} alt={displayedAccessLabel} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-slate-800">{displayedAccessLabel}</p>
                          {displayedCardText ? (
                            <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{displayedCardText}</p>
                          ) : null}
                        </div>
                      </div>
                      <dl className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                        <div>
                          <dt className="font-bold text-slate-700">{text(language, 'group')}</dt>
                          <dd className="mt-0.5 break-words">{groupName}</dd>
                        </div>
                        <div>
                          <dt className="font-bold text-slate-700">{text(language, 'author')}</dt>
                          <dd className="mt-0.5 break-words">{page.creatorDisplayName || page.createdByMemberId}</dd>
                        </div>
                        <div>
                          <dt className="font-bold text-slate-700">{text(language, 'menuName')}</dt>
                          <dd className="mt-0.5 break-words">{displayedAccessLabel}</dd>
                        </div>
                        {primaryMenuLabel ? (
                          <div>
                            <dt className="font-bold text-slate-700">{text(language, 'primaryMenu')}</dt>
                            <dd className="mt-0.5 break-words">{primaryMenuLabel}</dd>
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
      </SystemManagementFrame>

      {approvingPage && approvingPage.reviewStatus !== 'approved' ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/45 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:items-center sm:justify-center sm:pb-4">
          <button type="button" className="absolute inset-0" aria-label={text(language, 'cancel')} onClick={closeApproveDialog} />
          <section className="relative z-10 max-h-[calc(100vh-7rem)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            {renderApprovalEditor(approvingPage)}
          </section>
        </div>
      ) : null}

      {returningPage ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/45 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:items-center sm:justify-center sm:pb-4">
          <button type="button" className="absolute inset-0" aria-label={text(language, 'cancel')} onClick={closeReturnDialog} />
          <section className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-black text-slate-950">
              {text(language, returningPage.reviewStatus === 'approved' ? 'withdrawReviewTitle' : 'returnTitle')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {localizeText(returningPage.title, language) || returningPage.id}
            </p>
            <label className="mt-5 block text-sm font-bold text-slate-700" htmlFor="page-return-reason">
              {text(language, returningPage.reviewStatus === 'approved' ? 'withdrawReason' : 'returnReason')}
            </label>
            <textarea
              id="page-return-reason"
              className="mt-2 min-h-32 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-6 text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              value={returnReason}
              maxLength={1000}
              placeholder={text(language, returningPage.reviewStatus === 'approved' ? 'withdrawReasonPlaceholder' : 'returnReasonPlaceholder')}
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
                {text(language, returningPage.reviewStatus === 'approved' ? 'submitWithdrawReview' : 'submitReturn')}
              </AppActionButton>
            </div>
          </section>
        </div>
      ) : null}
    </AppPageShell>
  )
}

export default PageReviewView
