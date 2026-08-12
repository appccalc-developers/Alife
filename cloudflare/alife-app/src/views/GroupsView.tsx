import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronDown, ChevronRight, Network, Sparkles, UsersRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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
  getGroupHierarchyPath,
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

const membershipLabel = (membership: GroupMembershipDto | undefined, language: string) => {
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
  language: string
  activeGroupId: string
  focusedGroupId: string
  expandedIds: Set<string>
  memberships: GroupMembershipDto[]
  reduceMotion: boolean
  onFocus: (groupId: string) => void
  onToggle: (groupId: string) => void
}

const HierarchyRow = ({
  node,
  depth,
  language,
  activeGroupId,
  focusedGroupId,
  expandedIds,
  memberships,
  reduceMotion,
  onFocus,
  onToggle,
}: HierarchyRowProps) => {
  const groupName = localizeText(node.group.name, language)
  const hasChildren = node.children.length > 0
  const expanded = expandedIds.has(node.group.id)
  const active = activeGroupId === node.group.id
  const focused = focusedGroupId === node.group.id
  const membership = memberships.find((item) => item.groupId === node.group.id)

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
            onClick={() => onToggle(node.group.id)}
          >
            <ChevronDown className={['h-4 w-4 transition-transform', expanded ? '' : '-rotate-90'].join(' ')} />
          </button>
        ) : (
          <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f2eee5] text-[#6b7d76]">
            <UsersRound className="h-4 w-4" aria-hidden="true" />
          </span>
        )}

        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onFocus(node.group.id)}>
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-bold text-[#18332d]">{groupName}</span>
            {active ? <Check className="h-3.5 w-3.5 shrink-0 text-[#176b5a]" aria-label={language === 'zh' ? '当前小组' : 'Current group'} /> : null}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-[#718079]">
            <span>{membershipLabel(membership, language)}</span>
            {hasChildren ? <span>{language === 'zh' ? `${node.children.length} 个下属小组` : `${node.children.length} subgroup${node.children.length === 1 ? '' : 's'}`}</span> : null}
          </span>
        </button>
        <ChevronRight className="h-4 w-4 shrink-0 text-[#8a9792] transition group-hover:translate-x-0.5" aria-hidden="true" />
      </div>

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
                language={language}
                activeGroupId={activeGroupId}
                focusedGroupId={focusedGroupId}
                expandedIds={expandedIds}
                memberships={memberships}
                reduceMotion={reduceMotion}
                onFocus={onFocus}
                onToggle={onToggle}
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
  const visibleGroups = useMemo(() => groups.filter((group) => !group.isChurch), [groups])
  const hierarchy = useMemo(() => buildGroupHierarchy(visibleGroups), [visibleGroups])
  const focusedNode = useMemo(() => findGroupHierarchyNode(hierarchy, focusedGroupId), [focusedGroupId, hierarchy])
  const focusedGroup = focusedNode?.group ?? null
  const currentGroup = visibleGroups.find((group) => group.id === activeGroupId) ?? null
  const focusedPath = useMemo(() => getGroupHierarchyPath(hierarchy, focusedGroupId), [focusedGroupId, hierarchy])
  const focusedMembership = focusedGroup
    ? auth.memberships.find((membership) => membership.groupId === focusedGroup.id)
    : undefined

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    groupService.getVisibleGroups()
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
  }, [auth.isGuest])

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
    const membership = auth.memberships.find((item) => item.groupId === group.id)
    activeEntityService.setGroup(group.id, { clearPage: true, clearEvent: true })
    navigate(membership?.status === 'approved' || group.accessType === 'public' ? '/groups' : '/groups/join')
  }

  const toggleExpanded = (groupId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const focusGroup = (groupId: string) => {
    setFocusedGroupId(groupId)
    setExpandedIds((current) => new Set([
      ...current,
      ...getGroupHierarchyAncestorIds(hierarchy, groupId),
    ]))
  }

  return (
    <AppPageShell>
      <section className="relative overflow-hidden rounded-[2.25rem] border border-emerald-100 bg-[#173f36] px-6 py-8 text-white shadow-[0_28px_70px_rgba(19,63,54,0.22)] sm:px-9 sm:py-10">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#de6c4d]/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(17rem,0.75fr)] lg:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] ring-1 ring-white/15">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {language === 'zh' ? '小组生活' : 'Group Life'}
            </span>
            <h1 className="mt-5 text-3xl font-black tracking-[-0.045em] sm:text-5xl">
              {language === 'zh' ? '找到你的小组位置' : 'Find your place in the group family'}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50/78 sm:text-base">
              {language === 'zh'
                ? '展开小组结构，先了解上级与下属关系，再明确选择要进入的小组。教会生活不属于小组切换范围。'
                : 'Explore the hierarchy before choosing a group to enter. Church Life is separate and is never part of group switching.'}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/14 bg-white/10 p-5 backdrop-blur-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-100/70">{language === 'zh' ? '当前小组' : 'Current group'}</p>
            <p className="mt-2 text-xl font-black">{currentGroup ? localizeText(currentGroup.name, language) : (language === 'zh' ? '尚未选择小组' : 'No group selected')}</p>
            <p className="mt-2 text-xs leading-5 text-emerald-50/70">
              {currentGroup
                ? (language === 'zh' ? '你可以浏览结构，不会因为查看其他小组而意外切换。' : 'You can explore the hierarchy without switching accidentally.')
                : (language === 'zh' ? '从下方结构中选择一个小组开始。' : 'Choose a group from the hierarchy below to begin.')}
            </p>
          </div>
        </div>
      </section>

      {error ? <AppEmptyState title={language === 'zh' ? '加载失败' : 'Unable to load'} description={language === 'zh' ? '无法加载小组结构。' : 'Unable to load the group structure.'} /> : null}

      {!error && loading ? (
        <section className="grid gap-5 lg:grid-cols-[minmax(20rem,0.9fr)_minmax(0,1.1fr)]">
          {[0, 1].map((column) => (
            <div key={column} className="min-h-96 animate-pulse rounded-[2rem] border border-emerald-100 bg-white/78 p-5">
              <div className="h-5 w-2/5 rounded-lg bg-emerald-100/70" />
              <div className="mt-6 space-y-3">{[0, 1, 2, 3].map((row) => <div key={row} className="h-14 rounded-2xl bg-emerald-50" />)}</div>
            </div>
          ))}
        </section>
      ) : null}

      {!error && !loading && visibleGroups.length === 0 ? (
        <AppEmptyState
          title={language === 'zh' ? '暂时没有可见小组' : 'No visible groups yet'}
          description={language === 'zh' ? '有权限查看的小组会显示在这里，教会生活不会出现在小组列表中。' : 'Groups you can discover will appear here. Church Life is not part of this list.'}
        />
      ) : null}

      {!error && !loading && visibleGroups.length > 0 ? (
        <section className="grid items-start gap-5 lg:grid-cols-[minmax(20rem,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-[2rem] border border-[#2f4b42]/10 bg-[#f7f3eb]/92 p-4 shadow-[0_18px_45px_rgba(24,51,45,0.08)] sm:p-5">
            <div className="flex items-start justify-between gap-4 px-1 pb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#176b5a]">{language === 'zh' ? '小组结构' : 'Group structure'}</p>
                <h2 className="mt-1 text-xl font-black text-[#18332d]">{language === 'zh' ? '按层级浏览' : 'Browse by hierarchy'}</h2>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e3f0eb] text-[#176b5a]"><Network className="h-5 w-5" aria-hidden="true" /></span>
            </div>
            <ul role="tree" aria-label={language === 'zh' ? '可见小组结构' : 'Visible group hierarchy'} className="space-y-1">
              {hierarchy.map((node) => (
                <HierarchyRow
                  key={node.group.id}
                  node={node}
                  depth={0}
                  language={language}
                  activeGroupId={activeGroupId}
                  focusedGroupId={focusedGroupId}
                  expandedIds={expandedIds}
                  memberships={auth.memberships}
                  reduceMotion={reduceMotion}
                  onFocus={focusGroup}
                  onToggle={toggleExpanded}
                />
              ))}
            </ul>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {focusedGroup ? (
              <motion.aside
                key={focusedGroup.id}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
                transition={{ duration: reduceMotion ? 0 : 0.22 }}
                className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-white shadow-[0_22px_55px_rgba(24,51,45,0.10)]"
                aria-live="polite"
              >
                <div className="relative h-56 overflow-hidden bg-emerald-100 sm:h-64">
                  <img src={groupImages[focusedGroup.id] || fallbackGroupImages[0]} alt={localizeText(focusedGroup.name, language)} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#173f36]/90 via-[#173f36]/25 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
                    <div className="flex flex-wrap items-center gap-2">
                      <AppBadge variant={membershipVariant(focusedMembership)}>{membershipLabel(focusedMembership, language)}</AppBadge>
                      <AccessTypeBadge accessType={focusedGroup.accessType} />
                      {activeGroupId === focusedGroup.id ? <AppBadge variant="info">{language === 'zh' ? '当前小组' : 'Current group'}</AppBadge> : null}
                    </div>
                    <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">{localizeText(focusedGroup.name, language)}</h2>
                  </div>
                </div>
                <div className="p-6 sm:p-7">
                  <nav aria-label={language === 'zh' ? '小组层级路径' : 'Group hierarchy path'} className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-[#64756e]">
                    {focusedPath.map((pathGroup, index) => (
                      <span key={pathGroup.id} className="inline-flex items-center gap-1.5">
                        {index > 0 ? <ChevronRight className="h-3 w-3" aria-hidden="true" /> : null}
                        <button type="button" className="rounded-lg px-1.5 py-1 transition hover:bg-[#e3f0eb] hover:text-[#176b5a]" onClick={() => focusGroup(pathGroup.id)}>{localizeText(pathGroup.name, language)}</button>
                      </span>
                    ))}
                  </nav>
                  <p className="mt-5 text-sm leading-7 text-[#60716a]">
                    {localizeText(focusedGroup.description, language) || (language === 'zh' ? '进入此小组查看小组页面、活动和公告。' : 'Enter this group to see its pages, events, and announcements.')}
                  </p>

                  {focusedNode && focusedNode.children.length > 0 ? (
                    <div className="mt-6 rounded-2xl bg-[#f5f1e8] p-4">
                      <p className="text-xs font-black uppercase tracking-[0.15em] text-[#6a7973]">{language === 'zh' ? '包含下属小组' : 'Contains subgroups'}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {focusedNode.children.map((child) => (
                          <button key={child.group.id} type="button" className="rounded-full bg-white px-3 py-2 text-xs font-bold text-[#176b5a] ring-1 ring-[#176b5a]/12 transition hover:bg-[#e3f0eb]" onClick={() => focusGroup(child.group.id)}>
                            {localizeText(child.group.name, language)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-7 flex flex-col gap-3 border-t border-[#2f4b42]/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 text-[#75837e]">
                      {language === 'zh' ? '只有点击右侧按钮后才会切换当前小组。' : 'Your current group changes only after using this action.'}
                    </p>
                    <button type="button" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#176b5a] px-5 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(23,107,90,0.20)] transition hover:-translate-y-0.5 hover:bg-[#125b4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#de6c4d]/55" onClick={() => openGroup(focusedGroup)}>
                      {activeGroupId === focusedGroup.id
                        ? (language === 'zh' ? '进入当前小组' : 'Open current group')
                        : focusedMembership?.status === 'approved'
                          ? (language === 'zh' ? '切换并进入' : 'Switch and enter')
                          : focusedMembership?.status === 'requested'
                            ? (language === 'zh' ? '查看申请状态' : 'View request')
                            : focusedMembership?.status === 'invited'
                              ? (language === 'zh' ? '查看邀请' : 'Review invitation')
                              : (language === 'zh' ? '查看并申请加入' : 'View and request to join')}
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </motion.aside>
            ) : null}
          </AnimatePresence>
        </section>
      ) : null}
    </AppPageShell>
  )
}

export default GroupsView
