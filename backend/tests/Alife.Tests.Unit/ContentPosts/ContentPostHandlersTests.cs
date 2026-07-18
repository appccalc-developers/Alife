using Alife.Application.Common.Models;
using Alife.Application.ContentPosts.Commands.PublishContentPost;
using Alife.Application.ContentPosts.Commands.SaveContentPost;
using Alife.Application.ContentPosts.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Alife.Infrastructure.ReadServices;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;

namespace Alife.Tests.Unit.ContentPosts;

public sealed class ContentPostHandlersTests
{
    [Fact]
    public async Task Save_AsLeader_CreatesBilingualDraftAndAuditLog()
    {
        await using var db = CreateDb();
        var group = CreateGroup(isChurch: true);
        var leaderId = Guid.NewGuid();
        db.Groups.Add(group);
        await db.SaveChangesAsync();

        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(group.Id, leaderId, Arg.Any<CancellationToken>())
            .Returns(true);
        var cache = Substitute.For<IContentPostCacheInvalidationService>();
        var handler = new SaveContentPostCommandHandler(db, authorization, cache);

        var result = await handler.Handle(
            CreateSaveCommand(group.Id, leaderId, slug: "Church News"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(ContentPostStatus.Draft, result.Value!.Status);
        Assert.Equal("church-news", result.Value.Slug);
        Assert.Equal("消息", result.Value.Title["zh"]);
        Assert.Equal("content_post.create", (await db.AuditLogs.SingleAsync()).Action);
        await cache.Received(1).RemovePublicIndexAsync(group.Id, Arg.Any<CancellationToken>());
        await cache.Received(1).RemovePublicDetailAsync(
            group.Id,
            "church-news",
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Save_AsOrdinaryMember_IsForbidden()
    {
        await using var db = CreateDb();
        var group = CreateGroup(isChurch: true);
        var memberId = Guid.NewGuid();
        db.Groups.Add(group);
        await db.SaveChangesAsync();

        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(group.Id, memberId, Arg.Any<CancellationToken>())
            .Returns(false);
        var handler = new SaveContentPostCommandHandler(
            db,
            authorization,
            Substitute.For<IContentPostCacheInvalidationService>());

        var result = await handler.Handle(
            CreateSaveCommand(group.Id, memberId),
            CancellationToken.None);

        Assert.Equal(AppResultStatus.Forbidden, result.Status);
        Assert.Empty(db.ContentPosts);
        Assert.Empty(db.AuditLogs);
    }

    [Fact]
    public async Task Publish_PublicPostOwnedBySubgroup_IsRejected()
    {
        await using var db = CreateDb();
        var subgroup = CreateGroup(isChurch: false);
        var leaderId = Guid.NewGuid();
        var post = CreatePost(
            subgroup.Id,
            leaderId,
            ContentPostStatus.Draft,
            ContentPostVisibility.Public,
            "subgroup-news");
        db.Groups.Add(subgroup);
        db.ContentPosts.Add(post);
        await db.SaveChangesAsync();

        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(subgroup.Id, leaderId, Arg.Any<CancellationToken>())
            .Returns(true);
        var handler = new PublishContentPostCommandHandler(
            db,
            authorization,
            Substitute.For<IContentPostCacheInvalidationService>());

        var result = await handler.Handle(
            new PublishContentPostCommand(post.Id, leaderId),
            CancellationToken.None);

        Assert.Equal(AppResultStatus.ValidationError, result.Status);
        Assert.Equal(ContentPostStatus.Draft, post.Status);
        Assert.Empty(db.AuditLogs);
    }

    [Fact]
    public async Task Save_PublicPostOwnedBySubgroup_IsRejectedBeforeItCanBePublished()
    {
        await using var db = CreateDb();
        var subgroup = CreateGroup(isChurch: false);
        var leaderId = Guid.NewGuid();
        db.Groups.Add(subgroup);
        await db.SaveChangesAsync();

        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(subgroup.Id, leaderId, Arg.Any<CancellationToken>())
            .Returns(true);
        var handler = new SaveContentPostCommandHandler(
            db,
            authorization,
            Substitute.For<IContentPostCacheInvalidationService>());

        var result = await handler.Handle(
            CreateSaveCommand(subgroup.Id, leaderId),
            CancellationToken.None);

        Assert.Equal(AppResultStatus.ValidationError, result.Status);
        Assert.Empty(db.ContentPosts);
    }

    [Fact]
    public async Task Publish_PublicPostOwnedByChurch_DoesNotUsePageReview()
    {
        await using var db = CreateDb();
        var church = CreateGroup(isChurch: true);
        var leaderId = Guid.NewGuid();
        var post = CreatePost(
            church.Id,
            leaderId,
            ContentPostStatus.Draft,
            ContentPostVisibility.Public,
            "welcome");
        db.Groups.Add(church);
        db.ContentPosts.Add(post);
        await db.SaveChangesAsync();

        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(church.Id, leaderId, Arg.Any<CancellationToken>())
            .Returns(true);
        var cache = Substitute.For<IContentPostCacheInvalidationService>();
        var handler = new PublishContentPostCommandHandler(db, authorization, cache);

        var result = await handler.Handle(
            new PublishContentPostCommand(post.Id, leaderId),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(ContentPostStatus.Published, result.Value!.Status);
        Assert.NotNull(result.Value.PublishedUtc);
        Assert.Equal("content_post.publish", (await db.AuditLogs.SingleAsync()).Action);
        await authorization.DidNotReceiveWithAnyArgs()
            .CanReviewPagesAsync(default, default);
    }

    [Fact]
    public async Task PublicIndex_ReturnsOnlyCurrentPublicPublishedSummariesInDateOrder()
    {
        await using var db = CreateDb();
        using var provider = CreateCacheProvider();
        var church = CreateGroup(isChurch: true);
        var authorId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var newest = CreatePost(
            church.Id,
            authorId,
            ContentPostStatus.Published,
            ContentPostVisibility.Public,
            "newest",
            now.AddMinutes(-1));
        newest.SourceUrl = "https://nzalc.org/archive/newest";
        var older = CreatePost(
            church.Id,
            authorId,
            ContentPostStatus.Published,
            ContentPostVisibility.Public,
            "older",
            now.AddDays(-1));
        var draft = CreatePost(
            church.Id,
            authorId,
            ContentPostStatus.Draft,
            ContentPostVisibility.Public,
            "draft");
        var membersOnly = CreatePost(
            church.Id,
            authorId,
            ContentPostStatus.Published,
            ContentPostVisibility.GroupVisible,
            "members",
            now.AddHours(-1));
        var deleted = CreatePost(
            church.Id,
            authorId,
            ContentPostStatus.Published,
            ContentPostVisibility.Public,
            "deleted",
            now.AddHours(-2));
        deleted.IsDeleted = true;

        db.Groups.Add(church);
        db.ContentPosts.AddRange(newest, older, draft, membersOnly, deleted);
        await db.SaveChangesAsync();

        var service = new ContentPostReadService(
            db,
            provider.GetRequiredService<HybridCache>());
        var result = await service.GetPublicIndexAsync(church.Id, CancellationToken.None);

        Assert.Equal([newest.Id, older.Id], result.Select(x => x.Id));
        Assert.All(result, value => Assert.DoesNotContain("body", value.GetType().GetProperties()
            .Select(property => property.Name), StringComparer.OrdinalIgnoreCase));

        var detail = await service.GetPublicDetailAsync(
            church.Id,
            newest.Slug,
            CancellationToken.None);
        Assert.Equal("https://nzalc.org/archive/newest", detail!.SourceUrl);
    }

    [Fact]
    public void Categories_AreTheFiveControlledValues()
    {
        Assert.Equal(
            [
                ContentPostCategory.General,
                ContentPostCategory.News,
                ContentPostCategory.SermonOutline,
                ContentPostCategory.Testimony,
                ContentPostCategory.Learning
            ],
            Enum.GetValues<ContentPostCategory>());
    }

    private static SaveContentPostCommand CreateSaveCommand(
        Guid groupId,
        Guid memberId,
        string? slug = "news")
        => new(
            null,
            groupId,
            memberId,
            new Dictionary<string, string> { ["en"] = "News", ["zh"] = "消息" },
            new Dictionary<string, string> { ["en"] = "Summary", ["zh"] = "摘要" },
            new Dictionary<string, string> { ["en"] = "Body", ["zh"] = "正文" },
            ContentPostCategory.News,
            ContentPostVisibility.Public,
            slug,
            null,
            "Alife Church",
            null,
            null,
            null,
            null);

    private static ContentPost CreatePost(
        Guid groupId,
        Guid authorId,
        ContentPostStatus status,
        ContentPostVisibility visibility,
        string slug,
        DateTime? publishedUtc = null)
    {
        var now = DateTime.UtcNow;
        return new ContentPost
        {
            Id = Guid.NewGuid(),
            OwnerGroupId = groupId,
            CreatedByMemberId = authorId,
            TitleJson = $$"""{"en":"{{slug}}","zh":"{{slug}}"}""",
            SummaryJson = """{"en":"Summary","zh":"摘要"}""",
            BodyJson = """{"en":"Body","zh":"正文"}""",
            Category = ContentPostCategory.News,
            Status = status,
            Visibility = visibility,
            Slug = slug,
            PublishedUtc = publishedUtc,
            CreatedUtc = now,
            UpdatedUtc = now
        };
    }

    private static Group CreateGroup(bool isChurch)
    {
        var now = DateTime.UtcNow;
        return new Group
        {
            Id = Guid.NewGuid(),
            NameJson = """{"en":"Church","zh":"教会"}""",
            AccessType = AccessType.Public,
            IsChurch = isChurch,
            CreatedUtc = now,
            UpdatedUtc = now
        };
    }

    private static AlifeDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    private static ServiceProvider CreateCacheProvider()
    {
        var services = new ServiceCollection();
        services.AddHybridCache();
        return services.BuildServiceProvider();
    }
}
