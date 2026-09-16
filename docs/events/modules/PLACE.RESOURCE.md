# PLACE.RESOURCE

> Normative module contract. Owns module-specific behavior, authority and compatibility. [Current delivery and gaps](../IMPLEMENTATION-STATUS.md#place-resource) are maintained centrally; [exact machine values](../event-contract.json) remain unchanged. Read only affected sections.

## Collaboration version 1

Version 1 supplies an independent **venue and room catalogue/calendar** under the managing entity's administration. The root church catalogue appears in Church Management; non-church catalogues remain under their group management. An Event may reserve active venues owned by its group or by that group's root church. Catalogue administration is separate from Event ownership and plan editing: church-shared venues remain editable only by root-church catalogue administrators. Single and indefinite local weekly reservations share server conflict checks and venue locks across all using groups; they do not depend on the twelve-week occurrence horizon. Exceptions release/restore one date with reason and actor history; restoration cannot overwrite new bookings. Future-rule changes retain past bookings. DST ambiguity is explicit, never silently free. Calendar titles obey Event visibility; other viewers see Occupied. Equipment inventory remains deferred and standing bookings never extend approval coverage. See [EVENT-WORKSPACES.md](../EVENT-WORKSPACES.md).

## Purpose

Coordinate venue capacity, bookings, equipment, setup, handover, return, and conflicts while keeping legacy Session place data compatible.

## Target contract

### Activation

Required when `place.resourcesRequired == true` (`managed-place-or-resource`).

### Dependencies

`TEAM.WORK`.

### Domain responsibilities

Reusable venues, rooms, authoritative capacity, Event/Occurrence reservations, conflict detection, equipment quantities, setup, close-down, handover, and return history.

### Roles and authority

At least one `resource.coordinator` who is an Event team member. Catalogue authority is scoped to the managing group; reservation authority is scoped to the Event and enforced on the server.

### Data classification

`eventTeam` and `approvalEvidence`; catalogue/reservation management is private/no-store.

### Workflow contribution

`resource.reserve`, `resource.prepare`, `resource.handover`, `resource.close`.

### Readiness

`capacity-sufficient`, `bookings-confirmed`, and `conflicts-resolved`.

### Event Package contribution

Contributes venue/reservation identity and version, occurrence coverage, capacity comparison, booking status, conflict result, setup/resource readiness, and blockers. It does not copy unrelated catalogue or booking data. Event-wide venue, time, or capacity changes invalidate all affected coverage. An occurrence-bound reservation change uses the occurrence source vector, creates a local review/task, invalidates the prior occurrence Package, and preserves unrelated series occurrences until the scoped Package is approved.

### User experience

Coordinators select active venues from the owning group and its root church, see capacity and actual UTC conflicts, reserve or release without deleting history, and recover from stale ETags. Touching half-open boundaries do not conflict.

During [event creation](../CREATION-ARRANGEMENTS.md), the Arrangements page supports inline Yes/No activation and collapsible editing of existing or new group venues, capacity and booking times. Required activation stays locked. Final confirmation validates venue authority, capacity, half-open conflicts and concurrency, then saves venues/reservations atomically with the Event.

Preparation configuration follows the [formal-approval freeze and reopening contract](../EVENT-SETUP-FLOW.md). Approved preparation cannot be edited until reopening is authorised. Operational responses, consent and safety records retain their existing controls.

During saved preparation, the existing authorized tool is embedded directly in **Arrangements → Programme and venue → Venue and resources**. It shares its operational API and permissions with the independent workspace route; there is no separate Team and tools preparation step. See [integrated preparation](../EVENT-SETUP-FLOW.md).

## Operational behavior

venue slice. Reusable venue catalogue/capacity, Event and occurrence reservations, history-preserving release, half-open overlap detection, ETags, idempotency, exact coordinator authorisation, readiness, occurrence-local Package invalidation/review, private APIs, reachable `EventVenueWorkspaceSurface`, and legacy `Session.PlaceJson` compatibility exist.





## Independent venues and rooms

The root church catalogue and calendar is a peer tab immediately after Profile & settings at `/church/manage?section=venues`. Non-church managing groups retain `/groups/:groupId/venues`, and relevant Event work may continue to reach that independent route. Catalogue authority is current group leader/co-leader; owning an Event does not grant it. Event owners and authorized resource coordinators may reserve active venues from the Event's owning group and its root church. They cannot edit root-church venue details unless they separately hold root-church catalogue authority. Parent groups that are not the root church and unrelated churches do not enter the reservable scope. Names, addresses, capacity, kind (`venue`, `room`), time zone and enabled status belong to the managing catalogue. Equipment inventory is deferred.

Acceptance: an authorized root-church manager opening the Venues & rooms tab remains inside Church Management at `/church/manage?section=venues`; the venue directory, capacity controls, recurring calendar, exceptions and history use the root church group identifier without switching to a church-group management page. The tab is on the same single tab row as the other Church Management views and follows Profile & settings.

Acceptance: an authorized child-group Event editor sees active root-church venues marked as church-shared during creation and saved preparation, can reserve them with the same capacity, ETag, recurring-calendar and conflict checks as group-owned venues, and cannot edit their catalogue records. Another church's venues remain unavailable.

Calendars disclose Event names only to authorized viewers; others see Occupied. A weekly booking stores local first date, optional last date, start/end minutes, capacity and time zone. Blank last date is indefinite. Overnight intervals are supported within 24 hours. Calendar expansion uses the requested range (maximum 366 days), independently of the rolling twelve-week Event occurrence horizon. A Sunday morning remains occupied when queried a year later.

Conflict checks cover single/single, single/weekly and weekly/weekly reservations; venue-row locks serialize competing writes. New invalid/ambiguous DST boundaries are explicitly rejected. Legacy unresolved local times are conservatively blocked and visibly flagged rather than treated as available. Single-date release/restore appends actor/time/reason history. Restoring checks new bookings and never overwrites another Event. Changing future dates creates a successor rule and retains the previous rule's past intervals and change reason. Authorized calendar history exposes relevant creation/change records and release/restore records in the selected dates. No long-term reservation extends Package approval validity.


## Saved preparation compatibility

### Shared preparation editor

Saved creation-form edits retain booking IDs, release removed bookings and revalidate venue ETags, capacity and overlapping reservations within Plan acceptance. The occurrence-scoped read and atomic Plan/arrangement save are specified in [EVENT-SETUP-FLOW.md](../EVENT-SETUP-FLOW.md).
