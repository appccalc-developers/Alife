import type { Env } from './index'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com'
const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite'
const DEFAULT_IMAGES_API_BASE = 'https://images.ccalc.live'
const DEFAULT_API_PROXY_TARGET = 'https://api.ccalc.live'

type EnrollmentStep = 'name' | 'consent' | 'paymentFiles'

type EnrollmentPayload = {
  groupId: string
  eventId: string
  name?: string
  consent?: boolean
  paymentFiles: File[]
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return Response.json({ message: 'Method not allowed.' }, { status: 405 })
    }

    const payload = await parsePayload(request)
    if (!payload.groupId || !payload.eventId) {
      return Response.json({ message: 'groupId and eventId are required.' }, { status: 400 })
    }

    if (!payload.name) {
      return Response.json({
        status: 'needs_input',
        nextField: 'name',
        prompt: await buildGuidancePrompt(env, 'name'),
      })
    }

    if (payload.consent !== true) {
      return Response.json({
        status: 'needs_input',
        nextField: 'consent',
        prompt: await buildGuidancePrompt(env, 'consent', payload.name),
      })
    }

    if (payload.paymentFiles.length === 0) {
      return Response.json({
        status: 'needs_input',
        nextField: 'paymentFiles',
        prompt: await buildGuidancePrompt(env, 'paymentFiles', payload.name),
      })
    }

    const uploadedFiles = await uploadPaymentFiles(payload.eventId, payload.paymentFiles)
    const enrollmentJson = await buildEnrollmentJson(env, {
      groupId: payload.groupId,
      eventId: payload.eventId,
      name: payload.name,
      consent: true,
      paymentFiles: uploadedFiles,
    })

    const backendResponse = await postEnrollmentToBackend(request, env, payload.groupId, enrollmentJson)
    if (!backendResponse.ok) {
      const text = await backendResponse.text()
      return Response.json({ message: 'Failed to commit enrollment.', details: text }, { status: 502 })
    }

    return Response.json({
      status: 'completed',
      message: 'Enrollment submitted successfully.',
    })
  },
}

async function parsePayload(request: Request): Promise<EnrollmentPayload> {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    return {
      groupId: String(formData.get('groupId') ?? '').trim(),
      eventId: String(formData.get('eventId') ?? '').trim(),
      name: String(formData.get('name') ?? '').trim() || undefined,
      consent: parseBoolean(formData.get('consent')),
      paymentFiles: formData
        .getAll('paymentFiles')
        .filter((item): item is File => item instanceof File && item.size > 0),
    }
  }

  const body = await request.json().catch(() => ({})) as {
    groupId?: unknown
    eventId?: unknown
    name?: unknown
    consent?: unknown
  }

  return {
    groupId: typeof body.groupId === 'string' ? body.groupId.trim() : '',
    eventId: typeof body.eventId === 'string' ? body.eventId.trim() : '',
    name: typeof body.name === 'string' ? body.name.trim() : undefined,
    consent: typeof body.consent === 'boolean' ? body.consent : undefined,
    paymentFiles: [],
  }
}

function parseBoolean(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    return undefined
  }

  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  return undefined
}

async function buildGuidancePrompt(env: Env, step: EnrollmentStep, name?: string) {
  const fallback = fallbackPrompt(step, name)
  if (!env.GEMINI_API_KEY) {
    return fallback
  }

  try {
    const geminiRes = await fetch(`${GEMINI_API_BASE}/v1beta/models/${env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: 'You are an enrollment assistant. Return one short user-facing prompt in plain text.' }],
        },
        contents: [{ role: 'user', parts: [{ text: `Generate a concise prompt for step "${step}" for user "${name ?? ''}".` }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 160,
        },
      }),
    })

    if (!geminiRes.ok) {
      return fallback
    }

    const geminiData = await geminiRes.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const prompt = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    return prompt || fallback
  } catch {
    return fallback
  }
}

function fallbackPrompt(step: EnrollmentStep, name?: string) {
  if (step === 'name') {
    return 'Please enter your full name for this event enrollment.'
  }

  if (step === 'consent') {
    return `Hi ${name ?? 'there'}, do you consent to submitting your enrollment and payment evidence for verification?`
  }

  return 'Please attach your payment proof file(s) (image or PDF).'
}

async function uploadPaymentFiles(eventId: string, files: File[]) {
  const uploaded: Array<{ fileName: string; contentType: string; size: number; url: string }> = []
  const folder = `enrollments/${sanitizePath(eventId)}`

  for (const file of files) {
    if (!isAllowedPaymentFile(file)) {
      throw new Error('Unsupported payment file type.')
    }

    const formData = new FormData()
    formData.set('file', file, sanitizeFilename(file.name))
    const response = await fetch(`${DEFAULT_IMAGES_API_BASE}/api/images/${folder}`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Payment file upload failed.')
    }

    const body = await response.json() as { image?: { url?: string } }
    uploaded.push({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
      url: body.image?.url ?? '',
    })
  }

  return uploaded
}

function isAllowedPaymentFile(file: File) {
  return file.type.startsWith('image/') || file.type === 'application/pdf'
}

function sanitizeFilename(value: string) {
  return value.trim().replace(/[^\w.\-() ]+/g, '-').slice(0, 180) || 'payment-proof'
}

function sanitizePath(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120)
}

async function buildEnrollmentJson(
  env: Env,
  payload: {
    groupId: string
    eventId: string
    name: string
    consent: boolean
    paymentFiles: Array<{ fileName: string; contentType: string; size: number; url: string }>
  },
) {
  const fallback = {
    eventId: payload.eventId,
    applicantName: payload.name,
    consent: payload.consent,
    paymentFiles: payload.paymentFiles,
    submittedAtUtc: new Date().toISOString(),
  }

  if (!env.GEMINI_API_KEY) {
    return fallback
  }

  try {
    const geminiRes = await fetch(`${GEMINI_API_BASE}/v1beta/models/${env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: 'Return ONLY JSON for event enrollment. Must include eventId as a string.' }],
        },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 1024,
        },
      }),
    })

    if (!geminiRes.ok) {
      return fallback
    }

    const geminiData = await geminiRes.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const jsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    if (!jsonText) {
      return fallback
    }

    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    if (typeof parsed.eventId !== 'string' || !parsed.eventId.trim()) {
      parsed.eventId = payload.eventId
    }
    return parsed
  } catch {
    return fallback
  }
}

function getForwardHeaders(request: Request) {
  const headers = new Headers({ 'content-type': 'application/json' })
  const cookie = request.headers.get('cookie')
  const authorization = request.headers.get('authorization')

  if (cookie) {
    headers.set('cookie', cookie)
  }

  if (authorization) {
    headers.set('authorization', authorization)
  }

  return headers
}

function postEnrollmentToBackend(request: Request, env: Env, groupId: string, enrollmentJson: unknown) {
  const base = (env.API_PROXY_TARGET || DEFAULT_API_PROXY_TARGET).replace(/\/$/, '')
  return fetch(`${base}/api/group/${encodeURIComponent(groupId)}/enroll`, {
    method: 'POST',
    headers: getForwardHeaders(request),
    body: JSON.stringify(enrollmentJson),
  })
}
