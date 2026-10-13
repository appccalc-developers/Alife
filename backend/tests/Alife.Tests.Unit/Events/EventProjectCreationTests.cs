using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Commands.CreateGroupEvent;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public class EventProjectCreationTests
{
    [Fact]
    public async Task PresetProject_RequiresOwnConfirmation_ThenCopiesIdentityAndAnswersAtomically()
    {
        await using var db = new AlifeDbContext(new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var group = Guid.NewGuid(); var owner = Guid.NewGuid();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(group, owner, Arg.Any<CancellationToken>()).Returns(true);
        var engine = new EventCompositionEngine();
        var definition = EventCompositionDefinitions.ActivityTypesByCode["shared-meal"] with
        {
            Version = 4,
            PresetProjects = [new("shared-meal", new("Shared meal", "共同用餐"), new("", ""),
                ["meal"], new Dictionary<string, string> { ["foodService"] = "yes" }, false)]
        };
        IReadOnlyDictionary<string, EventActivityTypeDefinition> definitions =
            new Dictionary<string, EventActivityTypeDefinition> { [definition.Code] = definition };
        var catalog = Substitute.For<IEventActivityTemplateCatalog>();
        catalog.ActiveDefinitionsByCodeAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult(definitions));
        var handler = new CreateGroupEventCommandHandler(db, authorization,
            Substitute.For<IEventCacheInvalidationService>(), engine, catalog);
        var project = new PlannedActivity("project-" + Guid.NewGuid().ToString("N"), ["meal"],
            new("Shared meal", "共同用餐"), new(), SourcePresetKey: "shared-meal",
            SourceTemplateVersion: 4, Answers: EventProjectQuestionCatalog.ProjectSwitchCodes
                .ToDictionary(code => code, _ => new PlannedActivityAnswer("no", "human", true),
                    StringComparer.Ordinal)
                .Concat([new KeyValuePair<string, PlannedActivityAnswer>(
                    "foodService", new("yes", "template", false))])
                .ToDictionary(entry => entry.Key, entry => entry.Value, StringComparer.Ordinal),
            DefaultConfiguration: new(MinimumAge: 14, Capacity: 0));
        CreateGroupEventCommand Command(PlannedActivity value)
        {
            var plan = new ActivityPlanData([value], QuestionnaireVersion: 2);
            var compose = new EventPlanComposeRequest(EventCompositionDefinitions.SchemaVersion,
                "simple-social", new([]), [], ActivityTypeCode: "shared-meal", ActivityPlan: plan,
                ActivityTypeVersion: definition.Version,
                ModuleConfirmations: EventCompositionDefinitions.Modules.ToDictionary(
                    module => module.Code, _ => false, StringComparer.Ordinal));
            var preview = engine.Compose(compose, new("\"plan-new\"", HasAccountableOwner: true,
                ActivityTypesByCode: definitions));
            Assert.True(preview.IsSuccess, preview.Message);
            var start = new DateTime(2026, 12, 1, 8, 0, 0, DateTimeKind.Utc);
            return new(group, owner, "Meal", "聚餐", start, start.AddHours(2),
                EventCompositionTestData.CurrentEventData("Meal", "聚餐", start, start.AddHours(2)),
                Composition: compose, CompositionProposalHash: preview.Value!.ProposalHash,
                IdempotencyKey: Guid.NewGuid().ToString("N"),
                Arrangements: new());
        }

        var unconfirmed = await handler.Handle(Command(project), CancellationToken.None);
        Assert.Equal(AppResultStatus.ValidationError, unconfirmed.Status);
        Assert.Empty(await db.GroupEvents.ToArrayAsync());

        var confirmed = project with
        {
            PresetConfirmed = true,
            Answers = new Dictionary<string, PlannedActivityAnswer>(project.Answers!, StringComparer.Ordinal)
            {
                ["foodService"] = new("yes", "template", true)
            }
        };
        var created = await handler.Handle(Command(confirmed), CancellationToken.None);
        Assert.True(created.IsSuccess, created.Message);
        var stored = await db.EventActivityPlans.SingleAsync();
        var read = EventActivityPlanService.Parse(stored.DataJson);
        Assert.Single(read.Activities);
        Assert.Equal(confirmed.Id, read.Activities[0].Id);
        Assert.True(read.Activities[0].PresetConfirmed);
        Assert.Equal("yes", read.Activities[0].Answers!["foodService"].Value);
        Assert.Equal(14, read.Activities[0].DefaultConfiguration?.MinimumAge);
        Assert.Equal(0, read.Activities[0].DefaultConfiguration?.Capacity);
    }
}
