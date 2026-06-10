using Alife.Application.Groups.Services;
using Alife.Application.Notifications.Commands.CreateNotification;
using Alife.Application.Notifications.Commands.MarkNotificationRead;
using Alife.Application.Notifications.Commands.ReplyNotification;
using Alife.Application.Notifications.Queries.ListNotifications;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Notifications;

public class NotificationHandlersTests
{
    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    [Fact]
    public async Task CreateNotification_WhenGroupLeaderTargetsApprovedMember_CreatesNotification()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var groupId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var recipientId = Guid.NewGuid();
        var occurredUtc = new DateTime(2026, 6, 1, 12, 0, 0, DateTimeKind.Utc);

        dbContext.Members.Add(CreateRegisteredMember(recipientId));
        dbContext.GroupEvents.Add(new GroupEvent
        {
            Id = eventId,
            GroupId = groupId,
            CreatedByMemberId = leaderId,
            TitleEn = "Event",
            TitleZh = "Event",
            StartDate = occurredUtc,
            EndDate = occurredUtc.AddHours(1),
            EventDataJson = "{}",
            CreatedUtc = occurredUtc,
            UpdatedUtc = occurredUtc
        });
        await dbContext.SaveChangesAsync();

        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>())
            .Returns(true);
        groupAuthorizationService
            .IsApprovedMemberAsync(groupId, recipientId, Arg.Any<CancellationToken>())
            .Returns(true);

        var handler = new CreateNotificationCommandHandler(dbContext, groupAuthorizationService);

        var result = await handler.Handle(
            new CreateNotificationCommand(
                leaderId,
                recipientId,
                groupId,
                eventId,
                occurredUtc,
                "event.review.requested",
                "{\"eventId\":\"" + eventId + "\"}"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal(recipientId, result.Value.RecipientMemberId);
        Assert.Equal(leaderId, result.Value.CreatedByMemberId);
        Assert.Equal(groupId, result.Value.GroupId);
        Assert.Equal(eventId, result.Value.EventId);
        Assert.Equal(occurredUtc, result.Value.OccurredUtc);
        Assert.Null(result.Value.ReadUtc);
        Assert.Null(result.Value.RepliedUtc);
        Assert.Equal(1, await dbContext.NotificationMessages.CountAsync());
    }

    [Fact]
    public async Task CreateNotification_WhenRecipientIsNotApprovedGroupMember_ReturnsForbidden()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var recipientId = Guid.NewGuid();

        dbContext.Members.Add(CreateRegisteredMember(recipientId));
        await dbContext.SaveChangesAsync();

        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>())
            .Returns(true);
        groupAuthorizationService
            .IsApprovedMemberAsync(groupId, recipientId, Arg.Any<CancellationToken>())
            .Returns(false);

        var handler = new CreateNotificationCommandHandler(dbContext, groupAuthorizationService);

        var result = await handler.Handle(
            new CreateNotificationCommand(
                leaderId,
                recipientId,
                groupId,
                null,
                null,
                "event.review.requested",
                "{}"),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(0, await dbContext.NotificationMessages.CountAsync());
    }

    [Fact]
    public async Task ListNotifications_ReturnsOnlyCurrentRecipientsNotificationsWithUnreadFirst()
    {
        using var dbContext = CreateInMemoryDbContext();
        var currentMemberId = Guid.NewGuid();
        var otherMemberId = Guid.NewGuid();
        var creatorId = Guid.NewGuid();
        var older = new DateTime(2026, 6, 1, 12, 0, 0, DateTimeKind.Utc);
        var newer = older.AddDays(1);
        var newestRead = newer.AddDays(1);

        dbContext.NotificationMessages.AddRange(
            CreateNotification(Guid.NewGuid(), currentMemberId, creatorId, older, readUtc: older.AddMinutes(10), repliedUtc: older.AddHours(1)),
            CreateNotification(Guid.NewGuid(), currentMemberId, creatorId, newer, readUtc: null, repliedUtc: null),
            CreateNotification(Guid.NewGuid(), currentMemberId, creatorId, newestRead, readUtc: newestRead.AddMinutes(10), repliedUtc: null),
            CreateNotification(Guid.NewGuid(), otherMemberId, creatorId, newer.AddDays(2), readUtc: null, repliedUtc: null));
        await dbContext.SaveChangesAsync();

        var handler = new ListNotificationsQueryHandler(dbContext);

        var result = await handler.Handle(new ListNotificationsQuery(currentMemberId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal(3, result.Value.Count);
        Assert.Equal(newer, result.Value[0].OccurredUtc);
        Assert.Null(result.Value[0].ReadUtc);
        Assert.Null(result.Value[0].RepliedUtc);
        Assert.Equal(newestRead, result.Value[1].OccurredUtc);
        Assert.NotNull(result.Value[1].ReadUtc);
        Assert.Equal(older, result.Value[2].OccurredUtc);
    }

    [Fact]
    public async Task MarkNotificationRead_WhenRecipientMarksRead_StoresFirstReadTime()
    {
        using var dbContext = CreateInMemoryDbContext();
        var notificationId = Guid.NewGuid();
        var recipientId = Guid.NewGuid();
        var creatorId = Guid.NewGuid();
        dbContext.NotificationMessages.Add(CreateNotification(notificationId, recipientId, creatorId, DateTime.UtcNow, readUtc: null, repliedUtc: null));
        await dbContext.SaveChangesAsync();

        var handler = new MarkNotificationReadCommandHandler(dbContext);

        var result = await handler.Handle(new MarkNotificationReadCommand(notificationId, recipientId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.NotNull(result.Value.ReadUtc);
        Assert.Null(result.Value.RepliedUtc);

        var firstReadUtc = result.Value.ReadUtc;
        var secondResult = await handler.Handle(new MarkNotificationReadCommand(notificationId, recipientId), CancellationToken.None);

        Assert.True(secondResult.IsSuccess);
        Assert.Equal(firstReadUtc, secondResult.Value!.ReadUtc);
    }

    [Fact]
    public async Task MarkNotificationRead_WhenNotRecipient_ReturnsForbidden()
    {
        using var dbContext = CreateInMemoryDbContext();
        var notificationId = Guid.NewGuid();
        var recipientId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var creatorId = Guid.NewGuid();
        dbContext.NotificationMessages.Add(CreateNotification(notificationId, recipientId, creatorId, DateTime.UtcNow, readUtc: null, repliedUtc: null));
        await dbContext.SaveChangesAsync();

        var handler = new MarkNotificationReadCommandHandler(dbContext);

        var result = await handler.Handle(new MarkNotificationReadCommand(notificationId, actorId), CancellationToken.None);

        Assert.False(result.IsSuccess);
        var saved = await dbContext.NotificationMessages.SingleAsync(x => x.Id == notificationId);
        Assert.Null(saved.ReadUtc);
    }

    [Fact]
    public async Task ReplyNotification_WhenRecipientReplies_StoresResponseAndReplyTime()
    {
        using var dbContext = CreateInMemoryDbContext();
        var notificationId = Guid.NewGuid();
        var recipientId = Guid.NewGuid();
        var creatorId = Guid.NewGuid();
        var occurredUtc = new DateTime(2026, 6, 1, 12, 0, 0, DateTimeKind.Utc);
        dbContext.NotificationMessages.Add(CreateNotification(notificationId, recipientId, creatorId, occurredUtc, readUtc: null, repliedUtc: null));
        await dbContext.SaveChangesAsync();

        var handler = new ReplyNotificationCommandHandler(dbContext);

        var result = await handler.Handle(
            new ReplyNotificationCommand(notificationId, recipientId, "{\"decision\":\"accepted\"}"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal("{\"decision\":\"accepted\"}", result.Value.ResponseDataJson);
        Assert.NotNull(result.Value.ReadUtc);
        Assert.NotNull(result.Value.RepliedUtc);

        var saved = await dbContext.NotificationMessages.SingleAsync(x => x.Id == notificationId);
        Assert.Equal("{\"decision\":\"accepted\"}", saved.ResponseDataJson);
        Assert.NotNull(saved.ReadUtc);
        Assert.NotNull(saved.RepliedUtc);
    }

    [Fact]
    public async Task ReplyNotification_WhenNotRecipient_ReturnsForbidden()
    {
        using var dbContext = CreateInMemoryDbContext();
        var notificationId = Guid.NewGuid();
        var recipientId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var creatorId = Guid.NewGuid();
        dbContext.NotificationMessages.Add(CreateNotification(notificationId, recipientId, creatorId, DateTime.UtcNow, readUtc: null, repliedUtc: null));
        await dbContext.SaveChangesAsync();

        var handler = new ReplyNotificationCommandHandler(dbContext);

        var result = await handler.Handle(
            new ReplyNotificationCommand(notificationId, actorId, "{\"decision\":\"accepted\"}"),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        var saved = await dbContext.NotificationMessages.SingleAsync(x => x.Id == notificationId);
        Assert.Null(saved.ReadUtc);
        Assert.Null(saved.ResponseDataJson);
        Assert.Null(saved.RepliedUtc);
    }

    private static Member CreateRegisteredMember(Guid memberId)
        => new()
        {
            Id = memberId,
            DisplayName = "Member",
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };

    private static NotificationMessage CreateNotification(
        Guid id,
        Guid recipientMemberId,
        Guid createdByMemberId,
        DateTime occurredUtc,
        DateTime? readUtc,
        DateTime? repliedUtc)
        => new()
        {
            Id = id,
            RecipientMemberId = recipientMemberId,
            CreatedByMemberId = createdByMemberId,
            OccurredUtc = occurredUtc,
            ActionType = "event.review.requested",
            ActionDataJson = "{}",
            ResponseDataJson = repliedUtc.HasValue ? "{}" : null,
            ReadUtc = readUtc,
            RepliedUtc = repliedUtc,
            CreatedUtc = occurredUtc,
            UpdatedUtc = repliedUtc ?? occurredUtc
        };
}
