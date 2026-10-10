// Fixed bilingual copy for components/events/EventEnrollmentPanel.tsx.
export const eventEnrollmentPanelText = {
    cancelled: { en: 'Cancelled', zh: '已取消' } as const,
    waitlistPosition: { en: (value0: unknown) => `Waitlist position ${value0}`, zh: (value0: unknown) => `候补第 ${value0} 位` },
    confirmed: { en: 'Confirmed', zh: '正式报名' } as const,
    registrationCapacity: { en: 'Registration capacity', zh: '报名容量' } as const,
    peopleConfirmedWaitlistedCapacity: { en: (value0: unknown, value1: unknown, value2: unknown) => `${value0} people confirmed · ${value1} waitlisted · Capacity ${value2}`, zh: (value0: unknown, value1: unknown, value2: unknown) => `${value0} 人正式报名 · ${value1} 人候补 · 容量 ${value2}` },
    capacityConfirmedWaitlisted: { en: (value0: unknown, value1: unknown, value2: unknown) => `Capacity ${value0} · Confirmed ${value1} · Waitlisted ${value2}`, zh: (value0: unknown, value1: unknown, value2: unknown) => `容量 ${value0} · 正式报名 ${value1} · 候补 ${value2}` },
    registrationIsClosedOrItsConditionsAreNotMet: { en: 'Registration is closed or its conditions are not met. The waitlist is retained without promotion.', zh: '报名当前未开放或条件未满足；候补队列保留，暂不递补。' } as const,
    existingConfirmedRegistrationsExceedCapacityTheirPlacesAreRetained: { en: 'Existing confirmed registrations exceed capacity. Their places are retained; an organiser should review capacity.', zh: '历史正式报名已超过当前容量，现有名额保留。请由负责人复核容量。' } as const,
    aPlaceIsNotYetConfirmedYouWillReceive: { en: 'A place is not yet confirmed. You will receive an in-app notification after promotion.', zh: '尚未获得正式名额。递补成功后会收到站内通知。' } as const,
    enrollments: { en: (value0: unknown) => `${value0} enrollments`, zh: (value0: unknown) => `${value0} 项报名` },
};
