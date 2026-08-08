import type { Env } from '../../index'
import { authorizeGroupMember, extractMemberIdFromRequest } from '../../middlewares/authCache'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com'
const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image'
const MAX_GUIDANCE_LENGTH = 600
const MAX_FIELD_LENGTH = 4000
const MAX_BASE_IMAGE_BYTES = 6 * 1024 * 1024
const MAX_IMAGE_BASE64_LENGTH = 12 * 1024 * 1024
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type LocalizedText = { zh: string; en: string }

type CanonicalGroup = {
  id: string
  name: LocalizedText
  description: LocalizedText
  isChurch: boolean
  parentGroupId: string
}

type PosterEventBrief = {
  title: LocalizedText
  description: LocalizedText
  purpose: LocalizedText
  locationName: LocalizedText
  startDate: string
  endDate: string
}

type PosterGenerationRequest = {
  groupId: string | null
  guidance: string | null
  event: unknown
  baseImage: File | null
}

export async function handleGenerateEventPoster(request: Request, env: Env): Promise<Response> {
  if (!env.GEMINI_API_KEY) {
    return json({ message: 'GEMINI_API_KEY is not configured.' }, 503)
  }

  const memberId = extractMemberIdFromRequest(request)
  if (!memberId) {
    return json({ message: 'Authentication is required.' }, 401)
  }

  let payload: PosterGenerationRequest
  try {
    payload = await readPosterGenerationRequest(request)
  } catch {
    return json({ message: 'Invalid poster generation request body.' }, 400)
  }

  const groupId = payload.groupId
  if (!groupId || !UUID_PATTERN.test(groupId)) {
    return json({ message: 'A valid groupId is required.' }, 400)
  }

  if (!await canGenerateForGroup(request, env, groupId, memberId)) {
    return json({ message: 'Only group leaders and co-leaders can generate event posters.' }, 403)
  }

  const event = normalizeEventBrief(payload.event)
  if (!hasText(event.title) || !hasText(event.description)) {
    return json({ message: 'Event title and description are required before generating a poster.' }, 400)
  }

  const baseImage = payload.baseImage
  if (!baseImage) {
    return json({ message: 'A base poster image is required.' }, 400)
  }

  const baseImageMimeType = normalizeImageMimeType(baseImage.type)
  if (!baseImageMimeType) {
    return json({ message: 'Base poster image must be a JPEG, PNG, or WebP file.' }, 400)
  }
  if (baseImage.size === 0) {
    return json({ message: 'Base poster image cannot be empty.' }, 400)
  }
  if (baseImage.size > MAX_BASE_IMAGE_BYTES) {
    return json({ message: 'Base poster image must be 6 MB or smaller.' }, 400)
  }

  const guidance = payload.guidance?.slice(0, MAX_GUIDANCE_LENGTH) ?? ''
  let group: CanonicalGroup
  let church: CanonicalGroup
  try {
    group = await loadCanonicalGroup(request, env, groupId)
    church = group.parentGroupId
      ? await loadCanonicalGroup(request, env, group.parentGroupId)
      : group
  } catch (error) {
    console.error('Failed to load canonical church context for poster generation.', error)
    return json({ message: 'Church context could not be loaded.' }, 502)
  }

  const model = env.GEMINI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL
  try {
    const baseImageBase64 = bytesToBase64(new Uint8Array(await baseImage.arrayBuffer()))
    const geminiResponse = await fetch(`${GEMINI_API_BASE}/v1beta/interactions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        model,
        input: [
          { type: 'text', text: buildPosterPrompt({ event, group, church, guidance }) },
          { type: 'image', mime_type: baseImageMimeType, data: baseImageBase64 },
        ],
        response_format: {
          type: 'image',
          mime_type: 'image/jpeg',
          aspect_ratio: '16:9',
          image_size: '512',
        },
      }),
    })

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini event poster generation failed.', geminiResponse.status, errorText)
      const providerMessage = readProviderErrorMessage(errorText)
      if (geminiResponse.status === 400 && /api key not valid/i.test(providerMessage)) {
        return json({ message: 'AI image generation is not configured with a valid Gemini API key. Please contact an administrator.' }, 503)
      }
      if (geminiResponse.status === 403) {
        return json({ message: 'The configured Gemini project does not have permission to generate images. Please contact an administrator.' }, 503)
      }
      if (geminiResponse.status === 404) {
        return json({ message: 'The configured Gemini image model is unavailable. Please contact an administrator.' }, 503)
      }
      const status = geminiResponse.status === 429 ? 429 : 502
      return json({ message: status === 429 ? 'AI poster generation is busy. Please try again shortly.' : 'AI poster generation failed.' }, status)
    }

    const result = await geminiResponse.json() as unknown
    const imageOutput = readGeminiImageOutput(result)
    const imageBase64 = readString(imageOutput?.data)
    const mimeType = normalizeImageMimeType(imageOutput?.mime_type ?? imageOutput?.mimeType)
    if (!imageBase64 || imageBase64.length > MAX_IMAGE_BASE64_LENGTH || !mimeType) {
      console.error('Gemini poster response did not contain a usable image.')
      return json({ message: 'AI did not return a usable poster image.' }, 502)
    }

    return json({
      imageBase64,
      mimeType,
      model,
      context: {
        groupName: group.name,
        churchName: church.name,
      },
    }, 200)
  } catch (error) {
    console.error('Gemini event poster generation failed.', error)
    return json({ message: 'AI poster generation failed.' }, 502)
  }
}

async function canGenerateForGroup(request: Request, env: Env, groupId: string, memberId: string) {
  const authz = await authorizeGroupMember(env, groupId, memberId)
  const role = authz.record?.role?.toLowerCase()
  if (authz.status === 'hit' && (role === 'leader' || role === 'coleader')) {
    return true
  }

  const profile = await fetchOriginJson(request, env, '/api/me', true)
  if (!profile) return false
  if (profile.isAdmin === true || ['admin', 'superadmin'].includes(readString(profile.platformRole)?.toLowerCase() ?? '')) {
    return true
  }

  const memberships = Array.isArray(profile.memberships) ? profile.memberships : []
  return memberships.some((value) => {
    const membership = isRecord(value) ? value : {}
    const membershipRole = readString(membership.role)?.toLowerCase()
    return readString(membership.groupId) === groupId
      && readString(membership.status)?.toLowerCase() === 'approved'
      && (membershipRole === 'leader' || membershipRole === 'coleader')
  })
}

async function loadCanonicalGroup(request: Request, env: Env, groupId: string): Promise<CanonicalGroup> {
  const value = await fetchOriginJson(request, env, `/api/groups/${encodeURIComponent(groupId)}`)
  if (!value) throw new Error('Group not found.')
  return {
    id: readString(value.id) ?? groupId,
    name: normalizeLocalizedText(value.name),
    description: normalizeLocalizedText(value.description),
    isChurch: value.isChurch === true,
    parentGroupId: readString(value.parentGroupId) ?? '',
  }
}

async function fetchOriginJson(request: Request, env: Env, path: string, noStore = false) {
  const target = env.API_PROXY_TARGET?.trim()
  if (!target) return null
  const headers = forwardedAuthHeaders(request)
  if (noStore) headers.set('cache-control', 'no-store')
  const response = await fetch(new URL(path, target).toString(), { headers })
  if (!response.ok) return null
  const value = await response.json() as unknown
  return isRecord(value) ? value : null
}

function forwardedAuthHeaders(request: Request) {
  const headers = new Headers({ accept: 'application/json' })
  const cookie = request.headers.get('cookie')
  const authorization = request.headers.get('authorization')
  if (cookie) headers.set('cookie', cookie)
  if (authorization) headers.set('authorization', authorization)
  return headers
}

function buildPosterPrompt(args: { event: PosterEventBrief; group: CanonicalGroup; church: CanonicalGroup; guidance: string }) {
  return `Transform the supplied base image into one polished 16:9 event poster for a Chinese Christian church community in New Zealand. The supplied image is the required visual foundation; do not ignore it or replace it with an unrelated composition.

Canonical organization context (trusted; do not invent beyond it):
${JSON.stringify({
    church: { name: args.church.name, description: args.church.description },
    organizingGroup: { name: args.group.name, description: args.group.description },
  })}

Event brief (trusted event draft):
${JSON.stringify(args.event)}

Optional visual direction from the organizer:
${args.guidance || 'No additional direction.'}

Rules:
1. Preserve the base image's recognizable visual identity, main subject, and overall composition while adapting it to the event description, purpose, and canonical church context above.
2. Keep the tone warm, dignified, hopeful, welcoming, family-safe, culturally respectful, and appropriate for a church community.
3. Do not invent a church logo, denomination, sponsor, Bible quotation, address, date, price, phone number, URL, QR code, or factual claim.
4. Do not depict a recognizable real person or imply that a generated person is a real church member. Use symbolic imagery, environments, or clearly generic community figures.
5. Do not include private contact details, risk-management content, or internal planning notes.
6. Use only the supplied event title as prominent text. Keep other typography minimal because the organizer must verify all generated text before use.
7. Leave generous clean space so exact event details can be added or corrected later.
8. Produce only the poster image.`
}

function normalizeEventBrief(value: unknown): PosterEventBrief {
  const event = isRecord(value) ? value : {}
  return {
    title: normalizeLocalizedText(event.title),
    description: normalizeLocalizedText(event.description),
    purpose: normalizeLocalizedText(event.purpose),
    locationName: normalizeLocalizedText(event.locationName),
    startDate: readString(event.startDate)?.slice(0, 80) ?? '',
    endDate: readString(event.endDate)?.slice(0, 80) ?? '',
  }
}

function normalizeLocalizedText(value: unknown): LocalizedText {
  const text = isRecord(value) ? value : {}
  return {
    zh: (readString(text.zh) ?? '').slice(0, MAX_FIELD_LENGTH),
    en: (readString(text.en) ?? '').slice(0, MAX_FIELD_LENGTH),
  }
}

function hasText(value: LocalizedText) {
  return Boolean(value.zh || value.en)
}

function normalizeImageMimeType(value: unknown) {
  const mimeType = readString(value)?.toLowerCase()
  return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp' ? mimeType : null
}

function readGeminiImageOutput(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.steps)) return null

  for (const stepValue of value.steps) {
    if (!isRecord(stepValue) || stepValue.type !== 'model_output' || !Array.isArray(stepValue.content)) continue

    const imageOutput = stepValue.content.find((contentValue) =>
      isRecord(contentValue) && contentValue.type === 'image')
    if (isRecord(imageOutput)) return imageOutput
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readProviderErrorMessage(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!isRecord(parsed) || !isRecord(parsed.error)) return ''
    return readString(parsed.error.message) ?? ''
  } catch {
    return ''
  }
}

async function readPosterGenerationRequest(request: Request): Promise<PosterGenerationRequest> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data')) {
    throw new Error('Expected multipart form data.')
  }

  const formData = await request.formData()
  const eventValue = formData.get('event')
  if (typeof eventValue !== 'string') {
    throw new Error('Event data is required.')
  }

  const event = JSON.parse(eventValue) as unknown
  const baseImageValue = formData.get('baseImage')
  return {
    groupId: readString(formData.get('groupId')),
    guidance: readString(formData.get('guidance')),
    event,
    baseImage: baseImageValue instanceof File ? baseImageValue : null,
  }
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return btoa(binary)
}

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store, max-age=0',
      pragma: 'no-cache',
      'x-alife-cache': 'BYPASS',
    },
  })
}
