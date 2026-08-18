using System.Text.Json;
using Alife.Application.Admin;
using Alife.Application.Notifications.Queries.ListCurrentNotificationTasks;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Alife.Tests.Unit.Notifications;

public class CurrentNotificationTaskQueryTests
{
    [Fact]
    public async Task MembershipReview_RemainsCurrentAfterReadUntilRequestIsResolved()
    {
        using var dbContext = CreateInMemoryDbContext();
        var leaderId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        dbContext.Members.AddRange(CreateMember(leaderId), CreateMember(requesterId));
        dbContext.Groups.Add(new Group { Id = groupId, NameJson = "{}", CreatedUtc = now, UpdatedUtc = now });
        dbContext.GroupMemberships.AddRange(
            CreateMembership(groupId, leaderId, MembershipStatus.Approved, MembershipRole.Leader, now),
            CreateMembership(groupId, requesterId, MembershipStatus.Requested, MembershipRole.Member, now));
        dbContext.NotificationMessages.Add(CreateNotification(
            leaderId,
            requesterId,
            groupId,
            "group.join-request.received",
            JsonSerializer.Serialize(new { groupId, memberId = requesterId }),
            readUtc: now));
        await dbContext.SaveChangesAsync();

        var handler = new ListCurrentNotificationTasksQueryHandler(dbContext);
        var current = await handler.Handle(new ListCurrentNotificationTasksQuery(leaderId), CancellationToken.None);

        var task = Assert.Single(current.Value!);
        Assert.Equal("urgent", task.Category);
        Assert.Equal("workflow", task.CompletionMode);
        Assert.Equal($"/groups/{groupId}/manage?section=members", task.ActionUrl);

        var request = await dbContext.GroupMemberships.SingleAsync(x => x.MemberId == requesterId);
        request.Status = MembershipStatus.Approved;
        await dbContext.SaveChangesAsync();

        var resolved = await handler.Handle(new ListCurrentNotificationTasksQuery(leaderId), CancellationToken.None);
        Assert.Empty(resolved.Value!);
    }

    [Fact]
    public async Task LegacyMembershipAction_IsUrgentWhenItHasValidWorkflowReferences()
    {
        using var dbContext = CreateInMemoryDbContext();
        var leaderId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        dbContext.Members.AddRange(CreateMember(leaderId), CreateMember(requesterId));
        dbContext.Groups.Add(new Group { Id = groupId, NameJson = "{}", CreatedUtc = now, UpdatedUtc = now });
        dbContext.GroupMemberships.AddRange(
            CreateMembership(groupId, leaderId, MembershipStatus.Approved, MembershipRole.CoLeader, now),
            CreateMembership(groupId, requesterId, MembershipStatus.Requested, MembershipRole.Member, now));
        dbContext.NotificationMessages.Add(CreateNotification(
            leaderId,
            requesterId,
            groupId,
            "group.join.requested",
            JsonSerializer.Serialize(new { groupId, memberId = requesterId })));
        await dbContext.SaveChangesAsync();

        var result = await new ListCurrentNotificationTasksQueryHandler(dbContext)
            .Handle(new ListCurrentNotificationTasksQuery(leaderId), CancellationToken.None);

        var task = Assert.Single(result.Value!);
        Assert.Equal("urgent", task.Category);
        Assert.Equal($"/groups/{groupId}/manage?section=members", task.ActionUrl);
    }

    [Fact]
    public async Task MembershipReview_IsHiddenWhenLeaderRoleOrWorkflowReferenceIsMissing()
    {
        using var dbContext = CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        var requesterId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        dbContext.Members.AddRange(CreateMember(memberId), CreateMember(requesterId));
        dbContext.Groups.Add(new Group { Id = groupId, NameJson = "{}", CreatedUtc = now, UpdatedUtc = now });
        dbContext.GroupMemberships.AddRange(
            CreateMembership(groupId, memberId, MembershipStatus.Approved, MembershipRole.Member, now),
            CreateMembership(groupId, requesterId, MembershipStatus.Requested, MembershipRole.Member, now));
        dbContext.NotificationMessages.AddRange(
            CreateNotification(memberId, requesterId, groupId, "group.join-request.received", JsonSerializer.Serialize(new { groupId, memberId = requesterId })),
            CreateNotification(memberId, requesterId, groupId, "group.join-request.received", "{}"));
        await dbContext.SaveChangesAsync();

        var result = await new ListCurrentNotificationTasksQueryHandler(dbContext)
            .Handle(new ListCurrentNotificationTasksQuery(memberId), CancellationToken.None);

        Assert.Empty(result.Value!);
    }

