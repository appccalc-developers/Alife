// Fixed bilingual copy for views/ForumView.tsx.
export const forumViewText = {
    english: { en: 'English', zh: '中文' } as const,
    topicTitle: { en: 'Topic title', zh: '话题标题' } as const,
    writeTheTopicBody: { en: 'Write the topic body…', zh: '写下话题正文…' } as const,
    groupLifeForum: { en: 'Group Life / Forum', zh: '小组生活 / 论坛' } as const,
    churchLifeForum: { en: 'Church Life / Forum', zh: '教会生活 / 论坛' } as const,
    publicContentForum: { en: 'Public Content / Forum', zh: '公开内容 / 论坛' } as const,
    moreActions: { en: 'More actions', zh: '更多操作' } as const,
    forumPagination: { en: 'Forum pagination', zh: '论坛分页' } as const,
    previous: { en: 'Previous', zh: '上一页' } as const,
    page: { en: (value0: unknown) => `Page ${value0}`, zh: (value0: unknown) => `第 ${value0} 页` },
    next: { en: 'Next', zh: '下一页' } as const,
};
