// Fixed bilingual copy for views/admin/LogsSection.tsx.
export const logsSectionText = {
    platformRoleChanged: { en: 'Platform role changed', zh: '平台角色变更' } as const,
    adminNotificationSent: { en: 'Admin notification sent', zh: '管理员发送通知' } as const,
    changedSPlatformRoleFromTo: { en: (value0: unknown, value1: unknown, value2: unknown) => `Changed ${value0}'s platform role from ${value1} to ${value2}`, zh: (value0: unknown, value1: unknown, value2: unknown) => `将 ${value0} 的平台角色从 ${value1} 改为 ${value2}` },
    sentANotificationTo: { en: (value0: unknown, value1: unknown, value2: unknown) => `Sent a notification to ${value0}${value1}${value2}`, zh: (value0: unknown, value1: unknown, value2: unknown) => `向${value0}发送通知${value1}${value2}` },
    label: { en: () => '', zh: (value0: unknown) => `，共 ${value0} 位收件人` },
    scopeLabel: '小组',
    scopeLabel2: '单个成员',
    scopeLabel3: '指定角色',
    scopeLabel4: '全平台',
};
