using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Alife.Infrastructure.Persistence;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed partial class RamGovernanceTests
{
    private static RamSyncRisk WaterRisk() => new("water", "activity", new("Possible immersion", "可能落水"), new("Potential injury", "可能受伤"), new("Verify lifejackets before launch", "下水前核实救生衣"), new("Confirm conditions with the operator", "向运营方确认条件"));

    [Fact]
    public async Task UpstreamChangesScheduleAllModules_AndAiSyncPreservesHumanWork()
    {
        using var f = await Fixture.Create(); await f.Save(null); await f.AddAcceptedPlan();
        var e = await f.Db.GroupEvents.SingleAsync(); e.TitleEn = "Akaroa Kayaking";
        var before = f.Ram.RamDataJson;
        await new EventPackageInvalidationService(f.Db).InvalidateForModuleChangeAsync(e, f.Author, "FOOD.HOSPITALITY", "event.food.changed", "operational");
        Assert.False(f.Ram.IsUpdated); Assert.Equal("Outdated", f.Ram.SyncStatus);
        f.Ram.SyncDueUtc = DateTime.UtcNow.AddSeconds(-1); await f.Db.SaveChangesAsync();
        var ai = Substitute.For<IRamSyncAi>();
        ai.IdentifyAsync(Arg.Any<RamSyncContext>(), Arg.Any<CancellationToken>()).Returns([WaterRisk()]);
        await new EventRamSyncService(f.Db, ai, f.Cache).ProcessAsync(f.Event, default);
        await ai.Received(1).IdentifyAsync(Arg.Is<RamSyncContext>(c => c.ActivityTypes.Contains("water")), Arg.Any<CancellationToken>());
        Assert.True(f.Ram.IsUpdated); Assert.Equal("AI_Updated", f.Ram.SyncStatus); Assert.NotNull(f.Ram.LastEvaluatedAt);
        var draft = RamEvaluator.Parse(f.Ram.RamDataJson);
        Assert.Equal(RamEvaluator.Parse(before).Hazards[0].Hazard, draft.Hazards[0].Hazard);
        Assert.Null(draft.Hazards.Last().Likelihood); Assert.Null(draft.Hazards.Last().ResidualLikelihood);
        Assert.Null(f.Ram.ApprovedByMemberId); Assert.Equal("Incomplete", f.Ram.ResidualLevel);
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.SyncActionAsync(f.Event, f.Onsite, "review", new(null, f.Ram.ConcurrencyToken.ToString()), default)).Status);
        var reviewed = await f.Service.SyncActionAsync(f.Event, f.Author, "review", new(null, f.Ram.ConcurrencyToken.ToString()), default);
        Assert.True(reviewed.IsSuccess, reviewed.Message); Assert.Equal("Reviewed", reviewed.Value!.Sync.Status);
        await new EventPackageInvalidationService(f.Db).InvalidateForModuleChangeAsync(e, f.Author, "MOVE.STAY", "event.travel.changed", "operational");
        Assert.False(f.Ram.IsUpdated); Assert.Null(f.Ram.SyncReviewedByMemberId);
    }

    [Fact]
    public async Task FailedOrSupersededAiResultNeverCompletesTheReviewGate()
    {
        using var f = await Fixture.Create(); await f.Save(null); await f.AddAcceptedPlan();
        var before = f.Ram.RamDataJson;
        f.Ram.SyncDueUtc = DateTime.UtcNow.AddSeconds(-1); await f.Db.SaveChangesAsync();
        var ai = Substitute.For<IRamSyncAi>();
        ai.IdentifyAsync(Arg.Any<RamSyncContext>(), Arg.Any<CancellationToken>()).Returns(Task.FromException<IReadOnlyList<RamSyncRisk>>(new HttpRequestException()));
        var job = new EventRamSyncService(f.Db, ai, f.Cache);
        await job.ProcessAsync(f.Event, default);
        Assert.False(f.Ram.IsUpdated); Assert.Equal("ram.sync.failed", f.Ram.SyncError); Assert.Equal(before, f.Ram.RamDataJson);
        Assert.Equal(AppResultStatus.Conflict, (await f.Service.SyncActionAsync(f.Event, f.Author, "review", new(null, f.Ram.ConcurrencyToken.ToString()), default)).Status);
        f.Ram.SyncDueUtc = DateTime.UtcNow.AddSeconds(-1); await f.Db.SaveChangesAsync();
        ai.IdentifyAsync(Arg.Any<RamSyncContext>(), Arg.Any<CancellationToken>()).Returns(async _ => {
            var e = await f.Db.GroupEvents.SingleAsync(); e.TitleEn = "Changed while syncing"; await f.Db.SaveChangesAsync();
            return (IReadOnlyList<RamSyncRisk>)new[] { WaterRisk() };
        });
        await job.ProcessAsync(f.Event, default);
        Assert.False(f.Ram.IsUpdated); Assert.Equal(before, f.Ram.RamDataJson);
        Assert.Equal("Outdated", f.Ram.SyncStatus);
    }

    [Fact]
    public void MergeRetainsEditedAiRisks_AndProjectionContainsOnlyAggregateSignals()
    {
        var draft = RamSyncPolicy.Merge(new(), [WaterRisk()], "[]", out var previous);
        draft.Hazards[0].ControlMeasures = Text("Human override"); draft.Hazards[0].ResidualLikelihood = 2;
        var merged = RamSyncPolicy.Merge(draft, [WaterRisk()], previous, out _);
        Assert.Single(merged.Hazards); Assert.Equal("Human override", merged.Hazards[0].ControlMeasures.En);
        var context = new RamEventPlanContextDto(Guid.NewGuid(), Guid.NewGuid(), new("Akaroa Kayaking secret@example.com", "划船"), DateTime.UtcNow, DateTime.UtcNow, null);
        var projection = RamEvaluator.Serialize(RamSyncPolicy.Project(context));
        Assert.Contains("water", projection); Assert.DoesNotContain("Akaroa", projection); Assert.DoesNotContain("secret", projection);
    }

    [Fact]
    public void ChineseOnlyContextProducesTheSameActivitySignals()
    {
        var context = new RamEventPlanContextDto(Guid.NewGuid(), Guid.NewGuid(), new("", "独木舟和露营，有巴士接送"), DateTime.UtcNow, DateTime.UtcNow, null);
        var projection = RamSyncPolicy.Project(context);
        Assert.Contains("water", projection.ActivityTypes); Assert.Contains("transport", projection.ActivityTypes);
        Assert.True(projection.Overnight); Assert.True(projection.Outdoor);
    }

    [Fact]
    public async Task ConcurrentHumanSaveWinsOverInflightAiResult()
    {
        using var f = await Fixture.Create(); await f.Save(null); await f.AddAcceptedPlan();
        f.Ram.SyncDueUtc = DateTime.UtcNow.AddSeconds(-1); await f.Db.SaveChangesAsync();
        var ai = Substitute.For<IRamSyncAi>();
        var humanJson = "";
        ai.IdentifyAsync(Arg.Any<RamSyncContext>(), Arg.Any<CancellationToken>()).Returns(async _ => {
            await using var writer = new AlifeDbContext((DbContextOptions<AlifeDbContext>)f.Db.GetService<IDbContextOptions>());
            var ram = await writer.EventRamAssessments.SingleAsync();
            var draft = RamEvaluator.Parse(ram.RamDataJson); draft.Hazards[0].ControlMeasures = Text("Concurrent human edit");
            humanJson = ram.RamDataJson = RamEvaluator.Serialize(draft);
            RamSyncPolicy.Schedule(ram, DateTime.UtcNow); await writer.SaveChangesAsync();
            return (IReadOnlyList<RamSyncRisk>)new[] { WaterRisk() };
        });
        await new EventRamSyncService(f.Db, ai, f.Cache).ProcessAsync(f.Event, default);
        await f.Db.Entry(f.Ram).ReloadAsync();
        Assert.Equal(humanJson, f.Ram.RamDataJson); Assert.False(f.Ram.IsUpdated); Assert.Equal("Outdated", f.Ram.SyncStatus);
        Assert.False(await f.Db.AuditLogs.AnyAsync(a => a.Action == "event.ram.aiSynced"));
    }

    [Fact]
    public async Task LegacyAssessmentWaitsForExplicitUpgradeWithoutCallingAi()
    {
        using var f = await Fixture.Create(); await f.Save(null); await f.AddAcceptedPlan();
        f.Ram.SchemaVersion = 1; f.Ram.SyncDueUtc = DateTime.UtcNow.AddSeconds(-1); await f.Db.SaveChangesAsync();
        var before = f.Ram.RamDataJson; var ai = Substitute.For<IRamSyncAi>();
        await new EventRamSyncService(f.Db, ai, f.Cache).ProcessAsync(f.Event, default);
        await ai.DidNotReceive().IdentifyAsync(Arg.Any<RamSyncContext>(), Arg.Any<CancellationToken>());
        Assert.Equal("ram.sync.upgradeRequired", f.Ram.SyncError); Assert.Null(f.Ram.SyncDueUtc);
        Assert.False(f.Ram.IsUpdated); Assert.Equal(before, f.Ram.RamDataJson);
    }

    [Fact]
    public async Task SyncStateAndRetryEnforceMembershipAndCurrentEtag()
    {
        using var f = await Fixture.Create(); await f.Save(null); await f.AddAcceptedPlan();
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.SyncStateAsync(f.Event, f.Other, default)).Status);
        Assert.Equal(AppResultStatus.PreconditionFailed, (await f.Service.SyncActionAsync(f.Event, f.Author, "retry", new(null, "stale"), default)).Status);
        f.Db.GroupMemberships.Single(m => m.GroupId == f.Group && m.MemberId == f.Author).Status = Alife.Domain.Enums.MembershipStatus.Removed;
        await f.Db.SaveChangesAsync();
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.SyncActionAsync(f.Event, f.Author, "retry", new(null, f.Ram.ConcurrencyToken.ToString()), default)).Status);
    }
}
