using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed record RamSyncOverviewDto(bool IsRequired, string ETag, RamSyncStateDto Sync, bool CanReview, bool CanRetry);

public sealed partial class EventRamGovernanceService
{
    public async Task<AppResult<RamSyncOverviewDto>> SyncStateAsync(Guid eventId, Guid actor, CancellationToken ct)
    {
        var e = await db.GroupEvents.AsNoTracking().Include(x => x.RamAssessment).FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<RamSyncOverviewDto>.NotFound("Event not found.");
        if (!await CanReadAsync(e, actor, ct)) return AppResult<RamSyncOverviewDto>.Forbidden("RAM reading permission is required.");
        var context = await EventPlanContextCapture.CaptureAsync(db, e, ct);
        var owner = await EventWorkAccess.OwnerAsync(db, e, actor, ct);
        var editable = !await EventPreparationPolicy.IsFrozenAsync(db, eventId, ct);
        var ram = e.RamAssessment;
        return AppResult<RamSyncOverviewDto>.Success(new(IsRequired(e, context.AcceptedPlan?.Plan), Token(ram),
            ram is null ? new("Draft", false, null, null, null, null) : EventRamPolicy.ToDto(ram, e.GroupId).Sync!,
            owner && editable, editable && (owner || await CanEdit(e, actor, ct))));
    }

    public async Task<AppResult<RamSyncOverviewDto>> SyncActionAsync(Guid eventId, Guid actor, string action, RamActionRequest request, CancellationToken ct)
    {
        if (action is not ("retry" or "review" or "recalculate")) return AppResult<RamSyncOverviewDto>.Validation("Unknown sync action.");
        await using var tx = await db.BeginSerializableTransactionAsync(ct);
        await db.LockEventRegistrationAsync(eventId, ct);
        var e = await db.GroupEvents.Include(x => x.RamAssessment).FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<RamSyncOverviewDto>.NotFound("Event not found.");
        var owner = await EventWorkAccess.OwnerAsync(db, e, actor, ct);
        if (!owner && (action == "review" || !await CanEdit(e, actor, ct))) return AppResult<RamSyncOverviewDto>.Forbidden("Current owner authority is required for final RAM review.");
        if (await EventPreparationPolicy.IsFrozenAsync(db, eventId, ct)) return AppResult<RamSyncOverviewDto>.Conflict(EventPreparationPolicy.FrozenMessage);
        if (!Matches(request.ExpectedETag, Token(e.RamAssessment))) return AppResult<RamSyncOverviewDto>.PreconditionFailed("RAM changed; review the current revision. / RAM 已改变，请核对当前版本。");
        var context = await EventPlanContextCapture.CaptureAsync(db, e, ct);
        if (!IsRequired(e, context.AcceptedPlan?.Plan)) return AppResult<RamSyncOverviewDto>.Conflict("RAM is not currently enabled or required.");
        var ram = e.RamAssessment;
        if (action == "review")
        {
            if (ram is null || !ram.IsUpdated || ram.EvaluatedContextHash != Hash(context)) return AppResult<RamSyncOverviewDto>.Conflict(RamSyncPolicy.WaitMessage);
            ram.SyncStatus = "Reviewed"; ram.SyncReviewedByMemberId = actor; ram.SyncReviewedAt = DateTime.UtcNow;
            // No content change: preserve RAM signature, source-vector and approval ETags.
        }
        else
        {
            if (ram is not null && (ram.SyncStatus == "Syncing" && ram.SyncDueUtc > DateTime.UtcNow || action != "recalculate" && ram.IsUpdated && ram.EvaluatedContextHash == Hash(context)))
                return AppResult<RamSyncOverviewDto>.Conflict("RAM is already synchronized or running.");
            if (ram is null) { ram = new() { EventId = eventId, SchemaVersion = 2, RamDataJson = RamEvaluator.Serialize(new RamV2Draft()), CreatedUtc = DateTime.UtcNow }; db.EventRamAssessments.Add(ram); e.RamAssessment = ram; }
            Invalidate(ram);
            RamSyncPolicy.Schedule(ram, DateTime.UtcNow);
        }
        db.AuditLogs.Add(new() { Id = Guid.NewGuid(), EventId = eventId, GroupId = e.GroupId, ActorMemberId = actor,
            Action = "event.ram.sync." + action, EntityType = "EventRamAssessment", EntityId = eventId,
            BeforeJson = "{}", AfterJson = "{}", MetadataJson = RamEvaluator.Serialize(new { ram.ConcurrencyToken }), OccurredUtc = DateTime.UtcNow });
        try { await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<RamSyncOverviewDto>.PreconditionFailed("RAM changed concurrently; reload."); }
        return await SyncStateAsync(eventId, actor, ct);
    }
}
