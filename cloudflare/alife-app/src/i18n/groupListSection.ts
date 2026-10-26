// Fixed bilingual copy for components/sections/GroupListSection.tsx.
export const groupListSectionText = {
    publicEvent: { en: 'Public event', zh: '公开活动' } as const,
    churchMembers: { en: 'Church members', zh: '教会内可见' } as const,
    previous: { en: (value0: unknown) => `Previous ${value0}`, zh: (value0: unknown) => `上一项${value0}` },
    next: { en: (value0: unknown) => `Next ${value0}`, zh: (value0: unknown) => `下一项${value0}` },
};
