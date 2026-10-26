// Fixed bilingual copy for components/events/EventApprovalAssessment.tsx.
export const eventApprovalAssessmentText = {
    enhancedApproval: { en: 'Enhanced approval', zh: '加强审批' } as const,
    standardApproval: { en: 'Standard approval', zh: '标准审批' } as const,
    lightApproval: { en: 'Light approval', zh: '简易审批' } as const,
    approvalTierAndReplyDeadline: { en: 'Approval tier and reply deadline', zh: '审批等级与批复时间' } as const,
    thisPlanRequires: { en: 'This plan requires: ', zh: '本方案采用：' } as const,
    expectedLatestReply: { en: 'Expected latest reply: ', zh: '最晚预期批复：' } as const,
    theExpectedReplyTimeHasPassedFollowUpWith: { en: 'The expected reply time has passed. Follow up with the approver.', zh: '已超过预期批复时间，请联系审批人跟进。' } as const,
    whyIsThisApprovalTierRequired: { en: 'Why is this approval tier required?', zh: '为什么需要这个审批等级？' } as const,
    policyTheStrictestMatchingTierAppliesExpectedReplyHours: { en: (value0: unknown, value1: unknown) => `Policy ${value0}; the strictest matching tier applies. Expected reply = ${value1} hours before the event, not an approver’s commitment.`, zh: (value0: unknown, value1: unknown) => `政策 ${value0}；同时符合多个等级时采用最严格等级。预期批复时间 = 活动开始前 ${value1} 小时，不是审批人的承诺。` },
    applied: { en: ' · Applied', zh: ' · 本次采用' } as const,
    thisPlanDoesNotTriggerThisTierSPolicy: { en: 'This plan does not trigger this tier’s policy conditions.', zh: '本方案未触发此等级的政策条件。' } as const,
};
