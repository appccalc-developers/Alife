using Alife.Application.Admin.Commands.UpdatePagePublicationCopy;
using Alife.Application.Admin.Queries.GetPagePublicationCopy;
using Alife.Application.Admin.Queries.ListPageReviewCandidates;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;
using NSubstitute;

namespace Alife.Tests.Unit.Pages;

public class PagePublicationCopyTests
{
    [Fact]
    public async Task UpdatePendingCopy_ChangesOnlySubmittedSnapshotAndLeavesGroupAndPublishedCopiesUntouched()
    {
        using var dbContext = CreateInMemoryDbContext();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        dbContext.PlatformRoles.Add(new PlatformRole
        {
            Id = (int)PlatformRoleId.PageReviewer,
            Code = "page_reviewer",
            NameJson = "{\"en\":\"Page Reviewer\",\"zh\":\"发布审核者\"}",
            Level = 5
        });
        dbContext.Members.AddRange(
            new Member { Id = reviewerId, DisplayName = "Reviewer", IsRegistered = true },
            new Member { Id = authorId, DisplayName = "Author", IsRegistered = true });
        dbContext.MemberPlatformRoles.Add(new MemberPlatformRole
        {
            Id = Guid.NewGuid(),
            MemberId = reviewerId,
            RoleId = (int)PlatformRoleId.PageReviewer,
            AssignedUtc = now
        });
        dbContext.Groups.Add(new Group
        {
            Id = groupId,
            NameJson = "{\"en\":\"Group\",\"zh\":\"小组\"}",
            AccessType = AccessType.Protected,
            CreatedUtc = now,
            UpdatedUtc = now
        });
        var page = new Page
        {
            Id = pageId,
            OwnerGroupId = groupId,
            CreatedByMemberId = authorId,
            TitleJson = "{\"en\":\"Group working page\",\"zh\":\"小家工作页面\"}",
            TagsJson = "[]",
            TitleDisplayStyle = "Default",
            Visibility = PageVisibility.Public,
            UpdatedUtc = now
        };
        var sectionId = Guid.NewGuid();
        var submittedSection = new Section
        {
            Id = sectionId,
            PageId = pageId,
            Order = 1,
            Type = SectionType.CollectionShowcase,
            ContentJson = "{}",
            StyleJson = "{}",
            Links =
            [
                new Link
                {
                    Id = Guid.NewGuid(),
                    OwnerSectionId = sectionId,
                    Type = LinkType.GroupLink,
                    Title = "Group card",
                    ImageUrl = "/media/group-card.jpg",
                    SortOrder = 0
                }
            ]
        };
        var publishedSnapshot = PagePublicationSnapshots.Capture(page, [], now.AddHours(-1));
        dbContext.Pages.Add(page);
        dbContext.PagePublicationReviews.Add(new PagePublicationReview
        {
            Id = Guid.NewGuid(),
            PageId = pageId,
            Status = PagePublicationReviewStatus.Pending,
            SubmittedSnapshotJson = PagePublicationSnapshots.Capture(page, [submittedSection], now),
            SubmittedByMemberId = authorId,
            SubmittedUtc = now,
            PublishedSnapshotJson = publishedSnapshot,
            PublishedByMemberId = reviewerId,
            PublishedUtc = now.AddHours(-1),
            CreatedUtc = now.AddHours(-1),
            UpdatedUtc = now
        });
        await dbContext.SaveChangesAsync();

        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, reviewerId, Arg.Any<CancellationToken>()).Returns(true);
        var cacheInvalidation = Substitute.For<IPageCacheInvalidationService>();
        var handler = new UpdatePagePublicationCopyCommandHandler(dbContext, authorization, cacheInvalidation);

