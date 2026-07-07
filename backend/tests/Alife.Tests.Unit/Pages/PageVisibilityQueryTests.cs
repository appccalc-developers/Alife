using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Queries.GetGroupPages;
using Alife.Application.Pages.Queries.GetPageById;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Pages;

public class PageVisibilityQueryTests
{
    [Fact]
    public async Task GetGroupPages_ApprovedMemberSeesDraftItems()
    {
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var groupReadService = Substitute.For<IGroupReadService>();
        var pageReadService = Substitute.For<IPageReadService>();
        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        groupReadService.GetByIdAsync(groupId, Arg.Any<CancellationToken>())
            .Returns(CreateGroup(groupId));
        authorizationService.IsApprovedMemberAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(true);
        pageReadService.GetGroupPagesAsync(groupId, Arg.Any<CancellationToken>())
            .Returns([
                CreatePage(groupId, authorId, PageVisibility.Draft),
                CreatePage(groupId, authorId, PageVisibility.Group)
            ]);
        using var dbContext = CreateInMemoryDbContext();
        var handler = new GetGroupPagesQueryHandler(pageReadService, groupReadService, authorizationService, dbContext);

        var result = await handler.Handle(new GetGroupPagesQuery(groupId, memberId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value!.Count);
        Assert.Contains(result.Value, x => x.Visibility == PageVisibility.Draft);
    }

    [Fact]
    public async Task GetPageById_ApprovedNonAuthorCannotReadDraftDetail()
    {
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        var pageReadService = Substitute.For<IPageReadService>();
        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsApprovedMemberAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(true);
        authorizationService.IsLeaderOrCoLeaderAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(false);
        pageReadService.GetByIdAsync(pageId, Arg.Any<CancellationToken>())
            .Returns(CreatePageDetail(pageId, groupId, authorId, PageVisibility.Draft));
        var groupReadService = Substitute.For<IGroupReadService>();
        using var dbContext = CreateInMemoryDbContext();
        var handler = new GetPageByIdQueryHandler(pageReadService, authorizationService, dbContext);

        var result = await handler.Handle(new GetPageByIdQuery(pageId, memberId), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(Application.Common.Models.AppResultStatus.Forbidden, result.Status);
    }

    [Fact]
    public async Task GetPageById_LeaderCanReadDraftDetail()
    {
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        var pageReadService = Substitute.For<IPageReadService>();
        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsApprovedMemberAsync(groupId, leaderId, Arg.Any<CancellationToken>())
            .Returns(true);
        authorizationService.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>())
            .Returns(true);
        pageReadService.GetByIdAsync(pageId, Arg.Any<CancellationToken>())
            .Returns(CreatePageDetail(pageId, groupId, authorId, PageVisibility.Draft));
        var groupReadService = Substitute.For<IGroupReadService>();
        using var dbContext = CreateInMemoryDbContext();
        var handler = new GetPageByIdQueryHandler(pageReadService, authorizationService, dbContext);

        var result = await handler.Handle(new GetPageByIdQuery(pageId, leaderId), CancellationToken.None);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task GetPageById_PageReviewerCanReadDraftDetail()
    {
        var groupId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        var pageReadService = Substitute.For<IPageReadService>();
        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsApprovedMemberAsync(groupId, reviewerId, Arg.Any<CancellationToken>())
            .Returns(false);
        authorizationService.IsLeaderOrCoLeaderAsync(groupId, reviewerId, Arg.Any<CancellationToken>())
            .Returns(false);
        authorizationService.CanReviewPagesAsync(reviewerId, Arg.Any<CancellationToken>())
            .Returns(true);
        pageReadService.GetByIdAsync(pageId, Arg.Any<CancellationToken>())
            .Returns(CreatePageDetail(pageId, groupId, authorId, PageVisibility.Draft));
        var groupReadService = Substitute.For<IGroupReadService>();
        using var dbContext = CreateInMemoryDbContext();
        var handler = new GetPageByIdQueryHandler(pageReadService, authorizationService, dbContext);

        var result = await handler.Handle(new GetPageByIdQuery(pageId, reviewerId), CancellationToken.None);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task GetGroupPages_ApprovedMemberSeesCurrentGlobalReviewRefusal()
    {
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        var updatedUtc = DateTime.UtcNow.AddMinutes(-5);
        var groupReadService = Substitute.For<IGroupReadService>();
        var pageReadService = Substitute.For<IPageReadService>();
        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        groupReadService.GetByIdAsync(groupId, Arg.Any<CancellationToken>())
            .Returns(CreateGroup(groupId));
        authorizationService.IsApprovedMemberAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(true);
        pageReadService.GetGroupPagesAsync(groupId, Arg.Any<CancellationToken>())
            .Returns([CreatePage(pageId, groupId, authorId, PageVisibility.Public, updatedUtc)]);
        using var dbContext = CreateInMemoryDbContext();
        dbContext.Members.Add(new Member { Id = reviewerId, DisplayName = "Reviewer", IsRegistered = true });
        dbContext.PagePublicationReviews.Add(new PagePublicationReview
        {
            Id = Guid.NewGuid(),
            PageId = pageId,
            Status = PagePublicationReviewStatus.Returned,
            ReturnReason = "Please add bilingual contact details.",
            ReviewedByMemberId = reviewerId,
            ReviewedUtc = updatedUtc.AddMinutes(1),
            CreatedUtc = updatedUtc.AddMinutes(1),
            UpdatedUtc = updatedUtc.AddMinutes(1)
        });
        await dbContext.SaveChangesAsync();
        var handler = new GetGroupPagesQueryHandler(pageReadService, groupReadService, authorizationService, dbContext);

        var result = await handler.Handle(new GetGroupPagesQuery(groupId, memberId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var page = Assert.Single(result.Value!);
        Assert.NotNull(page.ReviewRefusal);
        Assert.Equal(reviewerId, page.ReviewRefusal!.ReviewerMemberId);
        Assert.Equal("Reviewer", page.ReviewRefusal.ReviewerDisplayName);
        Assert.Equal("Please add bilingual contact details.", page.ReviewRefusal.Reason);
    }

    [Fact]
    public async Task GetGroupPages_GuestSeesOnlyPublicChurchPages()
    {
        var groupId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var groupReadService = Substitute.For<IGroupReadService>();
        var pageReadService = Substitute.For<IPageReadService>();
        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        groupReadService.GetByIdAsync(groupId, Arg.Any<CancellationToken>())
            .Returns(CreateChurchGroup(groupId));
        var publicPage = CreatePage(groupId, authorId, PageVisibility.Public);
        pageReadService.GetGroupPagesAsync(groupId, Arg.Any<CancellationToken>())
            .Returns([
                publicPage,
                CreatePage(groupId, authorId, PageVisibility.Group),
                CreatePage(groupId, authorId, PageVisibility.Draft)
            ]);
        using var dbContext = CreateInMemoryDbContext();
        dbContext.PagePublicationReviews.Add(new PagePublicationReview
        {
            Id = Guid.NewGuid(),
            PageId = publicPage.Id,
            Status = PagePublicationReviewStatus.Approved,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var handler = new GetGroupPagesQueryHandler(pageReadService, groupReadService, authorizationService, dbContext);

        var result = await handler.Handle(new GetGroupPagesQuery(groupId, null), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value!);
        Assert.Equal(PageVisibility.Public, result.Value![0].Visibility);
        Assert.Null(result.Value![0].ReviewRefusal);
    }

    [Fact]
    public async Task GetPageById_GuestCannotReadUnapprovedPublicChurchPageDetail()
    {
        var groupId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        var pageReadService = Substitute.For<IPageReadService>();
        var groupReadService = Substitute.For<IGroupReadService>();
        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        pageReadService.GetByIdAsync(pageId, Arg.Any<CancellationToken>())
            .Returns(CreatePageDetail(pageId, groupId, authorId, PageVisibility.Public));
        using var dbContext = CreateInMemoryDbContext();
        var handler = new GetPageByIdQueryHandler(pageReadService, authorizationService, dbContext);

        var result = await handler.Handle(new GetPageByIdQuery(pageId, null), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(Application.Common.Models.AppResultStatus.Forbidden, result.Status);
    }

    [Fact]
    public async Task GetPageById_GuestCanReadCurrentApprovedPublicGroupPageDetail()
    {
        var groupId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        var updatedUtc = DateTime.UtcNow.AddMinutes(-5);
        var pageReadService = Substitute.For<IPageReadService>();
        var groupReadService = Substitute.For<IGroupReadService>();
        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        pageReadService.GetByIdAsync(pageId, Arg.Any<CancellationToken>())
            .Returns(CreatePageDetail(pageId, groupId, authorId, PageVisibility.Public, updatedUtc));
        using var dbContext = CreateInMemoryDbContext();
        dbContext.PagePublicationReviews.Add(new PagePublicationReview
        {
            Id = Guid.NewGuid(),
            PageId = pageId,
            Status = PagePublicationReviewStatus.Approved,
            AccessNameJson = "{\"en\":\"Approved\",\"zh\":\"已批准\"}",
            CreatedUtc = updatedUtc.AddMinutes(1),
            UpdatedUtc = updatedUtc.AddMinutes(1)
        });
        await dbContext.SaveChangesAsync();
        var handler = new GetPageByIdQueryHandler(pageReadService, authorizationService, dbContext);

        var result = await handler.Handle(new GetPageByIdQuery(pageId, null), CancellationToken.None);

        Assert.True(result.IsSuccess);
        await groupReadService.DidNotReceive().GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetPageById_GuestCannotReadNonPublicChurchPageDetail()
    {
        var groupId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        var pageReadService = Substitute.For<IPageReadService>();
        var groupReadService = Substitute.For<IGroupReadService>();
        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        pageReadService.GetByIdAsync(pageId, Arg.Any<CancellationToken>())
            .Returns(CreatePageDetail(pageId, groupId, authorId, PageVisibility.Group));
        groupReadService.GetByIdAsync(groupId, Arg.Any<CancellationToken>())
            .Returns(CreateChurchGroup(groupId));
        using var dbContext = CreateInMemoryDbContext();
        var handler = new GetPageByIdQueryHandler(pageReadService, authorizationService, dbContext);

        var result = await handler.Handle(new GetPageByIdQuery(pageId, null), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(Application.Common.Models.AppResultStatus.Forbidden, result.Status);
    }

    private static GroupDto CreateGroup(Guid groupId)
        => new(
            groupId,
            new Dictionary<string, string> { ["en"] = "Group" },
            null,
            null,
            AccessType.Protected,
            IsChurch: false,
            IsClosed: false,
            DateTime.UtcNow,
            DateTime.UtcNow);

    private static GroupDto CreateChurchGroup(Guid groupId)
        => new(
            groupId,
            new Dictionary<string, string> { ["en"] = "Church" },
            null,
            null,
            AccessType.Public,
            IsChurch: true,
            IsClosed: false,
            DateTime.UtcNow,
            DateTime.UtcNow);

    private static PageDto CreatePage(Guid groupId, Guid authorId, PageVisibility visibility)
        => new(
            Guid.NewGuid(),
            groupId,
            authorId,
            new Dictionary<string, string> { ["en"] = "Page" },
            null,
            "[]",
            "Default",
            visibility,
            DateTime.UtcNow);

    private static PageDto CreatePage(Guid pageId, Guid groupId, Guid authorId, PageVisibility visibility, DateTime updatedUtc)
        => new(
            pageId,
            groupId,
            authorId,
            new Dictionary<string, string> { ["en"] = "Page" },
            null,
            "[]",
            "Default",
            visibility,
            updatedUtc);

    private static PageDetailDto CreatePageDetail(Guid pageId, Guid groupId, Guid authorId, PageVisibility visibility)
        => CreatePageDetail(pageId, groupId, authorId, visibility, DateTime.UtcNow);

    private static PageDetailDto CreatePageDetail(Guid pageId, Guid groupId, Guid authorId, PageVisibility visibility, DateTime updatedUtc)
        => new(
            pageId,
            groupId,
            authorId,
            new Dictionary<string, string> { ["en"] = "Page" },
            null,
            "[]",
            "Default",
            visibility,
            updatedUtc,
            []);

    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
