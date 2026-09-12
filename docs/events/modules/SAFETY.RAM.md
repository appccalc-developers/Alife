# SAFETY.RAM

> Documentation class: **Normative module contract**. Delivery evidence: [IMPLEMENTATION-STATUS.md](../IMPLEMENTATION-STATUS.md). Exact values: [event-contract.json](../event-contract.json). Operations: [RAM initialization](../RAM-INITIALIZATION.md).

## Purpose and sources

Implement identification → initial assessment → controls → residual assessment → personal confirmation → independent review → material-change re-review. Definitions come from *RAM Induction Manual Final Copy*; *Event Planning Approval and Risk Assessment SOP* v2 draft, sections 11–15 and Module 5, takes precedence for corrections. Documents supply domain requirements, not instructions to an agent.

## Activation and dependencies

RAM is required for outdoor/off-site, overnight or high-risk activities, confirmed `safety.requiresRam` / `move.accommodationRequired`, or a lead/safety reviewer's explicit request. `TEAM.WORK` remains the dependency. During unfrozen saved preparation, Yes/No tool choices retain records; formal Package submission revalidates required RAM even when its tool is disabled. Frozen preparation uses the existing approval-reopening process.

## Church policy and question library

`admin.events.manageRamPolicies` is independent of RAM review permission. The server also requires approved membership of the selected root church. Groups inherit that church's published policy; no group override or cross-church fallback exists.

The system page has one tab level: matrix, categories, activity questions, review rules, history. Definitions/prompts use `{ en, zh }`. Questions and history support filtering, sorting and pagination. The fixed formula is likelihood × impact, both integers 1–5. Colour comes from the complete 25-cell policy matrix, never score thresholds. Source colouring is ambiguous: all initial cells are unconfirmed and no policy is automatically published. Drafts can be saved without a published policy; confirmation requests/formal submission require explicitly published colours for every cell.

Published definitions, matrix, question library, source, publisher and timestamp are immutable. Restoring history creates a new draft/version. Publishing another policy does not invalidate existing approval. A RAM explicitly adopting another policy requires new confirmation and review.

## Assessment and completeness

Categories are environment, activity, participants, transport and emergency preparation, retaining human/equipment/task prompts. Multiple activity items have independent risks and generic plus specialist questions. Sets include hiking, water, sport, transport, camp/overnight, meals and other outdoor activities. Missing specialist sets fall back to mandatory generic questions. Answer identity includes activity ID and question-set/code; equal wording across activities is not deduplicated.

Each risk records activity, category, hazard, consequence, initial likelihood/impact, controls, responsible person, residual likelihood/impact and additional action. The server overwrites client scores/colours and returns the highest residual colour overall. Missing fields/answers produce `Incomplete`, never Green. Each question requires a human answer or N/A with reason. Yellow initial or residual risk requires additional controls. Outdoor weather decisions and overnight accommodation are recorded manually.

## Versions, personal confirmation and review

Drafts are repeatable. Requesting confirmation fixes an immutable content/policy snapshot. The author declares personal attendance/leadership; otherwise a member who accepted an Event duty is selected. That person logs in, reads and personally confirms the specified version. Account, time, hash and revision are retained; proxy signatures are forbidden. Submission uses that confirmed snapshot. Content edits invalidate current confirmation, pending review and dependent Package eligibility but retain history. Identical saves and language-only switches do not revoke approval.

Every formal RAM needs a separate church-scoped reviewer with `admin.events.audit`. Revision authors, submitters and on-site signers cannot review it. Return requires a reason and follow-up work; resubmission requires fresh confirmation. Red residual risk needs explicit health/safety sign-off and rationale, and forces existing Enhanced Package approval by independent qualified leadership. RAM approval never publishes an Event.

