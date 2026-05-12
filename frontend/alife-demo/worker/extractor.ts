import type { Env } from './index'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com'
const GEMINI_MODEL = 'gemini-2.0-flash'

const GEMINI_SYSTEM_INSTRUCTION = `You are an AI assistant for Alife, a bilingual (Chinese/English) church community app.
Your sole task is to extract event details from a user's natural-language text or voice transcript
and return a single, minified JSON object that strictly conforms to the EventDto schema below.

=== EventDto JSON Schema (OpenAPI 3.1 inline object schema) ===
{
  "type": "object",
  "required": ["title", "description", "locationName", "startDate", "endDate", "registrationDeadline"],
  "properties": {
    "id":           { "type": "string", "format": "uuid", "description": "Leave empty string — server will assign." },
    "organizerId":  { "type": "string", "description": "Leave empty string — server will assign." },
    "title": {
      "type": "object",
      "required": ["zh", "en"],
      "properties": {
        "zh": { "type": "string", "description": "Event title in Simplified Chinese." },
        "en": { "type": "string", "description": "Event title in New-Zealand English." }
      }
    },
    "description": {
      "type": "object",
      "required": ["zh", "en"],
      "properties": { "zh": { "type": "string" }, "en": { "type": "string" } }
    },
    "locationName": {
      "type": "object",
      "required": ["zh", "en"],
      "properties": { "zh": { "type": "string" }, "en": { "type": "string" } }
    },
    "startDate":             { "type": "string", "format": "date-time", "description": "ISO-8601 UTC." },
    "endDate":               { "type": "string", "format": "date-time" },
    "registrationDeadline":  { "type": "string", "format": "date-time" },
    "maxCapacity":           { "type": "integer", "minimum": 1 },
    "capacityUnit":          { "type": "string", "enum": ["Families", "People"], "default": "Families" },
    "hardConstraints": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["ruleKey", "displayMessage", "isMandatory"],
        "properties": {
          "ruleKey":        { "type": "string", "description": "E.g. Transport, Food, Safety, General." },
          "displayMessage": { "type": "object", "properties": { "zh": { "type": "string" }, "en": { "type": "string" } } },
          "isMandatory":    { "type": "boolean", "default": true }
        }
      }
    },
    "optionalActivities": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "extraFee"],
        "properties": {
          "id":       { "type": "string", "format": "uuid" },
          "name":     { "type": "object", "properties": { "zh": { "type": "string" }, "en": { "type": "string" } } },
          "extraFee": { "type": "number", "minimum": 0 }
        }
      }
    },
    "baseFeePerAdult":  { "type": ["number", "null"] },
    "baseFeePerChild":  { "type": ["number", "null"] },
    "currency":         { "type": "string", "default": "NZD" },
    "posterImageUrl":   { "type": ["string", "null"] },
    "galleryUrls":      { "type": "array", "items": { "type": "string" } },
    "legacySummary": {
      "type": ["object", "null"],
      "properties": { "zh": { "type": "string" }, "en": { "type": "string" } }
    }
  }
}
=== End Schema ===

Rules:
1. Guide user to offer more information towards a comprehensive output.
  1.1 Even if the user only provided Chinese or English, you MUST populate both "zh" and "en" fields by translating yourself, to ensure a bilingual output.
  1.2 If the user input lacks details, make reasonable assumptions to fill in the gaps, but always adhere to the schema and rules. Prompt the user for clarification if critical information is missing and cannot be reasonably inferred.
  1.3 Output the raw JSON object only after confirmation.
2. All date-time fields MUST be ISO-8601 UTC strings (e.g. "2026-12-01T08:00:00Z").
3. Every MultilingualString field MUST have both "zh" and "en" keys populated.
   If the user spoke only one language, translate the other field yourself.
4. Extract hard constraints from phrases like "must take the bus", "no pork", "must RSVP".
   Map each to a ruleKey: Transport | Food | Safety | RSVP | General.
5. If a value cannot be inferred, use a sensible default (e.g. maxCapacity: 20, currency: "NZD").
6. Do NOT fabricate specific dates unless clearly stated; use the current year and a plausible month.
7. The current reference date is: CURRENT_DATE_PLACEHOLDER.
8. Use legacySummary to preserve important context that cannot be cleanly cataloged into other fields
   (e.g. tone, nuanced notes, caveats, special reminders, pastoral context, follow-up expectations).
   Keep it concise but informative, and always populate both legacySummary.zh and legacySummary.en when such context exists.`

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const apiKey = env.GEMINI_API_KEY
    if (!apiKey) {
      return Response.json({ message: 'GEMINI_API_KEY is not configured.' }, { status: 503 })
    }

    let body: { message?: unknown }
    try {
      body = await request.json() as { message?: unknown }
    } catch {
      return Response.json({ message: 'Invalid JSON body.' }, { status: 400 })
    }

    const userMessage = typeof body.message === 'string' ? body.message.trim() : ''
    if (!userMessage) {
      return Response.json({ message: 'User message cannot be empty.' }, { status: 400 })
    }

    const today = new Date().toISOString().slice(0, 10)
    const systemText = GEMINI_SYSTEM_INSTRUCTION.replace('CURRENT_DATE_PLACEHOLDER', today)

    const geminiPayload = {
      system_instruction: { parts: [{ text: systemText }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 2048 },
    }

    const geminiRes = await fetch(
      `${GEMINI_API_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(geminiPayload),
      },
    )

    if (!geminiRes.ok) {
      console.error('Gemini API error', geminiRes.status, await geminiRes.text())
      return Response.json({ message: 'AI extraction failed. Please try again.' }, { status: 502 })
    }

    const geminiData = await geminiRes.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const jsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    let eventDto: unknown
    try {
      eventDto = JSON.parse(jsonText)
    } catch {
      console.error('Gemini returned invalid JSON:', jsonText)
      return Response.json({ message: 'AI returned an unexpected response format.' }, { status: 502 })
    }

    return Response.json(eventDto, { status: 200 })
  },
}