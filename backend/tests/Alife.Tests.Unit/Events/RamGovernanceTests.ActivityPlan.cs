using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Tests.Unit.Events;

public sealed partial class RamGovernanceTests
{
    [Fact]
    public async Task CurrentQuestionnaire_RequiresExplicitSwitchValues_AndRejectsMissingVersion()
    {
        using var f = await Fixture.Create();
        var service = new EventActivityPlanService(f.Db, new EventPackageInvalidationService(f.Db), f.Cache);
        var view = (await service.GetAsync(f.Event, f.Author, default)).Value!;
        var project = view.Data.Activities[0];
        var off = EventProjectQuestionCatalog.GeneralSwitchCodes.ToDictionary(code => code,
            _ => new PlannedActivityAnswer("no", "human", true), StringComparer.Ordinal);
        var current = view.Data with
        {
            QuestionnaireVersion = 2,
            Activities = [project with { Answers = off }]
        };
        Assert.Null(EventActivityPlanService.Validate(current));
        Assert.NotNull(EventActivityPlanService.Validate(current with
        {
            Activities = [project with { Answers = off.Where(answer => answer.Key != "projectFee")
                .ToDictionary(answer => answer.Key, answer => answer.Value, StringComparer.Ordinal) }]
        }));
        var saved = await service.SaveAsync(f.Event, f.Author, new(current, view.ETag), default);
        Assert.True(saved.IsSuccess, saved.Message);
        Assert.Equal(AppResultStatus.ValidationError, (await service.SaveAsync(f.Event, f.Author,
            new(view.Data with { QuestionnaireVersion = null }, saved.Value!.ETag), default)).Status);
    }

    [Fact]
    public async Task CurrentQuestionnaire_CannotHideExistingProjectFee()
    {
        using var f = await Fixture.Create();
        var service = new EventActivityPlanService(f.Db, new EventPackageInvalidationService(f.Db), f.Cache);
        var view = (await service.GetAsync(f.Event, f.Author, default)).Value!;
        var project = view.Data.Activities[0];
        var answers = EventProjectQuestionCatalog.GeneralSwitchCodes.ToDictionary(code => code,
            _ => new PlannedActivityAnswer("no", "human", true), StringComparer.Ordinal);
        answers["projectSelection"] = new("yes", "human", true);
        var rules = new ActivityProjectRules(new("", ""), null, null, 0, false, false, 100, "NZD",
            DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(1), false, new("Terms", "条款"), "perOccurrence");
        f.Db.EventActivityPolicyVersions.Add(new() { Id = Guid.NewGuid(), EventId = f.Event,
            ActivityId = project.Id, Version = 1, IsCurrent = true, RulesJson = RamEvaluator.Serialize(rules) });
        await f.Db.SaveChangesAsync();
        var next = view.Data with { QuestionnaireVersion = 2, Activities = [project with { Answers = answers }] };
        var result = await service.SaveAsync(f.Event, f.Author, new(next, view.ETag), default);
        Assert.Equal(AppResultStatus.Conflict, result.Status);
        Assert.Contains("projectFee", result.Message);
    }

    [Fact]
    public async Task CurrentQuestionnaire_AllowsDraftOfferWithoutSelection_ButProtectsOpenOffer()
    {
        using var f = await Fixture.Create();
        var service = new EventActivityPlanService(f.Db, new EventPackageInvalidationService(f.Db), f.Cache);
        var view = (await service.GetAsync(f.Event, f.Author, default)).Value!;
        var project = view.Data.Activities[0];
        var answers = EventProjectQuestionCatalog.GeneralSwitchCodes.ToDictionary(code => code,
            _ => new PlannedActivityAnswer("no", "human", true), StringComparer.Ordinal);
        var rules = new ActivityProjectRules(new("", ""), null, null, 0, false, false, 0, "NZD",
            DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(1), false, new("Terms", "条款"), "perOccurrence");
        var policyId = Guid.NewGuid();
        var occurrenceId = Guid.NewGuid();
        var offer = new EventActivityOffer { Id = Guid.NewGuid(), EventId = f.Event, ActivityId = project.Id,
            PolicyVersionId = policyId, OccurrenceId = occurrenceId, Status = "draft" };
        f.Db.EventOccurrences.Add(new() { Id = occurrenceId, EventId = f.Event, StartUtc = DateTime.UtcNow,
            EndUtc = DateTime.UtcNow.AddHours(2), LocalDate = DateOnly.FromDateTime(DateTime.UtcNow) });
        f.Db.EventActivityPolicyVersions.Add(new() { Id = policyId, EventId = f.Event, ActivityId = project.Id,
            Version = 1, IsCurrent = true, RulesJson = RamEvaluator.Serialize(rules) });
        f.Db.EventActivityOffers.Add(offer);
        await f.Db.SaveChangesAsync();

        var current = view.Data with { QuestionnaireVersion = 2, Activities = [project with { Answers = answers }] };
        var saved = await service.SaveAsync(f.Event, f.Author, new(current, view.ETag), default);
        Assert.True(saved.IsSuccess, saved.Message);

        offer.Status = "open";
        await f.Db.SaveChangesAsync();
        var changed = current with { Activities = [project with { Answers = answers,
            Conditions = new RamText { En = "Changed", Zh = "已更改" } }] };
        var blocked = await service.SaveAsync(f.Event, f.Author, new(changed, saved.Value!.ETag), default);
        Assert.Equal(AppResultStatus.Conflict, blocked.Status);
        Assert.Contains("projectSelection", blocked.Message);
    }

