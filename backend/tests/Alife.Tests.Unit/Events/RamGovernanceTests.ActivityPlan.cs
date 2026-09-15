using Alife.Application.Common.Models;
using Alife.Application.Events.Services;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Tests.Unit.Events;

public sealed partial class RamGovernanceTests
{
    [Fact]
    public async Task ActivityPlan_OwnerOnly_Etag_Freeze_AndOccurrenceBoundaries()
    {
        using var f = await Fixture.Create();
        var service = new EventActivityPlanService(f.Db,new EventPackageInvalidationService(f.Db),f.Cache);
        var view = (await service.GetAsync(f.Event,f.Author,default)).Value!;
        Assert.True(view.CanEdit);
        Assert.Equal(AppResultStatus.Forbidden,(await service.GetAsync(f.Event,f.Other,default)).Status);
        Assert.Equal(AppResultStatus.Forbidden,(await service.SaveAsync(f.Event,f.Onsite,new(view.Data,view.ETag),default)).Status);
        Assert.Equal(AppResultStatus.PreconditionFailed,(await service.SaveAsync(f.Event,f.Author,new(view.Data,"stale"),default)).Status);
        var bad = view.Data with { Activities = [view.Data.Activities[0] with { OccurrenceId = Guid.NewGuid() }] };
        Assert.Equal(AppResultStatus.ValidationError,(await service.SaveAsync(f.Event,f.Author,new(bad,view.ETag),default)).Status);
        Assert.Equal(view.ETag,(await service.SaveAsync(f.Event,f.Author,new(view.Data,view.ETag),default)).Value!.ETag);
        f.Db.EventPackages.Add(new() { Id=Guid.NewGuid(),EventId=f.Event,Status=EventPackageStatus.Approved }); await f.Db.SaveChangesAsync();
        Assert.Equal(AppResultStatus.Conflict,(await service.SaveAsync(f.Event,f.Author,new(view.Data,view.ETag),default)).Status);
    }

    [Fact]
    public async Task SourceDeletionRetainsRisks_AndOldClientsCannotDefineActivities()
    {
        using var f = await Fixture.Create(); await f.Save(null); await f.AddAcceptedPlan();
        var forged = Draft(Policy()); forged.Activities[0].Name = Text("Forged activity"); forged.ParticipantCount = 999;
        Assert.True((await f.Save(null,forged)).IsSuccess);
        var saved = RamEvaluator.Parse(f.Ram.RamDataJson);
        Assert.NotEqual("Forged activity",saved.Activities[0].Name.En); Assert.NotEqual(999,saved.ParticipantCount);
        var service = new EventActivityPlanService(f.Db,new EventPackageInvalidationService(f.Db),f.Cache);
        var view = (await service.GetAsync(f.Event,f.Author,default)).Value!;
        f.Ram.IsUpdated = true; f.Ram.SyncStatus = "Reviewed"; f.Ram.SyncReviewedByMemberId = f.Author;
        var result = await service.SaveAsync(f.Event,f.Author,new(view.Data with { Activities = [] },view.ETag),default);
        Assert.True(result.IsSuccess,result.Message); Assert.False(f.Ram.IsUpdated); Assert.Null(f.Ram.SyncReviewedByMemberId);
        var orphan = RamEvaluator.Parse(f.Ram.RamDataJson);
        Assert.Empty(orphan.Activities); Assert.Equal(saved.Hazards.Length,orphan.Hazards.Length);
        Assert.Equal(saved.Hazards[0].ActivityId,orphan.Hazards[0].ActivityId);
        Assert.Equal(saved.Hazards[0].ResidualLikelihood,orphan.Hazards[0].ResidualLikelihood);
    }

    [Fact]
    public async Task LegacyActivityAdoptionIsExplicit_AndExcludesSyntheticAiActivities()
    {
        using var f = await Fixture.Create(); await f.Save(null);
        f.Db.EventActivityPlans.Remove(await f.Db.EventActivityPlans.SingleAsync());
        var draft = RamEvaluator.Parse(f.Ram.RamDataJson);
        draft.Activities = [..draft.Activities,new() { Id="ai-water",Type="water",Name=Text("AI context") }];
        f.Ram.RamDataJson = RamEvaluator.Serialize(draft); await f.Db.SaveChangesAsync();
        var before = f.Ram.RamDataJson;
        var service = new EventActivityPlanService(f.Db,new EventPackageInvalidationService(f.Db),f.Cache);
        var view = (await service.GetAsync(f.Event,f.Author,default)).Value!;
        Assert.Empty(view.Data.Activities); Assert.Single(view.LegacyCandidate!.Activities);
        Assert.Equal(AppResultStatus.Conflict,(await f.Save(null)).Status); Assert.Equal(before,f.Ram.RamDataJson);
        Assert.True((await service.SaveAsync(f.Event,f.Author,new(view.LegacyCandidate,"new"),default)).IsSuccess);
        Assert.Single((await service.GetAsync(f.Event,f.Author,default)).Value!.Data.Activities);
    }

