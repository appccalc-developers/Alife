using Alife.Application.Admin.Dtos;
using Alife.Application.Admin.Commands.PromotePageToGlobal;
using Alife.Application.Admin.Commands.RefusePageGlobalReview;
using Alife.Application.Admin.Queries.ListPageReviewCandidates;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Pages;

public class PageGlobalReviewTests
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
                Id = Guid.NewGuid(),
                OwnerGroupId = null,
                CreatedByMemberId = authorId,
                TitleJson = "{\"en\":\"Global page\",\"zh\":\"全站页面\"}",
                DescriptionJson = "{\"en\":\"Not part of group page review\",\"zh\":\"不是小组页面审核\"}",
                TagsJson = "[]",
                TitleDisplayStyle = "Default",
                Visibility = PageVisibility.Public,
                UpdatedUtc = now.AddMinutes(3)
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
                AccessNameJson = "{\"en\":\"Approved menu\",\"zh\":\"已批准菜单\"}",
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
        Assert.All(result.Value, page => Assert.Equal(groupId, page.OwnerGroupId));
        Assert.Contains(result.Value, page => page.Id == pageId && page.ReviewStatus == AdminPageReviewStatus.Pending);
        Assert.Contains(result.Value, page =>
            page.Id == approvedPageId &&
            page.ReviewStatus == AdminPageReviewStatus.Approved &&
            page.AccessName != null &&
            page.AccessName["en"] == "Approved menu");
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
        var returnHandler = new RefusePageGlobalReviewCommandHandler(dbContext, cacheInvalidation);
        var listHandler = new ListPageReviewCandidatesQueryHandler(dbContext);

        var returnResult = await returnHandler.Handle(
            new RefusePageGlobalReviewCommand(reviewerId, pageId, "Please add bilingual contact details."),
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
            log.Action == "page.global-review.return" &&
            log.EntityId == pageId &&
            log.MetadataJson != null &&
            log.MetadataJson.Contains("Please add bilingual contact details."));
        await cacheInvalidation.Received(1).RemoveDetailAsync(pageId, Arg.Any<CancellationToken>());
        await cacheInvalidation.Received(1).RemoveGroupPagesAsync(groupId, Arg.Any<CancellationToken>());
        await cacheInvalidation.Received(1).RemoveGlobalAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ApproveCandidate_WritesAccessNameWithoutMovingGroupPage()
    {
        using var dbContext = CreateInMemoryDbContext();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        await SeedReviewerScenarioAsync(dbContext, reviewerId, authorId, groupId, pageId);
        var cacheInvalidation = Substitute.For<IPageCacheInvalidationService>();
        var handler = new PromotePageToGlobalCommandHandler(dbContext, cacheInvalidation);

        var result = await handler.Handle(
            new PromotePageToGlobalCommand(
                reviewerId,
                pageId,
                new Dictionary<string, string> { ["en"] = "Menu name", ["zh"] = "菜单名" }),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(groupId, result.Value!.PreviousOwnerGroupId);
        Assert.NotNull(result.Value.Page);
        Assert.Equal(groupId, result.Value.Page!.OwnerGroupId);

        var storedPage = await dbContext.Pages.FirstAsync(x => x.Id == pageId);
        Assert.Equal(groupId, storedPage.OwnerGroupId);
        Assert.Equal(PageVisibility.Public, storedPage.Visibility);
        Assert.Contains(dbContext.PagePublicationReviews, review =>
            review.PageId == pageId &&
            review.Status == PagePublicationReviewStatus.Approved &&
            review.AccessNameJson != null &&
            review.AccessNameJson.Contains("Menu name"));
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "page.global-review.approve" && log.EntityId == pageId);

        await cacheInvalidation.Received(1).RemoveDetailAsync(pageId, Arg.Any<CancellationToken>());
        await cacheInvalidation.Received(1).RemoveGroupPagesAsync(groupId, Arg.Any<CancellationToken>());
        await cacheInvalidation.Received(1).RemoveGlobalAsync(Arg.Any<CancellationToken>());
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
        var handler = new PromotePageToGlobalCommandHandler(dbContext, cacheInvalidation);

        var result = await handler.Handle(
            new PromotePageToGlobalCommand(
                ordinaryMemberId,
                pageId,
                new Dictionary<string, string> { ["en"] = "Menu name", ["zh"] = "菜单名" }),
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
