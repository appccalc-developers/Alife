using Alife.Application.Admin.Commands.IgnorePageGlobalReview;
using Alife.Application.Admin.Commands.PromotePageToGlobal;
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
    public async Task ListCandidates_ReturnsPublicGroupPagesForPageReviewer()
    {
        using var dbContext = CreateInMemoryDbContext();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        await SeedReviewerScenarioAsync(dbContext, reviewerId, authorId, groupId, pageId);
        var handler = new ListPageReviewCandidatesQueryHandler(dbContext);

        var result = await handler.Handle(new ListPageReviewCandidatesQuery(reviewerId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var page = Assert.Single(result.Value!);
        Assert.Equal(pageId, page.Id);
        Assert.Equal(groupId, page.OwnerGroupId);
        Assert.Equal("Review me", page.Title["en"]);
    }

    [Fact]
    public async Task IgnoreCandidate_HidesPageUntilItIsEditedAgain()
    {
        using var dbContext = CreateInMemoryDbContext();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        await SeedReviewerScenarioAsync(dbContext, reviewerId, authorId, groupId, pageId);
        var ignoreHandler = new IgnorePageGlobalReviewCommandHandler(dbContext);
        var listHandler = new ListPageReviewCandidatesQueryHandler(dbContext);

        var ignoreResult = await ignoreHandler.Handle(new IgnorePageGlobalReviewCommand(reviewerId, pageId), CancellationToken.None);
        var hiddenResult = await listHandler.Handle(new ListPageReviewCandidatesQuery(reviewerId), CancellationToken.None);

        Assert.True(ignoreResult.IsSuccess);
        Assert.Empty(hiddenResult.Value!);

        var page = await dbContext.Pages.FirstAsync(x => x.Id == pageId);
        page.UpdatedUtc = DateTime.UtcNow.AddMinutes(5);
        await dbContext.SaveChangesAsync();

        var visibleAgainResult = await listHandler.Handle(new ListPageReviewCandidatesQuery(reviewerId), CancellationToken.None);

        Assert.True(visibleAgainResult.IsSuccess);
        Assert.Single(visibleAgainResult.Value!);
    }

    [Fact]
    public async Task PromoteCandidate_ChangesScopeToGlobalAndInvalidatesOldGroupAndGlobalCaches()
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
        Assert.Equal(PageScope.Global, result.Value.Page!.Scope);
        Assert.Null(result.Value.Page.OwnerGroupId);

        var storedPage = await dbContext.Pages.FirstAsync(x => x.Id == pageId);
        Assert.Equal(PageScope.Global, storedPage.Scope);
        Assert.Null(storedPage.OwnerGroupId);
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
