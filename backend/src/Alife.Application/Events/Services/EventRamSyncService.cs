using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Events.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed class EventRamSyncService(IAlifeDbContext db, IRamSyncAi ai, IEventCacheInvalidationService cache)
{
    public Task<Guid[]> DueAsync(CancellationToken ct) => db.EventRamAssessments.AsNoTracking()
        .Where(r => !r.IsUpdated && r.SyncDueUtc != null && r.SyncDueUtc <= DateTime.UtcNow)
        .OrderBy(r => r.SyncDueUtc).Select(r => r.EventId).Take(10).ToArrayAsync(ct);

    // Run one event per DI scope. ConcurrencyToken acts as an optimistic claim and stale-result fence.
    public async Task ProcessAsync(Guid eventId, CancellationToken ct)
    {
        var ram = await db.EventRamAssessments.Include(r => r.Event).FirstOrDefaultAsync(r => r.EventId == eventId, ct);
        if (ram is null || ram.IsUpdated || ram.SyncDueUtc is null || ram.SyncDueUtc > DateTime.UtcNow) return;
        var context = await EventPlanContextCapture.CaptureAsync(db, ram.Event, ct);
        if (await EventPreparationPolicy.IsFrozenAsync(db, eventId, ct) || !EventRamGovernanceService.IsRequired(ram.Event, context.AcceptedPlan?.Plan))
        {
            ram.SyncDueUtc = null;
            try { await db.SaveChangesAsync(ct); } catch (DbUpdateConcurrencyException) { }
            return;
        }
        if (ram.SchemaVersion != 2 || context.ActivityPlan?.Data.Activities.Length is null or 0)
        {
            // Upgrade is a human action. Do not spend provider calls retrying a legacy payload.
            ram.SyncStatus = "Outdated"; ram.SyncError = ram.SchemaVersion != 2 ? "ram.sync.upgradeRequired" : "ram.sync.activityPlanRequired";
            ram.SyncDueUtc = null; ram.ConcurrencyToken = Guid.NewGuid();
            try { await db.SaveChangesAsync(ct); } catch (DbUpdateConcurrencyException) { }
            return;
        }
        ram.SyncStatus = "Syncing"; ram.SyncDueUtc = DateTime.UtcNow.AddMinutes(2);
        ram.SyncAttempts++; ram.SyncError = null; ram.ConcurrencyToken = Guid.NewGuid();
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return; }
        var sourceHash = EventPackageCanonicalizer.HashCanonical(context);
        try
        {
            var results = await ai.IdentifyAsync(RamSyncPolicy.Project(context), ct);
            // Stop before staging any draft/audit writes if another writer has replaced our claim.
            if (!await db.EventRamAssessments.AsNoTracking().AnyAsync(r => r.EventId == eventId && r.ConcurrencyToken == ram.ConcurrencyToken, ct)) return;
            // Catch changed context even for a write path whose event notification was missed.
            var latestEvent = await db.GroupEvents.AsNoTracking().FirstAsync(e => e.Id == eventId, ct);
            if (sourceHash != EventPackageCanonicalizer.HashCanonical(await EventPlanContextCapture.CaptureAsync(db, latestEvent, ct)))
            {
                RamSyncPolicy.Schedule(ram, DateTime.UtcNow);
                await db.SaveChangesAsync(ct); return;
            }
            var draft = RamSyncPolicy.Merge(EventActivityPlanService.Mirror(RamEvaluator.Parse(ram.RamDataJson), context), results, ram.AiRiskDraftJson, out var generated);
            EventRamGovernanceService.Invalidate(ram);
            ram.RamDataJson = RamEvaluator.Serialize(draft); ram.AiRiskDraftJson = generated;
            ram.ResidualLevel = "Incomplete"; ram.IsUpdated = true; ram.SyncStatus = "AI_Updated";
            ram.LastEvaluatedAt = DateTime.UtcNow; ram.EvaluatedContextHash = sourceHash;
            ram.SyncDueUtc = null; ram.SyncError = null; ram.SyncReviewedAt = null; ram.SyncReviewedByMemberId = null;
            db.AuditLogs.Add(new() { Id = Guid.NewGuid(), EventId = eventId, GroupId = ram.Event.GroupId,
                Action = "event.ram.aiSynced", EntityType = "EventRamAssessment", EntityId = eventId,
                BeforeJson = "{}", AfterJson = "{}", MetadataJson = RamEvaluator.Serialize(new { sourceHash, risks = results.Count }), OccurredUtc = DateTime.UtcNow });
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException) { return; } // New upstream data/manual changes always win.
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException or InvalidDataException or JsonException)
        {
            if (ct.IsCancellationRequested) return; // The persisted lease recovers a terminated job.
            ram.SyncStatus = "Outdated"; ram.IsUpdated = false; ram.SyncError = "ram.sync.failed";
            ram.SyncDueUtc = ram.SyncAttempts < 5 ? DateTime.UtcNow.AddMinutes(Math.Pow(2, ram.SyncAttempts)) : null;
            ram.ConcurrencyToken = Guid.NewGuid();
            try { await db.SaveChangesAsync(ct); } catch (DbUpdateConcurrencyException) { return; }
        }
        await cache.RemoveGroupEventsAsync(ram.Event.GroupId, ct);
    }
}
