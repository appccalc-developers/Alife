import type { Env } from '../../index'
import { authorizeGroupMember, extractMemberIdFromRequest } from '../../middlewares/authCache'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com'
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite'
const SUPPORTED_LANGUAGES = new Set(['zh', 'en'])
const SUPPORTED_SCOPES = new Set(['group', 'church', 'page'])
const ALLOWED_FIELDS = new Set(['name', 'description', 'mission', 'introduction', 'intro'])
const ALLOWED_PAGE_FIELD_PATTERN = /^page\.(title|description)$/
const ALLOWED_SECTION_FIELD_PATTERN = /^sections\.(0|[1-9]\d*)\.(header\.(title|subtitle)|title|subtitle|body|text|quoteAuthor|linkLabel|actions\.(0|[1-9]\d*)\.label)$/
const MAX_FIELDS = 12

type LanguageCode = 'zh' | 'en'

type TranslationFieldRequest = {
  field: string
  sourceLanguage: LanguageCode
  targetLanguage: LanguageCode
  sourceText: string
  textType: string
}

type TranslationResponseField = {
  field: string
  language: LanguageCode
  text: string
}

const RESPONSE_SCHEMA = {
  type: 'object',
  required: ['fields'],
  properties: {
    fields: {
      type: 'array',
      items: {
        type: 'object',
        required: ['field', 'language', 'text'],
        properties: {
          field: { type: 'string' },
          language: { type: 'string', enum: ['zh', 'en'] },
          text: { type: 'string' },
        },
      },
    },
  },
} as const

const SYSTEM_INSTRUCTION = `
You translate official editable text for Alife, a bilingual Chinese/English church community app.

Rules:
1. Translate faithfully between Simplified Chinese and natural New Zealand English.
2. Keep Christian and ministry meaning accurate, warm, and suitable for a church community.
3. Do not invent names, activities, doctrine, dates, slogans, or details not present in the source.
4. Avoid corporate or marketing-heavy wording.
5. Return only JSON matching the response schema.
6. Return one translated text for each requested field, preserving the same field key and target language.
`

export async function handleTranslateTextFields(request: Request, env: Env): Promise<Response> {
  if (!env.GEMINI_API_KEY) {
    return json({ message: 'GEMINI_API_KEY is not configured.' }, 503)
  }

  const memberId = extractMemberIdFromRequest(request)
  if (!memberId) {
    return json({ message: 'Authentication is required.' }, 401)
  }

  let payload: Record<string, unknown>
  try {
    payload = await readJsonObject(request)
  } catch {
    return json({ message: 'Invalid translation request body.' }, 400)
  }

  const validation = await validateRequest(payload, memberId, request, env)
  if (!validation.ok) {
    return json({ message: validation.message }, validation.status)
  }

  try {
    const fields = await callGemini(validation.fields, env)
    return json({ fields }, 200)
  } catch (error) {
    console.error('Gemini text-field translation failed', error)
    return json({ message: 'AI translation failed.' }, 502)
  }
}

async function validateRequest(
  payload: Record<string, unknown>,
  memberId: string,
  request: Request,
  env: Env,
): Promise<
  | { ok: true; fields: TranslationFieldRequest[] }
  | { ok: false; status: number; message: string }
