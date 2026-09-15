using Alife.Application.Admin;
using Alife.Application.Common.Interfaces;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public static class EventWorkAccess
{
    public static readonly IReadOnlyDictionary<string, string> ReportRoles = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["SAFEGUARDING.CHILD"] = "safeguarding.lead",
        ["PROGRAM.PRODUCTION"] = "programme.lead",
        ["MOVE.STAY"] = "travel.coordinator",
        ["FOOD.HOSPITALITY"] = "hospitality.lead",
        ["COMMS.FOLLOWUP"] = "comms.owner"
    };
    public static Task<bool> MemberAsync(IAlifeDbContext db, Guid group, Guid actor, CancellationToken ct)
        => db.GroupMemberships.AsNoTracking().AnyAsync(x => x.GroupId == group && x.MemberId == actor && x.Status == MembershipStatus.Approved, ct);
    public static async Task<bool> OwnerAsync(IAlifeDbContext db, GroupEvent e, Guid actor, CancellationToken ct)
        => EventDutyAccess.OwnerId(e) == actor && await MemberAsync(db, e.GroupId, actor, ct);
    public static async Task<string[]> RolesAsync(IAlifeDbContext db, GroupEvent e, Guid actor, CancellationToken ct)
        => !await MemberAsync(db, e.GroupId, actor, ct) ? [] : await db.EventRoleAssignments.AsNoTracking()
            .Where(x => x.EventId == e.Id && x.MemberId == actor && x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null)
            .Select(x => x.RoleRequirementKey).ToArrayAsync(ct);
    public static bool HasRole(IEnumerable<string> roles, string module, string role)
        => roles.Contains($"{module}:{role}", StringComparer.Ordinal) || roles.Contains(role, StringComparer.Ordinal);
    public static async Task<bool> RoleAsync(IAlifeDbContext db, GroupEvent e, Guid actor, string module, string role, CancellationToken ct)
        => HasRole(await RolesAsync(db, e, actor, ct), module, role);
    public static async Task<bool> ReviewerAsync(IAlifeDbContext db, GroupEvent e, Guid actor, CancellationToken ct)
    {
        var root = await EventCompositionPersistence.FindChurchRootIdAsync(db, e.GroupId, ct);
        return root.HasValue && await MemberAsync(db, root.Value, actor, ct) &&
            await AdminPlatformRoleHelpers.HasPermissionAsync(db, actor, AdminPermissionCatalog.AuditEvents, ct);
    }
    public static async Task<bool> PlanReaderAsync(IAlifeDbContext db, GroupEvent e, Guid actor, CancellationToken ct)
    {
        if (await OwnerAsync(db, e, actor, ct) || (await RolesAsync(db, e, actor, ct)).Length > 0 || await ReviewContextAsync(db,e,actor,ct)) return true;
        return await MemberAsync(db, e.GroupId, actor, ct) && await db.EventTeamMembers.AsNoTracking()
            .AnyAsync(x => x.EventId == e.Id && x.MemberId == actor && x.Status == EventTeamMemberStatus.Accepted && x.EndedUtc == null, ct);
    }
    public static async Task<bool> ReviewContextAsync(IAlifeDbContext db, GroupEvent e, Guid actor, CancellationToken ct)
        => await ReviewerAsync(db,e,actor,ct) && (e.CollaborationVersion == 0 ||
            await db.EventRamActions.AnyAsync(x => x.EventId == e.Id && (x.Action == "submit" || x.Action == "legacy-submitted" || x.Action == "legacy-approved"), ct));
    public static async Task<bool> EnabledAsync(IAlifeDbContext db, Guid eventId, string module, CancellationToken ct)
    {
        var row = await db.EventPlanSnapshots.AsNoTracking().Where(x => x.EventId == eventId && x.IsActive).OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
        if (row is null) return false;
        try { return EventCompositionPersistence.ToSnapshotDto(row).Plan.ModuleDecisions.Any(x => x.ModuleCode == module && x.Status != EventModuleDecisionStatus.Inactive); }
        catch (System.Text.Json.JsonException) { return false; }
    }
}
