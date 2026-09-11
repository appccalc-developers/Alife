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

    private static EventPlanComposeRequest PreparationComposition(bool selected, int version) => new(
        "1.1.0", "simple-social", new(new[] { "people.volunteersRequired", "safety.requiresRam", "people.childrenPresent" }
            .Select(code => new EventFactInputDto(code, JsonSerializer.SerializeToElement(true),
                EventFactCertainty.Confirmed, EventFactSource.Human)).ToArray()),
        EventCompositionDefinitions.Modules.Select(module => new ModuleSelectionInput(module.Code,
            selected && PreparationModules.Contains(module.Code))).ToArray(), version, "shared-meal");

    [Fact]
    public async Task DraftTools_CanDisableReloadAndReenableAllFive_WithoutLosingFactsOrSavedRecords()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, false, PreparationModules);
        seeded.Event.PublicationStatus = EventPublicationStatus.Draft;
        seeded.Event.EventDataJson = "{\"visibility\":\"groupVisible\",\"maxCapacity\":30}";
        db.EventRamAssessments.Add(new() { EventId = seeded.Event.Id, RamDataJson = "{\"hazards\":[\"saved hazard\"]}" });
        db.EventEnrollments.Add(new() { Id = Guid.NewGuid(), EventId = seeded.Event.Id, MemberId = seeded.Owner });
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
            Assert.Single(await db.EventEnrollments.ToListAsync());
        }
        Assert.Equal(4, await db.EventPlanSnapshots.CountAsync());
        var service = new EventPackageService(db, authorization);
        var package = await service.GenerateAsync(seeded.Event.Id, seeded.Owner,
            new(EventPackageScopeType.Event, null, "1.0"), snapshot.ETag, "draft-disabled-tools", default);
        Assert.True(package.IsSuccess, package.Message);
        Assert.Equal(5, package.Value!.Manifest.Blockers.Count);
        var submitted = await service.SubmitAsync(seeded.Event.Id, package.Value.Id, seeded.Owner,
            package.Value.ETag, "cannot-submit-disabled-requirements", default);
        Assert.Equal(AppResultStatus.Conflict, submitted.Status);
        Assert.Equal(EventPackageStatus.Draft, (await db.EventPackages.SingleAsync()).Status);
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
        var dependencyOnly = engine.Compose(input with { Facts = new([]), HumanSelections =
            [new("TEAM.WORK", true), new("SAFEGUARDING.CHILD", true), new("PEOPLE.REGISTRATION", false)] },
            new("baseline", IsPreparationDraft: true));
        Assert.Single(EventCompositionEngine.FormalSubmissionModuleBlockers(dependencyOnly.Value!));
    }
}
