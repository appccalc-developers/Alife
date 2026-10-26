import { churchSiteCopyText } from '../../i18n/churchSiteCopy.ts'
import type { ChurchSiteSection } from '../../app/navigation/churchSiteNavigation'

export const churchSiteDescription = (section: ChurchSiteSection | null, language: string) => {
  const descriptions = {
    sermons: [churchSiteCopyText.listenToSundaySermonsAndReadTheBulletinFor.zh, churchSiteCopyText.listenToSundaySermonsAndReadTheBulletinFor.en],
    announcements: [churchSiteCopyText.keepUpWithAnnouncementsFromTheChurchAndIts.zh, churchSiteCopyText.keepUpWithAnnouncementsFromTheChurchAndIts.en],
    albums: [churchSiteCopyText.exploreChurchAndMinistryAlbumsAndRevisitMomentsShared.zh, churchSiteCopyText.exploreChurchAndMinistryAlbumsAndRevisitMomentsShared.en],
    forum: [churchSiteCopyText.aSharedSpaceForChurchMembersToExchangeStories.zh, churchSiteCopyText.aSharedSpaceForChurchMembersToExchangeStories.en],
    events: [churchSiteCopyText.exploreApprovedChurchAndMinistryEventsAndJoinIn.zh, churchSiteCopyText.exploreApprovedChurchAndMinistryEventsAndJoinIn.en],
  }
  const copy = section && section in descriptions ? descriptions[section as keyof typeof descriptions]
    : [churchSiteCopyText.listenToSundayMessagesCatchUpOnChurchNews.zh, churchSiteCopyText.listenToSundayMessagesCatchUpOnChurchNews.en]
  return copy[language === 'zh' ? 0 : 1]
}
