# Event creation arrangements

> Documentation class: **Normative feature contract**. Read with [EVENT-CONTRACT.md](EVENT-CONTRACT.md), [event-contract.json](event-contract.json), and the three affected module specifications. Delivery and verification belong in [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md).

## User flow

The Arrangements step gives each optional module an explicit Yes/No choice. Server-required modules remain locked. Choosing a tool never confirms a factual answer; candidate and unknown facts remain separate. SERVICE.ROSTER, PROGRAM.PRODUCTION and PLACE.RESOURCE expand inline when enabled, and can be collapsed without losing edits.

- Roles and shifts: start with template slot demand; edit role, required count and shift times, add or remove slots. These are unassigned slots, not evidence of eligibility or staffing readiness.
- Programme and production: add bilingual sessions, start/end times, ordered bilingual programme items, session-relative start minutes, duration and optional bilingual notes.
- Venue and resources: select an active venue in the owning group's catalogue, or enter a new bilingual venue with address and capacity, then specify attendance and booking times. New venues join that group's catalogue only upon successful event creation.

Each enabled editor must contain at least one complete row before the wizard proceeds. Each programme session must contain at least one item. A same-page summary updates as the user edits; Review repeats it for final human confirmation. Choosing No retains the local draft but excludes its rows from creation. Returning to previous steps, reloading a scoped draft, or switching templates preserves explicit arrangement edits; unedited role defaults follow the template. Language-only switches do not refetch composition or venue data.

These initial editors cover slot demand, programme structure and venue reservations. Member invitations/assignments, production cues and equipment workflows retain their separate module contracts. Creating arrangements does not publish an event, approve a Package, establish safety facts or bypass lifecycle gates.

## Additive creation request

After successful creation, the [continuous preparation flow](EVENT-SETUP-FLOW.md) continues team and tool setup on the same saved Event before poster preparation, formal approval and explicit publication. Composition-backed creation starts unpublished with registration closed.

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

Group creation authority is checked on the server before processing details. The same final database save commits Event, occurrence(s), RAM draft, fact set, accepted Plan, operational rows, new venues, venue token updates and the creation idempotency record. Validation or conflict failures must not leave a partially created event. Arrangements participate in the creation request hash; identical retries return the original event, and changed content under an already-used key conflicts. Requests omitting arrangements retain their pre-feature hash shape.

Arrangement rows use the existing operational tables and protected module read APIs. They are not embedded in public `EventDataJson`, the Plan snapshot, or AI details prompts. Existing data-class and private/no-store rules remain; group event cache invalidation still follows successful creation. No schema migration or extra provider is needed.

The client retains all drafts after a failed create. A conflict or stale ETag returns to Arrangements for review; the venue list can be refreshed, and changed content requires a new reviewed submission. A network retry of unchanged content preserves its idempotency key. Availability can change after the Arrangements page, so final creation rechecks venue conflicts.

## Acceptance scenarios

1. Required Team and tasks cannot be turned off; optional tools expose Yes/No beside their title.
2. Choosing Yes opens the relevant editor on Arrangements. Collapse, No→Yes, back navigation and scoped draft recovery retain entered data.
3. Incomplete enabled roles, programme or venue details block leaving Arrangements; the summary reflects the corrected values before Review.
4. Human confirmation stores all valid rows together, and retrying produces no duplicate operational rows.
5. Inactive/foreign venues, stale ETags, insufficient capacity, invalid programme durations and overlapping reservations fail without partial creation; adjacent booking intervals succeed.
6. Chinese and English remain usable at 320px, 768px and 1280px with accessible labels and keyboard-operable choices/expansion.