    [Fact]
    public async Task VisitorTasks_IncludeNewAndFollowUpButExcludeContacted()
    {
        using var dbContext = CreateInMemoryDbContext();
        var receiverId = Guid.NewGuid();
        var creatorId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var role = new PlatformRole
        {
            Id = 77,
            Code = "visitor_contact_receiver",
            NameJson = "{}",
            PermissionsJson = "[\"admin.visitRequests.receive\"]",
            Level = 1
        };
        dbContext.Members.AddRange(CreateMember(receiverId), CreateMember(creatorId));
        dbContext.PlatformRoles.Add(role);
        dbContext.MemberPlatformRoles.Add(new MemberPlatformRole
        {
            Id = Guid.NewGuid(),
            MemberId = receiverId,
            RoleId = role.Id,
            AssignedUtc = now
        });

        foreach (var status in new[] { "new", "followUp", "contacted" })
        {
            var requestId = Guid.NewGuid();
            dbContext.VisitContactRequests.Add(new VisitContactRequest
            {
                Id = requestId,
                DisplayName = status,
                Status = status,
                SubmittedUtc = now,
                CreatedUtc = now,
                UpdatedUtc = now
            });
            dbContext.NotificationMessages.Add(CreateNotification(
                receiverId,
                creatorId,
                null,
                "visitor.contact.requested",
                JsonSerializer.Serialize(new { visitContactRequestId = requestId }),
                readUtc: now));
        }
        await dbContext.SaveChangesAsync();

        var result = await new ListCurrentNotificationTasksQueryHandler(dbContext)
            .Handle(new ListCurrentNotificationTasksQuery(receiverId), CancellationToken.None);

        Assert.Equal(2, result.Value!.Count);
        Assert.All(result.Value, task =>
        {
            Assert.Equal("urgent", task.Category);
            Assert.Equal("workflow", task.CompletionMode);
            Assert.Equal("/admin/visit-requests", task.ActionUrl);
        });
    }

    [Fact]
    public async Task RoleScopedMessage_RequiresCurrentTargetRoleAndUnreadState()
    {
        using var dbContext = CreateInMemoryDbContext();
        var recipientId = Guid.NewGuid();
        var creatorId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var role = new PlatformRole
        {
            Id = 78,
            Code = "care_duty",
            NameJson = "{}",
            PermissionsJson = "[]",
            Level = 1
        };
        var memberRole = new MemberPlatformRole
        {
            Id = Guid.NewGuid(),
            MemberId = recipientId,
            RoleId = role.Id,
            AssignedUtc = now
        };
        dbContext.Members.AddRange(CreateMember(recipientId), CreateMember(creatorId));
        dbContext.PlatformRoles.Add(role);
        dbContext.MemberPlatformRoles.Add(memberRole);
        dbContext.NotificationMessages.Add(CreateNotification(
            recipientId,
            creatorId,
            null,
            "platform.message",
            "{\"scope\":\"role\",\"roleCodes\":[\"care_duty\"],\"actionUrl\":\"/admin/messages\"}"));
        await dbContext.SaveChangesAsync();
        var handler = new ListCurrentNotificationTasksQueryHandler(dbContext);

        var active = await handler.Handle(new ListCurrentNotificationTasksQuery(recipientId), CancellationToken.None);
        var task = Assert.Single(active.Value!);
        Assert.Equal("urgent", task.Category);
        Assert.Equal("read", task.CompletionMode);

        memberRole.RevokedUtc = now.AddMinutes(1);
        await dbContext.SaveChangesAsync();

        var revoked = await handler.Handle(new ListCurrentNotificationTasksQuery(recipientId), CancellationToken.None);
        Assert.Empty(revoked.Value!);
    }

    [Fact]
    public async Task GeneralTasks_ReturnOnlyUnreadNotificationsForCurrentRecipient()
    {
        using var dbContext = CreateInMemoryDbContext();
        var recipientId = Guid.NewGuid();
        var otherRecipientId = Guid.NewGuid();
        var creatorId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        dbContext.NotificationMessages.AddRange(
            CreateNotification(recipientId, creatorId, null, "announcement.published", "{}"),
            CreateNotification(recipientId, creatorId, null, "contact.inquiry.received", "{}", readUtc: now),
            CreateNotification(otherRecipientId, creatorId, null, "event.created", "{}"));
        await dbContext.SaveChangesAsync();

        var result = await new ListCurrentNotificationTasksQueryHandler(dbContext)
            .Handle(new ListCurrentNotificationTasksQuery(recipientId), CancellationToken.None);

        var task = Assert.Single(result.Value!);
        Assert.Equal("general", task.Category);
        Assert.Equal("read", task.CompletionMode);
        Assert.Equal(recipientId, task.RecipientMemberId);
    }

    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    private static Member CreateMember(Guid id)
        => new()
        {
            Id = id,
            DisplayName = id.ToString(),
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };

    private static GroupMembership CreateMembership(
        Guid groupId,
        Guid memberId,
        MembershipStatus status,
        MembershipRole role,
        DateTime now)
        => new()
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            MemberId = memberId,
            Status = status,
            Role = role,
            CreatedUtc = now,
            UpdatedUtc = now
        };

    private static NotificationMessage CreateNotification(
        Guid recipientId,
        Guid creatorId,
        Guid? groupId,
        string actionType,
        string actionDataJson,
        DateTime? readUtc = null)
    {
        var now = DateTime.UtcNow;
        return new NotificationMessage
        {
            Id = Guid.NewGuid(),
            RecipientMemberId = recipientId,
            CreatedByMemberId = creatorId,
            GroupId = groupId,
            OccurredUtc = now,
            ActionType = actionType,
            ActionDataJson = actionDataJson,
            ReadUtc = readUtc,
            CreatedUtc = now,
            UpdatedUtc = now
        };
    }
}
