using System.Text.Json;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed partial class EventOperationsService
{
    public async Task<AppResult<EventRosterPageDto>> GetRosterPageAsync(Guid eventId, Guid memberId, int page, CancellationToken ct, Guid? focusOccurrenceId = null)
    {
        if (page < 1 || page > 10000) return AppResult<EventRosterPageDto>.Validation("Invalid page.");
        var e = await db.GroupEvents.AsNoTracking().Include(x => x.EventSeries).FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<EventRosterPageDto>.NotFound("Event not found.");
        if (!await authorization.IsApprovedMemberAsync(e.GroupId, memberId, ct)) return AppResult<EventRosterPageDto>.Forbidden("Current group membership is required.");
        var manage = await CanCoordinate(e, memberId, "roster.coordinator", ct);
        if (!await IsModuleEnabled(eventId, "SERVICE.ROSTER", ct)) return AppResult<EventRosterPageDto>.Conflict("Roster is not enabled.");
        var groups = await db.EventRosterGroups.AsNoTracking().Where(x => x.EventId == eventId).ToListAsync(ct);
        if (!manage && !groups.Any(x => GroupMembers(x).Contains(memberId)) &&
            !await db.EventRosterAssignments.AnyAsync(x => x.ServiceSlot.Occurrence.EventId == eventId && x.MemberId == memberId && x.EndedUtc == null, ct))
            return AppResult<EventRosterPageDto>.Forbidden("Roster access is limited to coordinators, candidates and assignees.");
        var query = db.EventOccurrences.AsNoTracking().Where(x => x.EventId == eventId && x.EndUtc >= DateTime.UtcNow && x.Status != EventOccurrenceStatus.Cancelled);
        var total = await query.CountAsync(ct);
        if (focusOccurrenceId.HasValue)
        {
            var target = await query.Where(x => x.Id == focusOccurrenceId).Select(x => (DateTime?)x.StartUtc).SingleOrDefaultAsync(ct);
            if (target is null) return AppResult<EventRosterPageDto>.NotFound("This date has ended, was cancelled, or is no longer available. / 此场次已结束、已取消或不可用。");
            page = await query.CountAsync(x => x.StartUtc < target.Value, ct) / 4 + 1;
        }
        var ids = await query.OrderBy(x => x.StartUtc).ThenBy(x => x.Id).Skip((page - 1) * 4).Take(4).Select(x => x.Id).ToListAsync(ct);
        var occurrences = new List<EventRosterPageOccurrence>();
        foreach (var id in ids)
        {
            var occurrence = await RosterQuery(eventId, id).AsNoTracking().FirstAsync(ct);
            occurrences.Add(new(id, occurrence.StartUtc, occurrence.EndUtc, await RosterDtoAsync(occurrence, memberId, manage, ct)));
        }
        var personIds = manage ? groups.SelectMany(GroupMembers).Concat(occurrences.SelectMany(x => x.Roster.Slots).SelectMany(x => x.Assignments).Select(x => x.MemberId)).Distinct().ToArray() : new[] { memberId };
        var people = await db.Members.AsNoTracking().Where(x => personIds.Contains(x.Id)).Select(x => new EventRosterPersonDto(x.Id, x.DisplayName ?? "Member")).ToListAsync(ct);
        var defaults = await db.EventRosterDefaults.AsNoTracking().Where(x => x.EventId == eventId).OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
        return AppResult<EventRosterPageDto>.Success(new(page, 4, total, e.EventSeries?.TimeZone ?? "UTC", occurrences,
            manage ? groups.Select(GroupDto).ToArray() : [], people, manage, defaults?.Version, DefaultsETag(defaults),
            manage && !await EventPreparationPolicy.IsFrozenAsync(db, eventId, ct), e.EventSeriesId.HasValue));
    }

    public async Task<AppResult<IReadOnlyList<EventRosterDto>>> ApplyRosterBatchAsync(Guid eventId, Guid memberId,
        EventRosterBatchRequest request, string? key, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key) || key.Length > 120 || request.Changes is null || request.Changes.Count is < 1 or > 200 || request.Changes.Any(x => x is null))
            return AppResult<IReadOnlyList<EventRosterDto>>.Validation("An idempotency key and 1–200 changes are required.");
        await using var tx = await db.BeginSerializableTransactionAsync(ct);
        await db.LockEventRegistrationAsync(eventId, ct);
        var e = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<IReadOnlyList<EventRosterDto>>.NotFound("Event not found.");
        if (!await CanCoordinate(e, memberId, "roster.coordinator", ct)) return AppResult<IReadOnlyList<EventRosterDto>>.Forbidden("Current roster coordinator permission is required.");
        var hash = EventPackageCanonicalizer.HashCanonical(new { memberId, request });
        var replay = await db.EventIdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(x => x.ScopeId == eventId && x.Operation == "event.roster.batch" && x.Key == key, ct);
        if (replay is not null && replay.RequestHash != hash) return AppResult<IReadOnlyList<EventRosterDto>>.Conflict("The idempotency key belongs to a different batch.");
        var occurrences = new Dictionary<Guid, EventOccurrence>();
        foreach (var id in request.Changes.Select(x => x.OccurrenceId).Distinct())
        {
            var occurrence = await RosterQuery(eventId, id).FirstOrDefaultAsync(ct);
            if (occurrence is null) return AppResult<IReadOnlyList<EventRosterDto>>.NotFound("An occurrence is unavailable.");
            occurrences.Add(id, occurrence);
        }
        if (replay is not null) return await BatchResult();
        if (!await IsModuleEnabled(eventId, "SERVICE.ROSTER", ct)) return AppResult<IReadOnlyList<EventRosterDto>>.Conflict("Roster is not enabled.");
        var frozen = await EventPreparationPolicy.IsFrozenAsync(db, eventId, ct);
        var ordinaryAllowed = await EventRosterPolicy.AllowsOrdinaryStaffingAsync(db, eventId, ct);
        var groups = await db.EventRosterGroups.Where(x => x.EventId == eventId).ToListAsync(ct);
        var simulated = occurrences.Values.SelectMany(x => x.ServiceSlots).ToDictionary(x => x.Id,
            x => x.Assignments.Where(a => a.EndedUtc == null).ToDictionary(a => a.Id, a => a.MemberId));
        var changes = new List<(EventRosterBatchChange Change, EventOccurrence Occurrence, EventServiceSlot Slot, EventRosterGroup Group, EventRosterAssignment? Old)>();
        var now = DateTime.UtcNow;
        foreach (var change in request.Changes)
        {
            var occurrence = occurrences[change.OccurrenceId];
            var slot = occurrence.ServiceSlots.FirstOrDefault(x => x.Id == change.SlotId);
            if (slot is null || occurrence.Status == EventOccurrenceStatus.Cancelled || occurrence.EndUtc <= now)
                return AppResult<IReadOnlyList<EventRosterDto>>.Conflict("The occurrence or position is no longer available.");
            var group = groups.FirstOrDefault(x => x.RoleCode == slot.RoleCode);
            if (!Matches(change.OccurrenceETag, RosterETag(occurrence)) || group is null || !Matches(change.CandidateGroupETag, GroupDto(group).ETag))
                return AppResult<IReadOnlyList<EventRosterDto>>.PreconditionFailed("A date or candidate group changed. No part of this batch was saved or notified. / 场次或候选组已改变，整批未保存、未发通知。");
            if (frozen && (!ordinaryAllowed || EventRosterPolicy.IsCritical(slot.RoleCode, slot.EligibilityCode, group.ModuleCode)))
                return AppResult<IReadOnlyList<EventRosterDto>>.Conflict(EventPreparationPolicy.FrozenMessage);
            if (!await IsModuleEnabled(eventId, group.ModuleCode, ct)) return AppResult<IReadOnlyList<EventRosterDto>>.Conflict("The position's module is disabled.");
            var active = simulated[slot.Id];
            EventRosterAssignment? old = null;
            if (change.ReplacesAssignmentId.HasValue)
            {
                old = slot.Assignments.FirstOrDefault(x => x.Id == change.ReplacesAssignmentId && x.EndedUtc == null);
                if (old is null || !active.Remove(old.Id)) return AppResult<IReadOnlyList<EventRosterDto>>.Conflict("A replaced assignment is no longer active or appears twice in the batch.");
            }
            if (change.MemberId is { } candidate)
            {
                if (!GroupMembers(group).Contains(candidate) || !await IsEligibleForSlot(e, slot, candidate, ct))
                    return AppResult<IReadOnlyList<EventRosterDto>>.Forbidden("Choose a currently eligible member of this position's candidate group. / 请选择此岗位候选组中当前合资格的成员。");
                if (slot.Availability.Any(x => x.MemberId == candidate && x.Status == EventAvailabilityStatus.Unavailable))
                    return AppResult<IReadOnlyList<EventRosterDto>>.Conflict("The candidate marked this position unavailable.");
                if (active.Values.Contains(candidate) || active.Count >= slot.RequiredCount)
                    return AppResult<IReadOnlyList<EventRosterDto>>.Conflict("Duplicate or excess staffing is not allowed. Pending and confirmed invitations both reserve a position. / 不可重复或超额安排，待确认和已确认均占岗位人数。");
                active.Add(Guid.NewGuid(), candidate);
            }
            else if (old is null) return AppResult<IReadOnlyList<EventRosterDto>>.Validation("A cancellation must identify an active assignment.");
            changes.Add((change, occurrence, slot, group, old));
        }
        foreach (var (change, occurrence, slot, group, old) in changes)
        {
            if (old is not null)
            {
                old.Status = EventRosterAssignmentStatus.Ended; old.EndedUtc = now; old.UpdatedUtc = now;
                RosterNotification(e, occurrence, slot, old, memberId, old.MemberId, "ended", now);
            }
            if (change.MemberId is { } candidate)
            {
                var assignment = new EventRosterAssignment { Id = Guid.NewGuid(), ServiceSlotId = slot.Id, MemberId = candidate,
                    AssignedByMemberId = memberId, ReplacesAssignmentId = old?.Id, Status = EventRosterAssignmentStatus.Invited, CreatedUtc = now, UpdatedUtc = now };
                slot.Assignments.Add(assignment); db.EventRosterAssignments.Add(assignment);
                RosterNotification(e, occurrence, slot, assignment, memberId, candidate, "invited", now);
            }
            occurrence.RosterConcurrencyToken = Guid.NewGuid(); occurrence.UpdatedUtc = now;
            // Also conflicts with a candidate removal on another date; v2 approval hashes the configuration itself.
            group.ConcurrencyToken = Guid.NewGuid();
            if (EventRosterPolicy.IsCritical(slot.RoleCode, slot.EligibilityCode, group.ModuleCode) || !ordinaryAllowed)
            {
                if (packageInvalidation is not null) await packageInvalidation.InvalidateForModuleChangeAsync(e, memberId, "SERVICE.ROSTER", "event.roster.changed", "operational", ct);
                await InvalidateRosterRoleModuleAsync(occurrence, memberId, slot.RoleCode, ct);
            }
        }
        db.EventIdempotencyRecords.Add(new() { Id = Guid.NewGuid(), Operation = "event.roster.batch", ScopeId = eventId, Key = key, RequestHash = hash, ResultEntityId = eventId, CreatedUtc = now });
        try { await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<IReadOnlyList<EventRosterDto>>.PreconditionFailed("A concurrent change prevented the entire batch. Reload and review the retained draft."); }
        return await BatchResult();

        async Task<AppResult<IReadOnlyList<EventRosterDto>>> BatchResult()
        {
            var result = new List<EventRosterDto>();
            foreach (var occurrence in occurrences.Values) result.Add(await RosterDtoAsync(occurrence, memberId, true, ct));
            return AppResult<IReadOnlyList<EventRosterDto>>.Success(result);
        }
    }

    private void RosterNotification(GroupEvent e, EventOccurrence occurrence, EventServiceSlot slot, EventRosterAssignment assignment,
        Guid actor, Guid recipient, string action, DateTime now)
    {
        var label = EventCompositionDefinitions.ServiceSlotLabel(slot.RoleCode);
        var heading = action switch { "invited" => new LocalizedTextDto("Roster invitation", "排班邀请"), "ended" => new("Roster assignment ended", "排班安排已结束"), "confirmed" => new("Roster invitation accepted", "排班邀请已接受"), _ => new("Roster invitation declined", "排班邀请已拒绝") };
        db.NotificationMessages.Add(new() { Id = Guid.NewGuid(), RecipientMemberId = recipient, CreatedByMemberId = actor,
            EventId = e.Id, GroupId = e.GroupId, OccurredUtc = now, CreatedUtc = now, UpdatedUtc = now, ActionType = $"event.roster.{action}",
            ActionDataJson = JsonSerializer.Serialize(new { eventId = e.Id, occurrenceId = occurrence.Id, assignmentId = assignment.Id,
                startUtc = slot.StartUtc, endUtc = slot.EndUtc, role = new { en = label.En, zh = label.Zh },
                title = new { en = heading.En, zh = heading.Zh }, body = new { en = $"{e.TitleEn} · {label.En} · {slot.StartUtc:yyyy-MM-dd HH:mm} UTC. Open to review this assignment.", zh = $"{e.TitleZh} · {label.Zh} · {slot.StartUtc:yyyy-MM-dd HH:mm} UTC。请打开查看安排。" },
                actionUrl = $"/events/{e.Id}/workspace/roster?occurrenceId={occurrence.Id}&assignmentId={assignment.Id}" }) });
    }

    private static string DefaultsETag(EventRosterDefaults? value) => value is null ? "\"new\"" : $"\"roster-defaults-{value.Id:N}\"";
}
