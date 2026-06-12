import { groupService } from '../services/groupService'
import type { GroupDto, LocalizedText } from '../types'
import type { EventDto, GroupEventRecord } from '../types/event'

export type MissionStatement = {
  scope: 'group' | 'parentGroup'
  groupId: string
  name: LocalizedText
  description: LocalizedText | null
}

export type EventContext = {
  eventDataJson: string
  eventData: Record<string, unknown> | null
}

export type AiContentContext = {
  missionStatements: MissionStatement[]
  eventContext: EventContext | null
}

const emptyLocalizedText = (): LocalizedText => ({ en: '', zh: '' })

const toMissionStatement = (scope: MissionStatement['scope'], group: GroupDto): MissionStatement => ({
  scope,
  groupId: group.id,
  name: group.name ?? emptyLocalizedText(),
  description: group.description ?? null,
})

const parseJsonObject = (value: string): Record<string, unknown> | null => {
  if (!value.trim()) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

export const createEventContextFromDto = (eventDto: EventDto): EventContext => {
  const eventDataJson = JSON.stringify(eventDto)
  return {
    eventDataJson,
    eventData: parseJsonObject(eventDataJson),
  }
}

export const createEventContextFromRecord = (event: GroupEventRecord): EventContext => ({
  eventDataJson: event.eventDataJson,
  eventData: parseJsonObject(event.eventDataJson),
})

export const loadAiContentContext = async (
  groupId: string,
  options: {
    currentGroup?: GroupDto | null
    event?: GroupEventRecord | null
    eventDto?: EventDto | null
  } = {},
): Promise<AiContentContext> => {
  if (!groupId) {
    return { missionStatements: [], eventContext: null }
  }

  const group = options.currentGroup?.id === groupId
    ? options.currentGroup
    : await groupService.getGroup(groupId)

  let parentGroup: GroupDto | null = null
  if (group.parentGroupId) {
    try {
      parentGroup = await groupService.getGroup(group.parentGroupId)
    } catch {
      parentGroup = null
    }
  }

  return {
    missionStatements: [
      toMissionStatement('group', group),
      ...(parentGroup ? [toMissionStatement('parentGroup', parentGroup)] : []),
    ],
    eventContext: options.eventDto
      ? createEventContextFromDto(options.eventDto)
      : options.event
        ? createEventContextFromRecord(options.event)
        : null,
  }
}
