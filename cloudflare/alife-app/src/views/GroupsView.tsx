import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronDown, ChevronRight, LayoutList, Network, UsersRound, Workflow } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AccessTypeBadge from '../components/group/AccessTypeBadge'
import AppBadge from '../components/layout/AppBadge'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import { activeEntityService } from '../services/activeEntityService'
import { groupService } from '../services/groupService'
import { pageService } from '../services/pageService'
import { useAuthStore } from '../stores/auth'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import type { GroupMembershipDto, GroupSummaryDto, PageDetailDto } from '../types'
import { localizeText } from '../utils/localizedText'
import {
  buildGroupHierarchy,
  findGroupHierarchyNode,
  getGroupHierarchyAncestorIds,
  type GroupHierarchyNode,
} from '../utils/groupHierarchy'

const fallbackGroupImages = [
  '/media/alife-groups.jpg',
  '/media/alife-visit.jpg',
  '/media/alife-church-community-hero.jpg',
  '/media/alife-message-poster.jpg',
]

const readSectionImage = (page: PageDetailDto) => {
  for (const section of page.sections ?? []) {
    const content = section.contentJson ?? {}
    const mediaValue = content.media && typeof content.media === 'object' && !Array.isArray(content.media)
      ? content.media as Record<string, unknown>
      : null
    const candidate = content.backgroundImageUrl || content.backgroundImage || content.imageUrl || mediaValue?.url
    if (typeof candidate === 'string' && candidate.trim()) return candidate
  }
  return ''
}

const membershipLabel = (membership: GroupMembershipDto | undefined, language: string, isGuest = false) => {
  if (isGuest) return language === 'zh' ? '登录后可申请' : 'Sign in to apply'
  if (membership?.status === 'approved') return language === 'zh' ? '已加入' : 'Joined'
  if (membership?.status === 'requested') return language === 'zh' ? '申请审核中' : 'Request pending'
  if (membership?.status === 'invited') return language === 'zh' ? '收到邀请' : 'Invited'
  return language === 'zh' ? '可以申请加入' : 'Available to join'
}

const membershipVariant = (membership: GroupMembershipDto | undefined) => {
  if (membership?.status === 'approved') return 'success' as const
  if (membership?.status === 'requested') return 'warning' as const
  if (membership?.status === 'invited') return 'info' as const
  return 'neutral' as const
}

type HierarchyRowProps = {
  node: GroupHierarchyNode
  depth: number
  path: GroupSummaryDto[]
  language: string
  activeGroupId: string
  focusedGroupId: string
  expandedIds: Set<string>
  memberships: GroupMembershipDto[]
  groupImages: Record<string, string>
  isGuest: boolean
  reduceMotion: boolean
  onReveal: (groupId: string) => void
  onToggleDetail: (groupId: string) => void
  onToggleChildren: (groupId: string) => void
  onOpen: (group: GroupSummaryDto) => void
}

