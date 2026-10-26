// Fixed bilingual copy for components/events/EventTeamModules.tsx.
export const eventTeamModulesText = {
    enabledModuleResponsibilities: { en: 'Enabled module responsibilities', zh: '已启用模块负责人' } as const,
    modules: { en: (value0: unknown) => `${value0} modules`, zh: (value0: unknown) => `${value0} 个模块` },
    unassigned: { en: 'Unassigned', zh: '待分配' } as const,
    coordinatedByTheEventOwner: { en: 'Coordinated by the event owner', zh: '活动总负责人统筹' } as const,
    noEnabledModules: { en: 'No enabled modules', zh: '暂无已启用模块' } as const,
};