        var result = await handler.Handle(new UpdatePagePublicationCopyCommand(
            reviewerId,
            pageId,
            new Dictionary<string, string> { ["en"] = "Reviewer candidate", ["zh"] = "审核候选副本" },
            null,
            "[]",
            "Default",
            [new PageSectionDto(sectionId, 1, SectionType.CollectionShowcase, "{}", "{}")]), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var storedPage = await dbContext.Pages.SingleAsync(x => x.Id == pageId);
        var review = await dbContext.PagePublicationReviews.SingleAsync(x => x.PageId == pageId);
        Assert.Contains("Group working page", storedPage.TitleJson);
        Assert.Equal(publishedSnapshot, review.PublishedSnapshotJson);
        Assert.Contains("Reviewer candidate", review.SubmittedSnapshotJson);
        var updatedSubmittedSnapshot = PagePublicationSnapshots.Read(review.SubmittedSnapshotJson)!;
        Assert.Equal("/media/group-card.jpg", Assert.Single(Assert.Single(updatedSubmittedSnapshot.Sections).Links!).ImageUrl);
        var listResult = await new ListPageReviewCandidatesQueryHandler(dbContext).Handle(
            new ListPageReviewCandidatesQuery(reviewerId),
            CancellationToken.None);
        var candidate = Assert.Single(listResult.Value!);
        Assert.Equal("Reviewer candidate", candidate.Title["en"]);
        Assert.Equal("Group working page", candidate.PublishedTitle!["en"]);
        await cacheInvalidation.DidNotReceive().RemovePublishedDetailAsync(pageId, Arg.Any<CancellationToken>());
        await cacheInvalidation.DidNotReceive().RemovePublicAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SubmitCopy_LoadsSectionLinksIntoTheSnapshot()
    {
        using var dbContext = CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        var sectionId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        dbContext.Pages.Add(new Page
        {
            Id = pageId,
            OwnerGroupId = Guid.NewGuid(),
            CreatedByMemberId = memberId,
            TitleJson = "{\"en\":\"Linked page\",\"zh\":\"链接页面\"}",
            TagsJson = "[]",
            TitleDisplayStyle = "Default",
            Visibility = PageVisibility.Public,
            UpdatedUtc = now
        });
        dbContext.Sections.Add(new Section
        {
            Id = sectionId,
            PageId = pageId,
            Order = 1,
            Type = SectionType.CollectionShowcase,
            ContentJson = "{}",
            StyleJson = "{}"
        });
        dbContext.Links.Add(new Link
        {
            Id = Guid.NewGuid(),
            OwnerSectionId = sectionId,
            Type = LinkType.GroupLink,
            Title = "Linked image",
            ImageUrl = "/media/linked-image.jpg",
            SortOrder = 0
        });
        await dbContext.SaveChangesAsync();
        dbContext.ChangeTracker.Clear();
        var page = await dbContext.Pages
            .Include(candidate => candidate.Sections)
            .SingleAsync(candidate => candidate.Id == pageId);

        await PagePublicationReviewState.SubmitCopyIfPublicAsync(
            dbContext,
            page,
            memberId,
            now,
            CancellationToken.None);
        await dbContext.SaveChangesAsync();

        var review = await dbContext.PagePublicationReviews.SingleAsync(candidate => candidate.PageId == pageId);
        var snapshot = PagePublicationSnapshots.Read(review.SubmittedSnapshotJson)!;
        Assert.Equal("/media/linked-image.jpg", Assert.Single(Assert.Single(snapshot.Sections).Links!).ImageUrl);
        Assert.Equal("/media/linked-image.jpg", PagePublicationReviewDefaults.ExtractFirstSectionImage(snapshot.Sections));
    }

    [Fact]
    public async Task GetPublicationCopy_SelectsSubmittedOrPublishedSnapshotAndFailsClosed()
    {
        using var dbContext = CreateInMemoryDbContext();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        dbContext.PlatformRoles.Add(new PlatformRole
        {
            Id = (int)PlatformRoleId.PageReviewer,
            Code = "page_reviewer",
            NameJson = "{\"en\":\"Page Reviewer\",\"zh\":\"发布审核者\"}",
            Level = 5
        });
        dbContext.Members.AddRange(
            new Member { Id = reviewerId, DisplayName = "Reviewer", IsRegistered = true },
            new Member { Id = authorId, DisplayName = "Author", IsRegistered = true });
        dbContext.MemberPlatformRoles.Add(new MemberPlatformRole
        {
            Id = Guid.NewGuid(),
            MemberId = reviewerId,
            RoleId = (int)PlatformRoleId.PageReviewer,
            AssignedUtc = now
        });
        var page = new Page
        {
            Id = pageId,
            OwnerGroupId = Guid.NewGuid(),
            CreatedByMemberId = authorId,
            TitleJson = "{\"en\":\"Working copy\"}",
            TagsJson = "[]",
            TitleDisplayStyle = "Default",
            Visibility = PageVisibility.Public,
            UpdatedUtc = now
        };
        var submittedJson = PagePublicationSnapshots.Capture(
            page,
            new Dictionary<string, string> { ["en"] = "Submitted copy" },
            null,
            "[]",
            "Default",
            [],
            now,
            now);
        var publishedJson = PagePublicationSnapshots.Capture(
            page,
            new Dictionary<string, string> { ["en"] = "Published copy" },
            null,
            "[]",
            "Default",
            [],
            now.AddMinutes(-1),
            now.AddMinutes(-1));
        var review = new PagePublicationReview
        {
            Id = Guid.NewGuid(),
            PageId = pageId,
            Status = PagePublicationReviewStatus.Pending,
            SubmittedSnapshotJson = submittedJson,
            PublishedSnapshotJson = publishedJson,
            SubmittedByMemberId = authorId,
            SubmittedUtc = now,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        dbContext.Pages.Add(page);
        dbContext.PagePublicationReviews.Add(review);
        await dbContext.SaveChangesAsync();
        var handler = new GetPagePublicationCopyQueryHandler(dbContext);

        var pending = await handler.Handle(
            new GetPagePublicationCopyQuery(reviewerId, pageId),
            CancellationToken.None);

        Assert.True(pending.IsSuccess);
        Assert.Equal("Submitted copy", pending.Value!.Title["en"]);

        review.Status = PagePublicationReviewStatus.Approved;
        await dbContext.SaveChangesAsync();
        var approved = await handler.Handle(
            new GetPagePublicationCopyQuery(reviewerId, pageId),
            CancellationToken.None);

        Assert.True(approved.IsSuccess);
        Assert.Equal("Published copy", approved.Value!.Title["en"]);

        review.PublishedSnapshotJson = "{\"version\":999}";
        review.SubmittedSnapshotJson = null;
        await dbContext.SaveChangesAsync();
        var invalid = await handler.Handle(
            new GetPagePublicationCopyQuery(reviewerId, pageId),
            CancellationToken.None);

        Assert.Equal(AppResultStatus.Conflict, invalid.Status);
    }

    [Fact]
    public async Task PublicationCopyEndpoints_EnforceReviewerAndGroupLeaderPermissions()
    {
        using var dbContext = CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var page = new Page
        {
            Id = pageId,
            OwnerGroupId = groupId,
            CreatedByMemberId = memberId,
            TitleJson = "{\"en\":\"Candidate\"}",
            TagsJson = "[]",
            TitleDisplayStyle = "Default",
            Visibility = PageVisibility.Public,
            UpdatedUtc = now
        };
        dbContext.Members.Add(new Member { Id = memberId, DisplayName = "Member", IsRegistered = true });
        dbContext.Pages.Add(page);
        dbContext.PagePublicationReviews.Add(new PagePublicationReview
        {
            Id = Guid.NewGuid(),
            PageId = pageId,
            Status = PagePublicationReviewStatus.Pending,
            SubmittedSnapshotJson = PagePublicationSnapshots.Capture(page, [], now),
            SubmittedByMemberId = memberId,
            SubmittedUtc = now,
            CreatedUtc = now,
            UpdatedUtc = now
        });
        await dbContext.SaveChangesAsync();

        var getResult = await new GetPagePublicationCopyQueryHandler(dbContext).Handle(
            new GetPagePublicationCopyQuery(memberId, pageId),
            CancellationToken.None);

        Assert.Equal(AppResultStatus.Forbidden, getResult.Status);

        dbContext.PlatformRoles.Add(new PlatformRole
        {
            Id = (int)PlatformRoleId.PageReviewer,
            Code = "page_reviewer",
            NameJson = "{\"en\":\"Page Reviewer\",\"zh\":\"发布审核者\"}",
            Level = 5
        });
        dbContext.MemberPlatformRoles.Add(new MemberPlatformRole
        {
            Id = Guid.NewGuid(),
            MemberId = memberId,
            RoleId = (int)PlatformRoleId.PageReviewer,
            AssignedUtc = now
        });
        await dbContext.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, memberId, Arg.Any<CancellationToken>()).Returns(false);
        var handler = new UpdatePagePublicationCopyCommandHandler(
            dbContext,
            authorization,
            Substitute.For<IPageCacheInvalidationService>());

        var updateResult = await handler.Handle(new UpdatePagePublicationCopyCommand(
            memberId,
            pageId,
            new Dictionary<string, string> { ["en"] = "Blocked edit" },
            null,
            "[]",
            "Default",
            []), CancellationToken.None);

        Assert.Equal(AppResultStatus.Forbidden, updateResult.Status);
    }

    [Fact]
    public async Task UpdatePendingCopy_WhenApprovalWinsTheRace_ReturnsConflictWithoutOverwritingApproval()
    {
        var databaseName = Guid.NewGuid().ToString();
        var databaseRoot = new InMemoryDatabaseRoot();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var originalSnapshot = string.Empty;
        await using (var seedContext = CreateInMemoryDbContext(databaseName, databaseRoot))
        {
            seedContext.PlatformRoles.Add(new PlatformRole
            {
                Id = (int)PlatformRoleId.PageReviewer,
                Code = "page_reviewer",
                NameJson = "{\"en\":\"Page Reviewer\",\"zh\":\"发布审核者\"}",
                Level = 5
            });
            seedContext.Members.AddRange(
                new Member { Id = reviewerId, DisplayName = "Reviewer", IsRegistered = true },
                new Member { Id = authorId, DisplayName = "Author", IsRegistered = true });
            seedContext.MemberPlatformRoles.Add(new MemberPlatformRole
            {
                Id = Guid.NewGuid(),
                MemberId = reviewerId,
                RoleId = (int)PlatformRoleId.PageReviewer,
                AssignedUtc = now
            });
            seedContext.Groups.Add(new Group
            {
                Id = groupId,
                NameJson = "{\"en\":\"Group\",\"zh\":\"小组\"}",
                AccessType = AccessType.Protected,
                CreatedUtc = now,
                UpdatedUtc = now
            });
            var page = new Page
            {
                Id = pageId,
                OwnerGroupId = groupId,
                CreatedByMemberId = authorId,
                TitleJson = "{\"en\":\"Candidate A\",\"zh\":\"候选 A\"}",
                TagsJson = "[]",
                TitleDisplayStyle = "Default",
                Visibility = PageVisibility.Public,
                UpdatedUtc = now
            };
            originalSnapshot = PagePublicationSnapshots.Capture(page, [], now);
            seedContext.Pages.Add(page);
            seedContext.PagePublicationReviews.Add(new PagePublicationReview
            {
                Id = Guid.NewGuid(),
                PageId = pageId,
                Status = PagePublicationReviewStatus.Pending,
                SubmittedSnapshotJson = originalSnapshot,
                SubmittedByMemberId = authorId,
                SubmittedUtc = now,
                CreatedUtc = now,
                UpdatedUtc = now
            });
            await seedContext.SaveChangesAsync();
        }

        var barrier = new SaveChangesBarrierInterceptor();
        await using var staleContext = CreateInMemoryDbContext(databaseName, databaseRoot, barrier);
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, reviewerId, Arg.Any<CancellationToken>()).Returns(true);
        var cacheInvalidation = Substitute.For<IPageCacheInvalidationService>();
        var handler = new UpdatePagePublicationCopyCommandHandler(staleContext, authorization, cacheInvalidation);
        var staleUpdate = handler.Handle(new UpdatePagePublicationCopyCommand(
            reviewerId,
            pageId,
            new Dictionary<string, string> { ["en"] = "Stale reviewer edit", ["zh"] = "过期审核编辑" },
            null,
            "[]",
            "Default",
            []), CancellationToken.None);

        await barrier.WaitUntilSavingAsync();
        await using (var winningContext = CreateInMemoryDbContext(databaseName, databaseRoot))
        {
            var review = await winningContext.PagePublicationReviews.SingleAsync(candidate => candidate.PageId == pageId);
            review.Status = PagePublicationReviewStatus.Approved;
            review.PublishedSnapshotJson = originalSnapshot;
            review.PublishedByMemberId = reviewerId;
            review.PublishedUtc = now.AddMinutes(1);
            review.UpdatedUtc = now.AddMinutes(1);
            await winningContext.SaveChangesAsync();
        }
        barrier.ContinueSaving();

        var result = await staleUpdate;

        Assert.Equal(AppResultStatus.Conflict, result.Status);
        await using var verificationContext = CreateInMemoryDbContext(databaseName, databaseRoot);
        var persisted = await verificationContext.PagePublicationReviews.SingleAsync(candidate => candidate.PageId == pageId);
        Assert.Equal(PagePublicationReviewStatus.Approved, persisted.Status);
        Assert.Equal(originalSnapshot, persisted.PublishedSnapshotJson);
        Assert.Equal(originalSnapshot, persisted.SubmittedSnapshotJson);
    }

    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    private static AlifeDbContext CreateInMemoryDbContext(
        string databaseName,
        InMemoryDatabaseRoot databaseRoot,
        IInterceptor? interceptor = null)
    {
        var builder = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(databaseName, databaseRoot);
        if (interceptor is not null)
        {
            builder.AddInterceptors(interceptor);
        }

        return new AlifeDbContext(builder.Options);
    }

    private sealed class SaveChangesBarrierInterceptor : SaveChangesInterceptor
    {
        private readonly TaskCompletionSource _saving = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly TaskCompletionSource _continue = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public Task WaitUntilSavingAsync() => _saving.Task;

        public void ContinueSaving() => _continue.TrySetResult();

        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            _saving.TrySetResult();
            await _continue.Task.WaitAsync(cancellationToken);
            return result;
        }
    }
}
