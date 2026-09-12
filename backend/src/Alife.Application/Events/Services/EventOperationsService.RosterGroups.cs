using System.Text.Json;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed partial class EventOperationsService
{
    public async Task<AppResult<IReadOnlyList<EventRosterGroupDto>>> GetRosterGroupsAsync(Guid eventId, Guid memberId, CancellationToken ct)
    {
        var e = await db.GroupEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<IReadOnlyList<EventRosterGroupDto>>.NotFound("Event not found.");
        if (!await CanCoordinate(e, memberId, "roster.coordinator", ct))
            return AppResult<IReadOnlyList<EventRosterGroupDto>>.Forbidden("Roster candidate groups are private to the owner and roster coordinator.");
        var groups = await db.EventRosterGroups.AsNoTracking().Where(x => x.EventId == eventId).OrderBy(x => x.RoleCode).ToListAsync(ct);
        return AppResult<IReadOnlyList<EventRosterGroupDto>>.Success(groups.Select(GroupDto).ToArray());
    }

    public async Task<AppResult<EventRosterGroupDto>> SaveRosterGroupAsync(Guid eventId, Guid memberId, SaveEventRosterGroupRequest request, string? ifMatch, CancellationToken ct)
    {
        var e = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<EventRosterGroupDto>.NotFound("Event not found.");
        if (!await CanCoordinate(e, memberId, "roster.coordinator", ct)) return AppResult<EventRosterGroupDto>.Forbidden("Roster coordinator access is required.");
        if (string.IsNullOrWhiteSpace(request.RoleCode) || request.RoleCode.Length > 120 || request.RoleCode != request.RoleCode.Trim() ||
            request.MemberIds is null || request.MemberIds.Count > 200 || request.MemberIds.Distinct().Count() != request.MemberIds.Count ||
            string.IsNullOrWhiteSpace(request.ModuleCode) || !EventCompositionDefinitions.ModulesByCode.ContainsKey(request.ModuleCode))
            return AppResult<EventRosterGroupDto>.Validation("A valid module, role and up to 200 distinct candidates are required.");
        if (!await IsModuleEnabled(eventId, "SERVICE.ROSTER", ct) || !await IsModuleEnabled(eventId, request.ModuleCode, ct))
            return AppResult<EventRosterGroupDto>.Conflict("Enable roster and the owning module before configuring its candidate group.");
        var group = await db.EventRosterGroups.FirstOrDefaultAsync(x => x.EventId == eventId && x.RoleCode == request.RoleCode, ct);
        if (!string.Equals(ifMatch, group is null ? "\"new\"" : GroupDto(group).ETag, StringComparison.Ordinal))
            return AppResult<EventRosterGroupDto>.PreconditionFailed("The candidate group changed; reload before saving.");
        foreach (var candidate in request.MemberIds)
            if (!await authorization.IsApprovedMemberAsync(e.GroupId, candidate, ct))
                return AppResult<EventRosterGroupDto>.Validation("Every candidate must be an approved member of this Event's owning group.");
        var before = group is null ? "{}" : JsonSerializer.Serialize(GroupDto(group));
        if (group is null) { group = new() { Id = Guid.NewGuid(), EventId = eventId, RoleCode = request.RoleCode }; db.EventRosterGroups.Add(group); }
        group.ModuleCode = request.ModuleCode; group.MemberIdsJson = JsonSerializer.Serialize(request.MemberIds);
        group.ConcurrencyToken = Guid.NewGuid(); group.UpdatedUtc = DateTime.UtcNow;
        // Every occurrence observes candidate-list changes in its roster ETag.
        foreach (var occurrence in await db.EventOccurrences.Where(x => x.EventId == eventId).ToListAsync(ct))
        { occurrence.RosterConcurrencyToken = Guid.NewGuid(); occurrence.UpdatedUtc = DateTime.UtcNow; }
        db.AuditLogs.Add(new() { Id = Guid.NewGuid(), ActorMemberId = memberId, EventId = eventId, GroupId = e.GroupId,
            Action = "event.roster.groupSaved", EntityType = "EventRosterGroup", EntityId = group.Id,
            BeforeJson = before, AfterJson = JsonSerializer.Serialize(GroupDto(group)), MetadataJson = "{}", OccurredUtc = DateTime.UtcNow });
        if (packageInvalidation is not null)
        {
            await packageInvalidation.InvalidateForModuleChangeAsync(e, memberId, "SERVICE.ROSTER", "event.roster.groupSaved", "operational", ct);
            if (request.ModuleCode != "SERVICE.ROSTER")
                await packageInvalidation.InvalidateForModuleChangeAsync(e, memberId, request.ModuleCode, "event.roster.groupSaved", "operational", ct);
        }
        try { if (!await EventPreparationPolicy.SaveEditableAsync(db, eventId, ct)) return AppResult<EventRosterGroupDto>.Conflict(EventPreparationPolicy.FrozenMessage); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventRosterGroupDto>.PreconditionFailed("The candidate group changed while saving."); }
        catch (DbUpdateException) { return AppResult<EventRosterGroupDto>.Conflict("The candidate group was concurrently created or changed; reload."); }
        return AppResult<EventRosterGroupDto>.Success(GroupDto(group));
    }

    private static Guid[] GroupMembers(EventRosterGroup group) => JsonSerializer.Deserialize<Guid[]>(group.MemberIdsJson) ?? [];
    private static EventRosterGroupDto GroupDto(EventRosterGroup group) => new(group.RoleCode, group.ModuleCode, GroupMembers(group), $"\"roster-group-{group.ConcurrencyToken:N}\"");
    private async Task<EventRosterDto> RosterDtoAsync(EventOccurrence occurrence, Guid memberId, bool canManage, CancellationToken ct)
    {
        var result = ToRosterDto(occurrence, memberId, canManage);
        var groups = await db.EventRosterGroups.AsNoTracking().Where(x => x.EventId == occurrence.EventId).ToListAsync(ct);
        var enabled = new HashSet<string>();
        foreach (var module in result.Slots.Select(slot => groups.FirstOrDefault(x => x.RoleCode == slot.RoleCode)?.ModuleCode ?? RosterModuleForRole(slot.RoleCode)).Distinct())
            if (await IsModuleEnabled(occurrence.EventId, module, ct)) enabled.Add(module);
        return result with { Slots = result.Slots.Select(slot => {
            var group = groups.FirstOrDefault(x => x.RoleCode == slot.RoleCode);
            var members = group is null ? [] : GroupMembers(group);
            var target = group?.ModuleCode ?? RosterModuleForRole(slot.RoleCode);
            return slot with { ModuleCode = enabled.Contains(target) ? target : "SERVICE.ROSTER",
                CandidateMemberIds = canManage ? members : [], IsRosterCandidate = members.Contains(memberId) };
        }).ToArray() };
    }

    public static string RosterModuleForRole(string role) => role switch
    {
        "welcome.team" or "checkin.team" or "registration.desk" or "front.of.house" => "PEOPLE.REGISTRATION",
        "setup.team" or "cleanup.team" or "site.team" => "PLACE.RESOURCE",
        "transport.coordinator" => "MOVE.STAY",
        _ when role.StartsWith("hospitality.", StringComparison.Ordinal) => "FOOD.HOSPITALITY",
        "programme.team" or "worship.team" or "av.operator" or "stage.team" or "event.host" or "production.lead" => "PROGRAM.PRODUCTION",
        "event.lead" or "outing.lead" or "activity.lead" or "camp.director" or "retreat.lead" or "training.lead" or "facilitator.team" or "gathering.host" or "discussion.facilitator" or "service.lead" or "course.facilitator" or "prayer.lead" or "celebration.lead" or "outreach.lead" => "TEAM.WORK",
        _ => EventCompositionDefinitions.Modules.SelectMany(m => m.RoleRequirements.Select(r => new { m.Code, r.RoleCode }))
            .FirstOrDefault(r => r.RoleCode == role)?.Code ?? "SERVICE.ROSTER"
    };
}
