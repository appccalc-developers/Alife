// Fixed bilingual copy for components/events/RamFields.tsx.
export const ramFieldsText = {
    likelihoodLevel: { en: (value: number) => `Likelihood level ${value}`, zh: (value: number) => `可能性档位 ${value}` },
    impactLevel: { en: (value: number) => `Impact level ${value}`, zh: (value: number) => `影响程度档位 ${value}` },
    scaleDefinitionUnavailable: { en: 'The policy definition for this level is unavailable.', zh: '此档位的政策定义暂不可用。' } as const,
    levelLabels: { Green: { en: 'Green', zh: '绿色' }, Yellow: { en: 'Yellow', zh: '黄色' }, Red: { en: 'Red', zh: '红色' }, Incomplete: { en: 'Incomplete', zh: '未完成' } },
    english: { en: 'English', zh: '中文' } as const,
    editChinese: { en: 'Edit Chinese', zh: '编辑英文' } as const,
    likelihoodImpactEachColourConfirmedByTheChurch: { en: 'Likelihood × impact; each colour confirmed by the church', zh: '可能性 × 影响程度；每格颜色由教会确认' } as const,
    lI: { en: 'L ↓ / I →', zh: '可能性 ↓／影响 →' } as const,
    unconfirmed: { en: 'Unconfirmed', zh: '待确认' } as const,
};
