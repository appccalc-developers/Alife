import { groupsViewText } from '../i18n/groupsView.ts'
import { useGroupLifeDirectory } from '../hooks/useGroupLifeDirectory'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, UsersRound } from 'lucide-react'
import AppPageShell from '../components/layout/AppPageShell'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageTitleBar from '../components/layout/AppPageTitleBar'
import AppSiteNavigation from '../components/layout/AppSiteNavigation'
import GroupDirectoryImage from '../components/group/GroupDirectoryImage'
import { isDirectoryGroupType, isGroupLifeVisible } from '../utils/groupDirectory'
import AppBadge from '../components/layout/AppBadge'
import AccessTypeBadge from '../components/group/AccessTypeBadge'
import { useAuthStore } from '../stores/auth'
import { localizeText } from '../utils/localizedText'
import { groupMembershipLabel } from '../utils/groupMembershipPresentation'

const PAGE_SIZE = 12

const GroupsView = () => {
  const auth = useAuthStore()
  const zh = auth.language === 'zh'
  const [params, setParams] = useSearchParams()
  const query = useGroupLifeDirectory()
  const groupType = params.get('type') === 'ministry' ? 'ministry' : 'fellowship'
  const expandedId = params.get('expanded') ?? ''
  const search = params.get('q') ?? ''
  const filter = params.get('membership') ?? 'all'
  const sort = params.get('sort') ?? 'name'
  const groups = (query.data ?? []).filter(group => {
    if (!isGroupLifeVisible(group, auth.memberships) || !isDirectoryGroupType(group, groupType)) return false
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
    { key: 'fellowship', label: zh ? groupsViewText.fellowships.zh : groupsViewText.fellowships.en },
    { key: 'ministry', label: zh ? groupsViewText.ministries.zh : groupsViewText.ministries.en },
  ].map(tab => {
    const next = new URLSearchParams(params)
    next.set('type', tab.key)
    next.delete('p')
    next.delete('expanded')
    return { ...tab, to: `/groups?${next}` }
  })

  return <AppPageShell>
    <AppPageTitleBar title={zh ? groupsViewText.groupLife.zh : groupsViewText.groupLife.en}
      context={zh ? groupsViewText.groupLife.zh : groupsViewText.groupLife.en}
      subtitle={zh ? groupsViewText.discoverGroupsExpandTheirStoriesAndPicturesAndExplore.zh : groupsViewText.discoverGroupsExpandTheirStoriesAndPicturesAndExplore.en}
      navigation={<AppSiteNavigation items={tabItems} activeSection={groupType} label={zh ? groupsViewText.groupTypes.zh : groupsViewText.groupTypes.en} idPrefix="group-directory-tab" panelId="group-directory-panel" />} />
    <div id="group-directory-panel" role="tabpanel" aria-labelledby={`group-directory-tab-${groupType}`} tabIndex={0} className="outline-none focus-visible:ring-2 focus-visible:ring-[#176b5a]">
    <div className="mb-5 flex w-full flex-wrap items-end gap-3 rounded-2xl border border-[#2f4b42]/10 bg-white p-4">
      <label className="min-w-40 flex-1 text-sm">{zh ? groupsViewText.searchGroups.zh : groupsViewText.searchGroups.en}
        <input className="alife-input mt-1 w-full" value={search} onChange={event => update('q', event.target.value)} type="search" />
      </label>
      <label className="text-sm">{zh ? groupsViewText.membership.zh : groupsViewText.membership.en}
        <select className="alife-input mt-1 block" value={filter} onChange={event => update('membership', event.target.value)}>
          <option value="all">{zh ? groupsViewText.allGroups.zh : groupsViewText.allGroups.en}</option>
          <option value="joined">{zh ? groupsViewText.joined.zh : groupsViewText.joined.en}</option>
          <option value="discover">{zh ? groupsViewText.notJoined.zh : groupsViewText.notJoined.en}</option>
        </select>
      </label>
      <label className="text-sm">{zh ? groupsViewText.sort.zh : groupsViewText.sort.en}
        <select className="alife-input mt-1 block" value={sort} onChange={event => update('sort', event.target.value)}>
          <option value="name">{zh ? groupsViewText.nameAscending.zh : groupsViewText.nameAscending.en}</option>
          <option value="name-desc">{zh ? groupsViewText.nameDescending.zh : groupsViewText.nameDescending.en}</option>
        </select>
      </label>
    </div>
    {query.isPending ? <p role="status" className="p-5">{zh ? groupsViewText.loadingGroups.zh : groupsViewText.loadingGroups.en}</p>
      : query.isError ? <AppEmptyState title={zh ? groupsViewText.unableToLoadGroups.zh : groupsViewText.unableToLoadGroups.en}
        description={zh ? groupsViewText.pleaseTryAgain.zh : groupsViewText.pleaseTryAgain.en} actionLabel={zh ? groupsViewText.retry.zh : groupsViewText.retry.en} onAction={() => void query.refetch()} />
      : groups.length === 0 ? <AppEmptyState title={zh ? groupsViewText.noMatchingGroups.zh : groupsViewText.noMatchingGroups.en} description={zh ? groupsViewText.tryChangingTheFiltersGroupsYouCanDiscoverWill.zh : groupsViewText.tryChangingTheFiltersGroupsYouCanDiscoverWill.en} />
      : <>
        <ul className="divide-y divide-[#2f4b42]/10 border-y border-[#2f4b42]/10">
          {groups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(group => {
            const membership = auth.memberships.find(m => m.groupId === group.id)
            const joined = membership?.status === 'approved'
            const base = `/groups/${encodeURIComponent(group.id)}`
            const joinLabel = membership?.status === 'requested' ? (zh ? groupsViewText.viewRequest.zh : groupsViewText.viewRequest.en)
              : membership?.status === 'invited' ? (zh ? groupsViewText.reviewInvitation.zh : groupsViewText.reviewInvitation.en)
              : (zh ? groupsViewText.requestToJoin.zh : groupsViewText.requestToJoin.en)
            const expanded = expandedId === group.id
            const groupName = localizeText(group.name, auth.language)
            const description = localizeText(group.description, auth.language) || (zh ? groupsViewText.thisGroupHasNotAddedADescriptionYet.zh : groupsViewText.thisGroupHasNotAddedADescriptionYet.en)
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
                {(group.accessType === 'public' || joined || auth.canManageGroup(group.id)) && <Link className={`${actionClass} bg-[#e3f0eb] text-[#0d4f43]`} to={`${base}?view=overview&returnTo=${encodeURIComponent(returnTo)}`}>{joined ? (zh ? groupsViewText.openGroup.zh : groupsViewText.openGroup.en) : group.accessType === 'public' ? (zh ? groupsViewText.viewPublicContent.zh : groupsViewText.viewPublicContent.en) : (zh ? groupsViewText.viewGroupContent.zh : groupsViewText.viewGroupContent.en)}</Link>}
                {!joined && <Link className={`${actionClass} bg-[#176b5a] text-white`} to={`${base}/join?returnTo=${encodeURIComponent(returnTo)}`}>{joinLabel}</Link>}
              </div>
                  </div>
                </div>}
              </div>
            </li>
          })}
        </ul>
        <nav aria-label={zh ? groupsViewText.groupPagination.zh : groupsViewText.groupPagination.en} className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button className={`${actionClass} disabled:opacity-40`} disabled={page <= 1} onClick={() => update('p', String(page - 1))}>{zh ? groupsViewText.previous.zh : groupsViewText.previous.en}</button>
          <span className="text-sm">{zh ? groupsViewText.groups.zh(page, pageCount, groups.length) : groupsViewText.groups.en(page, pageCount, groups.length)}</span>
          <button className={`${actionClass} disabled:opacity-40`} disabled={page >= pageCount} onClick={() => update('p', String(page + 1))}>{zh ? groupsViewText.next.zh : groupsViewText.next.en}</button>
        </nav>
      </>}
    </div>
  </AppPageShell>
}

export default GroupsView
