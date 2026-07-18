using Alife.Application.Common.Models;
using Alife.Application.ContentPosts;
using Alife.Application.ContentPosts.Commands.BulkImportContentPosts;
using Alife.Application.ContentPosts.Dtos;
using Alife.Application.ContentPosts.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.ContentPosts;

public sealed class BulkImportContentPostsHandlerTests
{
    [Fact]
    public async Task DryRun_PlansCreatesWithoutWriting()
    {
        await using var db = CreateDb();
        var group = CreateGroup(isChurch: true);
        var leaderId = Guid.NewGuid();
        db.Groups.Add(group);
        await db.SaveChangesAsync();
        var (handler, _, cache) = CreateHandler(db, group.Id, leaderId, authorized: true);

        var result = await handler.Handle(
            Command(group.Id, leaderId, dryRun: true, Item("https://nzalc.org/news/one.html")),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Value!.CreateCount);
        var report = Assert.Single(result.Value.Items);
        Assert.Equal(ContentPostImportDisposition.Create, report.Disposition);
        Assert.False(report.Applied);
        Assert.Equal(64, report.SourceKey!.Length);
        Assert.Equal(64, report.SourceChecksum!.Length);
        Assert.Empty(db.ContentPosts);
        Assert.Empty(db.AuditLogs);
        await cache.DidNotReceiveWithAnyArgs()
            .RemovePublicBatchAsync(default, default!, default);
    }

    [Fact]
    public async Task Execute_CreatesDraftAndRepeatIsUnchanged()
    {
        await using var db = CreateDb();
        var group = CreateGroup(isChurch: true);
        var leaderId = Guid.NewGuid();
        db.Groups.Add(group);
        await db.SaveChangesAsync();
        var (handler, _, cache) = CreateHandler(db, group.Id, leaderId, authorized: true);
        var item = Item("https://nzalc.org/news/one.html");

        var first = await handler.Handle(
            Command(group.Id, leaderId, dryRun: false, item),
            CancellationToken.None);
        var second = await handler.Handle(
            Command(group.Id, leaderId, dryRun: false, item),
            CancellationToken.None);

        Assert.True(first.IsSuccess);
        Assert.True(Assert.Single(first.Value!.Items).Applied);
        Assert.Equal(ContentPostImportDisposition.Unchanged, Assert.Single(second.Value!.Items).Disposition);
        var post = await db.ContentPosts.SingleAsync();
        Assert.Equal(ContentPostStatus.Draft, post.Status);
        Assert.Equal(ContentPostVisibility.Public, post.Visibility);
        Assert.Equal("https://nzalc.org/news/one.html", post.SourceUrl);
        Assert.Equal("content_post.import.create", (await db.AuditLogs.SingleAsync()).Action);
        await cache.DidNotReceiveWithAnyArgs()
            .RemovePublicBatchAsync(default, default!, default);
    }

    [Fact]
    public async Task SameCanonicalSourceInBatch_IsReportedAsDuplicate()
    {
        await using var db = CreateDb();
        var group = CreateGroup(isChurch: true);
        var leaderId = Guid.NewGuid();
        db.Groups.Add(group);
        await db.SaveChangesAsync();
        var (handler, _, _) = CreateHandler(db, group.Id, leaderId, authorized: true);

        var result = await handler.Handle(
            new BulkImportContentPostsCommand(
                group.Id,
                leaderId,
                DryRun: true,
                Publish: false,
                UpdateChanged: false,
                [
                    Item("http://www.nzalc.org/news/one.html/?b=2&utm_source=legacy&a=1"),
                    Item("https://nzalc.org/news/one.html?a=1&b=2")
                ]),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Value!.DuplicateCount);
        Assert.Equal(
            "duplicateSourceInBatch",
            result.Value.Items[1].ReasonCode);
    }

    [Fact]
    public async Task IdenticalContentUnderAnotherSource_IsReportedAsDuplicate()
    {
        await using var db = CreateDb();
        var group = CreateGroup(isChurch: true);
        var leaderId = Guid.NewGuid();
        db.Groups.Add(group);
        await db.SaveChangesAsync();
        var (handler, _, _) = CreateHandler(db, group.Id, leaderId, authorized: true);
        var first = Item("https://nzalc.org/news/one.html");
        var second = first with { SourceUrl = "https://nzalc.org/news/alias.html" };

        var result = await handler.Handle(
            new BulkImportContentPostsCommand(
                group.Id,
                leaderId,
                DryRun: true,
                Publish: false,
                UpdateChanged: false,
                [first, second]),
            CancellationToken.None);

        Assert.Equal(1, result.Value!.DuplicateCount);
        Assert.Equal("duplicateContentInBatch", result.Value.Items[1].ReasonCode);
    }

