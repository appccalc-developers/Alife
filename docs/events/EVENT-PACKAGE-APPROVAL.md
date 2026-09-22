# Event Package approval and lifecycle gates

> Normative topic delegated by [the core contract](EVENT-CONTRACT.md). Owns Package policy, scope, immutable decisions, lifecycle gates, invalidation and rollout. Exact wire values remain in [event-contract.json](event-contract.json). Preparation interaction and reopening requests are specified in [the preparation flow](EVENT-SETUP-FLOW.md).

## Event Package Approval and lifecycle gates

### Purpose and concept boundaries

`EventPackage` is the immutable, structured approval projection of one Event or occurrence scope. It is assembled from the accepted Event Plan and authoritative module summaries; it is not another data-entry form. The following remain distinct:

- Plan acceptance: human confirmation of the composed Plan and creation of an immutable Plan Snapshot.
- Event Package Approval: an authorised human decision on one Package version.
- Specialist approval: a RAM, safeguarding, finance, sponsorship, or exception decision owned by its domain.
- Readiness: a projection of current evidence and blockers, never a human decision.
- Ready to Proceed: a lifecycle-gate result derived from active Package approval, specialist decisions, conditions, and pre-event confirmation; clients cannot set it directly.
- Duty notification: a discoverability record that links to an authoritative specialist action; reading or dismissing it cannot create or change the decision.

AI may propose text or candidate facts but cannot generate an authoritative Package, submit, decide, satisfy or verify conditions, publish, open registration, accept payment, or confirm execution.

### Governance policy version 1

Governance is evaluated from confirmed facts and one immutable policy version. Unknown required facts never count as false. Multiple triggers take the strictest result.

- `light`: group-visible, no registration or money flow, and no confirmed child, transport, accommodation, outdoor/remote, public-impact, or specialist-approval trigger. The accountable owner makes one explicit confirmation.
- `standard`: public or expanded visibility, registration, church resources, sponsorship consideration, money flow below any policy escalation, or another standard policy trigger. One owning-group leader/co-leader who is not the submitter decides; when no eligible separate actor exists, the decision escalates to the root church.
- `enhanced`: child/safeguarding, outdoor or remote risk, transport, accommodation/overnight duty, high-risk RAM, large-public-impact, external-partner, or policy-escalated finance facts. One root-church leader/co-leader or actor with `admin.events.approvePackages` decides and must be separate from the submitter and affected specialist authors.

Version 1 requires one eligible overall approver, not a multi-person quorum. A later policy version may require quorum without changing historical decisions. Delegation is valid only when the policy permits it and records organisation, Package scope, granted permission, start, expiry, grantor, revocation, and audit. Conflicted actors recuse and the decision escalates. The server derives actor and authority from the authenticated context; clients never supply the effective approver identity or authority snapshot.

Numerical attendance, amount, and risk thresholds are policy data, not hard-coded application constants. Missing or unsupported governance policy fails closed for new enforcement decisions.

### Scope and coverage

Each Package records `eventId`, `scopeType`, optional `scopeId`, `coverageMode`, covered occurrence information, Plan version, Package schema version, governance policy version, validity window, and supersession link.

- A one-off Event uses Event scope and covers its initial occurrence.
- A recurring Event uses either explicit occurrence IDs or `planBoundSeriesWindow` with a recorded start/end and baseline fingerprint.
- A newly materialised occurrence inherits only when it is inside that window, uses the same accepted Plan and Series defaults, and introduces no Package-relevant exception.
- Occurrence-versioned module sources are frozen per covered occurrence. An occurrence-local change creates a persisted open scoped review and required task, invalidates an earlier Package for that occurrence, and removes only that occurrence's inherited execution authority. The Event-level baseline and unrelated occurrences remain valid; an approved occurrence-scoped Package resolves the review. Packages created before granular occurrence source references fail closed at Event scope.
- An Event-level governance-critical change invalidates every affected occurrence coverage.
- A Child Event owns its own Package. A parent Package may reference the child's status but cannot approve it.

### Governance policy administration

The System Management policy editor manages global policies through bilingual business fields and an immutable-version selector. Reading server defaults or previewing impact is non-mutating. Initialization requires explicit administrator publication and defaults to `dryRun`; software suggestions (30/14/7-day validity, 72-hour confirmation window, 90-day transition) are not a claim that the SOP prescribes these values. Existing group-specific policies retain precedence.

Restoration copies an understood historical version into a new draft, renews effective/transition dates for review, and publishes a new version with its source ID in the audit. It never rewrites history or reactivates previous approvals. Unrecognized structures cannot be silently converted. Only rules evaluated by the current engine have editable controls; approval counts do not implement a sequential pastoral/deacons approval chain, and recorded transition dates do not schedule an automatic mode change.

`GET /api/admin/event-package-policies/defaults` returns validated-schema defaults and known bilingual trigger choices (including known template codes still needed by existing Events). `POST /api/admin/event-package-policies/preview` validates proposed rules and returns the current policy ID, affected Event and active-approval counts, and an impact token. Both require `admin.events.managePackagePolicies` and private/no-store responses. Preview covers only Events whose effective policy changes; a global replacement excludes Events with an effective group override.

