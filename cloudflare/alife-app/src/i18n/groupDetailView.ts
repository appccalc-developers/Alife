// Fixed bilingual copy for views/GroupDetailView.tsx.
export const groupDetailViewText = {
    public: { en: 'Public', zh: '公开' } as const,
    groupOnly: { en: 'Group only', zh: '小组可见' } as const,
    draft: { en: 'Draft', zh: '草稿' } as const,
    groupContent: { en: 'Group content', zh: '小组内容' } as const,
    content: { en: (value0: unknown) => `${value0} / Content`, zh: (value0: unknown) => `${value0} / 内容` },
    groupLifeContent: { en: (value0: unknown) => `Group Life / ${value0} / Content`, zh: (value0: unknown) => `小组生活 / ${value0} / 内容` },
    backToGroupOverview: { en: 'Back to group overview', zh: '返回小组总览' } as const,
    moreActions: { en: 'More actions', zh: '更多操作' } as const,
    editPage: { en: 'Edit page', zh: '编辑页面' } as const,
    manageGroupContent: { en: 'Manage group content', zh: '管理小组内容' } as const,
    groupLife: { en: 'Group Life', zh: '小组生活' } as const,
    groupLifeOverview: { en: 'Group Life / Overview', zh: '小组生活 / 总览' } as const,
    checkingGroupAccess: { en: 'Checking group access…', zh: '正在确认小组入口…' } as const,
};
