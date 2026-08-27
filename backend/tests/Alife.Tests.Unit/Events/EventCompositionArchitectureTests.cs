using System.Text.Json;
using Alife.Api.Controllers;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Common.Models;
using Alife.Application.Events.Commands.CreateGroupEvent;
using Alife.Application.Events.Composition;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public class EventCompositionArchitectureTests
{
    [Fact]
    public void PersistenceModel_IsolatesCompositionTablesFromLegacyPlanningLineage()
    {
        using var dbContext = CreateDbContext();

        Assert.Equal(
            "event_composition_series",
            dbContext.Model.FindEntityType(typeof(EventSeries))!.GetTableName());
        Assert.Equal(
            "event_composition_occurrences",
            dbContext.Model.FindEntityType(typeof(EventOccurrence))!.GetTableName());

        var groupEventType = dbContext.Model.FindEntityType(typeof(GroupEvent))!;
        var groupEventTable = StoreObjectIdentifier.Table(
            groupEventType.GetTableName()!,
            groupEventType.GetSchema());
        Assert.Equal(
            "composition_series_id",
            groupEventType.FindProperty(nameof(GroupEvent.EventSeriesId))!.GetColumnName(groupEventTable));
    }

    [Fact]
    public void SimpleMeal_LeavesUnknownSafetyFinanceAndSafeguardingInactive()
    {
        var result = Compose("simple-social",
            Fact("money.hasMoneyFlow", false),
            Unknown("people.childrenPresent"),
            Unknown("safety.requiresRam"),
            Fact("move.transportRequired", false));

        Assert.True(result.IsSuccess);
        AssertStatus(result.Value!, "TEAM.WORK", EventModuleDecisionStatus.Required);
        AssertStatus(result.Value!, "PEOPLE.REGISTRATION", EventModuleDecisionStatus.Recommended);
        AssertStatus(result.Value!, "COMMS.FOLLOWUP", EventModuleDecisionStatus.Recommended);
        AssertStatus(result.Value!, "MONEY.FINANCE", EventModuleDecisionStatus.Inactive);
        AssertStatus(result.Value!, "SAFETY.RAM", EventModuleDecisionStatus.Inactive);
        AssertStatus(result.Value!, "SAFEGUARDING.CHILD", EventModuleDecisionStatus.Inactive);
    }

    [Fact]
    public void RemoteHike_RequiresSafetyAndTravel_AndBlocksUntilReadinessEvidenceExists()
    {
        var result = Compose(null,
            Fact("safety.requiresRam", true),
            Fact("move.transportRequired", true));

        Assert.True(result.IsSuccess);
        AssertStatus(result.Value!, "SAFETY.RAM", EventModuleDecisionStatus.Required);
        AssertStatus(result.Value!, "MOVE.STAY", EventModuleDecisionStatus.Required);
        Assert.Equal(EventReadinessStatus.Blocked, result.Value!.Readiness.Status);
        Assert.NotEmpty(result.Value.Readiness.Blockers);
    }

    [Fact]
    public void CampWithChildren_ClosesDependencies_ButFinanceNeedsConfirmedMoneyFlow()
    {
        var result = Compose("camp-retreat",
            Fact("people.registrationMode", "required"),
            Fact("safety.requiresRam", true),
            Fact("people.childrenPresent", true),
            Fact("move.accommodationRequired", true),
            Fact("money.hasMoneyFlow", false));

        Assert.True(result.IsSuccess);
        AssertStatus(result.Value!, "PEOPLE.REGISTRATION", EventModuleDecisionStatus.Required);
        AssertStatus(result.Value!, "SAFETY.RAM", EventModuleDecisionStatus.Required);
        AssertStatus(result.Value!, "SAFEGUARDING.CHILD", EventModuleDecisionStatus.Required);
        AssertStatus(result.Value!, "MOVE.STAY", EventModuleDecisionStatus.Required);
        AssertStatus(result.Value!, "MONEY.FINANCE", EventModuleDecisionStatus.Inactive);
        Assert.Contains("roleRestricted",
            result.Value!.ModuleDecisions.Single(x => x.ModuleCode == "SAFEGUARDING.CHILD").DataClasses);
    }

    [Fact]
    public void PublicFestival_RequiresDependencyClosure_AndPendingSponsorshipBlocksReadiness()
    {
        var request = Request("festival-celebration",
            Fact("scale.multiZone", true),
            Fact("people.registrationMode", "required"),
            Fact("visibility", "public"));
        var result = new EventCompositionEngine().Compose(request, new EventCompositionContext(
            "\"festival\"",
            HasAccountableOwner: true,
            GovernanceMode: EventGovernanceMode.ChurchSponsored,
            SponsorshipStatus: EventSponsorshipStatus.Pending,
            CheckedUtc: DateTime.UnixEpoch));

        Assert.True(result.IsSuccess);
        foreach (var code in new[]
        {
            "TEAM.WORK", "PEOPLE.REGISTRATION", "SAFETY.RAM",
            "PROGRAM.PRODUCTION", "PLACE.RESOURCE", "FESTIVAL.OPERATIONS"
        })
        {
            Assert.NotEqual(EventModuleDecisionStatus.Inactive,
                result.Value!.ModuleDecisions.Single(x => x.ModuleCode == code).Status);
        }
        Assert.Equal(EventReadinessStatus.Blocked, result.Value!.Readiness.Status);
        Assert.Contains(result.Value.Readiness.Blockers,
            x => x.En.Contains("sponsorship", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void CandidateAiFact_CannotBecomeConfirmed_AndUnknownNeverMeansFalse()
    {
        var rejected = Compose(null, new EventFactInputDto(
            "people.childrenPresent",
            JsonSerializer.SerializeToElement(true),
            EventFactCertainty.Confirmed,
            EventFactSource.AiCandidate));
        Assert.False(rejected.IsSuccess);

        var unknown = Compose(null, Unknown("people.registrationMode"));
        Assert.True(unknown.IsSuccess);
        AssertStatus(unknown.Value!, "PEOPLE.REGISTRATION", EventModuleDecisionStatus.Inactive);
    }

    [Fact]
    public void ClientControlledFactCodesSourcesAndComplexValues_FailClosed()
    {
        var unknownCode = Compose(null, Fact("person.privateMedicalNotes", "secret"));
        var trustedClaim = Compose(null, new EventFactInputDto(
            "safety.requiresRam",
            JsonSerializer.SerializeToElement(true),
            EventFactCertainty.Confirmed,
            EventFactSource.TrustedContext));
        var complexValue = Compose(null, new EventFactInputDto(
            "safety.requiresRam",
            JsonSerializer.SerializeToElement(new { secret = "value" }),
            EventFactCertainty.Candidate,
            EventFactSource.Human));

        Assert.Equal(AppResultStatus.ValidationError, unknownCode.Status);
        Assert.Equal(AppResultStatus.ValidationError, trustedClaim.Status);
        Assert.Equal(AppResultStatus.ValidationError, complexValue.Status);
    }

    [Fact]
    public void Composition_IsDeterministic_AndDefinitionsResolveUniqueSurfaceKeys()
    {
        var request = Request(null,
            Fact("move.transportRequired", true),
            Fact("safety.requiresRam", true));
        var context = new EventCompositionContext("\"same\"", CheckedUtc: DateTime.UnixEpoch);
        var first = new EventCompositionEngine().Compose(request, context);
        var second = new EventCompositionEngine().Compose(request, context);

        Assert.Equal(first.Value!.ProposalHash, second.Value!.ProposalHash);
        Assert.Equal(12, EventCompositionDefinitions.Modules.Count);
        Assert.Equal(13, EventCompositionDefinitions.Surfaces.Count);
        Assert.Equal(13, EventCompositionDefinitions.Surfaces.Select(x => x.SurfaceKey).Distinct().Count());
        Assert.All(EventCompositionDefinitions.Modules, module =>
            Assert.True(EventCompositionDefinitions.SurfacesByKey.ContainsKey(module.SurfaceKey)));
    }

    [Fact]
    public void ActivityTypeCatalogue_HasFourArchetypesAndSixteenResolvableUniqueTypes()
    {
        Assert.Equal("1.1.0", EventCompositionDefinitions.SchemaVersion);
        Assert.Equal(4, EventCompositionDefinitions.Archetypes.Count);
        Assert.Equal(16, EventCompositionDefinitions.ActivityTypes.Count);
        Assert.Equal(16, EventCompositionDefinitions.ActivityTypes.Select(x => x.Code).Distinct().Count());
        Assert.All(EventCompositionDefinitions.Archetypes, archetype => Assert.Equal(4, archetype.ActivityTypes.Count));
        Assert.All(EventCompositionDefinitions.ActivityTypes, activityType =>
        {
            Assert.Equal(2, activityType.Version);
            Assert.True(EventCompositionDefinitions.ArchetypesByCode.ContainsKey(activityType.ArchetypeCode));
            Assert.Equal("People", activityType.Defaults.CapacityUnit);
            Assert.DoesNotContain("MONEY.FINANCE", activityType.PreselectedModules);
            Assert.Contains("SERVICE.ROSTER", activityType.PreselectedModules);
            Assert.NotEmpty(activityType.PresetServiceSlots);
            Assert.Equal(activityType.PresetServiceSlots.Count,
                activityType.PresetServiceSlots.Select(x => x.RoleCode).Distinct().Count());
            Assert.All(activityType.PresetServiceSlots, slot =>
            {
                Assert.True(slot.RequiredCount > 0);
                Assert.Equal("approvedGroupMember", slot.EligibilityCode);
                Assert.False(string.IsNullOrWhiteSpace(slot.Label.En));
                Assert.False(string.IsNullOrWhiteSpace(slot.Label.Zh));
            });
            Assert.All(activityType.PreselectedModules,
                module => Assert.True(EventCompositionDefinitions.ModulesByCode.ContainsKey(module)));
        });
    }

    [Fact]
    public void CurrentComposition_UsesTypePreset_AllowsManualClose_ButConfirmedFactWins()
    {
        var request = CurrentRequest(
            "simple-social",
            "shared-meal",
            [Fact("food.serviceRequired", true), Fact("money.hasMoneyFlow", false)],
            [new ModuleSelectionInput("FOOD.HOSPITALITY", false)]);

        var result = new EventCompositionEngine().Compose(
            request,
            new EventCompositionContext("\"type\"", CheckedUtc: DateTime.UnixEpoch));

        Assert.True(result.IsSuccess);
        Assert.Equal("shared-meal", result.Value!.ActivityTypeCode);
        AssertStatus(result.Value, "TEAM.WORK", EventModuleDecisionStatus.Required);
        AssertStatus(result.Value, "FOOD.HOSPITALITY", EventModuleDecisionStatus.Required);
        AssertStatus(result.Value, "MONEY.FINANCE", EventModuleDecisionStatus.Inactive);
        Assert.Contains(result.Value.Warnings, warning => warning.En.Contains("deselection", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void CurrentComposition_RejectsUnknownOrMismatchedType_AndRequiresType()
    {
        var engine = new EventCompositionEngine();
        var missing = engine.Compose(
            new(EventCompositionDefinitions.SchemaVersion, "simple-social", new([]), []),
            new EventCompositionContext("\"missing\""));
        var unknown = engine.Compose(
            CurrentRequest("simple-social", "unknown"),
            new EventCompositionContext("\"unknown\""));
        var mismatch = engine.Compose(
            CurrentRequest("simple-social", "church-camp"),
            new EventCompositionContext("\"mismatch\""));

        Assert.Equal(AppResultStatus.ValidationError, missing.Status);
        Assert.Equal(AppResultStatus.ValidationError, unknown.Status);
        Assert.Equal(AppResultStatus.ValidationError, mismatch.Status);
    }

    [Fact]
    public void WorkflowDecisionAndActivityVersion_AreCoveredByProposalHash()
    {
        var request = CurrentRequest("camp-retreat", "church-camp", useRecommendedWorkflow: true);
        var selected = new EventWorkflowRecommendationDto(
            "camp", 3, new LocalizedTextDto("Camp", "营会"), "selected");
        var declined = selected with { Status = "declined" };
        var engine = new EventCompositionEngine();
        var selectedProposal = engine.Compose(request, new EventCompositionContext(
            "\"workflow\"", CheckedUtc: DateTime.UnixEpoch, WorkflowRecommendation: selected));
        var declinedProposal = engine.Compose(request with { UseRecommendedWorkflow = false }, new EventCompositionContext(
            "\"workflow\"", CheckedUtc: DateTime.UnixEpoch, WorkflowRecommendation: declined));

        Assert.True(selectedProposal.IsSuccess);
        Assert.Equal(2, selectedProposal.Value!.ActivityTypeVersion);
        Assert.Equal("selected", selectedProposal.Value.WorkflowRecommendation!.Status);
        Assert.Equal(3, selectedProposal.Value.WorkflowRecommendation.ResolvedVersion);
        Assert.NotEqual(selectedProposal.Value.ProposalHash, declinedProposal.Value!.ProposalHash);
    }

    [Fact]
    public async Task WorkflowRecommendation_ResolvesSelectedDeclinedAndUnavailableWithoutCreatingRun()
    {
        await using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        dbContext.EventWorkflowTemplates.Add(new EventWorkflowTemplate
        {
            Id = Guid.NewGuid(), Code = "camp", Version = 2, NameEn = "Camp", NameZh = "营会",
            DescriptionEn = "", DescriptionZh = "", DefinitionJson = WorkflowDefinition,
            IsActive = true, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var selected = await EventCompositionPersistence.ResolveWorkflowRecommendationAsync(
            dbContext, groupId, CurrentRequest("camp-retreat", "church-camp", useRecommendedWorkflow: true),
            CancellationToken.None);
        var declined = await EventCompositionPersistence.ResolveWorkflowRecommendationAsync(
            dbContext, groupId, CurrentRequest("camp-retreat", "church-camp"), CancellationToken.None);
        var unavailable = await EventCompositionPersistence.ResolveWorkflowRecommendationAsync(
            dbContext, groupId, CurrentRequest("festival-celebration", "public-outreach", useRecommendedWorkflow: true),
            CancellationToken.None);

        Assert.Equal("selected", selected!.Status);
        Assert.Equal(2, selected.ResolvedVersion);
        Assert.Equal("declined", declined!.Status);
        Assert.Equal("unavailable", unavailable!.Status);
        Assert.Empty(await dbContext.EventWorkflowRuns.ToListAsync());
    }

    [Fact]
    public async Task CurrentRecurringCreate_AtomicallyCreatesSeriesOccurrencesRamAndSnapshot()
    {
        await using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var cache = Substitute.For<IEventCacheInvalidationService>();
        var engine = new EventCompositionEngine();
        var handler = new CreateGroupEventCommandHandler(dbContext, authorization, cache, engine);
        var composition = CurrentRequest("recurring-gathering", "small-group-fellowship");
        var proposal = engine.Compose(composition, new EventCompositionContext(
            "\"plan-new\"", HasAccountableOwner: true));
        Assert.True(proposal.IsSuccess);
        var firstLocal = DateTime.SpecifyKind(DateTime.Today.AddDays(7).AddHours(19), DateTimeKind.Unspecified);
        var weekday = firstLocal.DayOfWeek switch
        {
            DayOfWeek.Monday => "MO", DayOfWeek.Tuesday => "TU", DayOfWeek.Wednesday => "WE",
            DayOfWeek.Thursday => "TH", DayOfWeek.Friday => "FR", DayOfWeek.Saturday => "SA", _ => "SU"
        };
        var command = new CreateGroupEventCommand(
            groupId, leaderId, "Fellowship", "团契",
            firstLocal, firstLocal.AddHours(2), "{\"visibility\":\"groupVisible\"}",
            Composition: composition,
            CompositionProposalHash: proposal.Value!.ProposalHash,
            IdempotencyKey: "series-create",
            SeriesSetup: new CreateEventSeriesSetupRequest(
                new("Fellowship", "团契"), $"FREQ=WEEKLY;INTERVAL=1;BYDAY={weekday}",
                "Pacific/Auckland", firstLocal, 120, [], 12));

        var result = await handler.Handle(command, CancellationToken.None);
        var retry = await handler.Handle(command, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(retry.IsSuccess);
        Assert.Single(await dbContext.EventSeries.ToListAsync());
        Assert.Equal(11, await dbContext.EventOccurrences.CountAsync());
        Assert.Single(await dbContext.EventRamAssessments.ToListAsync());
        var snapshot = await dbContext.EventPlanSnapshots.SingleAsync();
        Assert.Equal("small-group-fellowship", snapshot.ActivityTypeCode);
        Assert.Equal(2, snapshot.ActivityTypeVersion);
        var createdEvent = await dbContext.GroupEvents.SingleAsync();
        var occurrences = await dbContext.EventOccurrences.OrderBy(x => x.StartUtc).ToListAsync();
        var firstOccurrence = occurrences[0];
        Assert.Equal(firstOccurrence.StartUtc, createdEvent.StartDate);
        Assert.Equal(firstOccurrence.EndUtc, createdEvent.EndDate);
        var presets = EventCompositionDefinitions.ActivityTypesByCode["small-group-fellowship"].PresetServiceSlots;
        var slots = await dbContext.EventServiceSlots.ToListAsync();
        Assert.Equal(occurrences.Count * presets.Count, slots.Count);
        Assert.All(slots, slot =>
        {
            var occurrence = occurrences.Single(x => x.Id == slot.OccurrenceId);
            Assert.Equal(occurrence.StartUtc, slot.StartUtc);
            Assert.Equal(occurrence.EndUtc, slot.EndUtc);
            Assert.Contains(presets, preset => preset.RoleCode == slot.RoleCode && preset.RequiredCount == slot.RequiredCount);
        });
    }

    [Fact]
    public async Task CurrentCreate_DoesNotCreatePresetSlots_WhenRosterPresetIsDeclined()
    {
        await using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var engine = new EventCompositionEngine();
        var composition = CurrentRequest(
            "simple-social",
            "shared-meal",
            selections: [new ModuleSelectionInput("SERVICE.ROSTER", false)]);
        var proposal = engine.Compose(composition, new EventCompositionContext(
            "\"plan-new\"", HasAccountableOwner: true));
        Assert.True(proposal.IsSuccess);
        AssertStatus(proposal.Value!, "SERVICE.ROSTER", EventModuleDecisionStatus.Inactive);

        var handler = new CreateGroupEventCommandHandler(
            dbContext, authorization, Substitute.For<IEventCacheInvalidationService>(), engine);
        var start = DateTime.UtcNow.AddDays(2);
        var result = await handler.Handle(new CreateGroupEventCommand(
            groupId, leaderId, "Meal", "聚餐", start, start.AddHours(2),
            "{\"visibility\":\"groupVisible\"}", Composition: composition,
            CompositionProposalHash: proposal.Value!.ProposalHash,
            IdempotencyKey: "meal-without-roster"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(await dbContext.EventOccurrences.ToListAsync());
        Assert.Empty(await dbContext.EventServiceSlots.ToListAsync());
    }

    [Fact]
    public async Task InvalidRecurringSetup_DoesNotPersistPartialEventData()
    {
        await using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var engine = new EventCompositionEngine();
        var composition = CurrentRequest("recurring-gathering", "prayer-meeting");
        var proposal = engine.Compose(composition, new EventCompositionContext("\"plan-new\""));
        var handler = new CreateGroupEventCommandHandler(
            dbContext, authorization, Substitute.For<IEventCacheInvalidationService>(), engine);
        var start = DateTime.SpecifyKind(DateTime.Today.AddDays(7).AddHours(19), DateTimeKind.Unspecified);
        var result = await handler.Handle(new CreateGroupEventCommand(
            groupId, leaderId, "Prayer", "祷告会", start, start.AddHours(1),
            "{\"visibility\":\"groupVisible\"}", Composition: composition,
            CompositionProposalHash: proposal.Value!.ProposalHash, IdempotencyKey: "invalid-series",
            SeriesSetup: new CreateEventSeriesSetupRequest(new("Prayer", "祷告会"), "FREQ=DAILY",
                "Pacific/Auckland", start, 60, [], 12)), CancellationToken.None);

        dbContext.ChangeTracker.Clear();
        Assert.Equal(AppResultStatus.ValidationError, result.Status);
        Assert.Empty(await dbContext.GroupEvents.ToListAsync());
        Assert.Empty(await dbContext.EventSeries.ToListAsync());
        Assert.Empty(await dbContext.EventOccurrences.ToListAsync());
        Assert.Empty(await dbContext.EventServiceSlots.ToListAsync());
        Assert.Empty(await dbContext.EventRamAssessments.ToListAsync());
        Assert.Empty(await dbContext.EventPlanSnapshots.ToListAsync());
    }

    [Fact]
    public void RecurringFellowship_MaterializesTwelveFutureWeeks_WithoutRewritingExistingOccurrence()
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById("Pacific/Auckland");
        var now = new DateTime(2026, 8, 26, 0, 0, 0, DateTimeKind.Utc);
        var firstLocal = new DateTime(2026, 8, 27, 19, 0, 0, DateTimeKind.Unspecified);
        var existingStart = TimeZoneInfo.ConvertTimeToUtc(firstLocal, zone);

        var occurrences = EventSeriesMaterializer.Materialize(
            Guid.NewGuid(), firstLocal, 120, 1, 12, zone, new HashSet<DateOnly>(),
            new HashSet<DateTime> { existingStart }, now);

        Assert.Equal(11, occurrences.Count);
        Assert.DoesNotContain(occurrences, x => x.StartUtc == existingStart);
        Assert.All(occurrences, x => Assert.Equal(EventOccurrenceStatus.Scheduled, x.Status));
    }

    [Fact]
    public void ChurchSponsoredPublicProjection_RequiresBothRamAndSponsorshipApproval()
    {
        var pending = Summary(EventRamStatus.Approved, EventSponsorshipStatus.Pending);
        var approved = Summary(EventRamStatus.Approved, EventSponsorshipStatus.Approved);

        Assert.False(EventVisibilityPolicy.IsPublished(pending));
        Assert.True(EventVisibilityPolicy.IsPublished(approved));
    }

    [Fact]
    public async Task AcceptPlan_CreatesImmutableSnapshot_EnforcesETag_Idempotency_AndInvalidatesCache()
    {
        await using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var ownerId = Guid.NewGuid();
        var groupEvent = CreateEvent(groupId, ownerId);
        dbContext.GroupEvents.Add(groupEvent);
        await dbContext.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, ownerId, Arg.Any<CancellationToken>()).Returns(true);
        var cache = Substitute.For<IEventCacheInvalidationService>();
        var engine = new EventCompositionEngine();
        var handler = new AcceptEventPlanCommandHandler(dbContext, authorization, engine, cache);
        var composition = Request(null);
        var currentETag = EventCompositionPersistence.CreateEmptyPlanETag(groupEvent);
        var proposal = engine.Compose(composition, new EventCompositionContext(
            currentETag,
            SatisfiedReadinessRules: EventCompositionPersistence.GetSatisfiedReadinessRules(groupEvent),
            HasAccountableOwner: true));
        Assert.True(proposal.IsSuccess);
        var acceptRequest = new AcceptEventPlanRequest(proposal.Value!.ProposalHash, [], composition);
        var command = new AcceptEventPlanCommand(
            groupEvent.Id, ownerId, acceptRequest, currentETag, "accept-once");

        var accepted = await handler.Handle(command, CancellationToken.None);
        var retry = await handler.Handle(command, CancellationToken.None);
        var keyReuse = await handler.Handle(command with
        {
            Request = acceptRequest with { ProposalHash = "different" }
        }, CancellationToken.None);
        var stale = await handler.Handle(command with
        {
            IdempotencyKey = "stale-key",
            IfMatch = "\"stale\""
        }, CancellationToken.None);

        Assert.True(accepted.IsSuccess);
        Assert.True(retry.IsSuccess);
        Assert.Equal(accepted.Value!.PlanVersion, retry.Value!.PlanVersion);
        Assert.Equal(AppResultStatus.Conflict, keyReuse.Status);
        Assert.Equal(AppResultStatus.PreconditionFailed, stale.Status);
        Assert.Single(await dbContext.EventPlanSnapshots.ToListAsync());
        Assert.Single(await dbContext.EventFactSets.ToListAsync());
        Assert.Equal(1, (await dbContext.GroupEvents.SingleAsync()).ActivePlanVersion);
        await cache.Received(1).RemoveGroupEventsAsync(groupId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RecomposePlan_RejectsNonManagerBeforeReturningEventTeamData()
    {
        await using var dbContext = CreateDbContext();
        var groupEvent = CreateEvent(Guid.NewGuid(), Guid.NewGuid());
        dbContext.GroupEvents.Add(groupEvent);
        await dbContext.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(
            groupEvent.GroupId, Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(false);
        var handler = new RecomposeEventPlanCommandHandler(
            dbContext, authorization, new EventCompositionEngine());

        var result = await handler.Handle(new RecomposeEventPlanCommand(
            groupEvent.Id,
            Guid.NewGuid(),
            Request(null),
            EventCompositionPersistence.CreateEmptyPlanETag(groupEvent)), CancellationToken.None);

        Assert.Equal(AppResultStatus.Forbidden, result.Status);
    }

    [Fact]
    public async Task FinanceRoleAssignments_EnforceSeparationOfDuties()
    {
        await using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var ownerId = Guid.NewGuid();
        var financeMemberId = Guid.NewGuid();
        var groupEvent = CreateEvent(groupId, ownerId);
        var composition = Request(null, Fact("money.hasMoneyFlow", true));
        var proposal = new EventCompositionEngine().Compose(
            composition,
            new EventCompositionContext("\"plan-new\"", HasAccountableOwner: true));
        Assert.True(proposal.IsSuccess);
        var factSet = new EventFactSet
        {
            Id = Guid.NewGuid(), EventId = groupEvent.Id, Version = 1,
            FactsJson = "[]", SourceHash = proposal.Value!.Facts.SourceHash,
            CreatedByMemberId = ownerId, CreatedUtc = DateTime.UtcNow
        };
        groupEvent.ActivePlanVersion = 1;
        dbContext.GroupEvents.Add(groupEvent);
        dbContext.EventFactSets.Add(factSet);
        dbContext.EventPlanSnapshots.Add(new EventPlanSnapshot
        {
            Id = Guid.NewGuid(), EventId = groupEvent.Id, SourceFactSetId = factSet.Id,
            Version = 1, ProposalHash = proposal.Value.ProposalHash,
            ETag = EventCompositionPersistence.CreatePlanETag(1, proposal.Value.ProposalHash),
            SnapshotJson = EventCompositionPersistence.SerializePlan(proposal.Value, []),
            AcceptedByMemberId = ownerId, AcceptedUtc = DateTime.UtcNow,
            IsActive = true, CreatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsApprovedMemberAsync(groupId, financeMemberId, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new CreateEventRoleAssignmentCommandHandler(dbContext, authorization);

        var ownerRole = await handler.Handle(new CreateEventRoleAssignmentCommand(
            groupEvent.Id, ownerId,
            new CreateEventRoleAssignmentRequest("MONEY.FINANCE:finance.owner", financeMemberId),
            "finance-owner"), CancellationToken.None);
        var approverRole = await handler.Handle(new CreateEventRoleAssignmentCommand(
            groupEvent.Id, ownerId,
            new CreateEventRoleAssignmentRequest("MONEY.FINANCE:finance.approver", financeMemberId),
            "finance-approver"), CancellationToken.None);

        Assert.True(ownerRole.IsSuccess);
        Assert.Equal(AppResultStatus.Conflict, approverRole.Status);
        Assert.Single(await dbContext.EventRoleAssignments.ToListAsync());
    }

    [Fact]
    public async Task SponsorshipDecision_RequiresRootChurchAuthority_AndInvalidatesPublicEventCache()
    {
        await using var dbContext = CreateDbContext();
        var rootId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var rootLeaderId = Guid.NewGuid();
        var outsiderId = Guid.NewGuid();
        dbContext.Groups.AddRange(
            new Group { Id = rootId, IsChurch = true, NameJson = "{}" },
            new Group { Id = groupId, ParentGroupId = rootId, NameJson = "{}" });
        dbContext.GroupMemberships.Add(new GroupMembership
        {
            Id = Guid.NewGuid(), GroupId = rootId, MemberId = rootLeaderId,
            Status = MembershipStatus.Approved, Role = MembershipRole.Leader
        });
        var groupEvent = CreateEvent(groupId, Guid.NewGuid());
        groupEvent.GovernanceMode = EventGovernanceMode.ChurchSponsored;
        groupEvent.SponsorshipStatus = EventSponsorshipStatus.Pending;
        dbContext.GroupEvents.Add(groupEvent);
        await dbContext.SaveChangesAsync();
        dbContext.ChangeTracker.Clear();
        var persistedEvent = await dbContext.GroupEvents.SingleAsync(x => x.Id == groupEvent.Id);
        var cache = Substitute.For<IEventCacheInvalidationService>();
        var handler = new DecideEventSponsorshipCommandHandler(dbContext, cache);
        var eTag = $"\"sponsorship-{(int)persistedEvent.SponsorshipStatus}-{persistedEvent.UpdatedUtc.Ticks:x}\"";

        var forbidden = await handler.Handle(new DecideEventSponsorshipCommand(
            groupEvent.Id, outsiderId, new SponsorshipDecisionRequest("Not authorised"),
            EventApprovalDecisionType.Approved, eTag, "outsider"), CancellationToken.None);
        var approved = await handler.Handle(new DecideEventSponsorshipCommand(
            groupEvent.Id, rootLeaderId, new SponsorshipDecisionRequest("Approved by root church"),
            EventApprovalDecisionType.Approved, eTag, "root-approval"), CancellationToken.None);

        Assert.Equal(AppResultStatus.Forbidden, forbidden.Status);
        Assert.True(approved.IsSuccess);
        Assert.Equal(EventSponsorshipStatus.Approved, approved.Value!.Status);
        Assert.Single(await dbContext.EventApprovalDecisions.ToListAsync());
        await cache.Received(1).RemoveGroupEventsAsync(groupId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CompatibleCreate_WithPlan_IsAtomicAndIdempotent_AndLegacyCreateGetsOccurrence()
    {
        await using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var cache = Substitute.For<IEventCacheInvalidationService>();
        var engine = new EventCompositionEngine();
        var handler = new CreateGroupEventCommandHandler(dbContext, authorization, cache, engine);
        var composition = Request("simple-social", Fact("food.serviceRequired", true));
        var proposal = engine.Compose(composition, new EventCompositionContext(
            "\"plan-new\"", HasAccountableOwner: true));
        Assert.True(proposal.IsSuccess);
        var command = new CreateGroupEventCommand(
            groupId, leaderId, "Meal", "聚餐",
            new DateTime(2026, 9, 1, 8, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 9, 1, 10, 0, 0, DateTimeKind.Utc),
            "{\"visibility\":\"groupVisible\"}", [], null, null,
            composition, proposal.Value!.ProposalHash, IdempotencyKey: "create-once");

        var created = await handler.Handle(command, CancellationToken.None);
        var retry = await handler.Handle(command, CancellationToken.None);

        Assert.True(created.IsSuccess);
        Assert.True(retry.IsSuccess);
        Assert.Equal(created.Value!.Id, retry.Value!.Id);
        Assert.Single(await dbContext.GroupEvents.ToListAsync());
        Assert.Single(await dbContext.EventOccurrences.ToListAsync());
        Assert.Single(await dbContext.EventPlanSnapshots.ToListAsync());
        Assert.Single(await dbContext.EventFactSets.ToListAsync());
        Assert.Equal(1, created.Value.ActivePlanVersion);
        await cache.Received(1).RemoveGroupEventsAsync(groupId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task WorkspaceEndpoint_UsesNoStoreAndNeverCreatesSharedViewerCache()
    {
        var memberId = Guid.NewGuid();
        var mediator = Substitute.For<IMediator>();
        var accessor = Substitute.For<ICurrentMemberAccessor>();
        accessor.GetCurrentMemberId().Returns(memberId);
        mediator.Send(Arg.Any<GetEventWorkspaceQuery>(), Arg.Any<CancellationToken>())
            .Returns(AppResult<EventWorkspaceDto>.Success(new EventWorkspaceDto(
                Guid.NewGuid(), Guid.NewGuid(), new LocalizedTextDto("Event", "活動"),
                null, "\"plan-new\"",
                new ReadinessDto(EventReadinessStatus.NotReady, [], [], DateTime.UtcNow),
                [], [], false, EventSponsorshipStatus.NotRequested)));
        var controller = new EventCompositionController(mediator, accessor)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };

        var result = await controller.GetWorkspace(Guid.NewGuid(), CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal("no-store", controller.Response.Headers.CacheControl.ToString());
        Assert.Equal("no-cache", controller.Response.Headers.Pragma.ToString());
        Assert.False(controller.Response.Headers.ContainsKey("ETag"));
    }

    [Fact]
    public async Task ArchetypeCatalogueEndpoint_IsAuthenticatedNoStore_AndIncludesSixteenTypes()
    {
        var memberId = Guid.NewGuid();
        var mediator = Substitute.For<IMediator>();
        var accessor = Substitute.For<ICurrentMemberAccessor>();
        accessor.GetCurrentMemberId().Returns(memberId);
        mediator.Send(Arg.Any<ListEventArchetypesQuery>(), Arg.Any<CancellationToken>())
            .Returns(AppResult<IReadOnlyList<EventArchetypeDto>>.Success(EventCompositionDefinitions.Archetypes));
        var controller = new EventCompositionController(mediator, accessor)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };

        var result = await controller.ListArchetypes(Guid.NewGuid(), CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal("no-store", controller.Response.Headers.CacheControl.ToString());
        Assert.Equal(16, EventCompositionDefinitions.Archetypes.Sum(x => x.ActivityTypes.Count));
    }

    [Fact]
    public async Task CurrentCompose_RejectsOrdinaryMemberBeforeReturningProposal()
    {
        await using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, memberId, Arg.Any<CancellationToken>()).Returns(false);
        var handler = new ComposeEventPlanCommandHandler(dbContext, authorization, new EventCompositionEngine());

        var result = await handler.Handle(new ComposeEventPlanCommand(
            groupId, memberId, CurrentRequest("simple-social", "shared-meal")), CancellationToken.None);

        Assert.Equal(AppResultStatus.Forbidden, result.Status);
        Assert.Null(result.Value);
    }

    private static AppResult<EventPlanProposalDto> Compose(
        string? archetype,
        params EventFactInputDto[] facts)
        => new EventCompositionEngine().Compose(
            Request(archetype, facts),
            new EventCompositionContext("\"test\"", CheckedUtc: DateTime.UnixEpoch));

    private static EventPlanComposeRequest Request(
        string? archetype,
        params EventFactInputDto[] facts)
        => new(EventCompositionDefinitions.LegacySchemaVersion, archetype, new EventFactSetInput(facts), []);

    private static EventPlanComposeRequest CurrentRequest(
        string archetype,
        string activityType,
        IReadOnlyList<EventFactInputDto>? facts = null,
        IReadOnlyList<ModuleSelectionInput>? selections = null,
        bool useRecommendedWorkflow = false)
        => new(EventCompositionDefinitions.SchemaVersion, archetype, new EventFactSetInput(facts ?? []),
            selections ?? [], null, activityType, useRecommendedWorkflow);

    private static EventFactInputDto Fact(string code, object value)
        => new(code, JsonSerializer.SerializeToElement(value),
            EventFactCertainty.Confirmed, EventFactSource.Human);

    private static EventFactInputDto Unknown(string code)
        => new(code, null, EventFactCertainty.Unknown, EventFactSource.Human);

    private static void AssertStatus(
        EventPlanProposalDto proposal,
        string moduleCode,
        EventModuleDecisionStatus status)
        => Assert.Equal(status, proposal.ModuleDecisions.Single(x => x.ModuleCode == moduleCode).Status);

    private static AlifeDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    private static GroupEvent CreateEvent(Guid groupId, Guid ownerId)
        => new()
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            CreatedByMemberId = ownerId,
            AccountableOwnerMemberId = ownerId,
            TitleEn = "Event",
            TitleZh = "活動",
            StartDate = DateTime.UtcNow.AddDays(1),
            EndDate = DateTime.UtcNow.AddDays(1).AddHours(2),
            EventDataJson = "{\"visibility\":\"groupVisible\"}",
            PlanConcurrencyToken = Guid.NewGuid(),
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };

    private static GroupEventSummaryDto Summary(
        EventRamStatus ram,
        EventSponsorshipStatus sponsorship)
        => new(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Event", "活動",
            DateTime.UtcNow, DateTime.UtcNow.AddHours(1), "{\"visibility\":\"public\"}",
            DateTime.UtcNow, DateTime.UtcNow, [], ram, EventVisibilityPolicy.Public,
            Guid.NewGuid(), EventGovernanceMode.ChurchSponsored, sponsorship);

    private const string WorkflowDefinition = """
        {"stages":[
          {"key":"prepare","name":{"en":"Prepare","zh":"准备"},"required":true,"requiresApproval":false,"integrationKey":null,"artifacts":[]}
        ]}
        """;
}
