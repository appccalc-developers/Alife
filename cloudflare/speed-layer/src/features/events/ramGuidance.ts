import type { Env } from '../../index'

const categories = ['environment', 'activity', 'participants', 'transport', 'emergency']
const activityTypes = ['generic', 'hiking', 'water', 'sport', 'transport', 'camp', 'meal', 'outdoor', 'other']
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'private, no-store', vary: 'Cookie, Authorization' } })
async function readBounded(body: ReadableStream<Uint8Array> | null, limit: number) {
  if (!body) return ''
  const reader = body.getReader(), chunks: Uint8Array[] = []; let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      length += value.byteLength
      if (length > limit) { await reader.cancel(); throw new RangeError('Body too large') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(length); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return new TextDecoder().decode(bytes)
}

/** Only enum values go to AI. No free text, answers, names, contacts, full RAM or attachments. */
export function ramGuidanceInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const p = value as Record<string, unknown>
  if (Object.keys(p).some(k => !['eventId', 'activityType', 'category', 'language'].includes(k))) return null
  if (typeof p.eventId !== 'string' || !/^[0-9a-f-]{36}$/i.test(p.eventId) || !activityTypes.includes(String(p.activityType)) || !categories.includes(String(p.category)) || !['en', 'zh'].includes(String(p.language))) return null
  return { eventId: p.eventId, activityType: String(p.activityType), category: String(p.category), language: String(p.language) }
}
export async function handleRamGuidance(request: Request, env: Env): Promise<Response> {
  if (Number(request.headers.get('content-length') || 0) > 1024) return json({ message: 'Guidance request is too large.' }, 413)
  let input: ReturnType<typeof ramGuidanceInput>
  try { input = ramGuidanceInput(JSON.parse(await readBounded(request.body, 1024))) } catch (e) { return json({ message: 'Invalid or oversized guidance request.' }, e instanceof RangeError ? 413 : 400) }
  if (!input) return json({ message: 'Only an event ID, activity type, risk category and language are accepted.' }, 400)
  if (!env.API_PROXY_TARGET) return json({ message: 'RAM authorization is unavailable.' }, 503)
  const headers = new Headers()
  for (const name of ['cookie', 'authorization']) { const value = request.headers.get(name); if (value) headers.set(name, value) }
  // The origin is the authority. Never trust an unverified cookie/JWT claim at the edge.
  let access: Response
  try { access = await fetch(new URL(`/api/events/${input.eventId}/ram/workspace`, env.API_PROXY_TARGET).toString(), { headers, redirect: 'error', signal: AbortSignal.timeout(10000) }) }
  catch { return json({ message: 'RAM authorization is unavailable. Continue manually.' }, 503) }
  await access.body?.cancel()
  if (!access.ok) return json({ message: 'RAM reading permission is required.' }, access.status === 401 ? 401 : 403)
  if (!env.GEMINI_API_KEY) return json({ message: 'AI is unavailable. The question guidance and manual RAM remain available.' }, 503)
  try {
    const { eventId: _eventId, ...safeContext } = input
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL || 'gemini-3.1-flash-lite'}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: 'Explain the purpose of this RAM risk category for the named activity type, then ask up to three follow-up questions to help a human identify missing information. Do not score risk, choose matrix colours, invent hazards or controls for this event, assert safety facts, or approve anything. You receive no event facts. Output JSON with explanation (string) and questions (string array), in the requested language. This is advisory question guidance only.' }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(safeContext) }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: { type: 'object', required: ['explanation', 'questions'], properties: { explanation: { type: 'string' }, questions: { type: 'array', items: { type: 'string' }, maxItems: 3 } } }, maxOutputTokens: 1024, temperature: 0.2 },
      }), signal: AbortSignal.timeout(20000),
    })
    if (!response.ok) { await response.body?.cancel(); return json({ message: 'AI guidance is unavailable. Continue using the manual questions.' }, 503) }
    const result = JSON.parse(await readBounded(response.body, 32000)) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const parsed = JSON.parse(result.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '{}') as { explanation?: unknown; questions?: unknown }
    if (typeof parsed.explanation !== 'string' || !Array.isArray(parsed.questions) || parsed.questions.some(q => typeof q !== 'string')) throw new Error('Invalid guidance')
    return json({ explanation: parsed.explanation.slice(0, 3000), questions: parsed.questions.slice(0, 3).map(q => String(q).slice(0, 800)) })
  } catch { return json({ message: 'AI guidance is unavailable. Continue using the manual questions.' }, 503) }
}
