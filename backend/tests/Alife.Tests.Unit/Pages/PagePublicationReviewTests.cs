using Alife.Application.Admin.Dtos;
using Alife.Application.Admin.Commands.ApprovePagePublication;
using Alife.Application.Admin.Commands.ReturnPagePublication;
using Alife.Application.Admin.Queries.ListPageReviewCandidates;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Pages;

public class PagePublicationReviewTests
{
    [Fact]
    public async Task ListCandidates_ReturnsPublicPagesGroupedByCurrentReviewStatus()
    {
        using var dbContext = CreateInMemoryDbContext();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        var approvedPageId = Guid.NewGuid();
        var returnedPageId = Guid.NewGuid();
        await SeedReviewerScenarioAsync(dbContext, reviewerId, authorId, groupId, pageId);
        var now = DateTime.UtcNow;
        dbContext.Pages.AddRange(
            new Page
            {
                Id = Guid.NewGuid(),
                OwnerGroupId = groupId,
                CreatedByMemberId = authorId,
                TitleJson = "{\"en\":\"Draft review\",\"zh\":\"草稿审核\"}",
                DescriptionJson = "{\"en\":\"Draft page\",\"zh\":\"草稿页面\"}",
                TagsJson = "[]",
                TitleDisplayStyle = "Default",
                Visibility = PageVisibility.Draft,
                UpdatedUtc = now.AddMinutes(1)
            },
            new Page
            {
                Id = Guid.NewGuid(),
                OwnerGroupId = groupId,
                CreatedByMemberId = authorId,
                TitleJson = "{\"en\":\"Group review\",\"zh\":\"组内审核\"}",
                DescriptionJson = "{\"en\":\"Group-visible page\",\"zh\":\"组内可见页面\"}",
                TagsJson = "[]",
                TitleDisplayStyle = "Default",
                Visibility = PageVisibility.Group,
                UpdatedUtc = now.AddMinutes(2)
            },
            new Page
            {
                Id = approvedPageId,
                OwnerGroupId = groupId,
                CreatedByMemberId = authorId,
                TitleJson = "{\"en\":\"Approved review\",\"zh\":\"已批准审核\"}",
                DescriptionJson = "{\"en\":\"Approved page\",\"zh\":\"已批准页面\"}",
                TagsJson = "[]",
                TitleDisplayStyle = "Default",
                Visibility = PageVisibility.Public,
                UpdatedUtc = now.AddMinutes(4)
            },
            new Page
            {
                Id = returnedPageId,
                OwnerGroupId = groupId,
                CreatedByMemberId = authorId,
                TitleJson = "{\"en\":\"Returned review\",\"zh\":\"已退回审核\"}",
                DescriptionJson = "{\"en\":\"Returned page\",\"zh\":\"已退回页面\"}",
                TagsJson = "[]",
                TitleDisplayStyle = "Default",
                Visibility = PageVisibility.Public,
                UpdatedUtc = now.AddMinutes(5)
            });
        dbContext.PagePublicationReviews.AddRange(
            new PagePublicationReview
            {
                Id = Guid.NewGuid(),
                PageId = approvedPageId,
                Status = PagePublicationReviewStatus.Approved,
                PrimaryMenuNameJson = "{\"en\":\"Ministries\",\"zh\":\"事工\"}",
                AccessNameJson = "{\"en\":\"Approved menu\",\"zh\":\"已批准菜单\"}",
                CardImageUrl = "https://example.test/approved.jpg",
                CardTextJson = "{\"en\":\"Approved card\",\"zh\":\"已批准卡片\"}",
                ReviewedByMemberId = reviewerId,
                ReviewedUtc = now.AddMinutes(6),
                CreatedUtc = now.AddMinutes(6),
                UpdatedUtc = now.AddMinutes(6)
            },
            new PagePublicationReview
            {
                Id = Guid.NewGuid(),
                PageId = returnedPageId,
                Status = PagePublicationReviewStatus.Returned,
                ReturnReason = "Needs revision",
                ReviewedByMemberId = reviewerId,
                ReviewedUtc = now.AddMinutes(7),
                CreatedUtc = now.AddMinutes(7),
                UpdatedUtc = now.AddMinutes(7)
            });
        await dbContext.SaveChangesAsync();
        var handler = new ListPageReviewCandidatesQueryHandler(dbContext);

        var result = await handler.Handle(new ListPageReviewCandidatesQuery(reviewerId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value!.Count);
        Assert.All(result.Value, page => Assert.Equal(PageVisibility.Public, page.Visibility));
        Assert.Contains(result.Value, page => page.Id == pageId && page.ReviewStatus == AdminPageReviewStatus.Pending);
        Assert.Contains(result.Value, page =>
            page.Id == approvedPageId &&
            page.ReviewStatus == AdminPageReviewStatus.Approved &&
            page.PrimaryMenuName != null &&
            page.PrimaryMenuName["en"] == "Ministries" &&
            page.AccessName != null &&
            page.AccessName["en"] == "Approved menu" &&
            page.CardImageUrl == "https://example.test/approved.jpg" &&
            page.CardText != null &&
            page.CardText["en"] == "Approved card");
        Assert.Contains(result.Value, page =>
            page.Id == returnedPageId &&
            page.ReviewStatus == AdminPageReviewStatus.Returned &&
            page.ReturnReason == "Needs revision");
    }

    [Fact]
    public async Task ReturnCandidate_RecordsReasonAndInvalidatesGroupPageCaches()
    {
        using var dbContext = CreateInMemoryDbContext();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        await SeedReviewerScenarioAsync(dbContext, reviewerId, authorId, groupId, pageId);
        var cacheInvalidation = Substitute.For<IPageCacheInvalidationService>();
        var returnHandler = new ReturnPagePublicationCommandHandler(dbContext, cacheInvalidation);
        var listHandler = new ListPageReviewCandidatesQueryHandler(dbContext);

        var returnResult = await returnHandler.Handle(
            new ReturnPagePublicationCommand(reviewerId, pageId, "Please add bilingual contact details."),
            CancellationToken.None);
        var visibleResult = await listHandler.Handle(new ListPageReviewCandidatesQuery(reviewerId), CancellationToken.None);

        Assert.True(returnResult.IsSuccess);
        Assert.True(visibleResult.IsSuccess);
        Assert.Contains(visibleResult.Value!, page =>
            page.Id == pageId &&
            page.Visibility == PageVisibility.Public &&
            page.ReviewStatus == AdminPageReviewStatus.Returned &&
            page.ReturnReason == "Please add bilingual contact details.");
        Assert.Contains(dbContext.PagePublicationReviews, review =>
            review.PageId == pageId &&
            review.Status == PagePublicationReviewStatus.Returned &&
            review.ReturnReason == "Please add bilingual contact details.");
        Assert.Contains(dbContext.AuditLogs, log =>
            log.Action == "page.publication-review.return" &&
            log.EntityId == pageId &&
            log.MetadataJson != null &&
            log.MetadataJson.Contains("Please add bilingual contact details."));
        await cacheInvalidation.Received(1).RemoveDetailAsync(pageId, Arg.Any<CancellationToken>());
        await cacheInvalidation.Received(1).RemoveGroupPagesAsync(groupId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ApproveCandidate_WritesMenuConfigurationAndCanUpdateItAfterApproval()
    {
        using var dbContext = CreateInMemoryDbContext();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        await SeedReviewerScenarioAsync(dbContext, reviewerId, authorId, groupId, pageId);
        var cacheInvalidation = Substitute.For<IPageCacheInvalidationService>();
        var handler = new ApprovePagePublicationCommandHandler(dbContext, cacheInvalidation);

        var result = await handler.Handle(
            new ApprovePagePublicationCommand(
                reviewerId,
                pageId,
                new Dictionary<string, string> { ["en"] = "Ministries", ["zh"] = "事工" },
                new Dictionary<string, string> { ["en"] = "Menu name", ["zh"] = "菜单名" },
                "https://example.test/ministry.jpg",
                new Dictionary<string, string> { ["en"] = "Card text", ["zh"] = "卡片文字" }),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(groupId, result.Value!.OwnerGroupId);
        Assert.NotNull(result.Value.Page);
        Assert.Equal(groupId, result.Value.Page.OwnerGroupId);

        var storedPage = await dbContext.Pages.FirstAsync(x => x.Id == pageId);
        Assert.Equal(groupId, storedPage.OwnerGroupId);
        Assert.Equal(PageVisibility.Public, storedPage.Visibility);
        Assert.Contains(dbContext.PagePublicationReviews, review =>
            review.PageId == pageId &&
            review.Status == PagePublicationReviewStatus.Approved &&
            review.PrimaryMenuNameJson != null &&
            review.PrimaryMenuNameJson.Contains("Ministries") &&
            review.AccessNameJson != null &&
            review.AccessNameJson.Contains("Menu name") &&
            review.CardImageUrl == "https://example.test/ministry.jpg" &&
            review.CardTextJson != null &&
            review.CardTextJson.Contains("Card text"));
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "page.publication-review.approve" && log.EntityId == pageId);

        var updateResult = await handler.Handle(
            new ApprovePagePublicationCommand(
                reviewerId,
                pageId,
                new Dictionary<string, string> { ["en"] = "Community", ["zh"] = "社区" },
                new Dictionary<string, string> { ["en"] = "Updated menu", ["zh"] = "更新菜单" },
                "https://example.test/updated.jpg",
                new Dictionary<string, string> { ["en"] = "Updated text", ["zh"] = "更新文字" }),
            CancellationToken.None);

        Assert.True(updateResult.IsSuccess);
        var updatedReview = await dbContext.PagePublicationReviews.FirstAsync(review => review.PageId == pageId);
        Assert.Contains("Community", updatedReview.PrimaryMenuNameJson);
        Assert.Contains("Updated menu", updatedReview.AccessNameJson);
        Assert.Equal("https://example.test/updated.jpg", updatedReview.CardImageUrl);
        Assert.Contains("Updated text", updatedReview.CardTextJson);

        await cacheInvalidation.Received(2).RemoveDetailAsync(pageId, Arg.Any<CancellationToken>());
        await cacheInvalidation.Received(2).RemoveGroupPagesAsync(groupId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ApproveCandidate_RequiresBilingualPrimaryMenuName()
    {
        using var dbContext = CreateInMemoryDbContext();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        await SeedReviewerScenarioAsync(dbContext, reviewerId, authorId, groupId, pageId);
        var cacheInvalidation = Substitute.For<IPageCacheInvalidationService>();
        var handler = new ApprovePagePublicationCommandHandler(dbContext, cacheInvalidation);

        var result = await handler.Handle(
            new ApprovePagePublicationCommand(
                reviewerId,
                pageId,
                new Dictionary<string, string> { ["en"] = "Ministries" },
                new Dictionary<string, string> { ["en"] = "Menu", ["zh"] = "菜单" },
                "https://example.test/ministry.jpg",
                new Dictionary<string, string> { ["en"] = "Text", ["zh"] = "文字" }),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(Application.Common.Models.AppResultStatus.ValidationError, result.Status);
        Assert.DoesNotContain(dbContext.PagePublicationReviews, review => review.PageId == pageId);
    }

    [Fact]
    public async Task ApproveCandidate_RejectsMemberWithoutPageReviewerRole()
    {
        using var dbContext = CreateInMemoryDbContext();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        await SeedReviewerScenarioAsync(dbContext, reviewerId, authorId, groupId, pageId);
        var ordinaryMemberId = Guid.NewGuid();
        dbContext.Members.Add(new Member { Id = ordinaryMemberId, DisplayName = "Member", IsRegistered = true });
        await dbContext.SaveChangesAsync();
        var cacheInvalidation = Substitute.For<IPageCacheInvalidationService>();
        var handler = new ApprovePagePublicationCommandHandler(dbContext, cacheInvalidation);

        var result = await handler.Handle(
            new ApprovePagePublicationCommand(
                ordinaryMemberId,
                pageId,
                new Dictionary<string, string> { ["en"] = "Ministries", ["zh"] = "事工" },
                new Dictionary<string, string> { ["en"] = "Menu name", ["zh"] = "菜单名" },
                "https://example.test/ministry.jpg",
                new Dictionary<string, string> { ["en"] = "Card text", ["zh"] = "卡片文字" }),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(Application.Common.Models.AppResultStatus.Forbidden, result.Status);
    }

    private static async Task SeedReviewerScenarioAsync(
        AlifeDbContext dbContext,
        Guid reviewerId,
        Guid authorId,
        Guid groupId,
        Guid pageId)
    {
        var now = DateTime.UtcNow;
        dbContext.PlatformRoles.AddRange(
            new PlatformRole
            {
                Id = (int)PlatformRoleId.PageReviewer,
                Code = "page_reviewer",
                NameJson = "{\"en\":\"Page Reviewer\",\"zh\":\"发布审核者\"}",
                Level = 5
            },
            new PlatformRole
            {
                Id = (int)PlatformRoleId.Admin,
                Code = "admin",
                NameJson = "{\"en\":\"Admin\",\"zh\":\"管理员\"}",
                Level = 10
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
            NameJson = "{\"en\":\"Alpha Group\",\"zh\":\"Alpha 小组\"}",
            AccessType = AccessType.Protected,
            IsChurch = false,
            CreatedUtc = now,
            UpdatedUtc = now
        });
        dbContext.Pages.Add(new Page
        {
            Id = pageId,
            OwnerGroupId = groupId,
            CreatedByMemberId = authorId,
            TitleJson = "{\"en\":\"Review me\",\"zh\":\"请审核\"}",
            DescriptionJson = "{\"en\":\"Ready for public review\",\"zh\":\"准备公开审核\"}",
            TagsJson = "[]",
            TitleDisplayStyle = "Default",
            Visibility = PageVisibility.Public,
            UpdatedUtc = now
        });
        await dbContext.SaveChangesAsync();
    }

    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