> {
  const scope = typeof payload.scope === 'string' ? payload.scope.trim() : ''
  if (scope && !SUPPORTED_SCOPES.has(scope)) {
    return { ok: false, status: 400, message: 'Unsupported translation scope.' }
  }

  const groupId = typeof payload.groupId === 'string' ? payload.groupId.trim() : ''
  if (groupId) {
    const authz = await authorizeGroupMember(env, groupId, memberId)
    if (authz.status !== 'hit' && !await canReadGroupFromOrigin(env, request, groupId)) {
      return { ok: false, status: 403, message: 'Forbidden' }
    }
  }

  if (!Array.isArray(payload.fields) || payload.fields.length === 0) {
    return { ok: false, status: 400, message: 'fields must contain at least one item.' }
  }

  if (payload.fields.length > MAX_FIELDS) {
    return { ok: false, status: 400, message: `fields cannot contain more than ${MAX_FIELDS} items.` }
  }

  const fields: TranslationFieldRequest[] = []
  for (const [index, value] of payload.fields.entries()) {
    const item = isRecord(value) ? value : {}
    const field = readRequiredString(item.field)
    const sourceLanguage = readLanguage(item.sourceLanguage)
    const targetLanguage = readLanguage(item.targetLanguage)
    const sourceText = readRequiredString(item.sourceText)
    const textType = readRequiredString(item.textType)

    if (!field || !isAllowedTranslationField(field)) {
      return { ok: false, status: 400, message: `fields[${index}].field is not supported.` }
    }

    if (!sourceText) {
      return { ok: false, status: 400, message: `fields[${index}].sourceText is required.` }
    }

    if (!sourceLanguage || !targetLanguage) {
      return { ok: false, status: 400, message: `fields[${index}] has an unsupported language.` }
    }

    if (sourceLanguage === targetLanguage) {
      return { ok: false, status: 400, message: `fields[${index}] sourceLanguage and targetLanguage must differ.` }
    }

    fields.push({ field, sourceLanguage, targetLanguage, sourceText, textType: textType || field })
  }

  return { ok: true, fields }
}

function isAllowedTranslationField(field: string) {
  if (field.length > 120) {
    return false
  }

  return (
    ALLOWED_FIELDS.has(field) ||
    ALLOWED_PAGE_FIELD_PATTERN.test(field) ||
    ALLOWED_SECTION_FIELD_PATTERN.test(field)
  )
}

async function canReadGroupFromOrigin(env: Env, request: Request, groupId: string) {
  const target = env.API_PROXY_TARGET?.trim()
  if (!target) {
    return false
  }

  const url = new URL(`/api/groups/${encodeURIComponent(groupId)}`, target)
  const headers = new Headers()
  const cookie = request.headers.get('cookie')
  const authorization = request.headers.get('authorization')
  if (cookie) {
    headers.set('cookie', cookie)
  }
  if (authorization) {
    headers.set('authorization', authorization)
  }

  const response = await fetch(url.toString(), { headers })
  return response.ok
}

async function callGemini(fields: TranslationFieldRequest[], env: Env): Promise<TranslationResponseField[]> {
  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
  const geminiPayload = {
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{
      role: 'user',
      parts: [{
        text: JSON.stringify({
          task: 'translate-text-fields',
          guidance: 'Translate each sourceText into targetLanguage. Return exactly one result per input field.',
          fields,
        }),
      }],
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
  }

  const geminiRes = await fetch(`${GEMINI_API_BASE}/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': env.GEMINI_API_KEY ?? '',
    },
    body: JSON.stringify(geminiPayload),
  })

  if (!geminiRes.ok) {
    const errorText = await geminiRes.text()
    console.error('Gemini API error', geminiRes.status, errorText)
    throw new Error('Gemini request failed.')
  }

  const geminiData = await geminiRes.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const jsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const parsed = JSON.parse(jsonText)
  const translatedFields = isRecord(parsed) && Array.isArray(parsed.fields) ? parsed.fields : []

  return fields.map((requested) => {
    const translated = translatedFields.find((candidate) =>
      isRecord(candidate) &&
      candidate.field === requested.field &&
      candidate.language === requested.targetLanguage &&
      typeof candidate.text === 'string',
    )

    if (!translated) {
      throw new Error(`Missing translation for ${requested.field}.${requested.targetLanguage}.`)
    }

    return {
      field: requested.field,
      language: requested.targetLanguage,
      text: String(translated.text).trim(),
    }
  })
}

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text()
  if (!text.trim()) {
    return {}
  }

  const parsed = JSON.parse(text)
  return isRecord(parsed) ? parsed : {}
}

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  })
}

function readLanguage(value: unknown): LanguageCode | '' {
  return typeof value === 'string' && SUPPORTED_LANGUAGES.has(value) ? value as LanguageCode : ''
}

function readRequiredString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
