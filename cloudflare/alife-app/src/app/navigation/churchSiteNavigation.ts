import { churchSiteNavigationText } from '../../i18n/churchSiteNavigation.ts'
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
    { key: 'sermons', label: zh ? churchSiteNavigationText.sundaySermons.zh : churchSiteNavigationText.sundaySermons.en, to: '/sermons' },
  ]
  if (!access.isMember) return items
  items.push(
    { key: 'announcements', label: zh ? churchSiteNavigationText.announcements.zh : churchSiteNavigationText.announcements.en, to: '/church?section=announcements' },
    { key: 'albums', label: zh ? churchSiteNavigationText.albums.zh : churchSiteNavigationText.albums.en, to: '/church/albums' },
    { key: 'forum', label: zh ? churchSiteNavigationText.forum.zh : churchSiteNavigationText.forum.en, to: '/church/forum' },
    { key: 'events', label: zh ? churchSiteNavigationText.events.zh : churchSiteNavigationText.events.en, to: '/church?section=events' },
  )
  if (access.canReviewRam) {
    items.push({ key: 'ram-reviews', label: zh ? churchSiteNavigationText.independentRamReview.zh : churchSiteNavigationText.independentRamReview.en, to: '/church?section=ram-reviews' })
  }
  return items
}
