using System.Text.Json;
using System.Text.Json.Nodes;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Tests.Unit.Events;

public sealed partial class EventPackageFoundationTests
{
    [Theory]
    [InlineData(24)]
    [InlineData(96)]
    public async Task Assessment_UsesEffectiveGroupPolicyWindow_AndReportsAllMatchingTiers(int hours)
    {
        await using var db = CreateDb();
        var seed = await SeedAsync(db, true, ["TEAM.WORK", "PEOPLE.REGISTRATION"]);
        var global = await db.EventPackageGovernancePolicyVersions.SingleAsync();
        var rules = JsonNode.Parse(global.RulesJson)!;
        rules["preEventConfirmationWindowHours"] = hours;
        rules["tierRules"]![2]!["whenAnyActivityTypeCodes"] = new JsonArray("shared-meal");
        db.EventPackageGovernancePolicyVersions.Add(new EventPackageGovernancePolicyVersion {
            Id = Guid.NewGuid(), OrganisationId = seed.Event.GroupId, Version = "group.2", SchemaVersion = "1",
            IsPublished = true, RulesJson = rules.ToJsonString(), EffectiveFromUtc = global.EffectiveFromUtc.AddDays(-1),
            PublishedByMemberId = seed.Owner, PublishedUtc = global.PublishedUtc
        });
        var entity = await db.EventPlanSnapshots.SingleAsync();
        var plan = seed.Plan.Plan with { Facts = seed.Plan.Plan.Facts with { Items = [
            new("money.hasMoneyFlow", JsonSerializer.SerializeToElement(true), EventFactCertainty.Confirmed, EventFactSource.Human),
            new("people.childrenPresent", JsonSerializer.SerializeToElement(true), EventFactCertainty.Candidate, EventFactSource.AiCandidate),
            new("move.transportRequired", JsonSerializer.SerializeToElement(true), EventFactCertainty.Confirmed, EventFactSource.Human)
        ] } };
        entity.SnapshotJson = EventCompositionPersistence.SerializePlan(plan, []);
        await db.SaveChangesAsync();
        var service = new EventPackageService(db, Authorization());
        var result = await service.GetApprovalAssessmentAsync(seed.Event.Id, seed.Owner, EventPackageScopeType.Event, null, default);
        Assert.True(result.IsSuccess, result.Message);
        var assessment = result.Value!;
        Assert.Equal("group.2", assessment.PolicyVersion);
        Assert.Equal(hours, assessment.FinalConfirmationWindowHours);
        Assert.Equal(seed.Event.StartDate.AddHours(-hours), assessment.ApprovalDeadlineUtc);
        Assert.Equal(EventGovernanceTier.Enhanced, assessment.Tier);
        Assert.Single(assessment.Tiers, x => x.Selected);
        Assert.All(assessment.Tiers, x => Assert.True(x.Applies));
        var reasons = assessment.Tiers.SelectMany(x => x.Reasons).ToArray();
        Assert.Contains(reasons, x => x.Code == "event.governance.module.PEOPLE.REGISTRATION");
        Assert.Contains(reasons, x => x.Code == "event.governance.fact.money.hasMoneyFlow");
        Assert.Contains(reasons, x => x.Code == "event.governance.fact.move.transportRequired");
        Assert.Contains(reasons, x => x.Code == "event.governance.template.shared-meal");
        Assert.DoesNotContain(reasons, x => x.Code.Contains("childrenPresent"));
        Assert.All(reasons, x => { Assert.NotEmpty(x.Message.En); Assert.NotEmpty(x.Message.Zh); });
        var occurrence = seed.Occurrences.Last();
        var scoped = await service.GetApprovalAssessmentAsync(seed.Event.Id, seed.Owner, EventPackageScopeType.Occurrence, occurrence.Id, default);
        Assert.True(scoped.IsSuccess, scoped.Message);
        Assert.Equal(occurrence.StartUtc.AddHours(-hours), scoped.Value!.ApprovalDeadlineUtc);
        Assert.Empty(await db.EventPackages.ToListAsync());
        Assert.Empty(await db.AuditLogs.ToListAsync());
        Assert.Equal(AppResultStatus.Forbidden, (await service.GetApprovalAssessmentAsync(seed.Event.Id, Guid.NewGuid(), EventPackageScopeType.Event, null, default)).Status);
    }

    [Fact]
    public async Task Assessment_LightBaseline_AndOverdueExpectationDoNotPreventApprovalSubmission()
    {
        await using var db = CreateDb();
        var seed = await SeedAsync(db, false, ["TEAM.WORK"]);
        seed.Event.StartDate = DateTime.UtcNow.AddHours(12);
        seed.Event.EndDate = seed.Event.StartDate.AddHours(2);
        await db.SaveChangesAsync();
        var service = new EventPackageService(db, Authorization());
        var result = await service.GetApprovalAssessmentAsync(seed.Event.Id, seed.Owner, EventPackageScopeType.Event, null, default);
        Assert.True(result.IsSuccess, result.Message);
        Assert.Equal(EventGovernanceTier.Light, result.Value!.Tier);
        Assert.True(result.Value.ApprovalDeadlineUtc < DateTime.UtcNow);
        Assert.All(result.Value.Tiers.Where(x => x.Tier != EventGovernanceTier.Light), x => Assert.False(x.Applies));
        var package = await service.GenerateAsync(seed.Event.Id, seed.Owner, new(), seed.Plan.ETag, "deadline-generate", default);
        Assert.True(package.IsSuccess, package.Message);
        var submitted = await service.SubmitAsync(seed.Event.Id, package.Value!.Id, seed.Owner, package.Value.ETag, "deadline-submit", default);
        Assert.True(submitted.IsSuccess, submitted.Message);
    }
}
