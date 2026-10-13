using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Alife.Tests.Unit.Events;

public sealed partial class EventPackageFoundationTests
{
    // Formal Package tests need the same two independent RAM decisions as production:
    // the approved assessment and the owner's review of the latest synchronized context.
    private static async Task SeedApprovedCurrentRamAsync(AlifeDbContext db, Seeded seeded, Guid? approvedBy = null)
    {
        var ram = seeded.Event.RamAssessment ??
            await db.EventRamAssessments.SingleOrDefaultAsync(x => x.EventId == seeded.Event.Id);
        if (ram is null)
        {
            ram = new EventRamAssessment { EventId = seeded.Event.Id };
            db.EventRamAssessments.Add(ram);
            seeded.Event.RamAssessment = ram;
        }

        var now = DateTime.UtcNow;
        ram.SchemaVersion = 2;
        ram.RamDataJson = RamEvaluator.Serialize(new RamV2Draft());
        ram.Status = EventRamStatus.Approved;
        ram.Validity = "Valid";
        ram.ResidualLevel = "Green";
        ram.ReviewRequested = true;
        ram.ApprovedByMemberId = approvedBy ?? seeded.Owner;
        ram.ApprovedUtc = now;
        ram.CreatedUtc = ram.CreatedUtc == default ? now : ram.CreatedUtc;
        ram.UpdatedUtc = now;
        await db.SaveChangesAsync();

        ram.EvaluatedContextHash = EventPackageCanonicalizer.HashCanonical(
            await EventPlanContextCapture.CaptureAsync(db, seeded.Event, default));
        ram.IsUpdated = true;
        ram.LastEvaluatedAt = now;
        ram.SyncStatus = "Reviewed";
        ram.SyncReviewedByMemberId = seeded.Owner;
        ram.SyncReviewedAt = now;
        await db.SaveChangesAsync();
    }
}
