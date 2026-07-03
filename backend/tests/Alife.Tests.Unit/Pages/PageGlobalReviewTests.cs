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
    public async Task ListCandidates_ReturnsAllPageScopesAndVisibilityStatusesForPageReviewer()
    {
        using var dbContext = CreateInMemoryDbContext();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        await SeedReviewerScenarioAsync(dbContext, reviewerId, authorId, groupId, pageId);
        dbContext.Pages.AddRange(
            new Page
            {
                Id = Guid.NewGuid(),
                Scope = PageScope.Group,
                OwnerGroupId = groupId,
                CreatedByMemberId = authorId,
                TitleJson = "{\"en\":\"Draft review\",\"zh\":\"草稿审核\"}",
                DescriptionJson = "{\"en\":\"Draft page\",\"zh\":\"草稿页面\"}",
                TagsJson = "[]",
                TitleDisplayStyle = "Default",
                Visibility = PageVisibility.Draft,
                UpdatedUtc = DateTime.UtcNow.AddMinutes(1)
            },
            new Page
            {
                Id = Guid.NewGuid(),
                Scope = PageScope.Group,
                OwnerGroupId = groupId,
                CreatedByMemberId = authorId,
                TitleJson = "{\"en\":\"Group review\",\"zh\":\"组内审核\"}",
                DescriptionJson = "{\"en\":\"Group-visible page\",\"zh\":\"组内可见页面\"}",
                TagsJson = "[]",
                TitleDisplayStyle = "Default",
                Visibility = PageVisibility.Group,
                UpdatedUtc = DateTime.UtcNow.AddMinutes(2)
            },
            new Page
            {
                Id = Guid.NewGuid(),
                Scope = PageScope.Global,
                OwnerGroupId = null,
                CreatedByMemberId = authorId,
                TitleJson = "{\"en\":\"Global review\",\"zh\":\"全站审核\"}",
                DescriptionJson = "{\"en\":\"Global page\",\"zh\":\"全站页面\"}",
                TagsJson = "[]",
                TitleDisplayStyle = "Default",
                Visibility = PageVisibility.Public,
                UpdatedUtc = DateTime.UtcNow.AddMinutes(3)
            });
        await dbContext.SaveChangesAsync();
        var handler = new ListPageReviewCandidatesQueryHandler(dbContext);

        var result = await handler.Handle(new ListPageReviewCandidatesQuery(reviewerId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(4, result.Value!.Count);
        Assert.Contains(result.Value, page => page.Id == pageId && page.Visibility == PageVisibility.Public);
        Assert.Contains(result.Value, page => page.Visibility == PageVisibility.Draft);
        Assert.Contains(result.Value, page => page.Visibility == PageVisibility.Group);
        Assert.Contains(result.Value, page => page.Scope == PageScope.Global && page.OwnerGroupId is null);
    }

    [Fact]
    public async Task RefuseCandidate_RecordsReasonAndInvalidatesGroupPageCaches()
    {
        using var dbContext = CreateInMemoryDbContext();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        await SeedReviewerScenarioAsync(dbContext, reviewerId, authorId, groupId, pageId);
        var cacheInvalidation = Substitute.For<IPageCacheInvalidationService>();
        var refuseHandler = new RefusePageGlobalReviewCommandHandler(dbContext, cacheInvalidation);
        var listHandler = new ListPageReviewCandidatesQueryHandler(dbContext);

        var refuseResult = await refuseHandler.Handle(
            new RefusePageGlobalReviewCommand(reviewerId, pageId, "Please add bilingual contact details."),
            CancellationToken.None);
        var visibleResult = await listHandler.Handle(new ListPageReviewCandidatesQuery(reviewerId), CancellationToken.None);

        Assert.True(refuseResult.IsSuccess);
        Assert.True(visibleResult.IsSuccess);
        Assert.Contains(visibleResult.Value!, page => page.Id == pageId);
        Assert.Contains(dbContext.AuditLogs, log =>
            log.Action == "page.global-review.refuse" &&
            log.EntityId == pageId &&
            log.MetadataJson != null &&
            log.MetadataJson.Contains("Please add bilingual contact details."));
        await cacheInvalidation.Received(1).RemoveDetailAsync(pageId, Arg.Any<CancellationToken>());
        await cacheInvalidation.Received(1).RemoveGroupPagesAsync(groupId, Arg.Any<CancellationToken>());
        await cacheInvalidation.Received(1).RemoveGlobalAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task PromoteCandidate_ApprovesGlobalPublicationWithoutMovingGroupPage()
    {
        using var dbContext = CreateInMemoryDbContext();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        await SeedReviewerScenarioAsync(dbContext, reviewerId, authorId, groupId, pageId);
        var cacheInvalidation = Substitute.For<IPageCacheInvalidationService>();
        var handler = new PromotePageToGlobalCommandHandler(dbContext, cacheInvalidation);

        var result = await handler.Handle(new PromotePageToGlobalCommand(reviewerId, pageId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(groupId, result.Value!.PreviousOwnerGroupId);
        Assert.NotNull(result.Value.Page);
        Assert.Equal(PageScope.Group, result.Value.Page!.Scope);
        Assert.Equal(groupId, result.Value.Page.OwnerGroupId);

        var storedPage = await dbContext.Pages.FirstAsync(x => x.Id == pageId);
        Assert.Equal(PageScope.Group, storedPage.Scope);
        Assert.Equal(groupId, storedPage.OwnerGroupId);
        Assert.Equal(PageVisibility.Public, storedPage.Visibility);
        Assert.Contains(dbContext.AuditLogs, log => log.Action == "page.global-review.promote" && log.EntityId == pageId);

        await cacheInvalidation.Received(1).RemoveDetailAsync(pageId, Arg.Any<CancellationToken>());
        await cacheInvalidation.Received(1).RemoveGroupPagesAsync(groupId, Arg.Any<CancellationToken>());
        await cacheInvalidation.Received(1).RemoveGlobalAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task PromoteCandidate_RejectsMemberWithoutPageReviewerRole()
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

        var result = await handler.Handle(new PromotePageToGlobalCommand(ordinaryMemberId, pageId), CancellationToken.None);

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
            Scope = PageScope.Group,
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