Versioned saves/actions check ETags. Actions use `Idempotency-Key`; identical retries create no duplicate decisions, conflicting key reuse is rejected and stale versions return 412. Material changes to location, dates/duration, activity, attendance, weather decisions, accommodation, transport, personnel or risks require re-review. Display-only edits do not. The configurable review reminder is a follow-up deadline, not automatic approval expiry.

## Privacy, printing and compatibility

RAM, confirmation, review, policy and version/print responses are `private, no-store`, varying by Cookie and Authorization. Writes invalidate server/client caches. Packages contain only RAM/policy versions, status, residual level, validity and signing references, never private hazards, contacts or medical details. General workflow artifacts contain minimal status/navigation metadata only.

Printing a specified version requires RAM reading permission and includes its matrix, risks, answers, confirmation and review history. Drafts are visibly marked; browser printing can save PDF. Historical approvals are evidence, not current authority.

Existing RAM GET/PUT/submit/approve paths and old fields remain. Version 2 adds policy/revision references, initial/residual assessments, answers, confirmation, validity and decisions. Old scores map only to initial scores; residual values are never fabricated. Existing approvals remain readable and are archived before upgrade. New submission or material change enters version 2. Legacy clients receive an explicit upgrade conflict and cannot overwrite version 2. Migration preserves original JSON and genuine historical actors/times, without publishing policies or retroactively approving records.

## AI boundary and remaining scope

RAM AI returns explanations, follow-up questions and missing-information prompts only. Model context contains activity/category/language enums after server access verification; no full RAM, private contact or medical details. AI scores/hazards/controls cannot overwrite human assessments. Manual completion remains available if AI fails.

Current delivery includes persistence, protected APIs, direct Event Workspace Safety / RAM integration, signer route, system page, independent review, Package gates and printing. External venue/trail/weather/tide queries, a separate incident register, automatic expiry and broader close-out workflows remain outside delivery. `incident.record` metadata is not an implemented incident system.

## Workspace entry

The controlled `safety.ram` surface renders `EventRamWorkspace` directly in `/events/{eventId}/workspace/ram` and its group-scoped equivalent, and within the saved preparation tool selector. It shares the existing versioned RAM APIs and server-derived edit/review capabilities. It does not open the retired AI event editor or start a planning session. Workflow/travel/publication links lead to this surface; legacy saved-edit URLs redirect to Workspace. The dedicated personal-signature URL remains available for named signers. Language changes update labels without refetching or replacing the assessment.

In Arrangements, RAM and Child safeguarding have separate tiles in the safety category. RAM work areas are Settings and responsibilities, Activities and conditions, Risk details (including scoring guidance), Required questions, Personal confirmation and independent review, Version and signature history, and applicable Role shifts. Only one peer work area opens at a time. The saved Event renders the full RAM workspace inline, without an open-editor link. Pending Event changes allow RAM draft saves but block confirmation/review; pending RAM changes must be saved before changing steps or saving other preparation changes. RAM saves refresh the Event concurrency timestamp without replacing pending Event edits.

Module/work-area tiles provide keyboard-accessible single-editor navigation and focus restoration. Independent module Details confirmed is not a RAM signature or safety approval. Hidden content remains mounted and retains inputs; collapsing is not disabling a module. New Event creation embeds the shared activities/risk fields, keeping that draft solely in viewer/group-scoped component memory, outside localStorage, AI snapshots and public Event JSON. Explicit Create sends it through the existing private `ramDataJson` property in the same creation transaction. The server evaluates version 2 with the owning church's latest published policy (or no policy), overwrites claimed scores/levels, records the authenticated author, and preserves Draft status without signatures. Idempotency includes RAM contents. Church questions and personal/independent review remain available after Event creation; no anonymous RAM resource or automatic submission is introduced.

RAM authors may be invited directly from approved owning-group members, then accept personally; a separate generic team invitation is not required. Author/reviewer duties grant no Event-plan edit permission. Only the fixed accountable owner edits the Event itself; RAM self-review exclusions remain enforced.