    [Fact]
    public async Task ChangedSource_RequiresExplicitUpdateChanged()
    {
        await using var db = CreateDb();
        var group = CreateGroup(isChurch: true);
        var leaderId = Guid.NewGuid();
        db.Groups.Add(group);
        await db.SaveChangesAsync();
        var (handler, _, _) = CreateHandler(db, group.Id, leaderId, authorized: true);
        var original = Item("https://nzalc.org/news/one.html");
        await handler.Handle(
            Command(group.Id, leaderId, dryRun: false, original),
            CancellationToken.None);
        var changed = original with
        {
            Body = new Dictionary<string, string> { ["zh"] = "<p>更新正文</p>" }
        };

        var skipped = await handler.Handle(
            Command(group.Id, leaderId, dryRun: false, changed),
            CancellationToken.None);
        var updated = await handler.Handle(
            new BulkImportContentPostsCommand(
                group.Id,
                leaderId,
                DryRun: false,
                Publish: false,
                UpdateChanged: true,
                [changed]),
            CancellationToken.None);

        Assert.Equal(
            ContentPostImportDisposition.ChangedSkipped,
            Assert.Single(skipped.Value!.Items).Disposition);
        Assert.Equal(
            ContentPostImportDisposition.Update,
            Assert.Single(updated.Value!.Items).Disposition);
        Assert.Equal(
            "<p>更新正文</p>",
            ContentPostMapper.ReadLocalized((await db.ContentPosts.SingleAsync()).BodyJson)["zh"]);
        Assert.Equal(2, await db.AuditLogs.CountAsync());
    }

    [Fact]
    public async Task ExistingContentAndSlugCollisions_AreReportedWithoutWriting()
    {
        await using var db = CreateDb();
        var group = CreateGroup(isChurch: true);
        var leaderId = Guid.NewGuid();
        db.Groups.Add(group);
        await db.SaveChangesAsync();
        var (handler, _, _) = CreateHandler(db, group.Id, leaderId, authorized: true);
        var original = Item("https://nzalc.org/news/one.html");
        await handler.Handle(
            Command(group.Id, leaderId, dryRun: false, original),
            CancellationToken.None);
        var identicalAlias = original with
        {
            SourceUrl = "https://nzalc.org/news/alias.html",
            Slug = "different-slug"
        };
        var slugCollision = original with
        {
            SourceUrl = "https://nzalc.org/news/different.html",
            Body = new Dictionary<string, string> { ["zh"] = "<p>不同内容</p>" }
        };

        var duplicate = await handler.Handle(
            Command(group.Id, leaderId, dryRun: false, identicalAlias),
            CancellationToken.None);
        var conflict = await handler.Handle(
            Command(group.Id, leaderId, dryRun: false, slugCollision),
            CancellationToken.None);

        Assert.Equal(
            "existingContentDuplicate",
            Assert.Single(duplicate.Value!.Items).ReasonCode);
        Assert.Equal(
            "slugConflict",
            Assert.Single(conflict.Value!.Items).ReasonCode);
        Assert.Single(db.ContentPosts);
        Assert.Single(db.AuditLogs);
    }

