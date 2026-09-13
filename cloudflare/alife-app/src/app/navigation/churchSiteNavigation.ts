export type ChurchSiteSection = 'home' | 'sermons' | 'bulletins' | 'announcements' | 'albums' | 'forum' | 'events' | 'ram-reviews'

export const withChurchSiteOwnerFilter = (to: string, search: string) => {
  const ownerGroupId = new URLSearchParams(search).get('ownerGroupId')?.trim()
  if (!ownerGroupId) return to
  const [pathname, targetSearch = ''] = to.split('?')
  const params = new URLSearchParams(targetSearch)
  params.set('ownerGroupId', ownerGroupId)
  return `${pathname}?${params}`
}

export const getChurchSiteSection = (pathname: string, search = ''): ChurchSiteSection | null => {
  if (pathname === '/sermons' || pathname.startsWith('/sermons/')) return 'sermons'
  if (pathname === '/church/bulletins') return 'bulletins'
  if (pathname === '/church/albums' || /^\/church\/groups\/[^/]+\/albums(?:\/[^/]+)?$/.test(pathname)) return 'albums'
  if (pathname === '/church/forum' || pathname.startsWith('/church/forum/')) return 'forum'
  if (pathname !== '/church') return null
  const section = new URLSearchParams(search).get('section')?.trim()
  return section === 'events' || section === 'announcements' || section === 'ram-reviews' ? section : 'home'
}

export const getChurchSiteMenu = (language: string, access: { isMember: boolean; canReviewRam?: boolean }) => {
  const zh = language === 'zh'
  const items: { key: ChurchSiteSection; label: string; to: string }[] = [
    { key: 'sermons', label: zh ? '主日证道' : 'Sunday Sermons', to: '/sermons' },
  ]
  if (!access.isMember) return items
  items.push(
    { key: 'announcements', label: zh ? '公告' : 'Announcements', to: '/church?section=announcements' },
    { key: 'albums', label: zh ? '相册' : 'Albums', to: '/church/albums' },
    { key: 'forum', label: zh ? '论坛' : 'Forum', to: '/church/forum' },
    { key: 'events', label: zh ? '活动' : 'Events', to: '/church?section=events' },
  )
  if (access.canReviewRam) {
    items.push({ key: 'ram-reviews', label: zh ? 'RAM 独立审核' : 'Independent RAM review', to: '/church?section=ram-reviews' })
  }
  return items
}
