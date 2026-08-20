using Alife.Application.Albums;
using Alife.Application.ChurchLife;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.ChurchLife;

public sealed class ChurchLifeServiceTests
{
    [Fact]
    public async Task Scope_RecursesOpenTreeAndPrunesClosedUnrelatedAndCyclicBranches()
    {
        await using var db = CreateDb();
        var memberId = Guid.NewGuid();
        var root = Group("Church", isChurch: true);
        var child = Group("Ministry", parentId: root.Id);
        var grandchild = Group("Team", parentId: child.Id);
        var closed = Group("Closed", parentId: root.Id, isClosed: true);
        var closedDescendant = Group("Closed child", parentId: closed.Id);
        var unrelated = Group("Other root");
        var cycleA = Group("Cycle A");
        var cycleB = Group("Cycle B", parentId: cycleA.Id);
        cycleA.ParentGroupId = cycleB.Id;

        db.Members.Add(Member(memberId));
        db.Groups.AddRange(root, child, grandchild, closed, closedDescendant, unrelated, cycleA, cycleB);
        db.GroupMemberships.Add(Membership(child.Id, memberId, MembershipRole.Leader));
        await db.SaveChangesAsync();

        var result = await new ChurchLifeScopeService(db).GetScopeAsync(memberId, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal([root.Id, child.Id, grandchild.Id], result.Value!.Groups.Select(x => x.Id));
        Assert.Equal([root.Id, child.Id, grandchild.Id], result.Value.Groups.Single(x => x.Id == grandchild.Id).PathIds);
        Assert.True(result.Value.Groups.Single(x => x.Id == child.Id).CanManage);
        Assert.DoesNotContain(result.Value.Groups, x => x.Id == closed.Id || x.Id == closedDescendant.Id || x.Id == unrelated.Id || x.Id == cycleA.Id || x.Id == cycleB.Id);
    }

    [Fact]
    public async Task AggregatesPublishedContentUsingOwnerAndRootMembershipBoundaries()
    {
        await using var db = CreateDb();
        var now = DateTime.UtcNow;
        var memberId = Guid.NewGuid();
        var root = Group("Church", isChurch: true);
        var child = Group("Ministry", parentId: root.Id);
        var grandchild = Group("Team", parentId: child.Id);
        var privateGroup = Group("Private ministry", parentId: root.Id, accessType: AccessType.Private);
        var closed = Group("Closed", parentId: root.Id, isClosed: true);
        db.Members.Add(Member(memberId));
        db.Groups.AddRange(root, child, grandchild, privateGroup, closed);
        db.GroupMemberships.Add(Membership(child.Id, memberId));

        var rootPublicPage = Page(root.Id, PageVisibility.Public, now.AddMinutes(-1));
        var rootGroupPage = Page(root.Id, PageVisibility.Group, now.AddMinutes(-2));
        var childGroupPage = Page(child.Id, PageVisibility.Group, now.AddMinutes(-3));
        var childDraft = Page(child.Id, PageVisibility.Draft, now);
        var privatePublicPage = Page(privateGroup.Id, PageVisibility.Public, now.AddMinutes(-4));
        db.Pages.AddRange(rootPublicPage, rootGroupPage, childGroupPage, childDraft, privatePublicPage);
        db.PagePublicationReviews.AddRange(ApprovedReview(rootPublicPage.Id), ApprovedReview(privatePublicPage.Id));

        db.Announcements.AddRange(
            Announcement(privateGroup.Id, memberId, AnnouncementAudience.Public, now),
            Announcement(child.Id, memberId, AnnouncementAudience.SpecificGroup, now.AddMinutes(-1)),
            Announcement(grandchild.Id, memberId, AnnouncementAudience.ChurchMembers, now.AddMinutes(-2)),
            Announcement(root.Id, memberId, AnnouncementAudience.Public, now.AddMinutes(-3), status: AnnouncementStatus.Draft),
            Announcement(root.Id, memberId, AnnouncementAudience.Public, now.AddDays(-2), expireUtc: now.AddDays(-1)));

        var categoryId = Guid.NewGuid();
        db.ForumCategories.Add(new ForumCategory { Id = categoryId, NameJson = "{\"en\":\"General\"}", IsEnabled = true, CreatedUtc = now, UpdatedUtc = now });
        db.ForumPosts.AddRange(
            ForumPost(categoryId, privateGroup.Id, memberId, ForumPostVisibility.Public, now),
            ForumPost(categoryId, child.Id, memberId, ForumPostVisibility.GroupOnly, now.AddMinutes(-1)),
            ForumPost(categoryId, grandchild.Id, memberId, ForumPostVisibility.GroupOnly, now.AddMinutes(-2)),
            ForumPost(categoryId, null, memberId, ForumPostVisibility.MembersOnly, now.AddMinutes(-3)),
            ForumPost(categoryId, closed.Id, memberId, ForumPostVisibility.Public, now.AddMinutes(-4)));
        await db.SaveChangesAsync();

        var pageRead = Substitute.For<IPageReadService>();
        var pagesByGroup = new Dictionary<Guid, IReadOnlyList<PageDto>>
        {
            [root.Id] = [PageDto(rootPublicPage), PageDto(rootGroupPage)],
            [child.Id] = [PageDto(childGroupPage), PageDto(childDraft)],
            [grandchild.Id] = [],
            [privateGroup.Id] = [PageDto(privatePublicPage)],
        };
        pageRead.GetGroupPagesAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(call => pagesByGroup.GetValueOrDefault(call.ArgAt<Guid>(0), []));

        var eventRead = Substitute.For<IEventReadService>();
        var childPrivateEvent = Event(child.Id, EventVisibilityPolicy.GroupVisible, EventRamStatus.Approved, now.AddDays(1));
        var grandChurchEvent = Event(grandchild.Id, EventVisibilityPolicy.ChurchVisible, EventRamStatus.Approved, now.AddDays(2));
        var privatePublicEvent = Event(privateGroup.Id, EventVisibilityPolicy.Public, EventRamStatus.Approved, now.AddDays(3));
        var draftEvent = Event(root.Id, EventVisibilityPolicy.Public, EventRamStatus.Draft, now.AddDays(4));
        var eventsByGroup = new Dictionary<Guid, IReadOnlyList<GroupEventSummaryDto>>
        {
            [root.Id] = [draftEvent],
            [child.Id] = [childPrivateEvent],
            [grandchild.Id] = [grandChurchEvent],
            [privateGroup.Id] = [privatePublicEvent],
        };
        eventRead.GetGroupEventsAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(call => eventsByGroup.GetValueOrDefault(call.ArgAt<Guid>(0), []));

        var albumService = Substitute.For<IAlbumService>();
        var publicAlbum = new AlbumSummaryDto(Guid.NewGuid(), privateGroup.Id, null, new Dictionary<string, string> { ["en"] = "Public album" }, null, AlbumVisibility.Public, 0, null, 0, 0);
        albumService.ListChurchLifeAsync(Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns([publicAlbum]);

        var service = new ChurchLifeService(db, new ChurchLifeScopeService(db), pageRead, eventRead, albumService);

        var pages = await service.ListPagesAsync(memberId, null, CancellationToken.None);
        var events = await service.ListEventsAsync(memberId, null, CancellationToken.None);
        var announcements = await service.ListAnnouncementsAsync(memberId, null, CancellationToken.None);
        var albums = await service.ListAlbumsAsync(memberId, null, CancellationToken.None);
        var forum = await service.ListForumPostsAsync(memberId, null, null, 1, 20, CancellationToken.None);

        Assert.Equal([rootPublicPage.Id, childGroupPage.Id, privatePublicPage.Id], pages.Value!.Items.Select(x => x.Id));
        Assert.Equal([childPrivateEvent.Id, privatePublicEvent.Id], events.Value!.Items.Select(x => x.Id));
        Assert.Equal(Guid.Empty, events.Value.Items.Single(x => x.Id == privatePublicEvent.Id).CreatedByMemberId);
        Assert.Empty(events.Value.Items.Single(x => x.Id == privatePublicEvent.Id).ContactProfileIds!);
        Assert.Equal(2, announcements.Value!.Items.Count);
        Assert.DoesNotContain(announcements.Value.Items, x => x.Audience == AnnouncementAudience.ChurchMembers);
        Assert.Equal(publicAlbum.Id, Assert.Single(albums.Value!.Items).Id);
        Assert.Equal(2, forum.Value!.Items.Count);
        Assert.DoesNotContain(forum.Value.Items, x => x.GroupId == grandchild.Id || x.GroupId == closed.Id || x.GroupId == null);
        Assert.Contains(pages.Value.Groups, x => x.Id == privateGroup.Id && x.Name["en"] == "Private ministry");
    }

    [Fact]
    public async Task OwnerFilterRejectsGroupsOutsideOpenChurchTree()
    {
        await using var db = CreateDb();
        var memberId = Guid.NewGuid();
        db.Members.Add(Member(memberId));
        db.Groups.Add(Group("Church", isChurch: true));
        await db.SaveChangesAsync();
        var service = new ChurchLifeService(
            db,
            new ChurchLifeScopeService(db),
            Substitute.For<IPageReadService>(),
            Substitute.For<IEventReadService>(),
            Substitute.For<IAlbumService>());

        var result = await service.ListAnnouncementsAsync(memberId, Guid.NewGuid(), CancellationToken.None);

        Assert.Equal(AppResultStatus.ValidationError, result.Status);
    }

    [Fact]
    public async Task GroupMetadataKeepsPrivateAncestorsForCompleteVisiblePaths()
    {
        await using var db = CreateDb();
        var memberId = Guid.NewGuid();
        var root = Group("Church", isChurch: true);
        var privateParent = Group("Private parent", parentId: root.Id, accessType: AccessType.Private);
        var publicChild = Group("Public child", parentId: privateParent.Id);
        var page = Page(publicChild.Id, PageVisibility.Public, DateTime.UtcNow);
        db.Members.Add(Member(memberId));
        db.Groups.AddRange(root, privateParent, publicChild);
        db.Pages.Add(page);
        db.PagePublicationReviews.Add(ApprovedReview(page.Id));
        await db.SaveChangesAsync();
        var pageRead = Substitute.For<IPageReadService>();
        pageRead.GetGroupPagesAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(call => call.ArgAt<Guid>(0) == publicChild.Id ? [PageDto(page)] : []);
        var service = new ChurchLifeService(
            db,
            new ChurchLifeScopeService(db),
            pageRead,
            Substitute.For<IEventReadService>(),
            Substitute.For<IAlbumService>());

        var result = await service.ListPagesAsync(memberId, null, CancellationToken.None);

        var parentMetadata = result.Value!.Groups.Single(x => x.Id == privateParent.Id);
        var childMetadata = result.Value.Groups.Single(x => x.Id == publicChild.Id);
        Assert.False(parentMetadata.IsSelectable);
        Assert.True(childMetadata.IsSelectable);
        Assert.Equal([root.Id, privateParent.Id, publicChild.Id], childMetadata.PathIds);
    }

    [Fact]
    public async Task ForumFilterRejectsMissingOrDisabledCategories()
    {
        await using var db = CreateDb();
        var memberId = Guid.NewGuid();
        db.Members.Add(Member(memberId));
        db.Groups.Add(Group("Church", isChurch: true));
        var disabledCategoryId = Guid.NewGuid();
        db.ForumCategories.Add(new ForumCategory
        {
            Id = disabledCategoryId,
            NameJson = "{\"en\":\"Disabled\"}",
            IsEnabled = false,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
        var service = new ChurchLifeService(
            db,
            new ChurchLifeScopeService(db),
            Substitute.For<IPageReadService>(),
            Substitute.For<IEventReadService>(),
            Substitute.For<IAlbumService>());

        var missing = await service.ListForumPostsAsync(
            memberId,
            null,
            Guid.NewGuid(),
            1,
            20,
            CancellationToken.None);
        var disabled = await service.ListForumPostsAsync(
            memberId,
            null,
            disabledCategoryId,
            1,
            20,
            CancellationToken.None);

        Assert.Equal(AppResultStatus.ValidationError, missing.Status);
        Assert.Equal(AppResultStatus.ValidationError, disabled.Status);
    }

    [Fact]
    public async Task RootMembershipUnlocksChurchWideContentButNotOwnerGroupContent()
    {
        await using var db = CreateDb();
        var now = DateTime.UtcNow;
        var memberId = Guid.NewGuid();
        var root = Group("Church", isChurch: true);
        var child = Group("Ministry", parentId: root.Id);
        db.Members.Add(Member(memberId));
        db.Groups.AddRange(root, child);
        db.GroupMemberships.Add(Membership(root.Id, memberId));
        db.Announcements.AddRange(
            Announcement(child.Id, memberId, AnnouncementAudience.ChurchMembers, now),
            Announcement(child.Id, memberId, AnnouncementAudience.SpecificGroup, now.AddMinutes(-1)));
        await db.SaveChangesAsync();

        var eventRead = Substitute.For<IEventReadService>();
        eventRead.GetGroupEventsAsync(root.Id, Arg.Any<CancellationToken>()).Returns([]);
        eventRead.GetGroupEventsAsync(child.Id, Arg.Any<CancellationToken>()).Returns([
            Event(child.Id, EventVisibilityPolicy.ChurchVisible, EventRamStatus.Approved, now.AddDays(1)),
            Event(child.Id, EventVisibilityPolicy.GroupVisible, EventRamStatus.Approved, now.AddDays(2)),
        ]);
        var service = new ChurchLifeService(
            db,
            new ChurchLifeScopeService(db),
            Substitute.For<IPageReadService>(),
            eventRead,
            Substitute.For<IAlbumService>());

        var events = await service.ListEventsAsync(memberId, null, CancellationToken.None);
        var announcements = await service.ListAnnouncementsAsync(memberId, null, CancellationToken.None);

        var churchEvent = Assert.Single(events.Value!.Items);
        Assert.Equal(EventVisibilityPolicy.ChurchVisible, churchEvent.Visibility);
        Assert.Equal(Guid.Empty, churchEvent.CreatedByMemberId);
        Assert.Equal(AnnouncementAudience.ChurchMembers, Assert.Single(announcements.Value!.Items).Audience);
    }

    [Fact]
    public async Task OwnerLeaderStillSeesOnlyPublishedContentInAggregate()
    {
        await using var db = CreateDb();
        var now = DateTime.UtcNow;
        var memberId = Guid.NewGuid();
        var root = Group("Church", isChurch: true);
        var child = Group("Ministry", parentId: root.Id);
        db.Members.Add(Member(memberId));
        db.Groups.AddRange(root, child);
        db.GroupMemberships.Add(Membership(child.Id, memberId, MembershipRole.Leader));
        var publishedPage = Page(child.Id, PageVisibility.Public, now.AddMinutes(-1));
        var draftPage = Page(child.Id, PageVisibility.Draft, now);
        db.Pages.AddRange(publishedPage, draftPage);
        db.PagePublicationReviews.Add(ApprovedReview(publishedPage.Id));
        db.Announcements.AddRange(
            Announcement(child.Id, memberId, AnnouncementAudience.Public, now),
            Announcement(child.Id, memberId, AnnouncementAudience.Public, now, AnnouncementStatus.Draft));
        await db.SaveChangesAsync();

        var pageRead = Substitute.For<IPageReadService>();
        pageRead.GetGroupPagesAsync(root.Id, Arg.Any<CancellationToken>()).Returns([]);
        pageRead.GetGroupPagesAsync(child.Id, Arg.Any<CancellationToken>()).Returns([
            PageDto(publishedPage),
            PageDto(draftPage),
        ]);
        var eventRead = Substitute.For<IEventReadService>();
        eventRead.GetGroupEventsAsync(root.Id, Arg.Any<CancellationToken>()).Returns([]);
        eventRead.GetGroupEventsAsync(child.Id, Arg.Any<CancellationToken>()).Returns([
            Event(child.Id, EventVisibilityPolicy.Public, EventRamStatus.Approved, now.AddDays(1)),
            Event(child.Id, EventVisibilityPolicy.Public, EventRamStatus.Draft, now.AddDays(2)),
        ]);
        var service = new ChurchLifeService(
            db,
            new ChurchLifeScopeService(db),
            pageRead,
            eventRead,
            Substitute.For<IAlbumService>());

        var pages = await service.ListPagesAsync(memberId, null, CancellationToken.None);
        var events = await service.ListEventsAsync(memberId, null, CancellationToken.None);
        var announcements = await service.ListAnnouncementsAsync(memberId, null, CancellationToken.None);

        Assert.Equal(publishedPage.Id, Assert.Single(pages.Value!.Items).Id);
        Assert.Single(events.Value!.Items);
        Assert.Single(announcements.Value!.Items);
        Assert.True(pages.Value.Groups.Single(x => x.Id == child.Id).CanManage);
    }

    [Fact]
    public async Task UnregisteredMemberCannotCreateChurchLifeScope()
    {
        await using var db = CreateDb();
        var member = Member(Guid.NewGuid());
        member.IsRegistered = false;
        db.Members.Add(member);
        db.Groups.Add(Group("Church", isChurch: true));
        await db.SaveChangesAsync();

        var result = await new ChurchLifeScopeService(db).GetScopeAsync(member.Id, CancellationToken.None);

        Assert.Equal(AppResultStatus.Forbidden, result.Status);
    }

    private static AlifeDbContext CreateDb() => new(new DbContextOptionsBuilder<AlifeDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
        .Options);

    private static Group Group(
        string name,
        Guid? parentId = null,
        bool isChurch = false,
        bool isClosed = false,
        AccessType accessType = AccessType.Public) => new()
        {
            Id = Guid.NewGuid(),
            NameJson = $"{{\"en\":\"{name}\",\"zh\":\"{name}\"}}",
            ParentGroupId = parentId,
            AccessType = accessType,
            IsChurch = isChurch,
            IsClosed = isClosed,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow,
        };

    private static Member Member(Guid id) => new()
    {
        Id = id,
        DisplayName = "Member",
        IsRegistered = true,
        CreatedUtc = DateTime.UtcNow,
        UpdatedUtc = DateTime.UtcNow,
    };

    private static GroupMembership Membership(Guid groupId, Guid memberId, MembershipRole role = MembershipRole.Member) => new()
    {
        Id = Guid.NewGuid(),
        GroupId = groupId,
        MemberId = memberId,
        Status = MembershipStatus.Approved,
        Role = role,
        CreatedUtc = DateTime.UtcNow,
        UpdatedUtc = DateTime.UtcNow,
    };

    private static Page Page(Guid ownerGroupId, PageVisibility visibility, DateTime updatedUtc) => new()
    {
        Id = Guid.NewGuid(),
        OwnerGroupId = ownerGroupId,
        CreatedByMemberId = Guid.NewGuid(),
        TitleJson = "{\"en\":\"Page\"}",
        TagsJson = "[]",
        TitleDisplayStyle = "default",
        Visibility = visibility,
        UpdatedUtc = updatedUtc,
    };

    private static PageDto PageDto(Page page) => new(
        page.Id,
        page.OwnerGroupId,
        page.CreatedByMemberId,
        new Dictionary<string, string> { ["en"] = "Page" },
        null,
        page.TagsJson,
        page.TitleDisplayStyle,
        page.Visibility,
        page.UpdatedUtc);

    private static PagePublicationReview ApprovedReview(Guid pageId) => new()
    {
        Id = Guid.NewGuid(),
        PageId = pageId,
        Status = PagePublicationReviewStatus.Approved,
        CreatedUtc = DateTime.UtcNow,
        UpdatedUtc = DateTime.UtcNow,
    };

    private static GroupEventSummaryDto Event(Guid groupId, string visibility, EventRamStatus ramStatus, DateTime startUtc) => new(
        Guid.NewGuid(),
        groupId,
        Guid.NewGuid(),
        "Event",
        "活动",
        startUtc,
        startUtc.AddHours(1),
        $"{{\"visibility\":\"{visibility}\",\"privateNotes\":\"secret\"}}",
        DateTime.UtcNow,
        DateTime.UtcNow,
        [Guid.NewGuid()],
        ramStatus,
        visibility);

    private static Announcement Announcement(
        Guid groupId,
        Guid memberId,
        AnnouncementAudience audience,
        DateTime publishUtc,
        AnnouncementStatus status = AnnouncementStatus.Published,
        DateTime? expireUtc = null) => new()
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            TitleJson = "{\"en\":\"Notice\"}",
            SummaryJson = "{\"en\":\"Summary\"}",
            Audience = audience,
            Priority = AnnouncementPriority.Normal,
            Status = status,
            PublishUtc = publishUtc,
            ExpireUtc = expireUtc,
            CreatedByMemberId = memberId,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow,
        };

    private static ForumPost ForumPost(
        Guid categoryId,
        Guid? groupId,
        Guid memberId,
        ForumPostVisibility visibility,
        DateTime createdUtc) => new()
        {
            Id = Guid.NewGuid(),
            CategoryId = categoryId,
            GroupId = groupId,
            AuthorMemberId = memberId,
            TitleJson = "{\"en\":\"Post\"}",
            BodyJson = "{\"en\":\"Body\"}",
            MediaJson = "[]",
            Visibility = visibility,
            CreatedUtc = createdUtc,
            UpdatedUtc = createdUtc,
        };
}
