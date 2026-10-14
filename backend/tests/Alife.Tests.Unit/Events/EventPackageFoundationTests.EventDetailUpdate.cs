using System.Text.Json;
using Alife.Api.Controllers;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Common.Models;
using Alife.Application.Events.Commands.CreateGroupEvent;
using Alife.Application.Events.Commands.UpdateGroupEvent;
using Alife.Application.Events.Composition;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed partial class EventPackageFoundationTests
{
    [Fact]
    public async Task DetailUpdate_AcceptsReviewedEvent2Composition_AndCommitsOnePlanAtomically()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        var dataJson = CurrentEventData(seeded.Event, "Updated title", "更新后的标题");
        var input = EventPreparationPolicy.WithSavedDetails(
            new GroupEvent { EventDataJson = dataJson },
            EventCompositionTestData.CurrentRequest(facts: EventProjectQuestionCatalog.MovedEventFactCodes.Values
                .Select(code => new EventFactInputDto(
                    code,
                    JsonSerializer.SerializeToElement(false),
                    Alife.Domain.Enums.EventFactCertainty.Confirmed,
                    Alife.Domain.Enums.EventFactSource.Human))
                .ToArray()) with
            {
                BasePlanVersion = seeded.Plan.PlanVersion,
                ActivityPlan = EventActivityPlanService.Empty
            });
        var engine = new EventCompositionEngine();
        var preview = await new RecomposeEventPlanCommandHandler(db, Authorization(), engine).Handle(
            new(seeded.Event.Id, seeded.Owner, input, seeded.Plan.ETag), default);
        Assert.True(preview.IsSuccess, preview.Message);

        var handler = new UpdateGroupEventCommandHandler(
            db,
            Authorization(),
            Substitute.For<IEventCacheInvalidationService>(),
            new EventPackageInvalidationService(db),
            engine);
        var result = await handler.Handle(new(
            seeded.Event.Id,
            seeded.Owner,
            "Updated title",
            "更新后的标题",
            seeded.Event.StartDate,
            seeded.Event.EndDate,
            dataJson,
            [],
            input,
            preview.Value!.ProposalHash,
            seeded.Plan.ETag,
            seeded.Event.UpdatedUtc.ToString("O")), default);

        Assert.True(result.IsSuccess, result.Message);
        Assert.Equal(2, await db.EventFactSets.CountAsync());
        Assert.Equal(2, await db.EventPlanSnapshots.CountAsync());
        Assert.Single(await db.EventPlanSnapshots.Where(x => x.IsActive).ToListAsync());
        var activity = await db.EventActivityPlans.SingleAsync();
        Assert.Equal(2, activity.QuestionnaireVersion);
        Assert.Equal("Updated title", (await db.GroupEvents.SingleAsync()).TitleEn);
    }

    [Fact]
    public async Task DetailUpdate_WithStaleProposal_RollsBackEveryEventWrite()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        var originalTitle = seeded.Event.TitleEn;
        var dataJson = CurrentEventData(seeded.Event, "Rejected title", "不应保存");
        var input = EventPreparationPolicy.WithSavedDetails(
            new GroupEvent { EventDataJson = dataJson },
            EventCompositionTestData.CurrentRequest(facts: EventProjectQuestionCatalog.MovedEventFactCodes.Values
                .Select(code => new EventFactInputDto(
                    code,
                    JsonSerializer.SerializeToElement(false),
                    Alife.Domain.Enums.EventFactCertainty.Confirmed,
                    Alife.Domain.Enums.EventFactSource.Human))
                .ToArray()) with
            {
                BasePlanVersion = seeded.Plan.PlanVersion,
                ActivityPlan = EventActivityPlanService.Empty
            });
        var handler = new UpdateGroupEventCommandHandler(
            db,
            Authorization(),
            Substitute.For<IEventCacheInvalidationService>(),
            new EventPackageInvalidationService(db),
            new EventCompositionEngine());

        var result = await handler.Handle(new(
            seeded.Event.Id,
            seeded.Owner,
            "Rejected title",
            "不应保存",
            seeded.Event.StartDate,
            seeded.Event.EndDate,
            dataJson,
            [],
            input,
            new string('0', 64),
            seeded.Plan.ETag,
            seeded.Event.UpdatedUtc.ToString("O")), default);

        Assert.Equal(AppResultStatus.PreconditionFailed, result.Status);
        Assert.Equal(originalTitle, (await db.GroupEvents.SingleAsync()).TitleEn);
        Assert.Single(await db.EventFactSets.ToListAsync());
        Assert.Single(await db.EventPlanSnapshots.ToListAsync());
        Assert.Empty(await db.EventActivityPlans.ToListAsync());
    }

    [Fact]
    public async Task DetailUpdate_WithStalePlanETag_RollsBackEveryEventWrite()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        var command = await ReviewedUpdateAsync(db, seeded, "Rejected title", "不应保存");
        var handler = new UpdateGroupEventCommandHandler(
            db,
            Authorization(),
            Substitute.For<IEventCacheInvalidationService>(),
            new EventPackageInvalidationService(db),
            new EventCompositionEngine());

        var result = await handler.Handle(command with { PlanETag = "\"plan-stale\"" }, default);

        Assert.Equal(AppResultStatus.PreconditionFailed, result.Status);
        Assert.Equal(seeded.Event.TitleEn, (await db.GroupEvents.SingleAsync()).TitleEn);
        Assert.Single(await db.EventFactSets.ToListAsync());
        Assert.Single(await db.EventPlanSnapshots.ToListAsync());
        Assert.Empty(await db.EventActivityPlans.ToListAsync());
    }

    [Fact]
    public async Task CreateAndUpdate_MissingComposition_ReturnFixedUnsupportedSchemaCode()
    {
        await using var db = CreateDb();
        var cache = Substitute.For<IEventCacheInvalidationService>();
        var create = await new CreateGroupEventCommandHandler(db, Authorization(), cache).Handle(new(
            Guid.NewGuid(), Guid.NewGuid(), "Title", "标题", DateTime.UtcNow, DateTime.UtcNow.AddHours(1), "{}"), default);
        var update = await new UpdateGroupEventCommandHandler(
            db, Authorization(), cache, new EventPackageInvalidationService(db)).Handle(new(
            Guid.NewGuid(), Guid.NewGuid(), "Title", "标题", DateTime.UtcNow,
            DateTime.UtcNow.AddHours(1), "{}"), default);

        Assert.Equal(AppResultStatus.ValidationError, create.Status);
        Assert.Equal(EventCompositionDefinitions.UnsupportedSchemaErrorCode, create.Code);
        Assert.Equal(AppResultStatus.ValidationError, update.Status);
        Assert.Equal(EventCompositionDefinitions.UnsupportedSchemaErrorCode, update.Code);
    }

    [Fact]
    public async Task CreateAndUpdateApi_MissingOrLegacyComposition_ReturnSchemaErrorBeforeDispatch()
    {
        var mediator = Substitute.For<IMediator>();
        var member = Substitute.For<ICurrentMemberAccessor>();
        member.GetCurrentMemberId().Returns(Guid.NewGuid());
        var controller = new EventsController(mediator, member);
        var request = new EventsController.CreateGroupEventRequest(
            "Title", "标题", DateTime.UtcNow, DateTime.UtcNow.AddHours(1), "{}", [], null,
            null, "");

        var response = await controller.CreateGroupEvent(Guid.NewGuid(), request, default);
        var updateResponse = await controller.UpdateEvent(Guid.NewGuid(),
            new EventsController.UpdateGroupEventRequest(
                "Title", "标题", DateTime.UtcNow, DateTime.UtcNow.AddHours(1), "{}", [],
                null, "", ""), default);
        var legacyResponse = await controller.CreateGroupEvent(Guid.NewGuid(), request with
        {
            Composition = new EventsController.EventWriteCompositionRequest(
                "1.3.0", new([]), [],
                EventCompositionDefinitions.Modules.ToDictionary(x => x.Code, _ => false),
                EventActivityPlanService.Empty)
        }, default);

        var badRequest = Assert.IsType<BadRequestObjectResult>(response);
        using var body = JsonDocument.Parse(JsonSerializer.Serialize(badRequest.Value));
        Assert.Equal(EventCompositionDefinitions.UnsupportedSchemaErrorCode,
            body.RootElement.GetProperty("code").GetString());
        foreach (var rejected in new[] { updateResponse, legacyResponse })
        {
            var rejectedRequest = Assert.IsType<BadRequestObjectResult>(rejected);
            using var rejectedBody = JsonDocument.Parse(JsonSerializer.Serialize(rejectedRequest.Value));
            Assert.Equal(EventCompositionDefinitions.UnsupportedSchemaErrorCode,
                rejectedBody.RootElement.GetProperty("code").GetString());
        }
        await mediator.DidNotReceiveWithAnyArgs().Send(default(CreateGroupEventCommand)!, default);
        await mediator.DidNotReceiveWithAnyArgs().Send(default(UpdateGroupEventCommand)!, default);
    }

    [Fact]
    public void EventWriteJson_RejectsUnknownNestedCompositionField()
    {
        var json = JsonSerializer.Serialize(new
        {
            titleEn = "Title",
            titleZh = "标题",
            startDate = DateTime.UtcNow,
            endDate = DateTime.UtcNow.AddHours(1),
            eventDataJson = "{}",
            contactProfileIds = Array.Empty<Guid>(),
            composition = new
            {
                schemaVersion = EventCompositionDefinitions.SchemaVersion,
                facts = new { items = Array.Empty<object>() },
                humanSelections = Array.Empty<object>(),
                moduleConfirmations = EventCompositionDefinitions.Modules.ToDictionary(x => x.Code, _ => false),
                activityPlan = new
                {
                    activities = Array.Empty<object>(),
                    questionnaireVersion = 2,
                    legacyActivityType = "generic"
                }
            },
            compositionProposalHash = new string('a', 64),
            planETag = "\"plan-1\""
        });

        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<EventsController.UpdateGroupEventRequest>(
            json, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
    }

    [Fact]
    public async Task CreateApi_IncompleteComposition_ReturnsExplicitValidationCodeBeforeDispatch()
    {
        var mediator = Substitute.For<IMediator>();
        var member = Substitute.For<ICurrentMemberAccessor>();
        member.GetCurrentMemberId().Returns(Guid.NewGuid());
        var controller = new EventsController(mediator, member);
        var composition = new EventsController.EventWriteCompositionRequest(
            EventCompositionDefinitions.SchemaVersion,
            new([]),
            [],
            EventCompositionDefinitions.Modules.ToDictionary(x => x.Code, _ => false),
            null);
        var response = await controller.CreateGroupEvent(Guid.NewGuid(),
            new("Title", "标题", DateTime.UtcNow, DateTime.UtcNow.AddHours(1), "{}", [], null,
                composition, new string('a', 64)), default);

        var badRequest = Assert.IsType<BadRequestObjectResult>(response);
        using var body = JsonDocument.Parse(JsonSerializer.Serialize(badRequest.Value));
        Assert.Equal(EventCompositionRequestContract.InvalidCompositionErrorCode,
            body.RootElement.GetProperty("code").GetString());
        await mediator.DidNotReceiveWithAnyArgs().Send(default(CreateGroupEventCommand)!, default);
    }

    [Theory]
    [InlineData("{\"title\":{\"en\":\"A\",\"zh\":\"甲\"},\"title\":{\"en\":\"B\",\"zh\":\"乙\"}}")]
    [InlineData("{\"title\":{\"en\":\"A\",\"zh\":\"甲\",\"legacy\":\"x\"}}")]
    [InlineData("{\"galleryUrls\":[\"ok\",3]}")]
    public void EventDataJson_RejectsDuplicateKeysAndNonStrictNestedValues(string json)
    {
        Assert.NotNull(EventDataContract.Validate(json));
    }

    [Fact]
    public void EventDataJson_RequiresCanonicalOuterTitleAndDates()
    {
        var start = new DateTime(2026, 10, 20, 8, 0, 0, DateTimeKind.Utc);
        var end = start.AddHours(2);
        var json = JsonSerializer.Serialize(new
        {
            title = new { en = "Different", zh = "不同" },
            startDate = start,
            endDate = end
        });

        Assert.Equal("EventDataJson title must match the Event title fields.",
            EventDataContract.Validate(json, "Expected", "预期", start, end));
    }

    private static string CurrentEventData(GroupEvent item, string titleEn, string titleZh) =>
        JsonSerializer.Serialize(new
        {
            visibility = EventVisibilityPolicy.GroupVisible,
            title = new { en = titleEn, zh = titleZh },
            description = new { en = "Description", zh = "说明" },
            locationName = new { en = "Hall", zh = "礼堂" },
            startDate = item.StartDate,
            endDate = item.EndDate,
            registrationDeadline = item.StartDate,
            maxCapacity = 0,
            registrationMode = "none",
            capacityUnit = "People",
            hardConstraints = Array.Empty<object>(),
            currency = "NZD",
            galleryUrls = Array.Empty<string>(),
            timeZone = "Australia/Perth"
        });

    private static async Task<UpdateGroupEventCommand> ReviewedUpdateAsync(
        Alife.Infrastructure.Persistence.AlifeDbContext db,
        Seeded seeded,
        string titleEn,
        string titleZh)
    {
        var dataJson = CurrentEventData(seeded.Event, titleEn, titleZh);
        var input = EventPreparationPolicy.WithSavedDetails(
            new GroupEvent { EventDataJson = dataJson },
            EventCompositionTestData.CurrentRequest(facts: EventProjectQuestionCatalog.MovedEventFactCodes.Values
                .Select(code => new EventFactInputDto(
                    code,
                    JsonSerializer.SerializeToElement(false),
                    Alife.Domain.Enums.EventFactCertainty.Confirmed,
                    Alife.Domain.Enums.EventFactSource.Human))
                .ToArray()) with
            {
                BasePlanVersion = seeded.Plan.PlanVersion,
                ActivityPlan = EventActivityPlanService.Empty
            });
        var preview = await new RecomposeEventPlanCommandHandler(
            db, Authorization(), new EventCompositionEngine()).Handle(
            new(seeded.Event.Id, seeded.Owner, input, seeded.Plan.ETag), default);
        Assert.True(preview.IsSuccess, preview.Message);
        return new(
            seeded.Event.Id,
            seeded.Owner,
            titleEn,
            titleZh,
            seeded.Event.StartDate,
            seeded.Event.EndDate,
            dataJson,
            [],
            input,
            preview.Value!.ProposalHash,
            seeded.Plan.ETag,
            seeded.Event.UpdatedUtc.ToString("O"));
    }
}
