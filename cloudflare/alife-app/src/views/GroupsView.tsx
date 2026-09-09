import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, UsersRound } from 'lucide-react'
import AppPageShell from '../components/layout/AppPageShell'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageTitleBar from '../components/layout/AppPageTitleBar'
import AppSiteNavigation from '../components/layout/AppSiteNavigation'
import GroupDirectoryImage from '../components/group/GroupDirectoryImage'
import { isDirectoryGroupType } from '../utils/groupDirectory'
import AppBadge from '../components/layout/AppBadge'
import AccessTypeBadge from '../components/group/AccessTypeBadge'
import { groupService } from '../services/groupService'
import { useAuthStore } from '../stores/auth'
import { localizeText } from '../utils/localizedText'
import { groupMembershipLabel } from '../utils/groupMembershipPresentation'

const PAGE_SIZE = 12

const GroupsView = () => {
  const auth = useAuthStore()
  const zh = auth.language === 'zh'
  const [params, setParams] = useSearchParams()
  const query = useQuery({
    queryKey: ['group-life-directory', auth.me?.id ?? 'guest'],
    queryFn: () => groupService.getVisibleGroups(auth.me?.id),
    enabled: auth.initialized,
    staleTime: 30_000,
  })
  const groupType = params.get('type') === 'ministry' ? 'ministry' : 'fellowship'
  const expandedId = params.get('expanded') ?? ''
  const search = params.get('q') ?? ''
  const filter = params.get('membership') ?? 'all'
  const sort = params.get('sort') ?? 'name'
  const groups = (query.data ?? []).filter(group => {
    if (!isDirectoryGroupType(group, groupType)) return false
    const joined = auth.memberships.some(m => m.groupId === group.id && m.status === 'approved')
    return (filter === 'all' || (filter === 'joined' ? joined : !joined)) &&
      `${localizeText(group.name, auth.language)} ${localizeText(group.description, auth.language)}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())
  }).sort((a, b) => {
    const comparison = localizeText(a.name, auth.language).localeCompare(localizeText(b.name, auth.language), auth.language)
    return sort === 'name-desc' ? -comparison : comparison
  })
  const pageCount = Math.max(1, Math.ceil(groups.length / PAGE_SIZE))
  const page = Math.min(pageCount, Math.max(1, Math.floor(Number(params.get('p'))) || 1))
  const update = (key: string, value: string) => {
    setParams(previous => {
      const next = new URLSearchParams(previous)
      next.set(key, value)
      if (key !== 'p' && key !== 'expanded') next.delete('p')
      return next
    }, { replace: true })
  }
  const returnTo = `/groups${params.size ? `?${params}` : ''}`
  const actionClass = 'inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b5a]'

  const tabItems = [
    { key: 'fellowship', label: zh ? '团契' : 'Fellowships' },
    { key: 'ministry', label: zh ? '事工组' : 'Ministries' },
  ].map(tab => {
    const next = new URLSearchParams(params)
    next.set('type', tab.key)
    next.delete('p')
    next.delete('expanded')
    return { ...tab, to: `/groups?${next}` }
  })

  return <AppPageShell>
    <AppPageTitleBar title={zh ? '小组生活' : 'Group Life'}
      context={zh ? '小组生活' : 'Group Life'}
      subtitle={zh ? '认识各个小组，展开简介与图片，浏览公开内容或申请加入。' : 'Discover groups, expand their stories and pictures, and explore content or request to join.'}
      navigation={<AppSiteNavigation items={tabItems} activeSection={groupType} label={zh ? '小组类型' : 'Group types'} idPrefix="group-directory-tab" panelId="group-directory-panel" />} />
    <div id="group-directory-panel" role="tabpanel" aria-labelledby={`group-directory-tab-${groupType}`} tabIndex={0} className="outline-none focus-visible:ring-2 focus-visible:ring-[#176b5a]">
    <div className="mb-5 flex w-full flex-wrap items-end gap-3 rounded-2xl border border-[#2f4b42]/10 bg-white p-4">
      <label className="min-w-40 flex-1 text-sm">{zh ? '搜索小组' : 'Search groups'}
        <input className="alife-input mt-1 w-full" value={search} onChange={event => update('q', event.target.value)} type="search" />
      </label>
      <label className="text-sm">{zh ? '加入状态' : 'Membership'}
        <select className="alife-input mt-1 block" value={filter} onChange={event => update('membership', event.target.value)}>
          <option value="all">{zh ? '全部小组' : 'All groups'}</option>
          <option value="joined">{zh ? '已加入' : 'Joined'}</option>
          <option value="discover">{zh ? '尚未加入' : 'Not joined'}</option>
        </select>
      </label>
      <label className="text-sm">{zh ? '排序' : 'Sort'}
        <select className="alife-input mt-1 block" value={sort} onChange={event => update('sort', event.target.value)}>
          <option value="name">{zh ? '名称升序' : 'Name ascending'}</option>
          <option value="name-desc">{zh ? '名称降序' : 'Name descending'}</option>
        </select>
      </label>
    </div>
    {query.isPending ? <p role="status" className="p-5">{zh ? '正在加载小组…' : 'Loading groups…'}</p>
      : query.isError ? <AppEmptyState title={zh ? '无法加载小组' : 'Unable to load groups'}
        description={zh ? '请重试。' : 'Please try again.'} actionLabel={zh ? '重试' : 'Retry'} onAction={() => void query.refetch()} />
      : groups.length === 0 ? <AppEmptyState title={zh ? '没有符合条件的小组' : 'No matching groups'} description={zh ? '可以调整筛选条件；有权限发现的小组会显示在这里。' : 'Try changing the filters. Groups you can discover will appear here.'} />
      : <>
        <ul className="divide-y divide-[#2f4b42]/10 border-y border-[#2f4b42]/10">
          {groups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(group => {
            const membership = auth.memberships.find(m => m.groupId === group.id)
            const joined = membership?.status === 'approved'
            const base = `/groups/${encodeURIComponent(group.id)}`
            const joinLabel = membership?.status === 'requested' ? (zh ? '查看申请状态' : 'View request')
              : membership?.status === 'invited' ? (zh ? '查看邀请' : 'Review invitation')
              : (zh ? '申请加入' : 'Request to join')
            const expanded = expandedId === group.id
            const groupName = localizeText(group.name, auth.language)
            const description = localizeText(group.description, auth.language) || (zh ? '这个小组还没有填写简介。' : 'This group has not added a description yet.')
            return <li key={group.id}>
              <h2>
                <button type="button" id={`group-summary-${group.id}`} aria-expanded={expanded} aria-controls={`group-detail-${group.id}`}
                  onClick={() => update('expanded', expanded ? '' : group.id)}
                  className="flex min-h-16 w-full items-center gap-3 px-2 py-4 text-left transition-colors hover:bg-[#e3f0eb]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#176b5a] sm:px-4">
                  <UsersRound aria-hidden="true" className="h-5 w-5 shrink-0 text-[#176b5a]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2"><span className="break-words text-base font-semibold">{groupName}</span><AppBadge variant={joined ? 'success' : 'neutral'}>{groupMembershipLabel(membership, auth.language, auth.isGuest)}</AppBadge></span>
                    <span className="mt-1 block truncate text-sm font-normal text-[#66766f]">{description}</span>
                  </span>
                  <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-[#176b5a] ${expanded ? 'rotate-180' : ''}`} />
                </button>
              </h2>
              <div id={`group-detail-${group.id}`} role="region" aria-labelledby={`group-summary-${group.id}`} hidden={!expanded}>
                {expanded && <div className="flex flex-col gap-4 bg-white/60 px-4 pb-5 pt-3 sm:flex-row sm:gap-6 sm:px-6">
                  <GroupDirectoryImage groupId={group.id} groupName={groupName} />
                  <div className="min-w-0 flex-1">
                    <AccessTypeBadge accessType={group.accessType} showProtected />
                    <p className="my-3 whitespace-pre-line break-words text-sm leading-6 text-[#66766f]">{description}</p>
              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                {(group.accessType === 'public' || joined || auth.canManageGroup(group.id)) && <Link className={`${actionClass} bg-[#e3f0eb] text-[#0d4f43]`} to={`${base}?view=overview&returnTo=${encodeURIComponent(returnTo)}`}>{joined ? (zh ? '进入小组' : 'Open group') : group.accessType === 'public' ? (zh ? '查看公开内容' : 'View public content') : (zh ? '查看小组内容' : 'View group content')}</Link>}
                {!joined && <Link className={`${actionClass} bg-[#176b5a] text-white`} to={`${base}/join?returnTo=${encodeURIComponent(returnTo)}`}>{joinLabel}</Link>}
              </div>
                  </div>
                </div>}
              </div>
            </li>
          })}
        </ul>
        <nav aria-label={zh ? '小组分页' : 'Group pagination'} className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button className={`${actionClass} disabled:opacity-40`} disabled={page <= 1} onClick={() => update('p', String(page - 1))}>{zh ? '上一页' : 'Previous'}</button>
          <span className="text-sm">{zh ? `第 ${page} / ${pageCount} 页 · ${groups.length} 个小组` : `${page} / ${pageCount} · ${groups.length} groups`}</span>
          <button className={`${actionClass} disabled:opacity-40`} disabled={page >= pageCount} onClick={() => update('p', String(page + 1))}>{zh ? '下一页' : 'Next'}</button>
        </nav>
      </>}
    </div>
  </AppPageShell>
}

export default GroupsView
