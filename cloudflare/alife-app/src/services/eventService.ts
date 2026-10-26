import type { RamDraft } from '../types/ramGovernance'
import type { EventDto, GroupEventRecord } from '../types/event'
import { groupEventsQueryKey } from '../db/collections/groupCollection'
import { conditionalGet, removeCachedRecord } from '../db/httpCache'
import { queryClient } from '../db/queryClient'
import type { EventPlanComposeRequest, EventSeriesSetup } from '../types/eventComposition'
import type { PreparationSeriesUpdate } from '../utils/eventSavedPreparation'
import type { EventCreationArrangementsRequest } from '../utils/eventCreationArrangements'
import { http } from './http'
import { invalidateChurchLifeQueries } from './churchLifeService'

export const invalidateGroupEventsCache = async (groupId: string) => {
  const queryKey = groupEventsQueryKey(groupId)
  await removeCachedRecord(queryKey)
  await queryClient.invalidateQueries({ queryKey })
  await invalidateChurchLifeQueries()
}

const createPersistencePayload = (eventDto: EventDto) => {
  const publicEventData = {
    id: eventDto.id,
    organizerId: eventDto.organizerId,
    organizerDisplayName: eventDto.organizerDisplayName,
    visibility: eventDto.visibility,
    personResponsible: eventDto.personResponsible,
    purpose: eventDto.purpose,
    title: eventDto.title,
    description: eventDto.description,
    locationName: eventDto.locationName,
    startDate: eventDto.startDate,
    endDate: eventDto.endDate,
    registrationDeadline: eventDto.registrationDeadline,
    maxCapacity: eventDto.maxCapacity,
    registrationMode: eventDto.registrationMode,
    registrationRulesVersion: eventDto.registrationRulesVersion,
    capacityUnit: eventDto.capacityUnit,
    hardConstraints: eventDto.hardConstraints,
    baseFeePerAdult: eventDto.baseFeePerAdult,
    baseFeePerChild: eventDto.baseFeePerChild,
    currency: eventDto.currency,
    posterImageUrl: eventDto.posterImageUrl,
    galleryUrls: eventDto.galleryUrls,
    timeZone: eventDto.timeZone,
    requiresRam: eventDto.requiresRam,
  }
  return {
    eventDataJson: JSON.stringify(publicEventData),
  }
}

export type EventCreationPlan = {
  composition: EventPlanComposeRequest
  proposalHash: string
  idempotencyKey: string
  seriesSetup?: EventSeriesSetup | null
  arrangements?: EventCreationArrangementsRequest
}

export const eventService = {
  getGroupEvents: async (groupId: string, viewerId?: string): Promise<GroupEventRecord[]> => {
    const baseQueryKey = groupEventsQueryKey(groupId)
    const queryKey = viewerId ? [...baseQueryKey, 'viewer', viewerId] : baseQueryKey
    const fetchEvents = () => conditionalGet<GroupEventRecord[]>({
      queryKey,
      path: `/api/groups/${groupId}/events`,
    })

    if (!viewerId) {
      return fetchEvents()
    }

    return queryClient.fetchQuery({
      queryKey: [...queryKey, 'viewer', viewerId],
      queryFn: fetchEvents,
      // Coalesce sequential StrictMode startup reads while preserving navigation revalidation.
      staleTime: 1_000,
    })
  },

  getPublicUpcomingEvents: async (): Promise<GroupEventRecord[]> =>
    conditionalGet<GroupEventRecord[]>({
      queryKey: ['publicUpcomingEvents'],
      path: '/api/events/public/upcoming',
    }),

  createGroupEvent: async (
    groupId: string,
    eventDto: EventDto,
    creationPlan: EventCreationPlan & { initialRamDraft?: RamDraft },
  ): Promise<GroupEventRecord> => {
    const titleEn = eventDto.title.en || eventDto.title.zh || ''
    const titleZh = eventDto.title.zh || eventDto.title.en || ''
    const { eventDataJson } = createPersistencePayload(eventDto)
    const { data } = await http.post<GroupEventRecord>(`/api/groups/${groupId}/events`, {
      titleEn,
      titleZh,
      startDate: eventDto.startDate,
      endDate: eventDto.endDate,
      eventDataJson,
      ramDataJson: creationPlan.initialRamDraft ? JSON.stringify(creationPlan.initialRamDraft) : undefined,
      contactProfileIds: eventDto.contactProfileIds ?? [],
      composition: creationPlan.composition,
      compositionProposalHash: creationPlan.proposalHash,
      seriesSetup: creationPlan.seriesSetup ?? null,
      ...(creationPlan.arrangements ? { arrangements: creationPlan.arrangements } : {}),
    }, { headers: { 'Idempotency-Key': creationPlan.idempotencyKey } })
    await invalidateGroupEventsCache(groupId)
    return data
  },

  updateGroupEvent: async (
    eventId: string,
    eventDto: EventDto,
    expectedUpdatedUtc: string,
    updatePlan: Pick<EventCreationPlan, 'composition' | 'proposalHash'> & { planETag: string },
    seriesUpdate?: PreparationSeriesUpdate,
  ): Promise<GroupEventRecord> => {
    const titleEn = eventDto.title.en || eventDto.title.zh || ''
    const titleZh = eventDto.title.zh || eventDto.title.en || ''
    const { eventDataJson } = createPersistencePayload(eventDto)
    const { data } = await http.put<GroupEventRecord>(`/api/events/${eventId}`, {
      titleEn,
      titleZh,
      startDate: eventDto.startDate,
      endDate: eventDto.endDate,
      eventDataJson,
      contactProfileIds: eventDto.contactProfileIds ?? [],
      composition: updatePlan.composition,
      compositionProposalHash: updatePlan.proposalHash,
      planETag: updatePlan.planETag,
      ...(seriesUpdate ? { seriesUpdate } : {}),
    }, { headers: { 'If-Match': `"${expectedUpdatedUtc}"` } })
    await invalidateGroupEventsCache(data.groupId)
    return data
  },

  deleteGroupEvent: async (eventId: string, groupId?: string): Promise<void> => {
    await http.delete(`/api/events/${eventId}`)
    if (groupId) {
      await invalidateGroupEventsCache(groupId)
    } else {
      await invalidateChurchLifeQueries()
    }
  },

}