    [Fact]
    public async Task Publish_RejectsWarningItemsAndInvalidatesOneBatchForCleanItems()
    {
        await using var db = CreateDb();
        var group = CreateGroup(isChurch: true);
        var leaderId = Guid.NewGuid();
        db.Groups.Add(group);
        await db.SaveChangesAsync();
        var (handler, _, cache) = CreateHandler(db, group.Id, leaderId, authorized: true);
        var warned = Item("https://nzalc.org/news/warned.html") with
        {
            SourceWarnings = ["possibleSensitivePersonalData"]
        };
        var clean = Item("https://nzalc.org/news/clean.html") with
        {
            Slug = "clean-article",
            Body = new Dictionary<string, string> { ["zh"] = "<p>不同正文</p>" }
        };

        var result = await handler.Handle(
            new BulkImportContentPostsCommand(
                group.Id,
                leaderId,
                DryRun: false,
                Publish: true,
                UpdateChanged: false,
                [warned, clean]),
            CancellationToken.None);

        Assert.Equal(1, result.Value!.ConflictCount);
        Assert.Equal(1, result.Value.CreateCount);
        Assert.Equal(ContentPostStatus.Published, (await db.ContentPosts.SingleAsync()).Status);
        await cache.Received(1).RemovePublicBatchAsync(
            group.Id,
            Arg.Is<IReadOnlyCollection<string>>(x => x.SequenceEqual(new[] { "clean-article" })),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Publish_AfterDraftImport_PublishesUnchangedReviewedSource()
    {
        await using var db = CreateDb();
        var group = CreateGroup(isChurch: true);
        var leaderId = Guid.NewGuid();
        db.Groups.Add(group);
        await db.SaveChangesAsync();
        var (handler, _, cache) = CreateHandler(db, group.Id, leaderId, authorized: true);
        var item = Item("https://nzalc.org/news/reviewed.html") with
        {
            Slug = "reviewed-article"
        };
        await handler.Handle(
            Command(group.Id, leaderId, dryRun: false, item),
            CancellationToken.None);

        var result = await handler.Handle(
            new BulkImportContentPostsCommand(
                group.Id,
                leaderId,
                DryRun: false,
                Publish: true,
                UpdateChanged: false,
                [item]),
            CancellationToken.None);

        var report = Assert.Single(result.Value!.Items);
        Assert.Equal(ContentPostImportDisposition.Update, report.Disposition);
        Assert.Equal("publish", report.ReasonCode);
        Assert.True(report.Applied);
        Assert.Equal(ContentPostStatus.Published, (await db.ContentPosts.SingleAsync()).Status);
        await cache.Received(1).RemovePublicBatchAsync(
            group.Id,
            Arg.Is<IReadOnlyCollection<string>>(x => x.Contains("reviewed-article")),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ChangedPublishedSource_RequiresExplicitPublishAndClearedWarnings()
    {
        await using var db = CreateDb();
        var group = CreateGroup(isChurch: true);
        var leaderId = Guid.NewGuid();
        db.Groups.Add(group);
        await db.SaveChangesAsync();
        var (handler, _, cache) = CreateHandler(db, group.Id, leaderId, authorized: true);
        var original = Item("https://nzalc.org/news/published.html");
        await handler.Handle(
            new BulkImportContentPostsCommand(
                group.Id,
                leaderId,
                DryRun: false,
                Publish: true,
                UpdateChanged: false,
                [original]),
            CancellationToken.None);
        cache.ClearReceivedCalls();
        var changed = original with
        {
            Body = new Dictionary<string, string> { ["zh"] = "<p>未经复核的新正文</p>" },
            SourceWarnings = ["possibleSensitivePersonalData"]
        };

        var result = await handler.Handle(
            new BulkImportContentPostsCommand(
                group.Id,
                leaderId,
                DryRun: false,
                Publish: false,
                UpdateChanged: true,
                [changed]),
            CancellationToken.None);

        var report = Assert.Single(result.Value!.Items);
        Assert.Equal(ContentPostImportDisposition.Conflict, report.Disposition);
        Assert.Equal("publishedUpdateRequiresPublish", report.ReasonCode);
        Assert.False(report.Applied);
        Assert.Equal(
            "<p>正文</p>",
            ContentPostMapper.ReadLocalized((await db.ContentPosts.SingleAsync()).BodyJson)["zh"]);
        await cache.DidNotReceiveWithAnyArgs()
            .RemovePublicBatchAsync(default, default!, default);
    }

    [Fact]
    public async Task OrdinaryMember_IsForbidden()
    {
        await using var db = CreateDb();
        var group = CreateGroup(isChurch: true);
        var memberId = Guid.NewGuid();
        db.Groups.Add(group);
        await db.SaveChangesAsync();
        var (handler, _, _) = CreateHandler(db, group.Id, memberId, authorized: false);

        var result = await handler.Handle(
            Command(group.Id, memberId, dryRun: true, Item("https://nzalc.org/news/one.html")),
            CancellationToken.None);

        Assert.Equal(AppResultStatus.Forbidden, result.Status);
    }

    [Fact]
    public async Task SubgroupImport_IsRejected()
    {
        await using var db = CreateDb();
        var group = CreateGroup(isChurch: false);
        var leaderId = Guid.NewGuid();
        db.Groups.Add(group);
        await db.SaveChangesAsync();
        var (handler, authorization, _) = CreateHandler(db, group.Id, leaderId, authorized: true);

        var result = await handler.Handle(
            Command(group.Id, leaderId, dryRun: true, Item("https://nzalc.org/news/one.html")),
            CancellationToken.None);

        Assert.Equal(AppResultStatus.ValidationError, result.Status);
        await authorization.Received(1).IsLeaderOrCoLeaderAsync(
            group.Id,
            leaderId,
            Arg.Any<CancellationToken>());
    }

    private static BulkImportContentPostsCommand Command(
        Guid groupId,
        Guid memberId,
        bool dryRun,
        ContentPostImportItemDto item)
        => new(
            groupId,
            memberId,
            dryRun,
            Publish: false,
            UpdateChanged: false,
            [item]);

    private static ContentPostImportItemDto Item(string sourceUrl)
        => new(
            sourceUrl,
            new Dictionary<string, string> { ["zh"] = "历史消息" },
            new Dictionary<string, string> { ["zh"] = "摘要" },
            new Dictionary<string, string> { ["zh"] = "<p>正文</p>" },
            ContentPostCategory.News,
            "history-news",
            "https://nzalc.org/images/cover.jpg",
            "Legacy editor",
            new DateTime(2019, 2, 3, 0, 0, 0, DateTimeKind.Utc),
            []);

    private static (
        BulkImportContentPostsCommandHandler Handler,
        IGroupAuthorizationService Authorization,
        IContentPostCacheInvalidationService Cache) CreateHandler(
        AlifeDbContext db,
        Guid groupId,
        Guid memberId,
        bool authorized)
    {
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(authorized);
        var cache = Substitute.For<IContentPostCacheInvalidationService>();
        return (
            new BulkImportContentPostsCommandHandler(db, authorization, cache),
            authorization,
            cache);
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
}
