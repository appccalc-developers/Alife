using Alife.Application.Announcements.Commands.SaveAnnouncement;
using Alife.Application.Announcements.Queries.ListActiveAnnouncements;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Announcements;

public sealed class AnnouncementHandlersTests
{
    private static AlifeDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    [Fact]
    public async Task ActiveQuery_FiltersByScheduleStatusAndAudienceInApi()
    {
        await using var db = CreateDb();
        var churchId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var creatorId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        db.Groups.AddRange(
            new Group { Id = churchId, NameJson = "{}", IsChurch = true },
            new Group { Id = groupId, NameJson = "{}", ParentGroupId = churchId });
        db.GroupMemberships.Add(new GroupMembership
        {
            Id = Guid.NewGuid(), GroupId = groupId, MemberId = memberId,
            Status = MembershipStatus.Approved, Role = MembershipRole.Member
        });
        db.Announcements.AddRange(
            CreateAnnouncement(churchId, creatorId, "Public", AnnouncementAudience.Public, AnnouncementStatus.Published, now.AddMinutes(-5), null),
            CreateAnnouncement(churchId, creatorId, "Members", AnnouncementAudience.ChurchMembers, AnnouncementStatus.Published, now.AddMinutes(-5), null),
            CreateAnnouncement(groupId, creatorId, "Group", AnnouncementAudience.SpecificGroup, AnnouncementStatus.Published, now.AddMinutes(-5), null),
            CreateAnnouncement(groupId, creatorId, "Draft", AnnouncementAudience.SpecificGroup, AnnouncementStatus.Draft, now.AddMinutes(-5), null),
            CreateAnnouncement(groupId, creatorId, "Expired", AnnouncementAudience.SpecificGroup, AnnouncementStatus.Published, now.AddHours(-2), now.AddHours(-1)));
        await db.SaveChangesAsync();

        var memberResult = await new ListActiveAnnouncementsQueryHandler(db)
            .Handle(new ListActiveAnnouncementsQuery(groupId, memberId), CancellationToken.None);
        var guestResult = await new ListActiveAnnouncementsQueryHandler(db)
            .Handle(new ListActiveAnnouncementsQuery(groupId, null), CancellationToken.None);

        Assert.Equal(new[] { "Group", "Members", "Public" }, memberResult.Value!.Select(x => x.Title["en"]).OrderBy(x => x));
        Assert.Single(guestResult.Value!);
        Assert.Equal("Public", guestResult.Value![0].Title["en"]);
    }

    [Fact]
    public async Task PublishWithNotifications_CreatesReferencesForApprovedGroupMembersOnly()
    {
        await using var db = CreateDb();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var requestedId = Guid.NewGuid();
        db.Groups.Add(new Group { Id = groupId, NameJson = "{}" });
        db.GroupMemberships.AddRange(
            Membership(groupId, leaderId, MembershipStatus.Approved, MembershipRole.Leader),
            Membership(groupId, memberId, MembershipStatus.Approved, MembershipRole.Member),
            Membership(groupId, requestedId, MembershipStatus.Requested, MembershipRole.Member));
        await db.SaveChangesAsync();
        authorization.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);

        var result = await new SaveAnnouncementCommandHandler(db, authorization).Handle(new SaveAnnouncementCommand(
            null, groupId, leaderId,
            new Dictionary<string, string> { ["en"] = "Notice", ["zh"] = "公告" },
            new Dictionary<string, string> { ["en"] = "Summary", ["zh"] = "摘要" },
            null, AnnouncementAudience.SpecificGroup, AnnouncementPriority.Important, AnnouncementStatus.Published,
            DateTime.UtcNow, DateTime.UtcNow.AddDays(1), true, true), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var notifications = await db.NotificationMessages.ToListAsync();
        Assert.Equal(2, notifications.Count);
        Assert.All(notifications, value => Assert.Equal(result.Value!.Id, value.AnnouncementId));
        Assert.DoesNotContain(notifications, value => value.RecipientMemberId == requestedId);
    }

    private static Announcement CreateAnnouncement(Guid groupId, Guid creatorId, string title, AnnouncementAudience audience, AnnouncementStatus status, DateTime publishUtc, DateTime? expireUtc) => new()
    {
        Id = Guid.NewGuid(), GroupId = groupId, CreatedByMemberId = creatorId,
        TitleJson = $"{{\"en\":\"{title}\"}}", SummaryJson = "{\"en\":\"Summary\"}",
        Audience = audience, Priority = AnnouncementPriority.Normal, Status = status,
        PublishUtc = publishUtc, ExpireUtc = expireUtc, CreatedUtc = publishUtc, UpdatedUtc = publishUtc
    };

    private static GroupMembership Membership(Guid groupId, Guid memberId, MembershipStatus status, MembershipRole role) => new()
    {
        Id = Guid.NewGuid(), GroupId = groupId, MemberId = memberId, Status = status, Role = role
    };
}
