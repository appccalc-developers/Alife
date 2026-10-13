using System.Text.Json;
using Alife.Application.Common.Models;
using Alife.Application.Events.Composition;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed partial class EventPackageFoundationTests
{
    private static readonly string[] PreparationModules =
        ["TEAM.WORK", "PEOPLE.REGISTRATION", "SERVICE.ROSTER", "SAFETY.RAM", "SAFEGUARDING.CHILD"];

    private static Dictionary<string, bool> Confirmations(params string[] confirmed)
    {
        var selected = confirmed.ToHashSet(StringComparer.Ordinal);
        return EventCompositionDefinitions.Modules.ToDictionary(
            module => module.Code, module => selected.Contains(module.Code), StringComparer.Ordinal);
    }

    private static EventPlanComposeRequest PreparationComposition(bool selected, int version) => new(
        EventCompositionDefinitions.SchemaVersion, "simple-social", new(new[]
        {
            (Code: "people.volunteersRequired", Value: true),
            (Code: "safety.requiresRam", Value: true),
            (Code: "people.childrenPresent", Value: true),
            (Code: "comms.followupRequired", Value: false),
            (Code: "scale.multiZone", Value: false)
        }.Select(fact => new EventFactInputDto(fact.Code, JsonSerializer.SerializeToElement(fact.Value),
            EventFactCertainty.Confirmed, EventFactSource.Human)).ToArray()),
        EventCompositionDefinitions.Modules.Select(module => new ModuleSelectionInput(module.Code,
            selected && PreparationModules.Contains(module.Code))).ToArray(), version, "shared-meal",
        ModuleConfirmations: Confirmations(), ActivityPlan: EventActivityPlanService.Empty);

    [Fact]
    public async Task DraftTools_CanDisableReloadAndReenableAllFive_WithoutLosingFactsOrSavedRecords()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, false, PreparationModules);
        seeded.Event.PublicationStatus = EventPublicationStatus.Draft;
        seeded.Event.EventDataJson = "{\"visibility\":\"groupVisible\",\"maxCapacity\":30}";
        db.EventRamAssessments.Add(new() { EventId = seeded.Event.Id, RamDataJson = "{\"hazards\":[\"saved hazard\"]}" });
        var registration = new EventRegistrationApplication
        {
            Id = Guid.NewGuid(), EventId = seeded.Event.Id, OrganiserMemberId = seeded.Owner,
            CreatedByMemberId = seeded.Owner, PolicyVersion = 1, QueuedUtc = DateTime.UtcNow
        };
        registration.Participants.Add(new() { Id = Guid.NewGuid(), MemberId = seeded.Owner, DisplayName = "Owner", SeatStatus = "confirmed" });
        db.EventRegistrationApplications.Add(registration);
        await db.SaveChangesAsync();
        var authorization = Authorization(); var engine = new EventCompositionEngine();
        var recompose = new RecomposeEventPlanCommandHandler(db, authorization, engine);
        var accept = new AcceptEventPlanCommandHandler(db, authorization, engine,
            Substitute.For<IEventCacheInvalidationService>(), new EventPackageInvalidationService(db));
        var snapshot = seeded.Plan;
        foreach (var selected in new[] { false, true, false })
        {
            var input = PreparationComposition(selected, snapshot.PlanVersion);
            var preview = await recompose.Handle(new(seeded.Event.Id, seeded.Owner, input, snapshot.ETag), default);
            Assert.True(preview.IsSuccess, preview.Message);
            Assert.Empty(preview.Value!.Diff.BlockingRetirements);
            Assert.All(preview.Value.ModuleDecisions.Where(x => PreparationModules.Contains(x.ModuleCode)), x =>
                Assert.Equal(selected ? EventModuleDecisionStatus.Required : EventModuleDecisionStatus.Inactive, x.Status));
            var saved = await accept.Handle(new(seeded.Event.Id, seeded.Owner,
                new(preview.Value.ProposalHash, [], input), snapshot.ETag, Guid.NewGuid().ToString()), default);
            Assert.True(saved.IsSuccess, saved.Message);
            db.ChangeTracker.Clear();
            var loaded = await new GetEventPlanQueryHandler(db, authorization)
                .Handle(new(seeded.Event.Id, seeded.Owner), default);
            Assert.True(loaded.IsSuccess, loaded.Message); snapshot = loaded.Value!;
            Assert.All(snapshot.Plan.ModuleDecisions.Where(x => PreparationModules.Contains(x.ModuleCode)), x =>
                Assert.Equal(selected ? EventModuleDecisionStatus.Required : EventModuleDecisionStatus.Inactive, x.Status));
            Assert.All(snapshot.Plan.Facts.Items.Where(x => x.Code is "safety.requiresRam" or "people.childrenPresent"),
                x => Assert.True(x.Value!.Value.GetBoolean()));
            Assert.Equal(seeded.Owner, (await db.GroupEvents.SingleAsync()).AccountableOwnerMemberId);
            Assert.Equal("{\"hazards\":[\"saved hazard\"]}", (await db.EventRamAssessments.SingleAsync()).RamDataJson);
            Assert.Single(await db.EventRegistrationParticipants.ToListAsync());
        }
        Assert.Equal(4, await db.EventPlanSnapshots.CountAsync());
        var service = new EventPackageService(db, authorization);
        var package = await service.GenerateAsync(seeded.Event.Id, seeded.Owner,
            new(EventPackageScopeType.Event, null, "1.0"), snapshot.ETag, "draft-disabled-tools", default);
        Assert.True(package.IsSuccess, package.Message);
        Assert.Equal(6, package.Value!.Manifest.Blockers.Count);
        Assert.Contains(package.Value.Manifest.Blockers, b => b.En.Contains("pass independent review"));
        var submitted = await service.SubmitAsync(seeded.Event.Id, package.Value.Id, seeded.Owner,
            package.Value.ETag, "cannot-submit-disabled-requirements", default);
        Assert.Equal(AppResultStatus.Conflict, submitted.Status);
        Assert.Equal(EventPackageStatus.Draft, (await db.EventPackages.SingleAsync()).Status);
    }

    [Fact]
    public async Task PackageSubmission_RequiresIndependentRamReviewOnlyWhenThePlanRequiresRam()
    {
        await using var optionalDb = CreateDb();
        var optional = await SeedAsync(optionalDb, false, ["TEAM.WORK"]);
        var optionalService = new EventPackageService(optionalDb, Authorization());
        var optionalPackage = await optionalService.GenerateAsync(optional.Event.Id, optional.Owner,
            new(), optional.Plan.ETag, "optional-ram-package", default);

        Assert.True(optionalPackage.IsSuccess, optionalPackage.Message);
        Assert.DoesNotContain(optionalPackage.Value!.Manifest.Blockers,
            blocker => blocker.En.Contains("independent review", StringComparison.OrdinalIgnoreCase));
        Assert.True((await optionalService.SubmitAsync(optional.Event.Id, optionalPackage.Value.Id,
            optional.Owner, optionalPackage.Value.ETag, "optional-ram-submit", default)).IsSuccess);

        await using var requiredDb = CreateDb();
        var required = await SeedAsync(requiredDb, false, ["TEAM.WORK", "SAFETY.RAM"]);
        var requiredService = new EventPackageService(requiredDb, Authorization());
        var requiredPackage = await requiredService.GenerateAsync(required.Event.Id, required.Owner,
            new(), required.Plan.ETag, "required-ram-package", default);

        Assert.True(requiredPackage.IsSuccess, requiredPackage.Message);
        Assert.Contains(requiredPackage.Value!.Manifest.Blockers,
            blocker => blocker.En.Contains("pass independent review", StringComparison.OrdinalIgnoreCase));
        var blocked = await requiredService.SubmitAsync(required.Event.Id, requiredPackage.Value.Id,
            required.Owner, requiredPackage.Value.ETag, "required-ram-submit", default);
        Assert.Equal(AppResultStatus.Conflict, blocked.Status);
        Assert.Equal("event.package.submissionBlocked", blocked.Message);
    }

    [Fact]
    public void DraftDeselection_DoesNotWaiveFormalDependencies_OrChangeDefaultComposition()
    {
        var engine = new EventCompositionEngine(); var input = PreparationComposition(false, 1);
        var strict = engine.Compose(input, new("baseline"));
        Assert.All(strict.Value!.ModuleDecisions.Where(x => PreparationModules.Contains(x.ModuleCode)),
            x => Assert.Equal(EventModuleDecisionStatus.Required, x.Status));
        var draft = engine.Compose(input, new("baseline", IsPreparationDraft: true));
        Assert.Equal(5, EventCompositionEngine.FormalSubmissionModuleBlockers(draft.Value!).Count);
        var enabled = engine.Compose(PreparationComposition(true, 1), new("baseline", IsPreparationDraft: true));
        Assert.Empty(EventCompositionEngine.FormalSubmissionModuleBlockers(enabled.Value!));
        // A selected child tool still needs registration even when the fact is unknown.
        var dependencyOnly = engine.Compose(input with { Facts = new(
            EventProjectQuestionCatalog.MovedEventFactCodes.Values.Select(code =>
                new EventFactInputDto(code, JsonSerializer.SerializeToElement(false),
                    EventFactCertainty.Confirmed, EventFactSource.Human)).ToArray()), HumanSelections =
            [new("TEAM.WORK", true), new("SAFEGUARDING.CHILD", true), new("PEOPLE.REGISTRATION", false)] },
            new("baseline", IsPreparationDraft: true));
        Assert.Single(EventCompositionEngine.FormalSubmissionModuleBlockers(dependencyOnly.Value!));
    }
    [Fact]
    public void ModuleConfirmation_IsIndependent_Hashed_AndRejectsUnknownModules()
    {
        var engine = new EventCompositionEngine();
        var input = PreparationComposition(false, 1) with { ModuleConfirmations = Confirmations("SAFETY.RAM") };
        var first = engine.Compose(input, new("baseline", IsPreparationDraft: true));
        Assert.True(first.IsSuccess, first.Message);
        Assert.DoesNotContain("moduleConfirmations", EventPackageCanonicalizer.Serialize(input with { ModuleConfirmations = null }));
        Assert.Equal(12, first.Value!.ModuleConfirmations!.Count);
        Assert.True(first.Value.ModuleConfirmations["SAFETY.RAM"]);
        Assert.False(first.Value.ModuleConfirmations["SAFEGUARDING.CHILD"]);
        var second = engine.Compose(input with { ModuleConfirmations = Confirmations("SAFETY.RAM", "SAFEGUARDING.CHILD") }, new("baseline", IsPreparationDraft: true));
        Assert.True(second.IsSuccess, second.Message);
        var secondProposal = second.Value;
        Assert.NotNull(secondProposal);
        Assert.NotEqual(first.Value.ProposalHash, secondProposal.ProposalHash);
        var invalid = Confirmations(); invalid["unknown"] = true;
        Assert.False(engine.Compose(input with { ModuleConfirmations = invalid }, new("baseline")).IsSuccess);
        Assert.Equal(first.Value.Readiness.Status, secondProposal.Readiness.Status);
    }

    [Fact]
    public async Task ModuleConfirmation_RefreshIsPrecise_HistoryImmutable_AndOldClientCannotOverwrite()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, false, PreparationModules);
        seeded.Event.PublicationStatus = EventPublicationStatus.Draft; await db.SaveChangesAsync();
        var input = PreparationComposition(true, seeded.Plan.PlanVersion) with
        { ModuleConfirmations = EventCompositionDefinitions.Modules.ToDictionary(x => x.Code, _ => true) };
        var engine = new EventCompositionEngine(); var auth = Authorization();
        var preview = await new RecomposeEventPlanCommandHandler(db, auth, engine).Handle(new(seeded.Event.Id, seeded.Owner, input, seeded.Plan.ETag), default);
        var handler = new AcceptEventPlanCommandHandler(db, auth, engine, Substitute.For<IEventCacheInvalidationService>(), new EventPackageInvalidationService(db));
        var accepted = await handler.Handle(new(seeded.Event.Id, seeded.Owner, new(preview.Value!.ProposalHash, [], input), seeded.Plan.ETag, "module-confirmation"), default);
        Assert.True(accepted.IsSuccess, accepted.Message);
        await new EventPackageInvalidationService(db).InvalidateForModuleChangeAsync(seeded.Event, seeded.Owner, "SAFETY.RAM", "event.ram.saved", "operational");
        await db.SaveChangesAsync();
        var refreshed = await new GetEventPlanQueryHandler(db, auth).Handle(new(seeded.Event.Id, seeded.Owner), default);
        Assert.False(refreshed.Value!.Plan.ModuleConfirmations!["SAFETY.RAM"]);
        Assert.True(refreshed.Value.Plan.ModuleConfirmations["SAFEGUARDING.CHILD"]);
        Assert.True(EventCompositionPersistence.ToSnapshotDto(await db.EventPlanSnapshots.SingleAsync(x => x.IsActive)).Plan.ModuleConfirmations!["SAFETY.RAM"]);
        var old = input with { BasePlanVersion = refreshed.Value.PlanVersion, ModuleConfirmations = null };
        Assert.Equal(AppResultStatus.Conflict, (await new RecomposeEventPlanCommandHandler(db, auth, engine).Handle(new(seeded.Event.Id, seeded.Owner, old, refreshed.Value.ETag), default)).Status);
        Assert.Equal(AppResultStatus.Conflict, (await handler.Handle(new(seeded.Event.Id, seeded.Owner, new("ignored", [], old), refreshed.Value.ETag, "old-module-client"), default)).Status);
        db.AuditLogs.Add(new() { Id = Guid.NewGuid(), ActorMemberId = seeded.Owner, EventId = seeded.Event.Id, GroupId = seeded.Event.GroupId, Action = EventArrangementConfirmationPolicy.ChangeAction, EntityType = "GroupEvent", EntityId = seeded.Event.Id, AfterJson = "{\"section\":\"people\"}", MetadataJson = "{}", OccurredUtc = DateTime.UtcNow.AddSeconds(1) });
        await db.SaveChangesAsync();
        refreshed = await new GetEventPlanQueryHandler(db, auth).Handle(new(seeded.Event.Id, seeded.Owner), default);
        Assert.False(refreshed.Value!.Plan.ModuleConfirmations!["TEAM.WORK"]);
        Assert.False(refreshed.Value.Plan.ModuleConfirmations["SERVICE.ROSTER"]);
        Assert.True(refreshed.Value.Plan.ModuleConfirmations["FOOD.HOSPITALITY"]);
    }

    [Theory]
    [InlineData("{\"moduleCode\":\"PLACE.RESOURCE\",\"section\":\"programme\",\"invalidatesRam\":true}", false)]
    [InlineData("{\"section\":\"unrecognized\"}", true)]
    [InlineData("[]", true)]
    [InlineData("{\"section\":42}", true)]
    public async Task ModuleConfirmation_DependencyAndUnknownAuditFailClosed(string audit, bool revokeAll)
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, false, PreparationModules);
        var snapshot = seeded.Plan;
        snapshot = snapshot with { Plan = snapshot.Plan with { ModuleConfirmations = EventCompositionDefinitions.Modules.ToDictionary(x => x.Code, _ => true) } };
        db.AuditLogs.Add(new() { Id = Guid.NewGuid(), ActorMemberId = seeded.Owner, EventId = seeded.Event.Id, GroupId = seeded.Event.GroupId, Action = EventArrangementConfirmationPolicy.ChangeAction, EntityType = "GroupEvent", EntityId = seeded.Event.Id, AfterJson = audit, MetadataJson = "{}", OccurredUtc = DateTime.UtcNow.AddSeconds(1) });
        await db.SaveChangesAsync();
        var current = await EventArrangementConfirmationPolicy.RefreshAsync(db, snapshot, default);
        Assert.False(current.Plan.ModuleConfirmations!["SAFETY.RAM"]);
        Assert.False(current.Plan.ModuleConfirmations["PLACE.RESOURCE"]);
        Assert.Equal(!revokeAll, current.Plan.ModuleConfirmations["PROGRAM.PRODUCTION"]);
        Assert.Equal(!revokeAll, current.Plan.ModuleConfirmations["FOOD.HOSPITALITY"]);
    }

}
