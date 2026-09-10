# Event details assistant contract v1

The creation wizard uses `/api/events/details-session/{id}/message`, `/state` and `/close`. These use the existing Event Durable Object binding with a `details-v1:` object-name prefix and separate `event-details-v1` storage. Legacy event planning/editing, enrollment and review routes retain their response contracts. All four scenarios use shared assistant policy `1.0.0`; each supplies its own scenario definition and Gemini response schema.

## Input and output

Each message supplies `message` (up to 8,000 characters) and `appContext.knownFacts.snapshot`: `{ version: 1, revision, form, sources, isSeries, archetypeCode, activityTypeCode }`. The latest form is authoritative for draft editing, including manual changes. The server supplies the reference instant. Model context includes at most eight recent messages and no full member profiles, contact information, RAM or approval data.

`form` contains bilingual `{ zh, en }` title, description and locationName; nullable startLocal/endLocal (`YYYY-MM-DDTHH:mm`) and IANA timeZone; nullable visibility (`groupVisible`, `churchVisible`, `public`) and registrationMode (`none`, `required`); nullable integer maxCapacity and intervalWeeks (1–52). Classification/template selection remains outside the AI allow-list.

Gemini returns this complete form, `fieldAssessments` (field, status, exact supporting evidence, bilingual explanation), `assessment` (0–100 sufficiencyScore and bilingual summary), `issues` (field, kind, bilingual question), and bilingual `assistantReply`. Field statuses are explicit/inferred/missing/ambiguous/conflicting; issue kinds are missing/confirmationNeeded/ambiguous/conflicting/unsupported. Assessments/issues are bounded to ten and explanations/replies to 400 characters per language. Guidance asks at most two priority questions. Unknown business data is a successful partial draft, not a validation error.

After validation and conservative merging, the API returns `{ responseMode: "result", sessionId, result }`. The result adds `version: 1`, the input `revision`, adoptedFields, sources and deterministic `completion: { completed, total, percent, pending }`. Only supported, evidence-backed explicit fields can replace the latest draft; invalid values and ambiguous/conflicting changes do not. Explicit clears remain incomplete. The UI rejects responses for an older input signature/revision and retains user input on failure.

## Completion and authority

Each applicable field has equal weight. Bilingual fields count once and require both languages; capacity applies only when registration is required, and interval only for a series. Valid human/explicit sources count; defaults, unresolved fields and invalid values do not. Users may edit, clarify in conversation or confirm displayed defaults. The percentage measures draft completeness, not factual truth or business confirmation; AI sufficiency is separately labelled and cannot change completion, permissions, validation or approval.

Sources and revision metadata supplied by the client are presentation claims, never authorization credentials. AI output does not change module facts, template choices, approvals or persistence. Creation still requires the existing deterministic validation, server recomposition and explicit human acceptance. A 100% score neither approves nor publishes an event.

## Dates, recurrence and continuity

All creation dates are interpreted in the visible event time zone, including one-off events. Local-to-UTC conversion rejects invalid dates and DST gaps/folds. Relative phrases such as “next Saturday” require confirmation of a concrete date; conflicting weekly/fortnightly instructions are surfaced. Weekly intervals from 1–52 map to the existing `FREQ=WEEKLY;INTERVAL=N;BYDAY=...` contract and rolling 12-week materialization window. Monthly and multiple-weekday rules are not introduced.

Local draft envelopes use version 3 under the existing viewer/group-scoped storage key. Version 2 drafts retain text and settings, get interval 1 and unconfirmed sources. New assistant conversations are isolated from legacy conversations. Moving between wizard steps preserves the mounted conversation; closing the creation flow closes its ephemeral session. Local draft fields remain recoverable separately.

## Failure and privacy

Session ownership and authentication remain server-enforced; session responses use no-store and vary by Cookie/Authorization. Unknown fields and malformed inputs are rejected before invoking Gemini. MAX_TOKENS and malformed responses do not adopt partial results. No automatic retry or output-budget increase is introduced. Diagnostic output records model, finish reason and provider token counts without prompts, response bodies or profiles.

Test coverage includes incomplete output, latest snapshots, explicit corrections/clears, defaults and conditional completion, ALIFE date/recurrence ambiguity, DST, cross-member and legacy namespace isolation, invalid evidence, truncation recovery, and fortnightly backend materialization across NZ DST. Mocked tests are not evidence of live Gemini semantic accuracy.
