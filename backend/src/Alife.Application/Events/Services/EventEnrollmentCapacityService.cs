using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

/// <summary>One account, one Event seat. All writers lock the Event before reading its queue.</summary>
public sealed class EventEnrollmentCapacityService(IAlifeDbContext db, IGroupAuthorizationService authorization,
    IEventCacheInvalidationService? cache = null)
{
    public async Task<AppResult<EnrollmentCapacityDto>> GetCapacityAsync(Guid eventId, Guid actor, CancellationToken ct)
    {
        var e = await db.GroupEvents.AsNoTracking().Include(x => x.RamAssessment).Include(x => x.PlanSnapshots)
            .Include(x => x.RegistrationPackage).ThenInclude(x => x!.Conditions)
            .Include(x => x.RegistrationPackage).ThenInclude(x => x!.Decisions).FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<EnrollmentCapacityDto>.NotFound("Event not found.");
        if (!await authorization.IsApprovedMemberAsync(e.GroupId, actor, ct)) return AppResult<EnrollmentCapacityDto>.Forbidden("Approved group membership is required.");
        var counts = await db.EventEnrollments.AsNoTracking().Where(x => x.EventId == eventId).GroupBy(x => x.Status).Select(x => new { Status = x.Key, Count = x.Count() }).ToListAsync(ct);
        var confirmed = counts.FirstOrDefault(x => x.Status == "confirmed")?.Count ?? 0;
        var capacity = Capacity(e.EventDataJson);
        return AppResult<EnrollmentCapacityDto>.Success(new(capacity, confirmed, counts.FirstOrDefault(x => x.Status == "waitlisted")?.Count ?? 0,
            confirmed > capacity, EventLifecyclePolicy.CanCreateEnrollment(e, DateTime.UtcNow, out _), await CanManageAsync(e, actor, ct)));
    }
    public static int Capacity(string json)
    {
        try { using var doc = JsonDocument.Parse(json); return doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.TryGetProperty("maxCapacity", out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var n) ? Math.Max(n, 0) : 0; }
        catch (JsonException) { return 0; }
    }

    public async Task<AppResult<EventEnrollmentDto>> MutateAsync(Guid eventId, Guid actor, string operation,
        string? json, Guid? enrollmentId, bool acceptWaitlist, CancellationToken ct, Guid? expectedGroupId = null)
    {
        await using var tx = await db.BeginSerializableTransactionAsync(ct);
        await db.LockEventRegistrationAsync(eventId, ct);
        var e = await db.GroupEvents.Include(x => x.RamAssessment).Include(x => x.PlanSnapshots)
            .Include(x => x.RegistrationPackage).ThenInclude(x => x!.Conditions)
            .Include(x => x.RegistrationPackage).ThenInclude(x => x!.Decisions)
            .FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null || expectedGroupId.HasValue && e.GroupId != expectedGroupId) return AppResult<EventEnrollmentDto>.NotFound("Event not found.");
        if (await db.EventRegistrationPolicies.AnyAsync(x => x.EventId == eventId, ct))
            return AppResult<EventEnrollmentDto>.Conflict("event.registration.upgradeRequired: Use the participant-based registration workspace. / 请在新版报名工作空间按参加者办理。");
        var rows = await db.EventEnrollments.Where(x => x.EventId == eventId).ToListAsync(ct);
        var row = operation == "create" ? rows.SingleOrDefault(x => x.MemberId == actor) : rows.SingleOrDefault(x => x.Id == enrollmentId);
        if (operation != "create" && row is null) return AppResult<EventEnrollmentDto>.NotFound("Enrollment not found.");
        if (row is not null && row.MemberId != actor && !await CanManageAsync(e, actor, ct))
            return AppResult<EventEnrollmentDto>.Forbidden("Only the participant or a current registration manager can change this record.");
        var now = DateTime.UtcNow;
        if (operation == "create")
        {
            if (!await authorization.IsApprovedMemberAsync(e.GroupId, actor, ct))
                return AppResult<EventEnrollmentDto>.Forbidden("You must be an approved group member to enroll. / 必须是当前获准的小组成员才能报名。");
            // Repeated delivery of the same creation request cannot consume another seat.
            if (row is not null && row.Status != "cancelled")
            {
                if (expectedGroupId.HasValue)
                {
                    // Preserve the legacy group enrollment upsert contract and its prior evidence.
                    if (row.EnrollmentJson != (json ?? "{}"))
                    {
                        Preserve(row, now); row.EnrollmentJson = json ?? "{}";
                        row.UpdatedUtc = now; row.ConcurrencyToken = Guid.NewGuid();
                        await db.SaveChangesAsync(ct);
                    }
                    if (tx is not null) await tx.CommitAsync(ct);
                    if (cache is not null) await cache.RemoveEventEnrollmentsAsync(eventId, ct);
                    return AppResult<EventEnrollmentDto>.Success(ToDto(row, rows));
                }
                return enrollmentId == row.Id ? AppResult<EventEnrollmentDto>.Success(ToDto(row, rows)) : AppResult<EventEnrollmentDto>.Conflict("Enrollment already exists.");
            }
            if (!EventLifecyclePolicy.CanCreateEnrollment(e, now, out var error)) return AppResult<EventEnrollmentDto>.Conflict(error);
            if (row is null && enrollmentId.HasValue && await db.EventEnrollments.AnyAsync(x => x.Id == enrollmentId, ct))
                return AppResult<EventEnrollmentDto>.Conflict("Enrollment id already exists.");
            // Reserve existing eligible candidates before deciding whether a legacy client can join.
            // Do not stage promotions if the request must be rejected.
            if (!acceptWaitlist)
            {
                var reserved = rows.Count(x => x.Status == "confirmed");
                foreach (var waiting in Queue(rows))
                    if (await authorization.IsApprovedMemberAsync(e.GroupId, waiting.MemberId, ct)) reserved++;
                if (reserved >= Capacity(e.EventDataJson))
                    return AppResult<EventEnrollmentDto>.Conflict("event.enrollment.waitlistUpgradeRequired: This event is full. Refresh or update the app to explicitly join the waitlist. / 名额已满，请刷新或更新应用后明确选择候补。");
            }
            await PromoteAsync(e, rows, actor, now, ct);
            var full = rows.Count(x => x.Status == "confirmed") >= Capacity(e.EventDataJson);
            if (full && !acceptWaitlist)
                return AppResult<EventEnrollmentDto>.Conflict("event.enrollment.waitlistUpgradeRequired: This event is full. Refresh or update the app to explicitly join the waitlist. / 名额已满，请刷新或更新应用后明确选择候补。");
            if (row is null)
            {
                row = new() { Id = enrollmentId ?? Guid.NewGuid(), GroupId = e.GroupId, EventId = eventId, MemberId = actor, CreatedUtc = now };
                db.EventEnrollments.Add(row); rows.Add(row);
            }
            else Preserve(row, now);
            row.EnrollmentJson = json ?? "{}";
            row.QueuedUtc = now;
            ChangeStatus(row, full ? "waitlisted" : "confirmed", now);
        }
        else if (operation == "cancel")
        {
            if (row!.Status != "cancelled") { Preserve(row, now); ChangeStatus(row, "cancelled", now); }
            await PromoteAsync(e, rows, actor, now, ct);
        }
        else if (operation == "update")
        {
            // Editing answers never promotes, cancels or reactivates a record.
            Preserve(row!, now);
            row!.EnrollmentJson = json ?? "{}";
            row.UpdatedUtc = now; row.ConcurrencyToken = Guid.NewGuid();
            await PromoteAsync(e, rows, actor, now, ct);
        }
        else return AppResult<EventEnrollmentDto>.Validation("Unsupported enrollment operation.");
        try { await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventEnrollmentDto>.PreconditionFailed("Enrollment changed. Refresh and retry. / 报名已改变，请刷新后重试。"); }
        if (cache is not null) await cache.RemoveEventEnrollmentsAsync(eventId, ct);
        return AppResult<EventEnrollmentDto>.Success(ToDto(row!, rows));
    }

    // Caller owns the Event lock and transaction; notifications commit with the business change.
    public async Task ReconcileAsync(GroupEvent e, Guid actor, CancellationToken ct)
    {
        if (await db.EventRegistrationPolicies.AnyAsync(x => x.EventId == e.Id, ct)) return;
        e.PlanSnapshots = await db.EventPlanSnapshots.Where(x => x.EventId == e.Id && x.IsActive).ToListAsync(ct);
        var rows = await db.EventEnrollments.Where(x => x.EventId == e.Id).ToListAsync(ct);
        await PromoteAsync(e, rows, actor, DateTime.UtcNow, ct);
    }
    private async Task PromoteAsync(GroupEvent e, List<EventEnrollment> rows, Guid actor, DateTime now, CancellationToken ct)
    {
        if (!EventLifecyclePolicy.CanCreateEnrollment(e, now, out _)) return;
        var remaining = Capacity(e.EventDataJson) - rows.Count(x => x.Status == "confirmed");
        foreach (var row in Queue(rows))
        {
            if (remaining <= 0) break;
            if (!await authorization.IsApprovedMemberAsync(e.GroupId, row.MemberId, ct)) continue;
            Preserve(row, now); ChangeStatus(row, "confirmed", now); remaining--;
            db.NotificationMessages.Add(new() { Id = Guid.NewGuid(), RecipientMemberId = row.MemberId, CreatedByMemberId = actor,
                EventId = e.Id, GroupId = e.GroupId, ActionType = "event.enrollment.promoted", OccurredUtc = now, CreatedUtc = now, UpdatedUtc = now,
                ActionDataJson = JsonSerializer.Serialize(new { eventId = e.Id, enrollmentId = row.Id, actionUrl = $"/groups/{e.GroupId}/events/{e.Id}",
                    title = new { en = "A place is confirmed", zh = "已从候补转为正式报名" },
                    body = new { en = $"Your place in {e.TitleEn} is confirmed. Open the event to view your registration.", zh = $"你在「{e.TitleZh}」的名额已确认，请打开活动查看报名。" } }) });
        }
    }
    public async Task<bool> CanManageAsync(GroupEvent e, Guid actor, CancellationToken ct) =>
        await authorization.IsApprovedMemberAsync(e.GroupId, actor, ct) &&
        (e.AccountableOwnerMemberId == actor || e.CreatedByMemberId == actor || await authorization.IsLeaderOrCoLeaderAsync(e.GroupId, actor, ct) ||
         await db.EventRoleAssignments.AnyAsync(x => x.EventId == e.Id && x.MemberId == actor && x.RoleRequirementKey.EndsWith(":registration.manager") && x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null, ct));
    private static void ChangeStatus(EventEnrollment row, string status, DateTime now)
    { row.Status = status; row.StatusChangedUtc = now; row.UpdatedUtc = now; row.ConcurrencyToken = Guid.NewGuid(); }
    private void Preserve(EventEnrollment row, DateTime now) => db.EventEnrollmentHistory.Add(new() {
        Id = Guid.NewGuid(), EnrollmentId = row.Id, Status = row.Status, EnrollmentJson = row.EnrollmentJson,
        QueuedUtc = row.QueuedUtc, StatusChangedUtc = row.StatusChangedUtc, ArchivedUtc = now });
    private static IEnumerable<EventEnrollment> Queue(IEnumerable<EventEnrollment> rows) => rows.Where(x => x.Status == "waitlisted").OrderBy(x => x.QueuedUtc).ThenBy(x => x.Id);
    public static EventEnrollmentDto ToDto(EventEnrollment row, IEnumerable<EventEnrollment> rows) => new(row.Id, row.GroupId, row.EventId, row.MemberId,
        row.EnrollmentJson, row.CreatedUtc, row.UpdatedUtc, row.Status, row.QueuedUtc, row.StatusChangedUtc,
        row.Status == "waitlisted" ? Queue(rows).Select(x => x.Id).ToList().IndexOf(row.Id) + 1 : null, $"\"{row.ConcurrencyToken:N}\"");
}

public sealed record EnrollmentCapacityDto(int Capacity, int Confirmed, int Waitlisted, bool OverCapacity, bool IsOpen, bool CanManage);
