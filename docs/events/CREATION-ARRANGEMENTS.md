# Event creation arrangements

> Documentation class: **Normative feature contract**. Read with [EVENT-CONTRACT.md](EVENT-CONTRACT.md), [event-contract.json](event-contract.json), and the affected module specifications. Delivery and verification belong in [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md).

## User flow

The Arrangements step gives modules an explicit Yes/No choice; server dependencies remain enforced. Module choices replace the former duplicate fact questionnaires, as described below. SERVICE.ROSTER, PROGRAM.PRODUCTION, PLACE.RESOURCE and RAM risk fields render inline when enabled. All groups and module headers expose a top-right expand/collapse button with aria-expanded/aria-controls; hiding retains mounted content. Safety contains Child safeguarding and the inline RAM assessment.

- Roles and shifts: start with template slot demand; edit role, required count and shift times, add or remove slots. These are unassigned slots, not evidence of eligibility or staffing readiness.
- Programme and production: add bilingual sessions, start/end times, ordered bilingual programme items, session-relative start minutes, duration and optional bilingual notes.
- RAM and safety: record activities, hazards, consequences, initial/residual assessments and controls in the shared RAM fields. New Event drafts stay in component memory and are excluded from localStorage and AI snapshots. Explicit Create persists the private RAM draft with the Event; published church questions and personal/reviewer actions continue after creation. Saved Arrangements embeds the complete versioned RAM workspace.
- Venue and resources: select an active venue in the owning group's catalogue, or enter a new bilingual venue with address and capacity, then specify attendance and booking times. New venues join that group's catalogue only upon successful event creation.

Each enabled roles/programme/venue editor must contain at least one complete row before the wizard proceeds. RAM can remain an incomplete draft at creation and cannot be treated as approved or low risk. Each programme session must contain at least one item. A same-page summary updates as the user edits; Review repeats it for final human confirmation. Choosing No retains the local draft but excludes its rows from creation. Returning to previous steps, reloading a scoped draft, or switching templates preserves explicit arrangement edits; unedited role defaults follow the template. Language-only switches do not refetch composition or venue data.

These initial editors cover slot demand, programme structure and venue reservations. Member invitations/assignments, production cues and equipment workflows retain their separate module contracts. Creating arrangements does not publish an event, approve a Package, certify safety or bypass lifecycle gates.

## Additive creation request

After successful creation, the [continuous preparation flow](EVENT-SETUP-FLOW.md) continues team and tool setup on the same saved Event before poster preparation, formal approval and explicit publication. Composition-backed or version-2-RAM creation starts unpublished with registration closed.

`POST /api/groups/{groupId}/events` accepts optional `arrangements` alongside the existing composition proposal and idempotency key. Existing payloads remain compatible. When supplied, arrangements require a valid accepted composition, and nonempty row lists require the corresponding active module in the server-recomputed plan.

```text
arrangements.serviceSlots[]
  roleCode, requiredCount, eligibilityCode, startOffsetMinutes, endOffsetMinutes
arrangements.sessions[]
  title: { en, zh }, startOffsetMinutes, endOffsetMinutes
  items[]: title: { en, zh }, description?: { en, zh }, startOffsetMinutes, durationMinutes
arrangements.venueBookings[]
  venueId?, venueETag?, newVenue?: { name: { en, zh }, address?: { en, zh }, capacity, isActive }
  requiredCapacity, startOffsetMinutes, endOffsetMinutes
```

All slot/session/booking times are whole-minute offsets from the occurrence's UTC start. The browser resolves entered local dates using the visible event time zone, including daylight-saving transitions. Programme item offsets are relative to their session. For a series, offsets apply to each occurrence materialized in the initial rolling 12-week window. They do not establish a stored recurring arrangement template for later rolling generation; subsequent changes remain occurrence scoped.

Limits: 50 slots, 20 sessions, 50 items per session, 20 venue bookings. Roles are nonblank and at most 100 characters; counts are integers from 1 to 10,000. Eligibility uses the existing `approvedGroupMember`, `acceptedEventTeamMember` or nonempty `acceptedRole:` reference (maximum 120 characters). Titles/venue names require both languages, at most 240 characters each; optional programme notes at most 2,000 each; addresses at most 1,000 each. Capacities are positive integers up to 1,000,000. Start/end offsets must lie between -10,080 and 44,640 minutes with end after start. Programme item start is nonnegative and positive duration must fit its session.

Each booking specifies exactly one existing venue or new venue. Existing venue selection requires its current ETag, owning-group membership and active status. Required attendance must fit the authoritative capacity. Confirmed bookings use half-open intervals: touching boundaries are allowed, overlapping boundaries fail. Initial series occurrences and multiple bookings in the same request are checked against each other and existing reservations. The venue concurrency token participates in the final write to detect competing bookings.