The editor supplies `expectedCurrentPolicyId` (`Guid.Empty` for initialization), optional `sourcePolicyId`, and the preview's `impactToken` to the existing publish endpoint. These additive fields preserve existing clients. The server serializes scope publication in a database transaction, rechecks current policy and impact, retires preceding versions, saves the new immediately effective version, invalidates affected approvals and records audit/idempotency state atomically. Stale editor requests return conflict and require fresh review. Retries retain the same request and idempotency key. Permissions and policy versions are never inferred from frontend controls.

Formal preparation explains the matching Enhanced/Standard/Light policy conditions and selects the strictest matching tier. Its read-only assessment uses the current effective published group policy before global fallback. The expected latest approval reply is `scope start − preEventConfirmationWindowHours`, exactly when final confirmation opens; display the date, time, time zone and policy hours. Approval validity durations are separate. Passing the expected reply time prompts follow-up without adding a rejection gate. See [EVENT-SETUP-FLOW.md](EVENT-SETUP-FLOW.md) for the shared create/edit form, fixed saved template, arrangement identity and API contracts.

### Canonical generation and submission

Only the current accountable Event owner with approved owning-group membership may generate or submit the formal Package. Accepted `event.lead`, ordinary team membership, group leadership, platform approval permission and temporary approval delegation do not themselves grant submission authority. The capability projection and command use the same current owner/membership check. This owner-only submission rule was explicitly confirmed on 2026-09-22; historical submissions/decisions remain unchanged. Standard/enhanced independent approval and onsite execution roles keep their existing boundaries.

Lifecycle guidance for missing/expired Packages and generation of occurrence reviews identifies `event.accountableOwner`, not the onsite lead, as the responsible role. Generating/submitting for review is never described as the owner granting approval.

The server validates `If-Match` for the current Event Plan, reads only system-defined module contribution contracts, orders source references deterministically, canonicalises JSON, and calculates `sourceVectorHash` and `contentHash`. The Package schema, policy, Plan, source vector, scope, and content all participate in the hash contract. Before commit, every required source version is revalidated. A changed source returns `event.package.sourceChanged`; a retry with the same idempotency key and request hash returns the same result, while key reuse with different input is rejected.

A draft may be regenerated. Submission freezes the Package. Returned or rejected content is never edited in place; corrected source data produces a new Package version. Historical templates, policies, source summaries, decisions, and hashes are not rewritten.

### Package lifecycle, decisions, and conditions

Withdrawal of a draft/submitted Package is distinct from revoking an approval. It requires current authorized Package access and being its generator, its submitter, or the current accountable Event owner. Group leadership alone does not grant withdrawal. This clarification preserves the existing implementation and was confirmed on 2026-09-22; `canWithdraw` uses the same scope/actor boundary and version checks still apply.

Package lifecycle values are `draft`, `submitted`, `returnedForAmendment`, `rejected`, `approvedWithConditions`, `approved`, `withdrawn`, and `superseded`. `Under Review` is the user-facing label for `submitted` unless a later contract introduces a real review-claim transition. History queries are server-paged and can filter by status and exact Event/Occurrence scope without changing which Package is current.

Approval validity values are `notDecided`, `active`, `invalidated`, `expired`, and `revoked`. Only the machine-contract-approved combination of lifecycle and validity can satisfy a gate. Source-decision revocation/expiry, a governance-critical change, policy expiry, or an expired required condition recalculates validity immediately. Revocation and correction append new decisions; they never update the original decision.

Decision types are `approve`, `approveWithConditions`, `returnForAmendment`, `reject`, `revoke`, and the dedicated `conditionWaiver` exception decision. Revocation and condition waiver use separate append-only endpoints and cannot be smuggled through the ordinary decision command. Every decision binds Event, scope, Plan version, Package version, content hash, authenticated actor, authority snapshot, UTC time, and bilingual reason where a reason is required.

Condition states are `open`, `evidenceSubmitted`, `verified`, `rejected`, `expired`, and `waived`. Conditions record affected gates, bilingual text, owner role, due time, minimum evidence reference, satisfaction actor/time, verification actor/time, and a linked restricted Readiness task. Evidence submission is not verification. An overdue unresolved condition is persisted as `expired`, audited without copying evidence content, and immediately recalculates every affected gate. Waiver exists only when the immutable governing policy explicitly enables it and policy-resolved authority is independent from the condition owner and evidence actors. Condition state projects one-way into its task; completing or editing the task cannot mark the condition verified or create a decision.

### Lifecycle gates

One evaluator returns `gate`, scope, `allowed`, evaluated time, Plan/Package/policy versions, stable blockers and warnings, bilingual messages, responsible role, and next-action code. A protected, viewer-specific Package capability projection recomputes Package, lifecycle, delegation, and per-condition actions from current server authority; frontends never infer permission from display text or expose controls merely because a Package is visible.

