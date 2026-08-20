export const forumQueryKeys = {
  categories: ['forum', 'categories'] as const,
  posts: (categoryId?: string, groupId?: string) => ['forum', 'posts', groupId || 'site', categoryId || 'all'] as const,
  postScope: (postId: string) => ['forum', 'post', postId] as const,
  post: (postId: string, viewerId: string) => ['forum', 'post', postId, viewerId] as const,
  sermonPost: (sermonId: string, viewerId: string) => ['forum', 'sermon-post', sermonId, viewerId] as const,
}

export const churchLifeQueryKeys = {
  all: ['church-life'] as const,
  content: (contentType: string, viewerId: string, ownerGroupId?: string) =>
    ['church-life', viewerId, contentType, ownerGroupId || 'all'] as const,
  forum: (viewerId: string, ownerGroupId: string | undefined, categoryId: string | undefined, page: number, pageSize: number) =>
    ['church-life', viewerId, 'forum', ownerGroupId || 'all', categoryId || 'all', page, pageSize] as const,
  forumPost: (viewerId: string, postId: string) =>
    ['church-life', viewerId, 'forum-post', postId] as const,
}
