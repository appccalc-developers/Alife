import { groupMembershipPresentationText } from '../i18n/groupMembershipPresentation.ts'
type Membership = { status: string; role: string }

export const groupMembershipLabel = (membership: Membership | undefined, language: string, isGuest = false) => {
  const zh = language === 'zh'
  if (isGuest) return zh ? groupMembershipPresentationText.signInToApply.zh : groupMembershipPresentationText.signInToApply.en
  if (membership?.status === 'approved') {
    if (membership.role === 'leader') return zh ? groupMembershipPresentationText.groupLeader.zh : groupMembershipPresentationText.groupLeader.en
    if (membership.role === 'coLeader') return zh ? groupMembershipPresentationText.coLeader.zh : groupMembershipPresentationText.coLeader.en
    return zh ? groupMembershipPresentationText.groupMember.zh : groupMembershipPresentationText.groupMember.en
  }
  if (membership?.status === 'requested') return zh ? groupMembershipPresentationText.requestPending.zh : groupMembershipPresentationText.requestPending.en
  if (membership?.status === 'invited') return zh ? groupMembershipPresentationText.invited.zh : groupMembershipPresentationText.invited.en
  return zh ? groupMembershipPresentationText.availableToJoin.zh : groupMembershipPresentationText.availableToJoin.en
}