    [Fact]
    public async Task CurrentQuestionnaire_KeepsFeeModuleUntilHistoricProjectPaymentIsRefunded()
    {
        using var f = await Fixture.Create();
        var service = new EventActivityPlanService(f.Db, new EventPackageInvalidationService(f.Db), f.Cache);
        var view = (await service.GetAsync(f.Event, f.Author, default)).Value!;
        var project = view.Data.Activities[0];
        var answers = EventProjectQuestionCatalog.GeneralSwitchCodes.ToDictionary(code => code,
            _ => new PlannedActivityAnswer("no", "human", true), StringComparer.Ordinal);
        var zeroFee = new ActivityProjectRules(new("", ""), null, null, 0, false, false, 0, "NZD",
            DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(1), false, new("Terms", "条款"), "perOccurrence");
        var policyId = Guid.NewGuid();
        var occurrenceId = Guid.NewGuid();
        var offerId = Guid.NewGuid();
        var applicationId = Guid.NewGuid();
        var participantId = Guid.NewGuid();
        var participationId = Guid.NewGuid();
        f.Db.EventOccurrences.Add(new() { Id = occurrenceId, EventId = f.Event, StartUtc = DateTime.UtcNow,
            EndUtc = DateTime.UtcNow.AddHours(2), LocalDate = DateOnly.FromDateTime(DateTime.UtcNow) });
        f.Db.EventActivityPolicyVersions.Add(new() { Id = policyId, EventId = f.Event, ActivityId = project.Id,
            Version = 2, IsCurrent = true, RulesJson = RamEvaluator.Serialize(zeroFee) });
        f.Db.EventActivityOffers.Add(new() { Id = offerId, EventId = f.Event, ActivityId = project.Id,
            OccurrenceId = occurrenceId, PolicyVersionId = policyId, Status = "cancelled" });
        f.Db.EventRegistrationApplications.Add(new() { Id = applicationId, EventId = f.Event,
            OrganiserMemberId = f.Author, CreatedByMemberId = f.Author });
        f.Db.EventRegistrationParticipants.Add(new() { Id = participantId, ApplicationId = applicationId,
            MemberId = f.Author, DisplayName = "Member", SeatStatus = "cancelled" });
        f.Db.EventActivityParticipations.Add(new() { Id = participationId, OfferId = offerId,
            ParticipantId = participantId, PolicyVersionId = policyId, FeePolicyVersionId = policyId,
            FeeMinor = 100, SeatStatus = "cancelled" });
        f.Db.EventActivityPayments.Add(new() { Id = Guid.NewGuid(), ParticipationId = participationId,
            ActorMemberId = f.Author, Operation = "payment", AmountMinor = 100 });
        await f.Db.SaveChangesAsync();

        var current = view.Data with { QuestionnaireVersion = 2, Activities = [project with { Answers = answers }] };
        var blocked = await service.SaveAsync(f.Event, f.Author, new(current, view.ETag), default);
        Assert.Equal(AppResultStatus.Conflict, blocked.Status);
        Assert.Contains("projectFee", blocked.Message);
    }

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
    public async Task RamOnlyActivitiesAreNotReturnedOrAdopted()
    {
        using var f = await Fixture.Create(); await f.Save(null);
        f.Db.EventActivityPlans.Remove(await f.Db.EventActivityPlans.SingleAsync());
        await f.Db.SaveChangesAsync();
        var before = f.Ram.RamDataJson;
        var service = new EventActivityPlanService(f.Db,new EventPackageInvalidationService(f.Db),f.Cache);
        var view = (await service.GetAsync(f.Event,f.Author,default)).Value!;
        Assert.Empty(view.Data.Activities);
        Assert.Equal(before, f.Ram.RamDataJson);
        Assert.True((await service.SaveAsync(f.Event,f.Author,new(view.Data,"new"),default)).IsSuccess);
        Assert.Empty(RamEvaluator.Parse(f.Ram.RamDataJson).Activities);
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
    public async Task UnsupportedRamSchemaCannotBeUpgradedDuringSave()
    {
        using var f=await Fixture.Create();
        var result = await f.Service.SaveAsync(f.Event, f.Author, new("{\"schemaVersion\":1,\"activities\":[],\"hazards\":[],\"answers\":[]}", null, "new"), default);
        Assert.Equal(AppResultStatus.ValidationError, result.Status);
        Assert.Empty(await f.Db.EventRamAssessments.ToListAsync());
        Assert.Empty(await f.Db.EventRamRevisions.ToListAsync());
    }

    [Fact]
    public void RemovedSourceRetainsUntouchedAiRisksDuringSubsequentSync()
    {
        var source = Draft(Policy()); source.Activities[0].Attributes = ["water"];
        var draft=RamSyncPolicy.Merge(source,[WaterRisk()],"[]",out var previous);
        var orphanId=draft.Hazards.Last().Id;
        draft.Activities=[new() { Id="replacement",Attributes=["water"],Name=Text("Replacement activity") }];
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
