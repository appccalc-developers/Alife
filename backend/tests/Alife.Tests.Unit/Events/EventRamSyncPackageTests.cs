using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;

namespace Alife.Tests.Unit.Events;

public sealed partial class EventPackageFoundationTests
{
    [Fact]
    public async Task PackageSubmissionRequiresCurrentAiContextAndOwnerReview_EvenWithIndependentRamApproval()
    {
        await using var db = CreateDb(); var f = await SeedAsync(db, false, ["TEAM.WORK", "SAFETY.RAM"]);
        var ram = new EventRamAssessment { EventId = f.Event.Id, SchemaVersion = 2, Status = EventRamStatus.Approved,
            Validity = "Valid", ResidualLevel = "Green", RamDataJson = RamEvaluator.Serialize(new RamV2Draft()) };
        db.EventRamAssessments.Add(ram); f.Event.RamAssessment = ram; await db.SaveChangesAsync();
        var service = new EventPackageService(db, Authorization());
        var generated = await service.GenerateAsync(f.Event.Id, f.Owner, new(EventPackageScopeType.Event, null, "1.0"), f.Plan.ETag, "ram-sync-package", default);
        Assert.True(generated.IsSuccess, generated.Message); var package = generated.Value!;
        var pending = await service.SubmitAsync(f.Event.Id, package.Id, f.Owner, package.ETag, "ram-sync-submit", default);
        Assert.Equal(AppResultStatus.Conflict, pending.Status); Assert.Equal(RamSyncPolicy.WaitMessage, pending.Message);
        ram.IsUpdated = true; ram.SyncStatus = "AI_Updated";
        ram.EvaluatedContextHash = EventPackageCanonicalizer.HashCanonical(await EventPlanContextCapture.CaptureAsync(db, f.Event, default));
        await db.SaveChangesAsync();
        var uncheckedResult = await service.SubmitAsync(f.Event.Id, package.Id, f.Owner, package.ETag, "ram-sync-submit", default);
        Assert.Equal(RamSyncPolicy.ReviewMessage, uncheckedResult.Message);
        ram.SyncStatus = "Reviewed"; ram.SyncReviewedByMemberId = f.Owner; await db.SaveChangesAsync();
        var submitted = await service.SubmitAsync(f.Event.Id, package.Id, f.Owner, package.ETag, "ram-sync-submit", default);
        Assert.True(submitted.IsSuccess, submitted.Message); Assert.Equal(EventPackageStatus.Submitted, submitted.Value!.Status);
    }
}
