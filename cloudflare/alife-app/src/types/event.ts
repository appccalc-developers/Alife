export type MultilingualString = {
  zh: string
  en: string
}

export type EventVisibility = 'groupVisible' | 'churchVisible' | 'public'

export type EventRuleDto = {
  ruleKey: string
  displayMessage: MultilingualString
  isMandatory: boolean
}

export type EventRamStatus = 'draft' | 'awaitingReview' | 'approved'

export type EventRamAssessmentRecord = {
  sync?: import('./ramGovernance').RamSyncState
  eventId: string
  groupId: string
  ramDataJson: string
  status: EventRamStatus
  submittedByMemberId?: string | null
  submittedUtc?: string | null
  approvedByMemberId?: string | null
  approvedUtc?: string | null
  createdUtc: string
  updatedUtc: string
}

export type EventDto = {
  timeZone?: string
  id?: string
  organizerId?: string
  organizerDisplayName?: string
  visibility?: EventVisibility
  personResponsible?: string
  purpose?: MultilingualString
  title: MultilingualString
  description: MultilingualString
  locationName: MultilingualString
  startDate: string
  endDate: string
  registrationDeadline: string
  maxCapacity: number
  registrationMode?: 'none' | 'required'
  registrationRulesVersion?: number
  capacityUnit: 'Families' | 'People'
  hardConstraints: EventRuleDto[]
  baseFeePerAdult?: number | null
  baseFeePerChild?: number | null
  currency: string
  posterImageUrl?: string | null
  galleryUrls: string[]
  contactProfileIds?: string[]
  ram?: import('./ramGovernance').RamDraft
  requiresRam?: boolean
}

export type GroupEventRecord = {
  id: string
  groupId: string
  createdByMemberId?: string
  titleEn: string
  titleZh: string
  startDate: string
  endDate: string
  eventDataJson: string
  createdUtc?: string
  updatedUtc?: string
  contactProfileIds?: string[]
  ramStatus?: EventRamStatus
  ramRequired?: boolean | null
  visibility?: EventVisibility
  accountableOwnerMemberId?: string | null
  governanceMode?: 'private' | 'memberLed' | 'churchSponsored'
  sponsorshipStatus?: 'notRequested' | 'pending' | 'approved' | 'rejected' | 'revoked'
  activePlanVersion?: number | null
}
