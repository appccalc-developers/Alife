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
                "{\"description\":\"test\"}"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal(groupId, result.Value.GroupId);
        Assert.Equal("English Title", result.Value.TitleEn);
        Assert.Equal(1, await dbContext.GroupEvents.CountAsync());
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
    public async Task GetGroupEvents_GuestCanReadChurchEvents()
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
                    "{}",
                    DateTime.UtcNow,
                    DateTime.UtcNow)
            ]);
        var handler = new GetGroupEventsQueryHandler(eventReadService, groupReadService, groupAuthorizationService);

        var result = await handler.Handle(new GetGroupEventsQuery(groupId, null), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value!);
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
                "{\"after\":true}"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal("After", result.Value.TitleEn);
        Assert.Equal("更新後", result.Value.TitleZh);
        Assert.Equal("{\"after\":true}", result.Value.EventDataJson);
        Assert.True(result.Value.UpdatedUtc >= createdUtc);
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
}
