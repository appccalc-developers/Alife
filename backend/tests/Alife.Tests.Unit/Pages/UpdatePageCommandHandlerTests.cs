using Alife.Application.Groups.Services;
using Alife.Application.Pages.Commands.UpdatePage;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Pages;

public class UpdatePageCommandHandlerTests
{
    [Fact]
    public async Task Handle_WhenPageReviewerWithoutGroupEditAccessUpdatesPublicPage_ReturnsForbidden()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var pageCacheInvalidationService = Substitute.For<IPageCacheInvalidationService>();
        var reviewerId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        dbContext.Pages.Add(new Page
        {
            Id = pageId,
            OwnerGroupId = groupId,
            CreatedByMemberId = Guid.NewGuid(),
            TitleJson = "{\"en\":\"Old title\",\"zh\":\"旧标题\"}",
            DescriptionJson = "{\"en\":\"Old description\",\"zh\":\"旧描述\"}",
            TagsJson = "[]",
            TitleDisplayStyle = "Default",
            Visibility = PageVisibility.Public,
            UpdatedUtc = DateTime.UtcNow.AddDays(-1)
        });
        await dbContext.SaveChangesAsync();
        groupAuthorizationService
            .CanReviewPagesAsync(reviewerId, Arg.Any<CancellationToken>())
            .Returns(true);
        var handler = new UpdatePageCommandHandler(
            dbContext,
            groupAuthorizationService,
            pageCacheInvalidationService);

