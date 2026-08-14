using Alife.Application.Admin.Dtos;
using Alife.Application.Admin.Commands.ApprovePagePublication;
using Alife.Application.Admin.Commands.CreatePagePrimaryMenu;
using Alife.Application.Admin.Commands.DeletePagePrimaryMenu;
using Alife.Application.Admin.Commands.ReturnPagePublication;
using Alife.Application.Admin.Commands.SavePageMenuLayout;
using Alife.Application.Admin.Commands.UpdatePagePrimaryMenu;
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

    [Fact]
    public async Task SaveMenuLayout_ReordersMenusAndMovesApprovedPagesBetweenThem()
    {
        using var dbContext = CreateInMemoryDbContext();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var firstPageId = Guid.NewGuid();
        var secondPageId = Guid.NewGuid();
        var thirdPageId = Guid.NewGuid();
        await SeedReviewerScenarioAsync(dbContext, reviewerId, authorId, groupId, firstPageId);
        var now = DateTime.UtcNow;
        dbContext.Pages.AddRange(
            CreatePublicPage(secondPageId, groupId, authorId, "Second", now),
            CreatePublicPage(thirdPageId, groupId, authorId, "Third", now));
        var firstMenu = new PagePrimaryMenu
        {
            Id = Guid.NewGuid(),
            NameJson = "{\"en\":\"Ministries\",\"zh\":\"事工\"}",
            SortOrder = 0,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        var secondMenu = new PagePrimaryMenu
        {
            Id = Guid.NewGuid(),
            NameJson = "{\"en\":\"Community\",\"zh\":\"社区\"}",
            SortOrder = 1,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        dbContext.PagePrimaryMenus.AddRange(firstMenu, secondMenu);
        dbContext.PagePublicationReviews.AddRange(
            CreateApprovedReview(firstPageId, firstMenu, 0, now),
            CreateApprovedReview(secondPageId, firstMenu, 1, now),
            CreateApprovedReview(thirdPageId, secondMenu, 0, now));
        await dbContext.SaveChangesAsync();
        var cacheInvalidation = Substitute.For<IPageCacheInvalidationService>();
        var handler = new SavePageMenuLayoutCommandHandler(dbContext, cacheInvalidation);

        var result = await handler.Handle(
            new SavePageMenuLayoutCommand(
                reviewerId,
                [
                    new PagePrimaryMenuLayoutItemDto(secondMenu.Id, [thirdPageId, firstPageId]),
                    new PagePrimaryMenuLayoutItemDto(firstMenu.Id, [secondPageId])
                ]),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, secondMenu.SortOrder);
        Assert.Equal(1, firstMenu.SortOrder);
        var firstReview = await dbContext.PagePublicationReviews.SingleAsync(x => x.PageId == firstPageId);
        Assert.Equal(secondMenu.Id, firstReview.PrimaryMenuId);
        Assert.Equal(1, firstReview.MenuSortOrder);
        Assert.Contains("Community", firstReview.PrimaryMenuNameJson);
        Assert.Equal(0, (await dbContext.PagePublicationReviews.SingleAsync(x => x.PageId == thirdPageId)).MenuSortOrder);
        Assert.Equal(0, (await dbContext.PagePublicationReviews.SingleAsync(x => x.PageId == secondPageId)).MenuSortOrder);
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "page.menu-layout.update");
        await cacheInvalidation.Received(1).RemovePublicAsync(Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(true, PageVisibility.Public)]
    [InlineData(false, PageVisibility.Draft)]
    public async Task SaveMenuLayout_IgnoresApprovedReviewsForPagesHiddenFromReviewCandidates(
        bool isDeleted,
        PageVisibility visibility)
    {
        using var dbContext = CreateInMemoryDbContext();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var visiblePageId = Guid.NewGuid();
        var hiddenPageId = Guid.NewGuid();
        await SeedReviewerScenarioAsync(dbContext, reviewerId, authorId, groupId, visiblePageId);
        var now = DateTime.UtcNow;
        var hiddenPage = CreatePublicPage(hiddenPageId, groupId, authorId, "Hidden", now);
        hiddenPage.IsDeleted = isDeleted;
        hiddenPage.Visibility = visibility;
        dbContext.Pages.Add(hiddenPage);
        var firstMenu = new PagePrimaryMenu
        {
            Id = Guid.NewGuid(),
            NameJson = "{\"en\":\"Ministries\",\"zh\":\"事工\"}",
            SortOrder = 0,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        var secondMenu = new PagePrimaryMenu
        {
            Id = Guid.NewGuid(),
            NameJson = "{\"en\":\"Community\",\"zh\":\"社区\"}",
            SortOrder = 1,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        var visibleReview = CreateApprovedReview(visiblePageId, firstMenu, 0, now);
        var hiddenReview = CreateApprovedReview(hiddenPageId, firstMenu, 7, now);
        dbContext.PagePrimaryMenus.AddRange(firstMenu, secondMenu);
        dbContext.PagePublicationReviews.AddRange(visibleReview, hiddenReview);
        await dbContext.SaveChangesAsync();
        var cacheInvalidation = Substitute.For<IPageCacheInvalidationService>();
        var handler = new SavePageMenuLayoutCommandHandler(dbContext, cacheInvalidation);

        var result = await handler.Handle(
            new SavePageMenuLayoutCommand(
                reviewerId,
                [
                    new PagePrimaryMenuLayoutItemDto(secondMenu.Id, [visiblePageId]),
                    new PagePrimaryMenuLayoutItemDto(firstMenu.Id, [])
                ]),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, secondMenu.SortOrder);
        Assert.Equal(1, firstMenu.SortOrder);
        Assert.Equal(secondMenu.Id, visibleReview.PrimaryMenuId);
        Assert.Equal(0, visibleReview.MenuSortOrder);
        Assert.Equal(firstMenu.Id, hiddenReview.PrimaryMenuId);
        Assert.Equal(7, hiddenReview.MenuSortOrder);
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "page.menu-layout.update");
        await cacheInvalidation.Received(1).RemovePublicAsync(Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task SaveMenuLayout_RejectsIncompleteOrDuplicateVisibleApprovedPageSet(bool duplicatePageId)
    {
        using var dbContext = CreateInMemoryDbContext();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var firstPageId = Guid.NewGuid();
        var secondPageId = Guid.NewGuid();
        await SeedReviewerScenarioAsync(dbContext, reviewerId, authorId, groupId, firstPageId);
        var now = DateTime.UtcNow;
        dbContext.Pages.Add(CreatePublicPage(secondPageId, groupId, authorId, "Second", now));
        var menu = new PagePrimaryMenu
        {
            Id = Guid.NewGuid(),
            NameJson = "{\"en\":\"Ministries\",\"zh\":\"事工\"}",
            SortOrder = 0,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        dbContext.PagePrimaryMenus.Add(menu);
        dbContext.PagePublicationReviews.AddRange(
            CreateApprovedReview(firstPageId, menu, 0, now),
            CreateApprovedReview(secondPageId, menu, 1, now));
        await dbContext.SaveChangesAsync();
        var cacheInvalidation = Substitute.For<IPageCacheInvalidationService>();
        var handler = new SavePageMenuLayoutCommandHandler(dbContext, cacheInvalidation);
        var requestedPageIds = duplicatePageId ? new[] { firstPageId, firstPageId } : new[] { firstPageId };

        var result = await handler.Handle(
            new SavePageMenuLayoutCommand(
                reviewerId,
                [new PagePrimaryMenuLayoutItemDto(menu.Id, requestedPageIds)]),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(Application.Common.Models.AppResultStatus.Conflict, result.Status);
        Assert.DoesNotContain(dbContext.AuditLogs, log => log.Action == "page.menu-layout.update");
        await cacheInvalidation.DidNotReceive().RemovePublicAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreatePrimaryMenu_CreatesEmptyMenuAtEndOfTabOrder()
    {
        using var dbContext = CreateInMemoryDbContext();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        await SeedReviewerScenarioAsync(dbContext, reviewerId, authorId, groupId, pageId);
        var now = DateTime.UtcNow;
        dbContext.PagePrimaryMenus.Add(new PagePrimaryMenu
        {
            Id = Guid.NewGuid(),
            NameJson = "{\"en\":\"Existing\",\"zh\":\"现有\"}",
            SortOrder = 0,
            CreatedUtc = now,
            UpdatedUtc = now
        });
        await dbContext.SaveChangesAsync();
        var cacheInvalidation = Substitute.For<IPageCacheInvalidationService>();
        var handler = new CreatePagePrimaryMenuCommandHandler(dbContext, cacheInvalidation);

        var result = await handler.Handle(
            new CreatePagePrimaryMenuCommand(
                reviewerId,
                new Dictionary<string, string> { ["en"] = "New menu", ["zh"] = "新菜单" }),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Value!.SortOrder);
        Assert.Equal(0, result.Value.ApprovedPageCount);
        Assert.Contains(dbContext.PagePrimaryMenus, menu => menu.Id == result.Value.Id && menu.NameJson.Contains("New menu"));
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "page.primary-menu.create" && log.EntityId == result.Value.Id);
        await cacheInvalidation.Received(1).RemovePublicAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task PrimaryMenu_HomePlacementCanOnlyBeAssignedOnce()
    {
        using var dbContext = CreateInMemoryDbContext();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        await SeedReviewerScenarioAsync(dbContext, reviewerId, authorId, groupId, pageId);
        var cacheInvalidation = Substitute.For<IPageCacheInvalidationService>();
        var handler = new CreatePagePrimaryMenuCommandHandler(dbContext, cacheInvalidation);

        var first = await handler.Handle(
            new CreatePagePrimaryMenuCommand(
                reviewerId,
                new Dictionary<string, string> { ["en"] = "Organization", ["zh"] = "教会组成" },
                PagePrimaryMenuHomePlacement.ChurchOrganization),
            CancellationToken.None);
        var duplicate = await handler.Handle(
            new CreatePagePrimaryMenuCommand(
                reviewerId,
                new Dictionary<string, string> { ["en"] = "Another", ["zh"] = "另一个" },
                PagePrimaryMenuHomePlacement.ChurchOrganization),
            CancellationToken.None);

        Assert.True(first.IsSuccess);
        Assert.Equal(PagePrimaryMenuHomePlacement.ChurchOrganization, first.Value!.HomePlacement);
        Assert.False(duplicate.IsSuccess);
        Assert.Equal(Application.Common.Models.AppResultStatus.Conflict, duplicate.Status);
        Assert.Single(dbContext.PagePrimaryMenus);
        await cacheInvalidation.Received(1).RemovePublicAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task PrimaryMenu_CanBeRenamedAndDeletedAfterItsLastApprovedPageMovesAway()
    {
        using var dbContext = CreateInMemoryDbContext();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        await SeedReviewerScenarioAsync(dbContext, reviewerId, authorId, groupId, pageId);
        var now = DateTime.UtcNow;
        var sourceMenu = new PagePrimaryMenu
        {
            Id = Guid.NewGuid(),
            NameJson = "{\"en\":\"Ministries\",\"zh\":\"事工\"}",
            SortOrder = 0,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        var targetMenu = new PagePrimaryMenu
        {
            Id = Guid.NewGuid(),
            NameJson = "{\"en\":\"Community\",\"zh\":\"社区\"}",
            SortOrder = 1,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        dbContext.PagePrimaryMenus.AddRange(sourceMenu, targetMenu);
        dbContext.PagePublicationReviews.Add(CreateApprovedReview(pageId, sourceMenu, 0, now));
        await dbContext.SaveChangesAsync();
        var cacheInvalidation = Substitute.For<IPageCacheInvalidationService>();
        var updateHandler = new UpdatePagePrimaryMenuCommandHandler(dbContext, cacheInvalidation);
        var layoutHandler = new SavePageMenuLayoutCommandHandler(dbContext, cacheInvalidation);
        var deleteHandler = new DeletePagePrimaryMenuCommandHandler(dbContext, cacheInvalidation);

        var updateResult = await updateHandler.Handle(
            new UpdatePagePrimaryMenuCommand(
                reviewerId,
                sourceMenu.Id,
                new Dictionary<string, string> { ["en"] = "Serving", ["zh"] = "服事" }),
            CancellationToken.None);
        var moveResult = await layoutHandler.Handle(
            new SavePageMenuLayoutCommand(
                reviewerId,
                [
                    new PagePrimaryMenuLayoutItemDto(sourceMenu.Id, []),
                    new PagePrimaryMenuLayoutItemDto(targetMenu.Id, [pageId])
                ]),
            CancellationToken.None);
        var deleteResult = await deleteHandler.Handle(
            new DeletePagePrimaryMenuCommand(reviewerId, sourceMenu.Id),
            CancellationToken.None);

        Assert.True(updateResult.IsSuccess);
        Assert.True(moveResult.IsSuccess);
        Assert.True(deleteResult.IsSuccess);
        Assert.DoesNotContain(dbContext.PagePrimaryMenus, menu => menu.Id == sourceMenu.Id);
        Assert.Equal(targetMenu.Id, (await dbContext.PagePublicationReviews.SingleAsync()).PrimaryMenuId);
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "page.primary-menu.update");
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "page.primary-menu.delete");
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

    private static Page CreatePublicPage(Guid pageId, Guid groupId, Guid authorId, string title, DateTime now)
        => new()
        {
            Id = pageId,
            OwnerGroupId = groupId,
            CreatedByMemberId = authorId,
            TitleJson = $"{{\"en\":\"{title}\",\"zh\":\"{title}\"}}",
            DescriptionJson = "{}",
            TagsJson = "[]",
            TitleDisplayStyle = "Default",
            Visibility = PageVisibility.Public,
            UpdatedUtc = now
        };

    private static PagePublicationReview CreateApprovedReview(
        Guid pageId,
        PagePrimaryMenu primaryMenu,
        int menuSortOrder,
        DateTime now)
        => new()
        {
            Id = Guid.NewGuid(),
            PageId = pageId,
            Status = PagePublicationReviewStatus.Approved,
            PrimaryMenuId = primaryMenu.Id,
            PrimaryMenuNameJson = primaryMenu.NameJson,
            MenuSortOrder = menuSortOrder,
            AccessNameJson = "{\"en\":\"Menu\",\"zh\":\"菜单\"}",
            CardTextJson = "{\"en\":\"Card\",\"zh\":\"卡片\"}",
            ReviewedUtc = now,
            CreatedUtc = now,
            UpdatedUtc = now
        };

    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