When `serviceSlots` is omitted/null, legacy preset generation remains available. An explicit array replaces template slots; an empty array creates none. The wizard requires nonempty rows for enabled editors, while compatible API clients may still create an empty operational plan and prepare it later. Disabled editors send empty arrays. Sessions and bookings default to none when omitted.

## Persistence, privacy and failure

Group creation authority is checked on the server before processing details. Version 2 in the existing private `ramDataJson` is parsed and server-evaluated against only the owning church’s latest published policy (or no policy). Claimed scores/colours are replaced; the authenticated creator is the author, and Draft status carries no confirmation or approval. Unsupported versions or malformed arrays fail before persistence. Legacy RAM payloads remain compatible.

The same final database save commits Event, occurrence(s), RAM draft, fact set, accepted Plan, operational rows, new venues, venue token updates and the creation idempotency record. Validation or conflict failures must not leave a partially created event. Arrangements participate in the creation request hash; identical retries return the original event, and changed content under an already-used key conflicts. Requests omitting arrangements retain their pre-feature hash shape.

Arrangement rows use the existing operational tables and protected module read APIs. They are not embedded in public `EventDataJson`, the Plan snapshot, or AI details prompts. Existing data-class and private/no-store rules remain; group event cache invalidation still follows successful creation. No schema migration or extra provider is needed.

The client retains all drafts after a failed create, including the memory-only RAM draft. Reload/closing cannot recover an uncreated RAM draft from localStorage; leaving prompts about its loss. Disabling RAM keeps its draft and does not exempt formal RAM requirements. Saved inline RAM must be saved before step changes or Event arrangement saves, and its save refreshes the Event timestamp without replacing unsaved Event edits. A conflict or stale ETag returns to Arrangements for review; the venue list can be refreshed, and changed content requires a new reviewed submission. A network retry of unchanged content preserves its idempotency key. Availability can change after the Arrangements page, so final creation rechecks venue conflicts.

## Acceptance scenarios

1. Required Team and tasks cannot be turned off; optional tools expose Yes/No beside their title.
2. Choosing Yes opens the relevant editor on Arrangements. Collapse, No→Yes, back navigation and scoped draft recovery retain entered data.
3. Incomplete enabled roles, programme or venue details block leaving Arrangements; the summary reflects the corrected values before Review.
4. Human confirmation stores all valid rows together, and retrying produces no duplicate operational rows.
5. Inactive/foreign venues, stale ETags, insufficient capacity, invalid programme durations and overlapping reservations fail without partial creation; adjacent booking intervals succeed.
6. Chinese and English remain usable at 320px, 768px and 1280px with accessible labels and keyboard-operable choices/expansion.

## Integrated saved arrangements

After explicit Create, the same Arrangements groups embed the existing authorized team, enrollment, roster, programme, venue, safeguarding and travel tools alongside RAM. There is no separate Team and tools preparation step. Initial creation fields remain for demand/programme/venue/RAM; Event-ID-dependent invitations and assignments continue here after creation. Saved operational editors own their row writes; accepting module/fact selections omits arrangement arrays and preserves these records. Collapse and saved-step navigation keep the editors mounted. See [the preparation flow](EVENT-SETUP-FLOW.md).


## Section confirmation and module roles

Each arrangement group has one Confirmed checkbox, initially false, beside its disclosure control. Module Yes/No choices replace the duplicate Pending/Yes/No fact questionnaires. Checking a section acknowledges its visible module choices. Tool selection and section review do not establish factual evidence; existing confirmed facts are preserved even when their tool is disabled during preparation. Template presets alone remain suggestions. MOVE.STAY covers both transport and lodging, so selecting or confirming it does not invent either underlying fact. Unchecked sections remain visibly pending regardless of module choices and may be saved or created as drafts. Existing server dependency, safety and approval checks still apply.

Roles are generated by the server from enabled modules and shown/invited in the corresponding module. Disabled modules stop requesting roles but retain historical assignments. The Event accountable owner remains global, retaining its existing TEAM.WORK:event.accountableOwner key for compatibility. Before creation, roles show as unassigned and the creator is the default owner; invitations require the saved Event and personal acceptance. Review lists group confirmation states and module role assignments/statuses.

Composition requests and accepted Plan JSON add optional arrangementConfirmations (people, safety, programme, travel, food, money, followup). Flags participate in the proposal hash and existing ETag/idempotent acceptance; old snapshots remain readable, and old requests cannot omit this field once present. There is no new database migration. Editing a group resets its confirmation; details/template changes reset previous group reviews. Operational invalidation records a private event.arrangements.changed audit entry, and the current Plan read projects affected flags to false after its acceptance time. Immutable historical snapshots remain unchanged. Section confirmation is an organizer review marker, not a personal role acceptance, RAM signature, readiness certificate or approval; it introduces no additional formal approval gate.
