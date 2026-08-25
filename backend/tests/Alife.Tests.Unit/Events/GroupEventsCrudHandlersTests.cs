using Alife.Application.Events.Commands.CreateGroupEvent;
using Alife.Application.Events.Commands.DeleteGroupEvent;
using Alife.Application.Events.Commands.UpdateGroupEvent;
using Alife.Application.Events.Queries.GetGroupEvents;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public class GroupEventsCrudHandlersTests
{
    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    [Fact]
    public async Task CreateGroupEvent_WhenAuthorized_CreatesEvent()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var groupId = Guid.NewGuid();
        var currentMemberId = Guid.NewGuid();
        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, currentMemberId, Arg.Any<CancellationToken>())
            .Returns(true);

        var eventCacheInvalidationService = Substitute.For<IEventCacheInvalidationService>();
        var handler = new CreateGroupEventCommandHandler(dbContext, groupAuthorizationService, eventCacheInvalidationService);

        var result = await handler.Handle(
            new CreateGroupEventCommand(
                groupId,
                currentMemberId,
                "English Title",
                "中文標題",
                new DateTime(2026, 1, 10, 10, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 1, 10, 12, 0, 0, DateTimeKind.Utc),
                "{\"description\":\"test\",\"enabledModules\":[\"venue\"]}"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal(groupId, result.Value.GroupId);
        Assert.Equal("English Title", result.Value.TitleEn);
        Assert.Equal(EventVisibilityPolicy.GroupVisible, result.Value.Visibility);
        Assert.Equal(["venue"], result.Value.EnabledModules);
        Assert.Equal(1, await dbContext.GroupEvents.CountAsync());
    }

    [Fact]
    public async Task CreateGroupEvent_WithReviewedAiDraft_RecordsHumanConfirmationWithoutAiContent()
    {
        using var dbContext = CreateInMemoryDbContext();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        authorization.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new CreateGroupEventCommandHandler(
            dbContext,
            authorization,
            Substitute.For<IEventCacheInvalidationService>());

        var result = await handler.Handle(new CreateGroupEventCommand(
            groupId,
            leaderId,
            "Reviewed draft",
            "已核对草稿",
            DateTime.UtcNow.AddDays(1),
            DateTime.UtcNow.AddDays(1).AddHours(2),
            "{\"visibility\":\"groupVisible\"}",
            AiAssistanceReviewed: true), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var revision = await dbContext.EventPlanRevisions.SingleAsync();
        Assert.Equal("AI-assisted event draft confirmed by leader", revision.ChangeReason);
        var audit = await dbContext.AuditLogs.SingleAsync(x => x.Action == "event.ai-draft.confirmed");
        Assert.Equal(leaderId, audit.ActorMemberId);
        Assert.Contains("\"humanReviewed\":true", audit.MetadataJson);
        Assert.Contains("\"promptStored\":false", audit.MetadataJson);
        Assert.Contains("\"outputStored\":false", audit.MetadataJson);
        Assert.DoesNotContain("Reviewed draft", audit.MetadataJson);
    }

    [Fact]
    public async Task CreateGroupEvent_WithUnsupportedVisibility_IsRejected()
    {
        using var dbContext = CreateInMemoryDbContext();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        authorization.IsLeaderOrCoLeaderAsync(groupId, memberId, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new CreateGroupEventCommandHandler(
            dbContext,
            authorization,
            Substitute.For<IEventCacheInvalidationService>());

        var result = await handler.Handle(new CreateGroupEventCommand(
            groupId,
            memberId,
            "Event",
            "活动",
            DateTime.UtcNow,
            DateTime.UtcNow.AddHours(1),
            "{\"visibility\":\"secret\"}"), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Empty(dbContext.GroupEvents);
    }

    [Fact]
    public async Task CreateGroupEvent_WithLegacyWorkflowField_CreatesComposedPlanInstead()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var groupId = Guid.NewGuid();
        var currentMemberId = Guid.NewGuid();
        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, currentMemberId, Arg.Any<CancellationToken>())
            .Returns(true);
        dbContext.EventWorkflowTemplates.Add(new EventWorkflowTemplate
        {
            Id = Guid.NewGuid(),
            Code = "camp",
            Version = 3,
            NameEn = "Camp",
            NameZh = "营会",
            DescriptionEn = "Camp workflow",
            DescriptionZh = "营会工作流",
            DefinitionJson = WorkflowDefinition,
            IsActive = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var eventCacheInvalidationService = Substitute.For<IEventCacheInvalidationService>();
        var handler = new CreateGroupEventCommandHandler(dbContext, groupAuthorizationService, eventCacheInvalidationService);

        var result = await handler.Handle(
            new CreateGroupEventCommand(
                groupId,
                currentMemberId,
                "Camp",
                "营会",
                new DateTime(2026, 1, 10, 10, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 1, 12, 12, 0, 0, DateTimeKind.Utc),
                "{}",
                WorkflowTemplateCode: "CAMP"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var plan = await dbContext.EventPlans
            .Include(x => x.Modules)
            .Include(x => x.Revisions)
            .SingleAsync();
        Assert.Equal(result.Value!.Id, plan.EventId);
        Assert.Contains(plan.Modules, x => x.ModuleKey == "core");
        Assert.Contains(plan.Modules, x => x.ModuleKey == "communications");
        Assert.Single(plan.Revisions);
        Assert.Empty(dbContext.EventWorkflowRuns);
        Assert.Equal(1, await dbContext.GroupEvents.CountAsync());
        Assert.Equal(1, await dbContext.EventRamAssessments.CountAsync());
    }

    [Fact]
    public async Task CreateGroupEvent_WithUnknownLegacyWorkflowField_DoesNotBlockNewPlan()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var groupId = Guid.NewGuid();
        var currentMemberId = Guid.NewGuid();
        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, currentMemberId, Arg.Any<CancellationToken>())
            .Returns(true);
        var eventCacheInvalidationService = Substitute.For<IEventCacheInvalidationService>();
        var handler = new CreateGroupEventCommandHandler(dbContext, groupAuthorizationService, eventCacheInvalidationService);

        var result = await handler.Handle(
            new CreateGroupEventCommand(
                groupId,
                currentMemberId,
                "Event",
                "活动",
                DateTime.UtcNow,
                DateTime.UtcNow.AddHours(2),
                "{}",
                WorkflowTemplateCode: "missing"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(dbContext.GroupEvents);
        Assert.Single(dbContext.EventRamAssessments);
        Assert.Single(dbContext.EventPlans);
        Assert.Empty(dbContext.EventWorkflowRuns);
    }

    [Fact]
    public async Task CreateGroupEvent_WithAnotherGroupsLegacyWorkflowField_IgnoresIt()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var groupId = Guid.NewGuid();
        var otherGroupId = Guid.NewGuid();
        var currentMemberId = Guid.NewGuid();
        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, currentMemberId, Arg.Any<CancellationToken>())
            .Returns(true);
        dbContext.EventWorkflowTemplates.Add(new EventWorkflowTemplate
        {
            Id = Guid.NewGuid(),
            OwnerGroupId = otherGroupId,
            Code = "custom_other_group",
            Version = 1,
            NameEn = "Other group workflow",
            NameZh = "其他小组流程",
            DescriptionEn = "Private to another group",
            DescriptionZh = "只属于其他小组",
            DefinitionJson = WorkflowDefinition,
            IsActive = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var eventCacheInvalidationService = Substitute.For<IEventCacheInvalidationService>();
        var handler = new CreateGroupEventCommandHandler(dbContext, groupAuthorizationService, eventCacheInvalidationService);

        var result = await handler.Handle(new CreateGroupEventCommand(
            groupId,
            currentMemberId,
            "Event",
            "活动",
            DateTime.UtcNow,
            DateTime.UtcNow.AddHours(2),
            "{}",
            WorkflowTemplateCode: "custom_other_group"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(dbContext.GroupEvents);
        Assert.Single(dbContext.EventPlans);
        Assert.Empty(dbContext.EventWorkflowRuns);
    }

    [Fact]
    public async Task CreateGroupEvent_WhenAuthorized_DoesNotNotifyMembersBeforeRamApproval()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var approvedMemberId = Guid.NewGuid();
        var requestedMemberId = Guid.NewGuid();
        dbContext.GroupMemberships.AddRange(
            CreateMembership(groupId, leaderId, MembershipStatus.Approved, MembershipRole.Leader),
            CreateMembership(groupId, approvedMemberId, MembershipStatus.Approved, MembershipRole.Member),
            CreateMembership(groupId, requestedMemberId, MembershipStatus.Requested, MembershipRole.Member));
        await dbContext.SaveChangesAsync();

        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>())
            .Returns(true);

        var eventCacheInvalidationService = Substitute.For<IEventCacheInvalidationService>();
        var handler = new CreateGroupEventCommandHandler(dbContext, groupAuthorizationService, eventCacheInvalidationService);

        var result = await handler.Handle(
            new CreateGroupEventCommand(
                groupId,
                leaderId,
                "English Title",
                "中文標題",
                new DateTime(2026, 1, 10, 10, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 1, 10, 12, 0, 0, DateTimeKind.Utc),
                "{\"description\":\"test\"}"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        var notifications = await dbContext.NotificationMessages
            .OrderBy(x => x.RecipientMemberId)
            .ToListAsync();
        Assert.Empty(notifications);
        Assert.Equal(Alife.Domain.Enums.EventRamStatus.Draft, result.Value.RamStatus);
    }

    [Fact]
    public async Task GetGroupEvents_WhenAuthorized_ReturnsNonDeletedEventsInStartDateOrder()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var groupId = Guid.NewGuid();
        var currentMemberId = Guid.NewGuid();
        groupAuthorizationService
            .IsApprovedMemberAsync(groupId, currentMemberId, Arg.Any<CancellationToken>())
            .Returns(true);
        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, currentMemberId, Arg.Any<CancellationToken>())
            .Returns(true);

        dbContext.GroupEvents.AddRange(
            new GroupEvent
            {
                Id = Guid.NewGuid(),
                GroupId = groupId,
                CreatedByMemberId = currentMemberId,
                TitleEn = "Later",
                TitleZh = "晚一點",
                StartDate = new DateTime(2026, 2, 1, 12, 0, 0, DateTimeKind.Utc),
                EndDate = new DateTime(2026, 2, 1, 13, 0, 0, DateTimeKind.Utc),
                EventDataJson = "{}",
                CreatedUtc = DateTime.UtcNow,
                UpdatedUtc = DateTime.UtcNow
            },
            new GroupEvent
            {
                Id = Guid.NewGuid(),
                GroupId = groupId,
                CreatedByMemberId = currentMemberId,
                TitleEn = "Sooner",
                TitleZh = "早一點",
                StartDate = new DateTime(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc),
                EndDate = new DateTime(2026, 1, 1, 13, 0, 0, DateTimeKind.Utc),
                EventDataJson = "{}",
                CreatedUtc = DateTime.UtcNow,
                UpdatedUtc = DateTime.UtcNow
            },
            new GroupEvent
            {
                Id = Guid.NewGuid(),
                GroupId = groupId,
                CreatedByMemberId = currentMemberId,
                TitleEn = "Deleted",
                TitleZh = "已刪除",
                StartDate = new DateTime(2026, 1, 15, 12, 0, 0, DateTimeKind.Utc),
                EndDate = new DateTime(2026, 1, 15, 13, 0, 0, DateTimeKind.Utc),
                EventDataJson = "{}",
                CreatedUtc = DateTime.UtcNow,
                UpdatedUtc = DateTime.UtcNow,
                IsDeleted = true
            });
        await dbContext.SaveChangesAsync();

        var eventReadService = Substitute.For<IEventReadService>();
        eventReadService
            .GetGroupEventsAsync(groupId, Arg.Any<CancellationToken>())
            .Returns(dbContext.GroupEvents
                .Where(e => e.GroupId == groupId && !e.IsDeleted)
                .OrderBy(e => e.StartDate)
                .Select(e => new Alife.Application.Events.Dtos.GroupEventSummaryDto(
                    e.Id,
                    e.GroupId,
                    e.CreatedByMemberId,
                    e.TitleEn,
                    e.TitleZh,
                    e.StartDate,
                    e.EndDate,
                    e.EventDataJson,
                    e.CreatedUtc,
                    e.UpdatedUtc))
                .ToList());
        var groupReadService = Substitute.For<IGroupReadService>();
        groupReadService.GetByIdAsync(groupId, Arg.Any<CancellationToken>())
            .Returns(CreateGroup(groupId, isChurch: false));
        var handler = new GetGroupEventsQueryHandler(eventReadService, groupReadService, groupAuthorizationService);
        var result = await handler.Handle(new GetGroupEventsQuery(groupId, currentMemberId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal(2, result.Value.Count);
        Assert.Equal("Sooner", result.Value[0].TitleEn);
        Assert.Equal("Later", result.Value[1].TitleEn);
    }

    [Fact]
    public async Task GetGroupEvents_GuestCanReadOnlyApprovedPublicChurchEvents()
    {
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var groupReadService = Substitute.For<IGroupReadService>();
        var eventReadService = Substitute.For<IEventReadService>();
        var groupId = Guid.NewGuid();
        groupReadService.GetByIdAsync(groupId, Arg.Any<CancellationToken>())
            .Returns(CreateGroup(groupId, isChurch: true));
        eventReadService.GetGroupEventsAsync(groupId, Arg.Any<CancellationToken>())
            .Returns([
                new Alife.Application.Events.Dtos.GroupEventSummaryDto(
                    Guid.NewGuid(),
                    groupId,
                    Guid.NewGuid(),
                    "Guest Event",
                    "Guest Event",
                    DateTime.UtcNow,
                    DateTime.UtcNow.AddHours(1),
                    "{\"visibility\":\"public\",\"description\":{\"en\":\"Welcome\"},\"personResponsible\":\"Private lead\"}",
                    DateTime.UtcNow,
                    DateTime.UtcNow,
                    RamStatus: EventRamStatus.Approved,
                    Visibility: EventVisibilityPolicy.Public)
            ]);
        var handler = new GetGroupEventsQueryHandler(eventReadService, groupReadService, groupAuthorizationService);

        var result = await handler.Handle(new GetGroupEventsQuery(groupId, null), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value!);
        Assert.DoesNotContain("Private lead", result.Value![0].EventDataJson);
        Assert.Empty(result.Value[0].ContactProfileIds!);
        Assert.Equal(Guid.Empty, result.Value[0].CreatedByMemberId);
    }

    [Fact]
    public async Task GetGroupEvents_ChurchMemberCanReadApprovedChurchVisibleSubgroupEvent()
    {
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var groupReadService = Substitute.For<IGroupReadService>();
        var eventReadService = Substitute.For<IEventReadService>();
        var churchId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        groupReadService.GetByIdAsync(groupId, Arg.Any<CancellationToken>())
            .Returns(new GroupDto(
                groupId,
                new Dictionary<string, string> { ["en"] = "Subgroup" },
                null,
                churchId,
                AccessType.Protected,
                false,
                false,
                DateTime.UtcNow,
                DateTime.UtcNow));
        groupReadService.GetByIdAsync(churchId, Arg.Any<CancellationToken>())
            .Returns(CreateGroup(churchId, isChurch: true));
        groupAuthorizationService.IsApprovedMemberAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(false);
        groupAuthorizationService.IsApprovedMemberAsync(churchId, memberId, Arg.Any<CancellationToken>())
            .Returns(true);
        eventReadService.GetGroupEventsAsync(groupId, Arg.Any<CancellationToken>())
            .Returns([
                new Alife.Application.Events.Dtos.GroupEventSummaryDto(
                    Guid.NewGuid(), groupId, Guid.NewGuid(), "Church event", "教会活动",
                    DateTime.UtcNow, DateTime.UtcNow.AddHours(1),
                    "{\"visibility\":\"churchVisible\",\"description\":{\"en\":\"Welcome\"},\"contactProfileIds\":[\"secret\"]}",
                    DateTime.UtcNow, DateTime.UtcNow,
                    [Guid.NewGuid()], EventRamStatus.Approved, EventVisibilityPolicy.ChurchVisible)
            ]);
        var handler = new GetGroupEventsQueryHandler(eventReadService, groupReadService, groupAuthorizationService);

        var result = await handler.Handle(new GetGroupEventsQuery(groupId, memberId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var visibleEvent = Assert.Single(result.Value!);
        Assert.Equal(EventVisibilityPolicy.ChurchVisible, visibleEvent.Visibility);
        Assert.Empty(visibleEvent.ContactProfileIds!);
        Assert.DoesNotContain("contactProfileIds", visibleEvent.EventDataJson);
    }

    [Fact]
    public async Task GetGroupEvents_RootChurchMemberCanReadSanitizedChurchVisibleDeepDescendantEvent()
    {
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var groupReadService = Substitute.For<IGroupReadService>();
        var eventReadService = Substitute.For<IEventReadService>();
        var churchId = Guid.NewGuid();
        var ministryId = Guid.NewGuid();
        var teamId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var groups = new Dictionary<Guid, GroupDto>
        {
            [churchId] = new(
                churchId,
                new Dictionary<string, string> { ["en"] = "Church" },
                null,
                null,
                AccessType.Public,
                true,
                false,
                DateTime.UtcNow,
                DateTime.UtcNow),
            [ministryId] = new(
                ministryId,
                new Dictionary<string, string> { ["en"] = "Ministry" },
                null,
                churchId,
                AccessType.Protected,
                false,
                false,
                DateTime.UtcNow,
                DateTime.UtcNow),
            [teamId] = new(
                teamId,
                new Dictionary<string, string> { ["en"] = "Team" },
                null,
                ministryId,
                AccessType.Protected,
                false,
                false,
                DateTime.UtcNow,
                DateTime.UtcNow),
        };
        groupReadService.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(call => groups.GetValueOrDefault(call.ArgAt<Guid>(0)));
        groupAuthorizationService.IsApprovedMemberAsync(teamId, memberId, Arg.Any<CancellationToken>())
            .Returns(false);
        groupAuthorizationService.IsApprovedMemberAsync(churchId, memberId, Arg.Any<CancellationToken>())
            .Returns(true);
        eventReadService.GetGroupEventsAsync(teamId, Arg.Any<CancellationToken>())
            .Returns([
                new Alife.Application.Events.Dtos.GroupEventSummaryDto(
                    Guid.NewGuid(), teamId, Guid.NewGuid(), "Team event", "团队活动",
                    DateTime.UtcNow, DateTime.UtcNow.AddHours(1),
                    "{\"visibility\":\"churchVisible\",\"personResponsible\":\"Private lead\",\"contactProfileIds\":[\"secret\"]}",
                    DateTime.UtcNow, DateTime.UtcNow,
                    [Guid.NewGuid()], EventRamStatus.Approved, EventVisibilityPolicy.ChurchVisible)
            ]);
        var handler = new GetGroupEventsQueryHandler(eventReadService, groupReadService, groupAuthorizationService);

        var result = await handler.Handle(new GetGroupEventsQuery(teamId, memberId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var visibleEvent = Assert.Single(result.Value!);
        Assert.Equal(EventVisibilityPolicy.ChurchVisible, visibleEvent.Visibility);
        Assert.Equal(Guid.Empty, visibleEvent.CreatedByMemberId);
        Assert.Empty(visibleEvent.ContactProfileIds!);
        Assert.DoesNotContain("Private lead", visibleEvent.EventDataJson);
        Assert.DoesNotContain("contactProfileIds", visibleEvent.EventDataJson);
        await groupAuthorizationService.Received(1).IsApprovedMemberAsync(
            churchId,
            memberId,
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetGroupEvents_DoesNotExposeUnapprovedPublicEventToGuest()
    {
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var groupReadService = Substitute.For<IGroupReadService>();
        var eventReadService = Substitute.For<IEventReadService>();
        var groupId = Guid.NewGuid();
        groupReadService.GetByIdAsync(groupId, Arg.Any<CancellationToken>())
            .Returns(CreateGroup(groupId, isChurch: false));
        eventReadService.GetGroupEventsAsync(groupId, Arg.Any<CancellationToken>())
            .Returns([
                new Alife.Application.Events.Dtos.GroupEventSummaryDto(
                    Guid.NewGuid(), groupId, Guid.NewGuid(), "Draft", "草稿",
                    DateTime.UtcNow, DateTime.UtcNow.AddHours(1), "{\"visibility\":\"public\"}",
                    DateTime.UtcNow, DateTime.UtcNow,
                    RamStatus: EventRamStatus.AwaitingReview,
                    Visibility: EventVisibilityPolicy.Public)
            ]);
        var handler = new GetGroupEventsQueryHandler(eventReadService, groupReadService, groupAuthorizationService);

        var result = await handler.Handle(new GetGroupEventsQuery(groupId, null), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value!);
    }

    [Fact]
    public async Task UpdateGroupEvent_WhenAuthorized_UpdatesEvent()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var groupId = Guid.NewGuid();
        var currentMemberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var createdUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        dbContext.GroupEvents.Add(new GroupEvent
        {
            Id = eventId,
            GroupId = groupId,
            CreatedByMemberId = currentMemberId,
            TitleEn = "Before",
            TitleZh = "更新前",
            StartDate = new DateTime(2026, 3, 1, 8, 0, 0, DateTimeKind.Utc),
            EndDate = new DateTime(2026, 3, 1, 9, 0, 0, DateTimeKind.Utc),
            EventDataJson = "{\"before\":true}",
            CreatedUtc = createdUtc,
            UpdatedUtc = createdUtc
        });
        await dbContext.SaveChangesAsync();

        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, currentMemberId, Arg.Any<CancellationToken>())
            .Returns(true);

        var eventCacheInvalidationService = Substitute.For<IEventCacheInvalidationService>();
        var handler = new UpdateGroupEventCommandHandler(dbContext, groupAuthorizationService, eventCacheInvalidationService);
        var result = await handler.Handle(
            new UpdateGroupEventCommand(
                eventId,
                currentMemberId,
                "After",
                "更新後",
                new DateTime(2026, 3, 1, 10, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 3, 1, 11, 0, 0, DateTimeKind.Utc),
                "{\"after\":true,\"enabledModules\":[\"programme\",\"roster\"]}"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal("After", result.Value.TitleEn);
        Assert.Equal("更新後", result.Value.TitleZh);
        Assert.Equal("{\"after\":true,\"enabledModules\":[\"programme\",\"roster\"]}", result.Value.EventDataJson);
        Assert.Equal(["programme", "roster"], result.Value.EnabledModules);
        Assert.True(result.Value.UpdatedUtc >= createdUtc);
    }

    [Fact]
    public async Task UpdateGroupEvent_WithReviewedAiDraft_RecordsReviewedRevisionAndAudit()
    {
        using var dbContext = CreateInMemoryDbContext();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        dbContext.GroupEvents.Add(new GroupEvent
        {
            Id = eventId,
            GroupId = groupId,
            CreatedByMemberId = leaderId,
            TitleEn = "Before",
            TitleZh = "修改前",
            StartDate = DateTime.UtcNow.AddDays(1),
            EndDate = DateTime.UtcNow.AddDays(1).AddHours(1),
            EventDataJson = "{\"visibility\":\"groupVisible\"}",
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
        authorization.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new UpdateGroupEventCommandHandler(
            dbContext,
            authorization,
            Substitute.For<IEventCacheInvalidationService>());

        var result = await handler.Handle(new UpdateGroupEventCommand(
            eventId,
            leaderId,
            "After",
            "修改后",
            DateTime.UtcNow.AddDays(2),
            DateTime.UtcNow.AddDays(2).AddHours(1),
            "{\"visibility\":\"groupVisible\"}",
            AiAssistanceReviewed: true), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var revision = await dbContext.EventPlanRevisions.SingleAsync();
        Assert.Equal("AI-assisted event draft confirmed by leader", revision.ChangeReason);
        var audit = await dbContext.AuditLogs.SingleAsync(x => x.Action == "event.ai-draft.confirmed");
        Assert.Equal(eventId, audit.EventId);
        Assert.DoesNotContain("After", audit.MetadataJson);
    }

    [Fact]
    public async Task DeleteGroupEvent_WhenAuthorized_SoftDeletesEvent()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var groupId = Guid.NewGuid();
        var currentMemberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();

        dbContext.GroupEvents.Add(new GroupEvent
        {
            Id = eventId,
            GroupId = groupId,
            CreatedByMemberId = currentMemberId,
            TitleEn = "Delete me",
            TitleZh = "刪除我",
            StartDate = DateTime.UtcNow,
            EndDate = DateTime.UtcNow.AddHours(1),
            EventDataJson = "{}",
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, currentMemberId, Arg.Any<CancellationToken>())
            .Returns(true);

        var eventCacheInvalidationService = Substitute.For<IEventCacheInvalidationService>();
        var handler = new DeleteGroupEventCommandHandler(dbContext, groupAuthorizationService, eventCacheInvalidationService);
        var result = await handler.Handle(new DeleteGroupEventCommand(eventId, currentMemberId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var deletedEvent = await dbContext.GroupEvents
            .IgnoreQueryFilters()
            .SingleAsync(x => x.Id == eventId);
        Assert.True(deletedEvent.IsDeleted);
    }

    private static GroupDto CreateGroup(Guid groupId, bool isChurch)
        => new(
            groupId,
            new Dictionary<string, string> { ["en"] = isChurch ? "Church" : "Group" },
            null,
            null,
            AccessType.Public,
            isChurch,
            IsClosed: false,
            DateTime.UtcNow,
            DateTime.UtcNow);

    private static GroupMembership CreateMembership(
        Guid groupId,
        Guid memberId,
        MembershipStatus status,
        MembershipRole role)
        => new()
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            MemberId = memberId,
            Status = status,
            Role = role,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };

    private const string WorkflowDefinition = """
        {"stages":[
          {"key":"proposal","name":{"en":"Proposal","zh":"提案"},"required":true,"requiresApproval":true,"integrationKey":null,
           "artifacts":[{"type":"event_plan","title":{"en":"Plan","zh":"计划"},"required":true,"visibility":"groupVisible"}]},
          {"key":"risk_assessment","name":{"en":"Risk assessment","zh":"风险评估"},"required":true,"requiresApproval":true,"integrationKey":"ram",
           "artifacts":[{"type":"ram","title":{"en":"RAM","zh":"风险评估"},"required":true,"visibility":"groupVisible"}]}
        ]}
        """;
}
