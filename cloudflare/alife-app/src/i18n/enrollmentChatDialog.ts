// Fixed bilingual copy for components/group/EnrollmentChatDialog.tsx.
export const enrollmentChatDialogText = {
    useTheRegistrationWorkspaceForEachParticipantSConsent: { en: 'Use the registration workspace for each participant’s consent, materials, fees and place status.', zh: '请在报名空间办理每位参加者的同意、材料和费用，并查看名额状态。' } as const,
    openRegistration: { en: 'Open registration', zh: '进入报名办理' } as const,
    close: { en: 'Close', zh: '关闭' } as const,
    joinedTheWaitlistAtPositionYouWillReceiveAn: { en: (value0: unknown) => `Joined the waitlist at position ${value0}. You will receive an in-app notification when a place is confirmed.`, zh: (value0: unknown) => `已加入候补，当前位置：${value0}。获得名额后会收到站内通知。` },
    ifTheEventIsFullIAgreeToJoin: { en: 'If the event is full, I agree to join the waitlist and wait for a place in queue order.', zh: '如果名额已满，我同意加入候补并按顺序等待递补。' } as const,
    allPlacesAreFilledSelectTheOptionAboveTo: { en: 'All places are filled. Select the option above to join the waitlist.', zh: '正式名额已满。勾选上方选项后可加入候补。' } as const,
    joinedTheWaitlistAtPositionAPlaceIsNot: { en: (value0: unknown) => `Joined the waitlist at position ${value0}; a place is not yet confirmed.`, zh: (value0: unknown) => `已加入候补，第 ${value0} 位；尚未获得正式名额。` },
};
