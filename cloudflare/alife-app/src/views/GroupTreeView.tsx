import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronDown, ChevronRight, Church, Crosshair, Eye, LayoutList, Maximize2, Minus, Network, Plus, UsersRound, Workflow } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import AccessTypeBadge from '../components/group/AccessTypeBadge'
import AppBadge from '../components/layout/AppBadge'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import { activeEntityService } from '../services/activeEntityService'
import { groupService } from '../services/groupService'
import { useAuthStore } from '../stores/auth'
import type { GroupMembershipDto, GroupSummaryDto } from '../types'
import {
  buildGroupHierarchy,
  findGroupHierarchyNode,
  getGroupHierarchyAncestorIds,
  getGroupHierarchyPath,
  type GroupHierarchyNode,
} from '../utils/groupHierarchy'
import { localizeText } from '../utils/localizedText'

const NODE_WIDTH = 224
const NODE_HEIGHT = 108
const X_GAP = 44
const Y_GAP = 72
const CANVAS_PADDING = 38
const VIRTUAL_ROOT_ID = '__group_life_root__'

type TreeLayoutNode = {
  node: GroupHierarchyNode
  x: number
  y: number
  depth: number
  parentId: string | null
  enterX: number
  enterY: number
}

type TreeLayoutEdge = {
  id: string
  fromX: number
  fromY: number
  toX: number
  toY: number
}

const flattenHierarchy = (roots: GroupHierarchyNode[]): GroupHierarchyNode[] =>
  roots.flatMap((node) => [node, ...flattenHierarchy(node.children)])

const buildTreeLayout = (roots: GroupHierarchyNode[], expandedIds: Set<string>) => {
  const nodes: TreeLayoutNode[] = []
  const edges: TreeLayoutEdge[] = []
  let nextLeaf = 0
  let maxDepth = 0

  const visit = (node: GroupHierarchyNode, depth: number, parentId: string | null): number => {
    maxDepth = Math.max(maxDepth, depth)
    const visibleChildren = expandedIds.has(node.group.id) ? node.children : []
    const childCenters = visibleChildren.map((child) => visit(child, depth + 1, node.group.id))
    const centerX = childCenters.length > 0
      ? (childCenters[0] + childCenters[childCenters.length - 1]) / 2
      : CANVAS_PADDING + NODE_WIDTH / 2 + nextLeaf++ * (NODE_WIDTH + X_GAP)
    const y = CANVAS_PADDING + depth * (NODE_HEIGHT + Y_GAP)

    nodes.push({ node, x: centerX - NODE_WIDTH / 2, y, depth, parentId, enterX: centerX - NODE_WIDTH / 2, enterY: y })
    visibleChildren.forEach((child, index) => {
      edges.push({
        id: `${node.group.id}:${child.group.id}`,
        fromX: centerX,
        fromY: y + NODE_HEIGHT,
        toX: childCenters[index],
        toY: y + NODE_HEIGHT + Y_GAP,
      })
    })
    return centerX
  }

  roots.forEach((root) => visit(root, 0, null))
  const leafCount = Math.max(1, nextLeaf)
  const positionsById = new Map(nodes.map((item) => [item.node.group.id, item]))
  const animatedNodes = nodes.map((item) => {
    const parent = item.parentId ? positionsById.get(item.parentId) : null
    return {
      ...item,
      enterX: parent ? parent.x : item.x,
      enterY: parent ? parent.y + NODE_HEIGHT * 0.45 : item.y - 14,
    }
  })

  return {
    nodes: animatedNodes,
    edges,
    width: Math.max(920, CANVAS_PADDING * 2 + NODE_WIDTH + (leafCount - 1) * (NODE_WIDTH + X_GAP)),
    height: CANVAS_PADDING * 2 + (maxDepth + 1) * NODE_HEIGHT + maxDepth * Y_GAP,
  }
}

const membershipLabel = (membership: GroupMembershipDto | undefined, language: string) => {
  if (membership?.status === 'approved') return language === 'zh' ? '已加入' : 'Joined'
  if (membership?.status === 'requested') return language === 'zh' ? '审核中' : 'Pending'
  if (membership?.status === 'invited') return language === 'zh' ? '已邀请' : 'Invited'
  return language === 'zh' ? '可申请' : 'Available'
}

