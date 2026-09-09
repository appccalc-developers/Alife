type Membership = { status: string; role: string }

export const groupMembershipLabel = (membership: Membership | undefined, language: string, isGuest = false) => {
  const zh = language === 'zh'
  if (isGuest) return zh ? '登录后可申请' : 'Sign in to apply'
  if (membership?.status === 'approved') {
    if (membership.role === 'leader') return zh ? '组长' : 'Group leader'
    if (membership.role === 'coLeader') return zh ? '副组长' : 'Co-leader'
    return zh ? '组员' : 'Group member'
  }
  if (membership?.status === 'requested') return zh ? '申请审核中' : 'Request pending'
  if (membership?.status === 'invited') return zh ? '收到邀请' : 'Invited'
  return zh ? '可以申请加入' : 'Available to join'
}