const HierarchyRow = ({
  node,
  depth,
  path,
  language,
  activeGroupId,
  focusedGroupId,
  expandedIds,
  memberships,
  groupImages,
  isGuest,
  reduceMotion,
  onReveal,
  onToggleDetail,
  onToggleChildren,
  onOpen,
}: HierarchyRowProps) => {
  const groupName = localizeText(node.group.name, language)
  const hasChildren = node.children.length > 0
  const expanded = expandedIds.has(node.group.id)
  const active = !isGuest && activeGroupId === node.group.id
  const focused = focusedGroupId === node.group.id
  const membership = memberships.find((item) => item.groupId === node.group.id)
  const triggerId = `group-detail-trigger-${node.group.id}`
  const detailId = `group-detail-${node.group.id}`
  const nextPath = [...path, node.group]

  return (
    <li role="treeitem" aria-level={depth + 1} aria-selected={focused} aria-expanded={hasChildren ? expanded : undefined}>
      <div
        className={[
          'group relative flex items-center gap-2 rounded-2xl border py-2.5 pr-2 transition focus-within:ring-2 focus-within:ring-[#176b5a]/25',
          focused
            ? 'border-[#176b5a]/30 bg-[#e7f1ed] shadow-[0_10px_28px_rgba(23,107,90,0.10)]'
            : 'border-transparent bg-white/62 hover:border-[#2f4b42]/10 hover:bg-white',
        ].join(' ')}
        style={{ paddingLeft: `${0.55 + depth * 1.15}rem` }}
      >
        {depth > 0 ? <span className="absolute bottom-0 left-[0.65rem] top-0 border-l border-emerald-200/80" aria-hidden="true" /> : null}
        {hasChildren ? (
          <button
            type="button"
            className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#176b5a] transition hover:bg-white"
            aria-label={`${expanded ? (language === 'zh' ? '收起' : 'Collapse') : (language === 'zh' ? '展开' : 'Expand')} ${groupName}`}
            onClick={() => onToggleChildren(node.group.id)}
          >
            <ChevronDown className={['h-4 w-4 transition-transform', expanded ? '' : '-rotate-90'].join(' ')} />
          </button>
        ) : (
          <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f2eee5] text-[#6b7d76]">
            <UsersRound className="h-4 w-4" aria-hidden="true" />
          </span>
        )}

        <button
          id={triggerId}
          type="button"
          aria-expanded={focused}
          aria-controls={detailId}
          className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none"
          onClick={() => onToggleDetail(node.group.id)}
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-bold text-[#18332d]">{groupName}</span>
              {active ? <Check className="h-3.5 w-3.5 shrink-0 text-[#176b5a]" aria-label={language === 'zh' ? '当前小组' : 'Current group'} /> : null}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-[#718079]">
              <span>{membershipLabel(membership, language, isGuest)}</span>
              {hasChildren ? <span>{language === 'zh' ? `${node.children.length} 个下属小组` : `${node.children.length} subgroup${node.children.length === 1 ? '' : 's'}`}</span> : null}
            </span>
          </span>
          <ChevronDown className={['h-4 w-4 shrink-0 text-[#8a9792] transition-transform', focused ? 'rotate-180 text-[#176b5a]' : ''].join(' ')} aria-hidden="true" />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {focused ? (
          <motion.div
            id={detailId}
            role="region"
            aria-labelledby={triggerId}
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
            className="overflow-hidden"
          >
            <div className="my-2 overflow-hidden rounded-2xl border border-[#176b5a]/15 bg-white shadow-[0_14px_34px_rgba(24,51,45,0.09)]">
              <div className="grid sm:grid-cols-[10.5rem_minmax(0,1fr)]">
                <div className="relative min-h-32 overflow-hidden bg-emerald-100 sm:min-h-full">
                  <img src={groupImages[node.group.id] || fallbackGroupImages[0]} alt={groupName} className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#173f36]/55 to-transparent" aria-hidden="true" />
                </div>
                <div className="min-w-0 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <AppBadge variant={isGuest ? 'neutral' : membershipVariant(membership)}>{membershipLabel(membership, language, isGuest)}</AppBadge>
                    <AccessTypeBadge accessType={node.group.accessType} />
                    {active ? <AppBadge variant="info">{language === 'zh' ? '当前小组' : 'Current group'}</AppBadge> : null}
                  </div>
                  <nav aria-label={language === 'zh' ? '小组层级路径' : 'Group hierarchy path'} className="mt-3 flex flex-wrap items-center gap-1 text-[11px] font-bold text-[#64756e]">
                    {nextPath.map((pathGroup, index) => (
                      <span key={pathGroup.id} className="inline-flex items-center gap-1">
                        {index > 0 ? <ChevronRight className="h-3 w-3" aria-hidden="true" /> : null}
                        <button type="button" className="rounded-md px-1 py-0.5 transition hover:bg-[#e3f0eb] hover:text-[#176b5a]" onClick={() => onReveal(pathGroup.id)}>
                          {localizeText(pathGroup.name, language)}
                        </button>
                      </span>
                    ))}
                  </nav>
                  <p className="mt-3 text-sm leading-6 text-[#60716a]">
                    {localizeText(node.group.description, language) || (language === 'zh' ? '进入此小组查看小组页面、活动和公告。' : 'Enter this group to see its pages, events, and announcements.')}
                  </p>

                  {hasChildren ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {node.children.map((child) => (
                        <button key={child.group.id} type="button" className="rounded-full bg-[#f5f1e8] px-3 py-1.5 text-xs font-bold text-[#176b5a] transition hover:bg-[#e3f0eb]" onClick={() => onReveal(child.group.id)}>
                          {localizeText(child.group.name, language)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col gap-3 border-t border-[#2f4b42]/10 bg-[#fbfcfa] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-xs leading-5 text-[#75837e]">
                  {isGuest
                    ? (language === 'zh' ? '您正以访客身份浏览；登录或注册后可申请加入这个小组。' : "You're browsing as a guest. Sign in or register to apply to this group.")
                    : (language === 'zh' ? '只有使用进入按钮后才会切换当前小组。' : 'Your current group changes only after using the enter action.')}
                </p>
                <button type="button" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[#176b5a] px-4 py-2 text-sm font-black text-white shadow-[0_10px_22px_rgba(23,107,90,0.18)] transition hover:bg-[#125b4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#de6c4d]/55" onClick={() => onOpen(node.group)}>
                  {isGuest
                    ? (language === 'zh' ? '登录或注册' : 'Sign in or register')
                    : active
                      ? (language === 'zh' ? '进入当前小组' : 'Open current group')
                      : membership?.status === 'approved'
                        ? (language === 'zh' ? '切换并进入' : 'Switch and enter')
                        : membership?.status === 'requested'
                          ? (language === 'zh' ? '查看申请状态' : 'View request')
                          : membership?.status === 'invited'
                            ? (language === 'zh' ? '查看邀请' : 'Review invitation')
                            : (language === 'zh' ? '查看并申请加入' : 'View and request to join')}
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {hasChildren && expanded ? (
          <motion.ul
            role="group"
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, height: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="mt-1 space-y-1 overflow-hidden"
          >
            {node.children.map((child) => (
              <HierarchyRow
                key={child.group.id}
                node={child}
                depth={depth + 1}
                path={nextPath}
                language={language}
                activeGroupId={activeGroupId}
                focusedGroupId={focusedGroupId}
                expandedIds={expandedIds}
                memberships={memberships}
                groupImages={groupImages}
                isGuest={isGuest}
                reduceMotion={reduceMotion}
                onReveal={onReveal}
                onToggleDetail={onToggleDetail}
                onToggleChildren={onToggleChildren}
                onOpen={onOpen}
              />
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </li>
  )
}

const GroupsView = () => {
  const auth = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion() === true
  const { groupId: activeGroupId } = useActiveEntityIds()
  const [groups, setGroups] = useState<GroupSummaryDto[]>([])
  const [groupImages, setGroupImages] = useState<Record<string, string>>({})
  const [focusedGroupId, setFocusedGroupId] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const language = auth.language
  const alifeShellSearch = new URLSearchParams(location.search).get('from') === 'alife' ? '?from=alife' : ''
  const visibleGroups = useMemo(() => groups.filter((group) => !group.isChurch), [groups])
  const hierarchy = useMemo(() => buildGroupHierarchy(visibleGroups), [visibleGroups])
  const currentGroup = visibleGroups.find((group) => group.id === activeGroupId) ?? null

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    groupService.getVisibleGroups(auth.me?.id)
      .then((data) => {
        if (cancelled) return
        const selectableGroups = data.filter((group) => !group.isChurch)
        setGroups(selectableGroups)
        setLoading(false)

        Promise.all(selectableGroups.slice(0, 18).map(async (group, index) => {
          let imageUrl = fallbackGroupImages[index % fallbackGroupImages.length]
          try {
            const pages = await groupService.getGroupPages(group.id)
            const firstPage = pages[0]
            if (firstPage?.id) {
              const page = await pageService.getPageById(firstPage.id)
              imageUrl = readSectionImage(page) || imageUrl
            }
          } catch {
            imageUrl = fallbackGroupImages[index % fallbackGroupImages.length]
          }
          return [group.id, imageUrl] as const
        })).then((entries) => {
          if (!cancelled) setGroupImages(Object.fromEntries(entries))
        }).catch(() => undefined)
      })
      .catch(() => {
        if (!cancelled) {
          setError('load-failed')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [auth.isGuest, auth.me?.id])

  useEffect(() => {
    if (hierarchy.length === 0) return
    const activeNode = findGroupHierarchyNode(hierarchy, activeGroupId)
    const firstJoined = visibleGroups.find((group) => auth.memberships.some(
      (membership) => membership.groupId === group.id && membership.status === 'approved',
    ))
    const initialGroupId = activeNode?.group.id || firstJoined?.id || hierarchy[0]?.group.id || ''
    setFocusedGroupId((current) => findGroupHierarchyNode(hierarchy, current) ? current : initialGroupId)
    setExpandedIds((current) => new Set([
      ...current,
      ...getGroupHierarchyAncestorIds(hierarchy, initialGroupId),
    ]))
  }, [activeGroupId, auth.memberships, hierarchy, visibleGroups])

  const openGroup = (group: GroupSummaryDto) => {
    if (group.isChurch) {
      if (activeEntityService.getAll().groupId === group.id) {
        activeEntityService.setGroup('', { clearPage: true, clearEvent: true })
      }
      navigate('/church')
      return
    }
    if (auth.isGuest) {
      navigate('/onboarding')
      return
    }
    const membership = auth.memberships.find((item) => item.groupId === group.id)
    if (membership?.status === 'approved') {
      activeEntityService.setGroup(group.id, { clearPage: true, clearEvent: true })
      navigate('/groups?view=overview')
      return
    }
    if (activeEntityService.getAll().groupId === group.id) {
      activeEntityService.setGroup('', { clearPage: true, clearEvent: true })
    }
    navigate(group.accessType === 'public'
      ? `/groups/${encodeURIComponent(group.id)}?view=overview`
      : `/groups/${encodeURIComponent(group.id)}/join`)
  }

  const toggleExpanded = (groupId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const revealGroup = (groupId: string) => {
    setFocusedGroupId(groupId)
    setExpandedIds((current) => new Set([
      ...current,
      ...getGroupHierarchyAncestorIds(hierarchy, groupId),
    ]))
  }

  const toggleGroupDetail = (groupId: string) => {
    if (focusedGroupId === groupId) {
      setFocusedGroupId('')
      return
    }
    revealGroup(groupId)
  }

  return (
    <AppPageShell>
      <section className="relative overflow-hidden rounded-[1.75rem] border border-emerald-100 bg-[#173f36] px-5 py-5 text-white shadow-[0_20px_52px_rgba(19,63,54,0.18)] sm:px-7 sm:py-6">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#de6c4d]/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(15rem,0.55fr)] lg:items-center">
          <div>
            <nav aria-label={language === 'zh' ? '小组选择视图' : 'Group selection views'} className="mb-3 inline-flex rounded-full border border-white/15 bg-black/10 p-1 backdrop-blur">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-black text-[#173f36] shadow-sm">
                <LayoutList className="h-3.5 w-3.5" aria-hidden="true" />
                {language === 'zh' ? '简约选择' : 'Simple view'}
              </span>
              <Link to={`/groups/select/tree${alifeShellSearch}`} className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold text-white/72 transition hover:bg-white/10 hover:text-white">
                <Workflow className="h-3.5 w-3.5" aria-hidden="true" />
                {language === 'zh' ? '组织树' : 'Organization tree'}
              </Link>
            </nav>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
              {language === 'zh' ? '找到你的小组位置' : 'Find your place in the group family'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/72">
              {auth.isGuest
                ? (language === 'zh'
                    ? '浏览小组层级与公开资料；登录或注册后可申请加入。'
                    : 'Browse the group hierarchy and public details. Sign in or register to apply.')
                : (language === 'zh'
                    ? '在层级中展开任一小组，直接查看详情并选择要进入的小组。'
                    : 'Expand any group in the hierarchy to review its details and choose where to enter.')}
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-white/14 bg-white/[0.08] px-4 py-3.5 backdrop-blur-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-100/70">
              {auth.isGuest ? (language === 'zh' ? '浏览身份' : 'Browsing as') : (language === 'zh' ? '当前小组' : 'Current group')}
            </p>
            <p className="mt-1 text-base font-black">
              {auth.isGuest ? (language === 'zh' ? '访客' : 'Guest') : currentGroup ? localizeText(currentGroup.name, language) : (language === 'zh' ? '未选择小组' : 'No group selected')}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-emerald-50/65">
              {auth.isGuest
                ? (language === 'zh' ? '可浏览公开的小组资料；登录或注册后可申请加入。' : 'Browse public group details; sign in or register to apply.')
                : currentGroup
                  ? (language === 'zh' ? '你可以浏览结构，不会因为查看其他小组而意外切换。' : 'You can explore the hierarchy without switching accidentally.')
                  : (language === 'zh' ? '从下方结构中选择一个小组开始。' : 'Choose a group from the hierarchy below to begin.')}
            </p>
          </div>
        </div>
      </section>

      {error ? <AppEmptyState title={language === 'zh' ? '加载失败' : 'Unable to load'} description={language === 'zh' ? '无法加载小组结构。' : 'Unable to load the group structure.'} /> : null}

      {!error && loading ? (
        <section className="min-h-96 animate-pulse rounded-[2rem] border border-emerald-100 bg-white/78 p-5">
          <div className="h-5 w-2/5 rounded-lg bg-emerald-100/70" />
          <div className="mt-6 space-y-3">
            {[0, 1, 2, 3, 4].map((row) => <div key={row} className="h-14 rounded-2xl bg-emerald-50" />)}
          </div>
        </section>
      ) : null}

      {!error && !loading && visibleGroups.length === 0 ? (
        <AppEmptyState
          title={language === 'zh' ? '暂时没有可见小组' : 'No visible groups yet'}
          description={language === 'zh' ? '有权限查看的小组会显示在这里。' : 'Groups you can discover will appear here.'}
        />
      ) : null}

      {!error && !loading && visibleGroups.length > 0 ? (
        <section className="rounded-[2rem] border border-[#2f4b42]/10 bg-[#f7f3eb]/92 p-4 shadow-[0_18px_45px_rgba(24,51,45,0.08)] sm:p-5">
          <div className="flex items-start justify-between gap-4 px-1 pb-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#176b5a]">{language === 'zh' ? '小组结构' : 'Group structure'}</p>
              <h2 className="mt-1 text-xl font-black text-[#18332d]">{language === 'zh' ? '按层级浏览' : 'Browse by hierarchy'}</h2>
              <p className="mt-1.5 text-xs leading-5 text-[#718079]">{language === 'zh' ? '点击小组名称可在列表中展开详情；左侧箭头用于展开下属层级。' : 'Select a group name to expand its details; use the left arrow to reveal subgroups.'}</p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e3f0eb] text-[#176b5a]"><Network className="h-5 w-5" aria-hidden="true" /></span>
          </div>
          <ul role="tree" aria-label={language === 'zh' ? '可见小组结构' : 'Visible group hierarchy'} className="space-y-1">
            {hierarchy.map((node) => (
              <HierarchyRow
                key={node.group.id}
                node={node}
                depth={0}
                path={[]}
                language={language}
                activeGroupId={activeGroupId}
                focusedGroupId={focusedGroupId}
                expandedIds={expandedIds}
                memberships={auth.memberships}
                groupImages={groupImages}
                isGuest={auth.isGuest}
                reduceMotion={reduceMotion}
                onReveal={revealGroup}
                onToggleDetail={toggleGroupDetail}
                onToggleChildren={toggleExpanded}
                onOpen={openGroup}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </AppPageShell>
  )
}

export default GroupsView
