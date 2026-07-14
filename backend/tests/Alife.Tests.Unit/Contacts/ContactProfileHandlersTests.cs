using Alife.Application.Common.Models;
using Alife.Application.Contacts.Commands.CreateContactInquiry;
using Alife.Application.Contacts.Commands.CreateContactProfile;
using Alife.Application.Contacts.Queries.GetGroupContactProfiles;
using Alife.Application.Groups.Services;
using Alife.Application.Events.Commands.CreateGroupEvent;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Contacts;

public class ContactProfileHandlersTests
{
    [Fact]
    public async Task Create_RequiresApprovedMemberAndStoresBilingualProfile()
    {
        using var db = CreateDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var contactMemberId = Guid.NewGuid();
        db.GroupMemberships.Add(new GroupMembership
        {
            Id = Guid.NewGuid(), GroupId = groupId, MemberId = contactMemberId,
            Status = MembershipStatus.Approved, Role = MembershipRole.Member,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new CreateContactProfileCommandHandler(db, authorization);

        var result = await handler.Handle(new CreateContactProfileCommand(
            groupId, leaderId, contactMemberId,
            new Dictionary<string, string> { ["en"] = "Stephen", ["zh"] = "司提反" },
            new Dictionary<string, string> { ["en"] = "Pastor", ["zh"] = "牧师" },
            "https://example.test/photo.jpg",
            new Dictionary<string, string> { ["en"] = "Ask about care." },
            "+64 21 123 456", "stephen@example.test", "public"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("司提反", result.Value!.Name["zh"]);
        Assert.Equal("public", result.Value.Visibility);
        Assert.Single(db.ContactProfiles);
    }

    [Fact]
    public async Task List_AnonymousViewerOnlyReceivesPublicProfiles()
    {
        using var db = CreateDbContext();
        var groupId = Guid.NewGuid();
        db.Groups.Add(new Group { Id = groupId, NameJson = "{}", CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow });
        db.ContactProfiles.AddRange(
            Profile(groupId, ContactProfileVisibility.Public, "Public"),
            Profile(groupId, ContactProfileVisibility.GroupOnly, "Private"));
        await db.SaveChangesAsync();

        var handler = new GetGroupContactProfilesQueryHandler(db, Substitute.For<IGroupAuthorizationService>());
        var result = await handler.Handle(new GetGroupContactProfilesQuery(groupId, null), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var profile = Assert.Single(result.Value!);
        Assert.Equal("Public", profile.Name["en"]);
    }

    [Fact]
    public async Task Inquiry_StoresMessageAndCreatesNotificationForContactMember()
    {
        using var db = CreateDbContext();
        var groupId = Guid.NewGuid();
        var contactMemberId = Guid.NewGuid();
        db.Members.Add(new Member
        {
            Id = contactMemberId, DisplayName = "Contact", IsRegistered = true,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        var profile = Profile(groupId, ContactProfileVisibility.Public, "Contact");
        profile.MemberId = contactMemberId;
        db.ContactProfiles.Add(profile);
        await db.SaveChangesAsync();

        var handler = new CreateContactInquiryCommandHandler(db, Substitute.For<IGroupAuthorizationService>());
        var result = await handler.Handle(new CreateContactInquiryCommand(
            profile.Id, null, "Visitor", "visitor@example.test", null,
            "Could someone call me?", "en", "/groups/example", "127.0.0.1", "unit-test"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(db.ContactInquiries);
        var notification = await db.NotificationMessages.SingleAsync();
        Assert.Equal(contactMemberId, notification.RecipientMemberId);
        Assert.Equal("contact.inquiry.received", notification.ActionType);
        Assert.Contains("Could someone call me?", notification.ActionDataJson);
    }

    [Fact]
    public async Task Inquiry_GroupOnlyRejectsAnonymousViewer()
    {
        using var db = CreateDbContext();
        var profile = Profile(Guid.NewGuid(), ContactProfileVisibility.GroupOnly, "Private");
        db.ContactProfiles.Add(profile);
        await db.SaveChangesAsync();
        var handler = new CreateContactInquiryCommandHandler(db, Substitute.For<IGroupAuthorizationService>());

        var result = await handler.Handle(new CreateContactInquiryCommand(
            profile.Id, null, "Visitor", "visitor@example.test", null, "Hello", "en", null, null, null),
            CancellationToken.None);

        Assert.Equal(AppResultStatus.Forbidden, result.Status);
        Assert.Empty(db.ContactInquiries);
        Assert.Empty(db.NotificationMessages);
    }

    [Fact]
    public async Task Event_CanPersistMultipleContactProfilesFromItsGroup()
    {
        using var db = CreateDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var first = Profile(groupId, ContactProfileVisibility.Public, "First");
        var second = Profile(groupId, ContactProfileVisibility.GroupOnly, "Second");
        db.ContactProfiles.AddRange(first, second);
        await db.SaveChangesAsync();

        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var cache = Substitute.For<IEventCacheInvalidationService>();
        var handler = new CreateGroupEventCommandHandler(db, authorization, cache);

        var result = await handler.Handle(new CreateGroupEventCommand(
            groupId, leaderId, "Event", "活动", DateTime.UtcNow, DateTime.UtcNow.AddHours(2), "{}",
            [first.Id, second.Id]), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value!.ContactProfileIds!.Count);
        Assert.Equal(2, await db.EventContactProfiles.CountAsync());
    }

    private static ContactProfile Profile(Guid groupId, ContactProfileVisibility visibility, string name) => new()
    {
        Id = Guid.NewGuid(),
        MemberId = Guid.NewGuid(),
        OwnerGroupId = groupId,
        NameJson = $"{{\"en\":\"{name}\"}}",
        RoleJson = "{\"en\":\"Contact\"}",
        Visibility = visibility,
        CreatedUtc = DateTime.UtcNow,
        UpdatedUtc = DateTime.UtcNow
    };

    private static AlifeDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