        var result = await handler.Handle(
            new UpdatePageCommand(
                pageId,
                reviewerId,
                new Dictionary<string, string> { ["en"] = "Reviewed title", ["zh"] = "已审核标题" },
                new Dictionary<string, string> { ["en"] = "Reviewed description", ["zh"] = "已审核描述" },
                "[]",
                "Default",
                Array.Empty<PageSectionDto>()),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(Application.Common.Models.AppResultStatus.Forbidden, result.Status);
        Assert.Empty(dbContext.PagePublicationReviews);
        await pageCacheInvalidationService.DidNotReceive().RemoveDetailAsync(pageId, Arg.Any<CancellationToken>());
        await pageCacheInvalidationService.DidNotReceive().RemoveGroupPagesAsync(groupId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WhenLeaderUpdatesPublicPage_ResetsPublicationReviewToPending()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var pageCacheInvalidationService = Substitute.For<IPageCacheInvalidationService>();
        var leaderId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        dbContext.Pages.Add(new Page
        {
            Id = pageId,
            OwnerGroupId = groupId,
            CreatedByMemberId = Guid.NewGuid(),
            TitleJson = "{\"en\":\"Old title\",\"zh\":\"旧标题\"}",
            DescriptionJson = "{\"en\":\"Old description\",\"zh\":\"旧描述\"}",
            TagsJson = "[]",
            TitleDisplayStyle = "Default",
            Visibility = PageVisibility.Public,
            UpdatedUtc = DateTime.UtcNow.AddDays(-1)
        });
        dbContext.PagePublicationReviews.Add(new PagePublicationReview
        {
            Id = Guid.NewGuid(),
            PageId = pageId,
            Status = PagePublicationReviewStatus.Approved,
            AccessNameJson = "{\"en\":\"Menu\",\"zh\":\"菜单\"}",
            ReviewedByMemberId = Guid.NewGuid(),
            ReviewedUtc = DateTime.UtcNow.AddDays(-1),
            CreatedUtc = DateTime.UtcNow.AddDays(-1),
            UpdatedUtc = DateTime.UtcNow.AddDays(-1)
        });
        await dbContext.SaveChangesAsync();
        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>())
            .Returns(true);
        var handler = new UpdatePageCommandHandler(
            dbContext,
            groupAuthorizationService,
            pageCacheInvalidationService);

        var result = await handler.Handle(
            new UpdatePageCommand(
                pageId,
                leaderId,
                new Dictionary<string, string> { ["en"] = "Updated title", ["zh"] = "新标题" },
                null,
                "[]",
                "Default",
                Array.Empty<PageSectionDto>()),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var review = await dbContext.PagePublicationReviews.SingleAsync(x => x.PageId == pageId);
        Assert.Equal(PagePublicationReviewStatus.Pending, review.Status);
        Assert.Null(review.AccessNameJson);
        Assert.Null(review.ReviewedByMemberId);
        await pageCacheInvalidationService.Received(1).RemoveDetailAsync(pageId, Arg.Any<CancellationToken>());
        await pageCacheInvalidationService.Received(1).RemoveGroupPagesAsync(groupId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WhenApprovedPublicGroupPageChangesContent_ResetsReviewToPending()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var pageCacheInvalidationService = Substitute.For<IPageCacheInvalidationService>();
        var reviewerId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        dbContext.Pages.Add(new Page
        {
            Id = pageId,
            OwnerGroupId = groupId,
            CreatedByMemberId = Guid.NewGuid(),
            TitleJson = "{\"en\":\"Approved title\",\"zh\":\"已批准标题\"}",
            DescriptionJson = "{\"en\":\"Approved description\",\"zh\":\"已批准描述\"}",
            TagsJson = "[]",
            TitleDisplayStyle = "Default",
            Visibility = PageVisibility.Public,
            UpdatedUtc = DateTime.UtcNow.AddDays(-1)
        });
        dbContext.PagePublicationReviews.Add(new PagePublicationReview
        {
            Id = Guid.NewGuid(),
            PageId = pageId,
            Status = PagePublicationReviewStatus.Approved,
            AccessNameJson = "{\"en\":\"Approved\",\"zh\":\"已批准\"}",
            ReviewedByMemberId = reviewerId,
            ReviewedUtc = DateTime.UtcNow.AddDays(-1),
            CreatedUtc = DateTime.UtcNow.AddDays(-2),
            UpdatedUtc = DateTime.UtcNow.AddDays(-1)
        });
        await dbContext.SaveChangesAsync();
        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>())
            .Returns(true);
        var handler = new UpdatePageCommandHandler(
            dbContext,
            groupAuthorizationService,
            pageCacheInvalidationService);

        var result = await handler.Handle(
            new UpdatePageCommand(
                pageId,
                leaderId,
                new Dictionary<string, string> { ["en"] = "Changed title", ["zh"] = "已修改标题" },
                new Dictionary<string, string> { ["en"] = "Changed description", ["zh"] = "已修改描述" },
                "[]",
                "Default",
                Array.Empty<PageSectionDto>()),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var review = await dbContext.PagePublicationReviews.SingleAsync(x => x.PageId == pageId);
        Assert.Equal(PagePublicationReviewStatus.Pending, review.Status);
        Assert.Null(review.ReviewedByMemberId);
        Assert.Null(review.ReviewedUtc);
    }

    [Fact]
    public async Task Handle_WhenPageReviewerWithGroupEditAccessPreservesReviewStatus_KeepsApprovedReview()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var pageCacheInvalidationService = Substitute.For<IPageCacheInvalidationService>();
        var reviewerId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        var reviewedUtc = DateTime.UtcNow.AddDays(-1);
        dbContext.Pages.Add(new Page
        {
            Id = pageId,
            OwnerGroupId = groupId,
            CreatedByMemberId = Guid.NewGuid(),
            TitleJson = "{\"en\":\"Approved title\",\"zh\":\"已批准标题\"}",
            DescriptionJson = "{\"en\":\"Approved description\",\"zh\":\"已批准描述\"}",
            TagsJson = "[]",
            TitleDisplayStyle = "Default",
            Visibility = PageVisibility.Public,
            UpdatedUtc = DateTime.UtcNow.AddDays(-2)
        });
        dbContext.PagePublicationReviews.Add(new PagePublicationReview
        {
            Id = Guid.NewGuid(),
            PageId = pageId,
            Status = PagePublicationReviewStatus.Approved,
            AccessNameJson = "{\"en\":\"Approved\",\"zh\":\"已批准\"}",
            CardImageUrl = "https://example.test/card.jpg",
            CardTextJson = "{\"en\":\"Card\",\"zh\":\"卡片\"}",
            ReviewedByMemberId = reviewerId,
            ReviewedUtc = reviewedUtc,
            CreatedUtc = reviewedUtc,
            UpdatedUtc = reviewedUtc
        });
        await dbContext.SaveChangesAsync();
        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, reviewerId, Arg.Any<CancellationToken>())
            .Returns(true);
        groupAuthorizationService
            .CanReviewPagesAsync(reviewerId, Arg.Any<CancellationToken>())
            .Returns(true);
        var handler = new UpdatePageCommandHandler(
            dbContext,
            groupAuthorizationService,
            pageCacheInvalidationService);

        var result = await handler.Handle(
            new UpdatePageCommand(
                pageId,
                reviewerId,
                new Dictionary<string, string> { ["en"] = "Reviewer edit", ["zh"] = "审核员编辑" },
                new Dictionary<string, string> { ["en"] = "Edited description", ["zh"] = "已编辑描述" },
                "[]",
                "Default",
                Array.Empty<PageSectionDto>(),
                PreservePublicationReviewStatus: true),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var review = await dbContext.PagePublicationReviews.SingleAsync(x => x.PageId == pageId);
        Assert.Equal(PagePublicationReviewStatus.Approved, review.Status);
        Assert.Equal("{\"en\":\"Approved\",\"zh\":\"已批准\"}", review.AccessNameJson);
        Assert.Equal("https://example.test/card.jpg", review.CardImageUrl);
        Assert.Equal("{\"en\":\"Card\",\"zh\":\"卡片\"}", review.CardTextJson);
        Assert.Equal(reviewerId, review.ReviewedByMemberId);
        Assert.Equal(reviewedUtc, review.ReviewedUtc);
    }

    [Fact]
    public async Task Handle_WhenLeaderWithoutReviewAccessRequestsPreserveReviewStatus_ResetsReviewToPending()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var pageCacheInvalidationService = Substitute.For<IPageCacheInvalidationService>();
        var leaderId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        dbContext.Pages.Add(new Page
        {
            Id = pageId,
            OwnerGroupId = groupId,
            CreatedByMemberId = Guid.NewGuid(),
            TitleJson = "{\"en\":\"Approved title\",\"zh\":\"已批准标题\"}",
            DescriptionJson = "{\"en\":\"Approved description\",\"zh\":\"已批准描述\"}",
            TagsJson = "[]",
            TitleDisplayStyle = "Default",
            Visibility = PageVisibility.Public,
            UpdatedUtc = DateTime.UtcNow.AddDays(-2)
        });
        dbContext.PagePublicationReviews.Add(new PagePublicationReview
        {
            Id = Guid.NewGuid(),
            PageId = pageId,
            Status = PagePublicationReviewStatus.Approved,
            AccessNameJson = "{\"en\":\"Approved\",\"zh\":\"已批准\"}",
            ReviewedByMemberId = reviewerId,
            ReviewedUtc = DateTime.UtcNow.AddDays(-1),
            CreatedUtc = DateTime.UtcNow.AddDays(-2),
            UpdatedUtc = DateTime.UtcNow.AddDays(-1)
        });
        await dbContext.SaveChangesAsync();
        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>())
            .Returns(true);
        groupAuthorizationService
            .CanReviewPagesAsync(leaderId, Arg.Any<CancellationToken>())
            .Returns(false);
        var handler = new UpdatePageCommandHandler(
            dbContext,
            groupAuthorizationService,
            pageCacheInvalidationService);

        var result = await handler.Handle(
            new UpdatePageCommand(
                pageId,
                leaderId,
                new Dictionary<string, string> { ["en"] = "Leader edit", ["zh"] = "领袖编辑" },
                new Dictionary<string, string> { ["en"] = "Edited description", ["zh"] = "已编辑描述" },
                "[]",
                "Default",
                Array.Empty<PageSectionDto>(),
                PreservePublicationReviewStatus: true),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var review = await dbContext.PagePublicationReviews.SingleAsync(x => x.PageId == pageId);
        Assert.Equal(PagePublicationReviewStatus.Pending, review.Status);
        Assert.Null(review.AccessNameJson);
        Assert.Null(review.ReviewedByMemberId);
        Assert.Null(review.ReviewedUtc);
    }

    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
