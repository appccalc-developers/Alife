import type { EventDto, MultilingualString } from '../types/event'
import { http } from './http'

export type GenerateEventPosterPayload = {
  groupId: string
  guidance?: string
  baseImage: File
  event: Pick<EventDto, 'title' | 'description' | 'purpose' | 'locationName' | 'startDate' | 'endDate'>
}

export type GeneratedEventPoster = {
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  model: string
  context: {
    groupName: MultilingualString
    churchName: MultilingualString
  }
}

const extensionForMimeType = (mimeType: GeneratedEventPoster['mimeType']) => {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  return 'jpg'
}

export const eventPosterAiService = {
  async generate(payload: GenerateEventPosterPayload) {
    const formData = new FormData()
    formData.set('groupId', payload.groupId)
    formData.set('event', JSON.stringify(payload.event))
    if (payload.guidance) {
      formData.set('guidance', payload.guidance)
    }
    formData.set('baseImage', payload.baseImage, payload.baseImage.name)

    const { data } = await http.post<GeneratedEventPoster>('/api/ai/event-poster', formData)
    return data
  },

  async toFile(poster: GeneratedEventPoster) {
    const response = await fetch(`data:${poster.mimeType};base64,${poster.imageBase64}`)
    const blob = await response.blob()
    return new File(
      [blob],
      `ai-event-poster-${Date.now()}.${extensionForMimeType(poster.mimeType)}`,
      { type: poster.mimeType },
    )
  },
}