- Publish requires an active approved current Package, verified publish conditions, current specialist decisions, approved sponsorship when required, approved public copy/assets, no publication blocker, and an authorised explicit Publish command.
- Registration requires the applicable Package gate, enabled and complete registration configuration, capacity, deadline, privacy notice and consent, current RAM/safeguarding/sponsorship decisions, and an authorised explicit Open Registration command.
- Payment or fee acceptance, whenever implemented, additionally requires the Registration gate and current Finance approval/policy. Missing payment capability remains unavailable; this contract does not add a provider.
- Execute requires an active Package and specialist decisions, verified execute conditions, critical roles/evidence, no safety blocker, and an Event Lead confirmation made within the policy-defined pre-event window for the exact scope and Package version. An Event baseline can support an unaffected covered occurrence, but an open occurrence review returns `event.execute.occurrenceReviewRequired` until an approved occurrence Package resolves it.

Before Publish, public Event lists, public projections, search/SEO metadata, sitemaps, shared caches, anonymous URLs, and usable QR codes expose nothing. Draft copy, posters, and forms remain protected previews. An old URL cannot accept a registration while the Registration gate is closed.

If an already published or registration-open Event loses approval, policy chooses from `blockNewPublication`, `withdrawPublicProjection`, `pauseRegistration`, `blockExecution`, and `requireHumanNotificationReview`. Safety-critical or unclassified governance changes fail closed. Existing enrolments and audit history are preserved. Cancellation, postponement, unpublish, registration close, and reopen are explicit authorised, idempotent, audited commands with cache invalidation.

Governance policies are immutable published versions managed through the dedicated `admin.events.managePackagePolicies` permission. Publishing a replacement retires the prior effective version, is idempotent and audited, and invalidates affected active approvals without rewriting their history. Approval validity durations come from that policy. Delegation is disabled unless the bound policy explicitly enables it for the Package tier; a delegation records organisation, Event/Occurrence scope, delegate, permission, start/end, grantor, revocation, concurrency token and audit history. The delegate must remain an approved organisation member, and delegation never bypasses submitter or specialist-author separation. During `dryRun`, lifecycle commands persist non-sensitive would-block reason codes in audit metadata; the policy workspace aggregates those observations over a bounded window before administrators choose `enforced`.

### Material change and re-approval

Change evaluation is policy-versioned and produces field-level differences, classification, affected scopes/modules/specialist decisions, Package validity impact, gate actions, responsible duties, and whether a human-reviewed participant notification is required.

- `cosmetic`: presentation-only changes that do not alter meaning; record history without overall re-approval.
- `operational`: non-governance-critical programme, staffing, or resource changes; revalidate only affected modules or occurrence scope.
- `governanceCritical`: date, venue, capacity, child involvement, transport, accommodation, money flow, visibility, sponsor identity, accountable roles, risk, emergency, or policy-triggering changes; invalidate affected approval and require re-review.

An unknown classification fails closed. Governance-critical RAM, venue, safeguarding, and transport source mutations invalidate only the applicable active Package coverage in the same unit of work, safely withdraw/pause/block bound lifecycle states, notify the accountable owner, and create a required re-review task while preserving enrolments and history. Runtime participant enrolment and child attendance records are not themselves governance source versions. Plan B is not planned. Do not introduce contingency decision cases, timers, fallback actors or automated activation; revise the design guidance if that product decision changes. Existing RAM assessment and mitigation remain separate.

### Privacy, retention, and caching

Packages, decisions, conditions, and source references are `approvalEvidence` and `private, no-store`; role-restricted module data keeps its stricter access rules. Package manifests contain minimum summaries and immutable references, never participant lists, child/health/contact records, passenger manifests, or full financial detail. The manifest carries stable governance trigger reasons, required specialist-decision codes, seven ordered bilingual summary sections, and warnings so reviewers can understand the decision without reading mutable source data. Only approved sanitised public allow-list projections use shared caching.

Immutable audit means retaining the minimum decision chain, identifiers, versions, hashes, reason codes, and authority evidence. It does not authorise permanent retention of personal content. A condition's minimum evidence reference is `approvalEvidence`: it becomes inaccessible 90 days after the later of evidence submission or Event end; the irreversible SHA-256 hash, expiry/unavailable timestamps, actor and decision chain remain. Audit events never copy the reference content. Source modules may impose stricter expiry, deletion or anonymisation on the underlying evidence. Free-text reasons and condition evidence are length-limited and must not invite unnecessary sensitive data.

An occurrence-scoped execution confirmation is persisted on that `EventOccurrence`, bound to its Package, actor, timestamp, enforcement mode and concurrency token. Confirming one occurrence never confirms the Event or sibling occurrences; a local material change invalidates that occurrence confirmation while preserving unrelated occurrence state.

### Compatible rollout

Enforcement modes are `off`, `dryRun`, and `enforced`. Existing Events start as `legacyUnassessed`; they keep current RAM, sponsorship, visibility, and registration behaviour during `dryRun`, while the new evaluator records only non-sensitive differences. A versioned rollout policy classifies each Event as `formalPackageRequired`, `legacyReadOnlyPackage`, `timeLimitedCompatibility`, or `safetyCriticalBlocked`. No classification invents missing facts or approval. Transition deadlines, exceptions, and changes of mode are audited. Rollback changes enforcement behaviour but never deletes Package records or makes a previously invalid Package active.