const membershipVariant = (membership: GroupMembershipDto | undefined) => {
  if (membership?.status === 'approved') return 'success' as const
  if (membership?.status === 'requested') return 'warning' as const
  if (membership?.status === 'invited') return 'info' as const
  return 'neutral' as const
}

const GroupTreeView = () => {
  const auth = useAuthStore()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion() === true
  const { groupId: activeGroupId } = useActiveEntityIds()
  const [groups, setGroups] = useState<GroupSummaryDto[]>([])
  const [focusedGroupId, setFocusedGroupId] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [zoom, setZoom] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const treeViewportRef = useRef<HTMLDivElement>(null)
  const centeredInitialTreeRef = useRef('')
  const pendingCenterIdRef = useRef('')
  const pendingFitRef = useRef(false)
  const language = auth.language
  const churchGroup = useMemo(() => groups.find((group) => group.isChurch) ?? null, [groups])
  const hierarchy = useMemo(() => buildGroupHierarchy(groups.filter((group) => !group.isChurch)), [groups])
  const allNodes = useMemo(() => flattenHierarchy(hierarchy), [hierarchy])
  const displayHierarchy = useMemo<GroupHierarchyNode[]>(() => hierarchy.length ? [{
    group: churchGroup ?? {
      id: VIRTUAL_ROOT_ID,
      name: { en: 'Church', zh: '教会' },
      description: { en: 'The church is the fixed root of the group structure.', zh: '教会是整个小组结构的固定根节点。' },
      accessType: 'public',
      isChurch: true,
      isClosed: false,
      parentGroupId: null,
    },
    children: hierarchy,
  }] : [], [churchGroup, hierarchy])
  const rootGroupId = displayHierarchy[0]?.group.id ?? VIRTUAL_ROOT_ID
  const displayNodes = useMemo(() => flattenHierarchy(displayHierarchy), [displayHierarchy])
  const layout = useMemo(() => buildTreeLayout(displayHierarchy, expandedIds), [displayHierarchy, expandedIds])
  const focusedNode = useMemo(() => findGroupHierarchyNode(hierarchy, focusedGroupId), [focusedGroupId, hierarchy])
  const focusedGroup = focusedNode?.group ?? null
  const focusedPath = useMemo(() => getGroupHierarchyPath(hierarchy, focusedGroupId), [focusedGroupId, hierarchy])
  const focusedPathIds = useMemo(() => new Set([rootGroupId, ...focusedPath.map((group) => group.id)]), [focusedPath, rootGroupId])
  const currentGroup = groups.find((group) => group.id === activeGroupId && !group.isChurch) ?? null
  const focusedMembership = focusedGroup
    ? auth.memberships.find((membership) => membership.groupId === focusedGroup.id)
    : undefined

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    groupService.getVisibleGroups(auth.me?.id)
      .then((items) => {
        if (cancelled) return
        setGroups(items)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [auth.isGuest, auth.me?.id])

  useEffect(() => {
    if (hierarchy.length === 0) return
    const firstJoined = allNodes.find((node) => auth.memberships.some(
      (membership) => membership.groupId === node.group.id && membership.status === 'approved',
    ))?.group.id
    const initialId = findGroupHierarchyNode(hierarchy, activeGroupId)?.group.id || firstJoined || hierarchy[0].group.id
    pendingCenterIdRef.current = rootGroupId
    setFocusedGroupId((current) => findGroupHierarchyNode(hierarchy, current)?.group.id || initialId)
    setExpandedIds((current) => new Set([
      ...current,
      rootGroupId,
      ...hierarchy.map((node) => node.group.id),
      ...getGroupHierarchyAncestorIds(hierarchy, initialId),
    ]))
  }, [activeGroupId, allNodes, auth.memberships, hierarchy, rootGroupId])

  const centerNode = (groupId: string, behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth') => {
    const viewport = treeViewportRef.current
    if (!viewport) return
    const target = layout.nodes.find((item) => item.node.group.id === groupId)
    if (!target) return
    viewport.scrollTo({
      left: Math.max(0, (target.x + NODE_WIDTH / 2) * zoom - viewport.clientWidth / 2),
      top: Math.max(0, target.y * zoom - 48),
      behavior,
    })
  }

  useEffect(() => {
    if (loading || layout.nodes.length === 0 || !focusedGroupId) return
    const targetGroupId = pendingCenterIdRef.current || focusedGroupId
    const layoutSignature = `${targetGroupId}:${layout.width}:${layout.height}:${zoom}`
    if (centeredInitialTreeRef.current === layoutSignature) return
    const frame = window.requestAnimationFrame(() => {
      centerNode(targetGroupId)
      pendingCenterIdRef.current = ''
    })
    centeredInitialTreeRef.current = layoutSignature
    return () => window.cancelAnimationFrame(frame)
    // centerNode intentionally follows the latest animated layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedGroupId, layout.height, layout.nodes.length, layout.width, loading, reduceMotion, zoom])

  const focusGroup = (groupId: string) => {
    setFocusedGroupId(groupId)
    setExpandedIds((current) => new Set([
      ...current,
      ...getGroupHierarchyAncestorIds(hierarchy, groupId),
    ]))
  }

  const focusCurrentGroup = () => {
    if (!currentGroup) return
    pendingCenterIdRef.current = currentGroup.id
    focusGroup(currentGroup.id)
  }

  const showOverview = () => {
    pendingCenterIdRef.current = rootGroupId
    pendingFitRef.current = true
    const viewport = treeViewportRef.current
    if (viewport) {
      const fittedZoom = Math.max(0.35, Math.min(1, (viewport.clientWidth - 48) / layout.width, (viewport.clientHeight - 48) / layout.height))
      setZoom(Number(fittedZoom.toFixed(2)))
    }
    setExpandedIds(new Set(displayNodes.filter((node) => node.children.length > 0).map((node) => node.group.id)))
  }

  useEffect(() => {
    if (!pendingFitRef.current || !treeViewportRef.current) return
    const viewport = treeViewportRef.current
    const fittedZoom = Math.max(0.35, Math.min(1, (viewport.clientWidth - 48) / layout.width, (viewport.clientHeight - 48) / layout.height))
    pendingFitRef.current = false
    setZoom(Number(fittedZoom.toFixed(2)))
  }, [layout.height, layout.width])

  const toggleGroup = (groupId: string) => {
    pendingCenterIdRef.current = groupId
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const openGroup = (group: GroupSummaryDto) => {
    if (group.isChurch) {
      if (activeEntityService.getAll().groupId === group.id) {
        activeEntityService.setGroup('', { clearPage: true, clearEvent: true })
      }
      navigate('/church')
      return
    }
    const membership = auth.memberships.find((item) => item.groupId === group.id)
    activeEntityService.setGroup(group.id, { clearPage: true, clearEvent: true })
    navigate(membership?.status === 'approved' || group.accessType === 'public'
      ? `/groups/${encodeURIComponent(group.id)}?view=overview`
      : `/groups/${encodeURIComponent(group.id)}/join`)
  }

  const collapseAll = () => {
    pendingCenterIdRef.current = rootGroupId
    setZoom(1)
    setExpandedIds(new Set([rootGroupId]))
  }

  return (
    <AppPageShell>
      <section className="relative isolate overflow-hidden rounded-[1.75rem] border border-[#244a40] bg-[#0f322a] px-5 py-5 text-white shadow-[0_20px_55px_rgba(16,50,42,0.20)] sm:px-7 sm:py-6">
        <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(rgba(255,255,255,.16)_1px,transparent_1px)] [background-size:24px_24px]" aria-hidden="true" />
        <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#de6c4d]/22 blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(15rem,0.55fr)] lg:items-center">
          <div>
            <nav aria-label={language === 'zh' ? '小组选择视图' : 'Group selection views'} className="mb-3 inline-flex rounded-full border border-white/15 bg-black/10 p-1 backdrop-blur">
              <Link to="/groups/select" className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold text-white/70 transition hover:bg-white/10 hover:text-white">
                <LayoutList className="h-3.5 w-3.5" aria-hidden="true" />
                {language === 'zh' ? '简约选择' : 'Simple view'}
              </Link>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-black text-[#173f36] shadow-sm">
                <Workflow className="h-3.5 w-3.5" aria-hidden="true" />
                {language === 'zh' ? '组织树' : 'Organization tree'}
              </span>
            </nav>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
              {language === 'zh' ? '看见小组如何彼此连接' : 'See how every group connects'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
              {language === 'zh'
                ? '从组织树理解父级、同级与下属关系。聚焦节点只用于预览，确认后才会切换当前小组。'
                : 'Explore parent, peer, and subgroup relationships. Focusing a node only previews it; your current group changes after confirmation.'}
            </p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-white/10 overflow-hidden rounded-[1.5rem] border border-white/12 bg-white/[0.07] backdrop-blur">
            <div className="px-4 py-3.5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">{language === 'zh' ? '可见小组' : 'Visible groups'}</p>
              <p className="mt-1 text-2xl font-black tabular-nums">{allNodes.length}</p>
            </div>
            <div className="px-4 py-3.5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">{language === 'zh' ? '当前小组' : 'Current group'}</p>
              <p className="mt-1 truncate text-sm font-black">{currentGroup ? localizeText(currentGroup.name, language) : (language === 'zh' ? '尚未选择' : 'Not selected')}</p>
            </div>
          </div>
        </div>
      </section>

      {error ? <AppEmptyState title={language === 'zh' ? '加载失败' : 'Unable to load'} description={language === 'zh' ? '无法加载小组组织树。' : 'Unable to load the group organization tree.'} /> : null}

      {!error && loading ? (
        <section className="min-h-[34rem] animate-pulse rounded-[2rem] border border-emerald-100 bg-white/78 p-6">
          <div className="h-10 w-56 rounded-xl bg-emerald-100" />
          <div className="mx-auto mt-20 h-24 max-w-sm rounded-2xl bg-emerald-50" />
        </section>
      ) : null}

      {!error && !loading && hierarchy.length === 0 ? (
        <AppEmptyState title={language === 'zh' ? '暂时没有可见小组' : 'No visible groups yet'} description={language === 'zh' ? '有权限查看的小组会显示在组织树中。' : 'Groups you can discover will appear in the organization tree.'} />
      ) : null}

      {!error && !loading && hierarchy.length > 0 ? (
        <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="overflow-hidden rounded-[2rem] border border-[#2f4b42]/12 bg-[#f4f1ea] shadow-[0_24px_65px_rgba(24,51,45,0.10)]">
            <header className="flex flex-col gap-3 border-b border-[#d9d4ca] bg-white/78 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e3f0eb] text-[#176b5a]"><Network className="h-5 w-5" aria-hidden="true" /></span>
                <div>
                  <h2 className="text-base font-black text-[#18332d]">{language === 'zh' ? '教会与小组组织树' : 'Church and group organization'}</h2>
                  <p className="mt-0.5 text-xs text-[#718079]">{language === 'zh' ? '教会是固定根节点；点击小组预览，箭头展开下属小组' : 'The church is the fixed root; select a group to preview and expand its children'}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentGroup ? <button type="button" onClick={focusCurrentGroup} className="inline-flex items-center gap-1.5 rounded-full border border-[#cbd9d3] bg-white px-3.5 py-2 text-xs font-black text-[#31544b] transition hover:-translate-y-0.5 hover:bg-[#edf5f1]"><Crosshair className="h-3.5 w-3.5" />{language === 'zh' ? '定位当前小组' : 'Locate current'}</button> : null}
                <button type="button" onClick={collapseAll} className="rounded-full border border-[#d7dfda] bg-white px-3.5 py-2 text-xs font-bold text-[#53665f] transition hover:bg-[#edf5f1]">{language === 'zh' ? '收起分支' : 'Collapse'}</button>
                <button type="button" onClick={showOverview} className="inline-flex items-center gap-1.5 rounded-full bg-[#173f36] px-3.5 py-2 text-xs font-black text-white shadow-[0_8px_20px_rgba(23,63,54,.18)] transition hover:-translate-y-0.5 hover:bg-[#102f29]"><Maximize2 className="h-3.5 w-3.5" />{language === 'zh' ? '全局总览' : 'Overview'}</button>
              </div>
            </header>

            <div ref={treeViewportRef} className="relative max-h-[46rem] min-h-[30rem] overflow-auto bg-[#eef2ed] [scrollbar-color:#78978c_transparent]">
              <div className="pointer-events-none sticky left-0 top-0 z-10 h-0 w-full" aria-hidden="true">
                <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/72 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#60716a] shadow-sm backdrop-blur-xl">
                  <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-55" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" /></span>
                  {language === 'zh' ? '实时组织图谱' : 'Live organization map'}
                </div>
              </div>
              <div className="relative transition-[width,height] duration-500" style={{ width: layout.width * zoom, height: layout.height * zoom }} role="tree" aria-label={language === 'zh' ? '教会与可见小组组织树' : 'Church and visible group organization tree'}>
                <motion.div className="absolute left-0 top-0 overflow-hidden [background-image:radial-gradient(circle_at_center,rgba(255,255,255,.94)_0,rgba(244,247,243,.84)_42%,rgba(231,237,232,.94)_100%),radial-gradient(rgba(23,107,90,.16)_1px,transparent_1px)] [background-size:auto,22px_22px]" style={{ width: layout.width, height: layout.height, transformOrigin: 'top left' }} animate={{ scale: zoom }} transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}>
                <div className="pointer-events-none absolute left-1/2 top-0 h-full w-[34rem] -translate-x-1/2 bg-gradient-to-b from-emerald-100/35 via-transparent to-transparent blur-3xl" aria-hidden="true" />
                <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
                  <defs>
                    <linearGradient id="group-tree-line" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#176b5a" stopOpacity="0.55" />
                      <stop offset="100%" stopColor="#8fb9aa" stopOpacity="0.45" />
                    </linearGradient>
                    <filter id="group-tree-glow" x="-80%" y="-80%" width="260%" height="260%">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <AnimatePresence>
                    {layout.edges.map((edge) => {
                      const middleY = edge.fromY + (edge.toY - edge.fromY) / 2
                      const path = `M ${edge.fromX} ${edge.fromY} C ${edge.fromX} ${middleY}, ${edge.toX} ${middleY}, ${edge.toX} ${edge.toY}`
                      const [parentId, childId] = edge.id.split(':')
                      const highlighted = focusedPathIds.has(parentId) && focusedPathIds.has(childId)
                      return (
                        <g key={edge.id}>
                          <motion.path d={path} fill="none" stroke={highlighted ? '#8bd0b8' : 'url(#group-tree-line)'} strokeWidth={highlighted ? 8 : 2} strokeLinecap="round" initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: highlighted ? 0.18 : 0.62 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.48, ease: 'easeOut' }} />
                          {highlighted ? <motion.path d={path} fill="none" stroke="#176b5a" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="8 12" filter="url(#group-tree-glow)" initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }} animate={reduceMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 1, opacity: 1, strokeDashoffset: [0, -40] }} transition={reduceMotion ? { duration: 0 } : { pathLength: { duration: 0.45 }, strokeDashoffset: { duration: 1.8, ease: 'linear', repeat: Infinity } }} /> : null}
                          {highlighted && !reduceMotion ? (
                            <circle r="4" fill="#f4a56f" filter="url(#group-tree-glow)">
                              <animateMotion dur="2.4s" repeatCount="indefinite" path={path} />
                            </circle>
                          ) : null}
                        </g>
                      )
                    })}
                  </AnimatePresence>
                </svg>

                <AnimatePresence>
                  {layout.nodes.map(({ node, x, y, depth, enterX, enterY }) => {
                    const churchRoot = node.group.isChurch
                    const membership = auth.memberships.find((item) => item.groupId === node.group.id)
                    const focused = node.group.id === focusedGroupId
                    const active = node.group.id === activeGroupId
                    const expanded = expandedIds.has(node.group.id)
                    const inFocusedPath = focusedPathIds.has(node.group.id)
                    return (
                      <motion.div
                        key={node.group.id}
                        role="treeitem"
                        aria-level={depth + 1}
                        aria-selected={focused}
                        aria-expanded={node.children.length ? expanded : undefined}
                        className="absolute"
                        style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
                        initial={reduceMotion ? false : { opacity: 0, scale: 0.7, x: enterX, y: enterY, filter: 'blur(8px)' }}
                        animate={{ opacity: focusedGroupId && !inFocusedPath && !churchRoot ? 0.82 : 1, scale: 1, x, y, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: reduceMotion ? 0 : 0.42, delay: reduceMotion ? 0 : Math.min(depth * 0.06, 0.24), ease: [0.22, 1, 0.36, 1] }}
                        whileHover={reduceMotion ? undefined : { y: y - 5, scale: 1.025, opacity: 1, transition: { duration: 0.16 } }}
                      >
                        {focused ? <motion.div layoutId="group-tree-focus" className="absolute -inset-3 rounded-[1.75rem] bg-[#176b5a]/10 ring-2 ring-[#176b5a]/45" animate={reduceMotion ? undefined : { boxShadow: ['0 0 0 0 rgba(23,107,90,.10)', '0 0 0 12px rgba(23,107,90,0)', '0 0 0 0 rgba(23,107,90,0)'] }} transition={{ layout: { type: 'spring', stiffness: 320, damping: 28 }, boxShadow: { duration: 2.2, repeat: Infinity } }} /> : null}
                        <div className={['relative flex h-full overflow-hidden rounded-[1.35rem] border shadow-[0_14px_34px_rgba(24,51,45,0.12)] transition', churchRoot ? 'border-[#d8986c] bg-gradient-to-br from-[#1d5144] via-[#173f36] to-[#0e2e27] text-white shadow-[0_20px_50px_rgba(15,50,42,.28)]' : focused ? 'border-[#176b5a]/40 bg-white' : 'border-white/90 bg-white/94'].join(' ')}>
                          <button type="button" disabled={churchRoot} className="min-w-0 flex-1 px-4 py-3 text-left disabled:cursor-default" onClick={() => focusGroup(node.group.id)}>
                            <span className="flex items-center justify-between gap-2">
                              <span className={['text-[10px] font-black uppercase tracking-[0.15em]', churchRoot ? 'text-orange-100/75' : 'text-[#87938e]'].join(' ')}>{churchRoot ? (language === 'zh' ? '教会 · 固定根节点' : 'Church · fixed root') : (language === 'zh' ? `第 ${depth} 层` : `Level ${depth}`)}</span>
                              {active ? <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#176b5a] text-white"><Check className="h-3 w-3" aria-label={language === 'zh' ? '当前小组' : 'Current group'} /></span> : null}
                            </span>
                            <span className={['mt-2 flex items-center gap-2 truncate text-sm font-black', churchRoot ? 'text-white' : 'text-[#18332d]'].join(' ')}>{focused && !churchRoot ? <Eye className="h-3.5 w-3.5 shrink-0 text-[#de6c4d]" aria-hidden="true" /> : null}{churchRoot ? <Church className="h-4 w-4 shrink-0 text-[#ffc79f]" aria-hidden="true" /> : null}<span className="truncate">{localizeText(node.group.name, language)}</span></span>
                            <span className={['mt-1.5 flex items-center gap-1.5 text-[11px] font-bold', churchRoot ? 'text-white/62' : 'text-[#687871]'].join(' ')}>
                              {churchRoot ? <Workflow className="h-3.5 w-3.5 text-emerald-200" aria-hidden="true" /> : <UsersRound className="h-3.5 w-3.5 text-[#176b5a]" aria-hidden="true" />}
                              {churchRoot ? (language === 'zh' ? `${allNodes.length} 个小组 · 不参与切换` : `${allNodes.length} groups · never switched`) : membershipLabel(membership, language)}
                              {!churchRoot && node.children.length ? <span className="text-[#a0aaa5]">·</span> : null}
                              {!churchRoot && node.children.length ? <span>{language === 'zh' ? `${node.children.length} 个下属` : `${node.children.length} children`}</span> : null}
                            </span>
                          </button>
                          {node.children.length ? (
                            <button type="button" onClick={() => toggleGroup(node.group.id)} className={['flex w-10 shrink-0 items-center justify-center border-l transition', churchRoot ? 'border-white/10 text-emerald-200 hover:bg-white/10' : 'border-[#e5e9e6] text-[#176b5a] hover:bg-[#edf5f1]'].join(' ')} aria-label={`${expanded ? (language === 'zh' ? '收起' : 'Collapse') : (language === 'zh' ? '展开' : 'Expand')} ${localizeText(node.group.name, language)}`}>
                              <ChevronDown className={['h-4 w-4 transition-transform', expanded ? '' : '-rotate-90'].join(' ')} />
                            </button>
                          ) : null}
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
                </motion.div>
              </div>
              <div className="pointer-events-none sticky bottom-4 left-0 z-20 flex h-0 w-full justify-end pr-4">
                <div className="pointer-events-auto flex items-center overflow-hidden rounded-full border border-white/80 bg-white/82 p-1 shadow-[0_12px_30px_rgba(24,51,45,.16)] backdrop-blur-xl">
                <button type="button" onClick={() => setZoom((value) => Math.max(0.35, Number((value - 0.1).toFixed(2))))} disabled={zoom <= 0.35} className="flex h-9 w-9 items-center justify-center rounded-full text-[#31544b] transition hover:bg-[#e4efea] disabled:opacity-30" aria-label={language === 'zh' ? '缩小组织树' : 'Zoom out'}><Minus className="h-4 w-4" /></button>
                <button type="button" onClick={() => setZoom(1)} className="min-w-14 px-2 text-xs font-black tabular-nums text-[#31544b]" aria-label={language === 'zh' ? '恢复原始缩放' : 'Reset zoom'}>{Math.round(zoom * 100)}%</button>
                <button type="button" onClick={() => setZoom((value) => Math.min(1.3, Number((value + 0.1).toFixed(1))))} disabled={zoom >= 1.3} className="flex h-9 w-9 items-center justify-center rounded-full text-[#31544b] transition hover:bg-[#e4efea] disabled:opacity-30" aria-label={language === 'zh' ? '放大组织树' : 'Zoom in'}><Plus className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {focusedGroup ? (
              <motion.aside key={focusedGroup.id} initial={reduceMotion ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: reduceMotion ? 0 : 0.22 }} className="overflow-hidden rounded-[2rem] border border-[#2f4b42]/10 bg-white shadow-[0_22px_60px_rgba(24,51,45,0.10)] lg:sticky lg:top-5">
                <div className="border-b border-[#e3e7e4] bg-gradient-to-br from-[#173f36] to-[#245b4f] p-6 text-white">
                  <div className="flex flex-wrap items-center gap-2">
                    <AppBadge variant={membershipVariant(focusedMembership)}>{membershipLabel(focusedMembership, language)}</AppBadge>
                    {activeGroupId === focusedGroup.id ? <span className="rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white ring-1 ring-white/15">{language === 'zh' ? '当前小组' : 'Current'}</span> : null}
                  </div>
                  <h2 className="mt-4 text-2xl font-black tracking-[-0.035em]">{localizeText(focusedGroup.name, language)}</h2>
                  <p className="mt-2 text-sm leading-6 text-white/62">{localizeText(focusedGroup.description, language) || (language === 'zh' ? '进入此小组查看小组生活、活动和公告。' : 'Enter this group to see Group Life, events, and announcements.')}</p>
                </div>
                <div className="p-5">
                  <AccessTypeBadge accessType={focusedGroup.accessType} />
                  <nav aria-label={language === 'zh' ? '小组层级路径' : 'Group hierarchy path'} className="mt-5 flex flex-wrap items-center gap-1 text-xs font-bold text-[#64756e]">
                    {focusedPath.map((pathGroup, index) => (
                      <span key={pathGroup.id} className="inline-flex items-center gap-1">
                        {index > 0 ? <ChevronRight className="h-3 w-3" aria-hidden="true" /> : null}
                        <button type="button" className="rounded-lg px-1.5 py-1 transition hover:bg-[#e3f0eb] hover:text-[#176b5a]" onClick={() => focusGroup(pathGroup.id)}>{localizeText(pathGroup.name, language)}</button>
                      </span>
                    ))}
                  </nav>

                  {focusedNode && focusedNode.children.length > 0 ? (
                    <div className="mt-5 rounded-2xl bg-[#f5f1e8] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#75817c]">{language === 'zh' ? '直属下属小组' : 'Direct subgroups'}</p>
                      <div className="mt-3 space-y-1.5">
                        {focusedNode.children.map((child) => (
                          <button key={child.group.id} type="button" onClick={() => focusGroup(child.group.id)} className="flex w-full items-center justify-between gap-3 rounded-xl bg-white/75 px-3 py-2.5 text-left text-xs font-black text-[#31544b] transition hover:bg-white">
                            <span className="truncate">{localizeText(child.group.name, language)}</span><ChevronRight className="h-3.5 w-3.5 shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-6 border-t border-[#e3e7e4] pt-5">
                    <p className="text-xs leading-5 text-[#75837e]">
                      {focusedGroup.isChurch
                        ? (language === 'zh' ? '根节点代表教会生活，不属于小组切换范围。' : 'The root represents Church Life and is not a selectable group.')
                        : (language === 'zh' ? '预览不会改变当前小组，只有确认进入后才会切换。' : 'Previewing does not change your current group. Switching occurs only after confirmation.')}
                    </p>
                    <button type="button" onClick={() => openGroup(focusedGroup)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#176b5a] px-5 py-3 text-sm font-black text-white shadow-[0_12px_24px_rgba(23,107,90,0.20)] transition hover:-translate-y-0.5 hover:bg-[#125b4d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#de6c4d]/55">
                      {focusedGroup.isChurch
                        ? (language === 'zh' ? '进入教会生活' : 'Open Church Life')
                        : activeGroupId === focusedGroup.id
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

export default GroupTreeView
