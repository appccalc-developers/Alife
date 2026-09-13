using Alife.Application.Common.Interfaces;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public static class EventRosterPolicy
{
    public const int CurrentVersion = 2;
    public static bool IsCritical(string role, string eligibility, string? module = null) =>
        eligibility is not "approvedGroupMember" and not "acceptedEventTeamMember" ||
        module is "SAFETY.RAM" or "SAFEGUARDING.CHILD" or "MOVE.STAY" or "FESTIVAL.OPERATIONS" ||
        role.StartsWith("ram.", StringComparison.OrdinalIgnoreCase) || role.StartsWith("safety.", StringComparison.OrdinalIgnoreCase) ||
        role.StartsWith("safeguarding.", StringComparison.OrdinalIgnoreCase) || role.StartsWith("child.", StringComparison.OrdinalIgnoreCase) ||
        role.Contains("transport", StringComparison.OrdinalIgnoreCase) || role.Contains("driver", StringComparison.OrdinalIgnoreCase) ||
        role.Contains("command", StringComparison.OrdinalIgnoreCase) || role.Contains("onsite", StringComparison.OrdinalIgnoreCase) ||
        role.EndsWith(".lead", StringComparison.OrdinalIgnoreCase) || role.EndsWith(".director", StringComparison.OrdinalIgnoreCase);

    public static async Task<bool> AllowsOrdinaryStaffingAsync(IAlifeDbContext db, Guid eventId, CancellationToken ct)
    {
        var frozen = await EventPreparationPolicy.FrozenPackages(db, eventId).AsNoTracking().ToListAsync(ct);
        return frozen.Count == 0 || frozen.All(x => x.RosterRulesVersion >= CurrentVersion);
    }

    public static async Task<bool> IsReadyForExecutionAsync(IAlifeDbContext db, GroupEvent e, Guid? occurrenceId, CancellationToken ct)
    {
        var slots = await db.EventServiceSlots.AsNoTracking().Include(x => x.Assignments).Include(x => x.Availability).Where(x => x.Occurrence.EventId == e.Id &&
            x.Occurrence.Status != EventOccurrenceStatus.Cancelled && (!occurrenceId.HasValue || x.OccurrenceId == occurrenceId)).ToListAsync(ct);
        if (slots.Count == 0)
        {
            var snapshot = await db.EventPlanSnapshots.AsNoTracking().Where(x => x.EventId == e.Id && x.IsActive).OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
            if (snapshot is not null && EventCompositionPersistence.ToSnapshotDto(snapshot).Plan.ModuleDecisions.Any(x =>
                x.ModuleCode == "SERVICE.ROSTER" && x.Status is EventModuleDecisionStatus.Required or EventModuleDecisionStatus.Selected)) return false;
        }
        var groups = await db.EventRosterGroups.AsNoTracking().Where(x => x.EventId == e.Id).ToListAsync(ct);
        var members = await db.GroupMemberships.AsNoTracking().Where(x => x.GroupId == e.GroupId && x.Status == MembershipStatus.Approved).Select(x => x.MemberId).ToListAsync(ct);
        var teams = await db.EventTeamMembers.AsNoTracking().Where(x => x.EventId == e.Id && x.Status == EventTeamMemberStatus.Accepted && x.EndedUtc == null).Select(x => x.MemberId).ToListAsync(ct);
        var roles = await db.EventRoleAssignments.AsNoTracking().Where(x => x.EventId == e.Id && x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null).ToListAsync(ct);
        foreach (var slot in slots)
        {
            var group = groups.FirstOrDefault(x => x.RoleCode == slot.RoleCode);
            var candidates = group is null ? [] : System.Text.Json.JsonSerializer.Deserialize<Guid[]>(group.MemberIdsJson) ?? [];
            var valid = slot.Assignments.Where(x => x.Status == EventRosterAssignmentStatus.Confirmed && x.EndedUtc == null).Select(x => x.MemberId).Distinct().Count(id =>
                candidates.Contains(id) && !slot.Availability.Any(x => x.MemberId == id && x.Status == EventAvailabilityStatus.Unavailable) && EventDutyAccess.IsRosterEligible(slot.EligibilityCode, members.Contains(id),
                    members.Contains(id) && (EventDutyAccess.OwnerId(e) == id || teams.Contains(id) || roles.Any(x => x.MemberId == id)),
                    roles.Where(x => x.MemberId == id).Select(x => x.RoleRequirementKey).ToArray()));
            if (valid < slot.RequiredCount) return false;
        }
        return true;
    }
}
