using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Queries.GetGroupPages;
using Alife.Application.Pages.Queries.GetPageById;
using Alife.Application.Pages.Services;
using Alife.Domain.Enums;
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
        var handler = new GetGroupPagesQueryHandler(pageReadService, groupReadService, authorizationService);

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
        var handler = new GetPageByIdQueryHandler(pageReadService, authorizationService);

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
        var handler = new GetPageByIdQueryHandler(pageReadService, authorizationService);

        var result = await handler.Handle(new GetPageByIdQuery(pageId, leaderId), CancellationToken.None);

        Assert.True(result.IsSuccess);
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

    private static PageDto CreatePage(Guid groupId, Guid authorId, PageVisibility visibility)
        => new(
            Guid.NewGuid(),
            PageScope.Group,
            groupId,
            authorId,
            new Dictionary<string, string> { ["en"] = "Page" },
            null,
            "[]",
            "Default",
            visibility,
            DateTime.UtcNow);

    private static PageDetailDto CreatePageDetail(Guid pageId, Guid groupId, Guid authorId, PageVisibility visibility)
        => new(
            pageId,
            PageScope.Group,
            groupId,
            authorId,
            new Dictionary<string, string> { ["en"] = "Page" },
            null,
            "[]",
            "Default",
            visibility,
            DateTime.UtcNow,
            []);
}