    [Fact]
    public async Task RecalculateFreshAssessmentInvalidatesReview_AndBlocksDuplicateRunningJobs()
    {
        using var f = await Fixture.Create(); await f.Save(null); await f.AddAcceptedPlan();
        f.Ram.IsUpdated=true; f.Ram.SyncStatus="Reviewed"; f.Ram.SyncReviewedByMemberId=f.Author;
        var result=await f.Service.SyncActionAsync(f.Event,f.Author,"recalculate",new(null,f.Ram.ConcurrencyToken.ToString()),default);
        Assert.True(result.IsSuccess,result.Message); Assert.False(f.Ram.IsUpdated); Assert.Null(f.Ram.SyncReviewedByMemberId);
        f.Ram.SyncStatus="Syncing"; f.Ram.SyncDueUtc=DateTime.UtcNow.AddMinutes(1); await f.Db.SaveChangesAsync();
        Assert.Equal(AppResultStatus.Conflict,(await f.Service.SyncActionAsync(f.Event,f.Author,"recalculate",new(null,f.Ram.ConcurrencyToken.ToString()),default)).Status);
    }

    [Fact]
    public async Task LegacySourceMirrorsTriggerSafetyWithoutDiscardingLegacyFields()
    {
        using var f=await Fixture.Create(); await f.Save(null);
        f.Db.EventRamRevisions.RemoveRange(await f.Db.EventRamRevisions.ToListAsync());
        f.Ram.SchemaVersion=1; f.Ram.RamDataJson="{\"legacyNote\":\"retain me\",\"hazards\":[]}"; await f.Db.SaveChangesAsync();
        var service=new EventActivityPlanService(f.Db,new EventPackageInvalidationService(f.Db),f.Cache);
        var view=(await service.GetAsync(f.Event,f.Author,default)).Value!;
        Assert.True((await service.SaveAsync(f.Event,f.Author,new(view.Data with { IsOuting=true },view.ETag),default)).IsSuccess);
        Assert.Equal(1,f.Ram.SchemaVersion); Assert.Contains("retain me",f.Ram.RamDataJson);
        Assert.True(EventRamGovernanceService.IsRequired(await f.Db.GroupEvents.SingleAsync()));
        Assert.Contains(await f.Db.EventRamRevisions.ToListAsync(),r=>r.RamDataJson.Contains("retain me"));
    }

    [Fact]
    public void RemovedSourceRetainsUntouchedAiRisksDuringSubsequentSync()
    {
        var draft=RamSyncPolicy.Merge(Draft(Policy()),[WaterRisk()],"[]",out var previous);
        var orphanId=draft.Hazards.Last().Id;
        draft.Activities=[new() { Id="replacement",Type="water",Name=Text("Replacement activity") }];
        var result=RamSyncPolicy.Merge(draft,[WaterRisk()],previous,out _);
        Assert.Contains(result.Hazards,r=>r.Id==orphanId && r.ActivityId!="replacement");
        Assert.Contains(result.Hazards,r=>r.ActivityId=="replacement");
    }

    [Fact]
    public void UnknownAiActivityCannotCreateActivityOrRisk_AndQuestionBankIsOptional()
    {
        var draft=Draft(Policy()); var source=draft.Activities[0].Id;
        Assert.Throws<InvalidDataException>(()=>RamSyncPolicy.Merge(draft,[WaterRisk() with { ActivityKey="a49" }],"[]",out _));
        Assert.Single(draft.Activities); Assert.Equal(source,draft.Activities[0].Id); Assert.Single(draft.Hazards);
        var policy=Policy() with { Questions=[] };
        Assert.Empty(RamEvaluator.ValidatePolicy(policy,true));
        draft.Answers=[]; Assert.DoesNotContain(RamEvaluator.Evaluate(draft,policy).Errors,x=>x.Contains("answer",StringComparison.OrdinalIgnoreCase));
    }
}
