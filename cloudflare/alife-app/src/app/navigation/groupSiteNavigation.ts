export type GroupSiteSection = 'home' | 'announcements' | 'albums' | 'forum' | 'events'

export const getLegacyGroupEntryPath = (search: string, savedGroupId: string) => {
  const params = new URLSearchParams(search)
  return savedGroupId && (params.has('section') || params.has('page'))
    ? `/groups/${encodeURIComponent(savedGroupId)}${search}`
    : null
}

export const getGroupSiteRoute = (pathname: string, search = ''): { section: GroupSiteSection; groupId?: string } | null => {
  if (/^\/groups\/forum(?:\/posts\/[^/]+)?$/.test(pathname)) return { section: 'forum' }
  const forum = pathname.match(/^\/groups\/([^/]+)\/forum(?:\/posts\/[^/]+)?$/)
  if (forum) return { section: 'forum', groupId: forum[1] }
  if (/^\/albums(?:\/[^/]+)?$/.test(pathname)) return { section: 'albums' }
  const albums = pathname.match(/^\/groups\/([^/]+)\/albums(?:\/[^/]+)?$/)
  if (albums) return { section: 'albums', groupId: albums[1] }
  const group = pathname.match(/^\/groups(?:\/([^/]+))?$/)
  if (!group || !group[1] || ['select', 'join', 'manage', 'forum'].includes(group[1])) return null
  const params = new URLSearchParams(search)
  const section = params.get('section')
  if (params.get('view') === 'overview' || !section) return { section: 'home', groupId: group[1] }
  if (section === 'announcements' || section === 'events') return { section, groupId: group[1] }
  return null
}

export const getGroupSiteMenu = (language: string, access: { canManage: boolean; canRead: boolean }, groupId?: string) => {
  const zh = language === 'zh'
  const base = groupId ? `/groups/${encodeURIComponent(groupId)}` : '/groups'
  const items: { key: GroupSiteSection; label: string; to: string }[] = [{ key: 'home', label: zh ? '首页' : 'Home', to: `${base}?view=overview` }]
  if (access.canManage) items.push({ key: 'announcements', label: zh ? '公告' : 'Announcements', to: `${base}?section=announcements` })
  if (access.canRead) items.push({ key: 'albums', label: zh ? '相册' : 'Albums', to: groupId ? `${base}/albums` : '/albums' })
  if (access.canRead) items.push({ key: 'forum', label: zh ? '论坛' : 'Forum', to: `${base}/forum` })
  if (access.canManage) items.push({ key: 'events', label: zh ? '活动' : 'Events', to: `${base}?section=events` })
  return items
}
