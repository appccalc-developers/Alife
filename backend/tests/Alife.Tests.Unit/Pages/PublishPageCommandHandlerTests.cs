using Alife.Application.Groups.Services;
using Alife.Application.Pages.Commands.PublishPage;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Pages;

public class PublishPageCommandHandlerTests
{
    [Fact]
    public async Task Handle_WhenLeaderPublishesPage_ReturnsUpdatedPageSummary()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var pageCacheInvalidationService = Substitute.For<IPageCacheInvalidationService>();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        dbContext.Pages.Add(new Page
        {
            Id = pageId,
            OwnerGroupId = groupId,
            CreatedByMemberId = Guid.NewGuid(),
            TitleJson = "{\"en\":\"Welcome\",\"zh\":\"欢迎\"}",
            DescriptionJson = "{\"en\":\"Public information\",\"zh\":\"公开资讯\"}",
            TagsJson = "[\"church\"]",
            TitleDisplayStyle = "Default",
            Visibility = PageVisibility.Group,
            UpdatedUtc = DateTime.UtcNow.AddDays(-1)
        });
        await dbContext.SaveChangesAsync();
        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>())
            .Returns(true);
        var handler = new PublishPageCommandHandler(
            dbContext,
            groupAuthorizationService,
            pageCacheInvalidationService);

        var result = await handler.Handle(
            new PublishPageCommand(pageId, leaderId, PageVisibility.Public),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal(pageId, result.Value.Id);
        Assert.Equal(groupId, result.Value.OwnerGroupId);
        Assert.Equal(PageVisibility.Public, result.Value.Visibility);
        Assert.Equal("Welcome", result.Value.Title["en"]);
        Assert.Contains(dbContext.PagePublicationReviews, review =>
            review.PageId == pageId &&
            review.Status == PagePublicationReviewStatus.Pending);
        await pageCacheInvalidationService.Received(1).RemoveDetailAsync(pageId, Arg.Any<CancellationToken>());
        await pageCacheInvalidationService.Received(1).RemoveGroupPagesAsync(groupId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WhenPageReviewerPublishesGroupPage_ReturnsForbidden()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var pageCacheInvalidationService = Substitute.For<IPageCacheInvalidationService>();
        var groupId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        dbContext.Pages.Add(new Page
        {
            Id = pageId,
            OwnerGroupId = groupId,
            CreatedByMemberId = Guid.NewGuid(),
            TitleJson = "{\"en\":\"Welcome\",\"zh\":\"欢迎\"}",
            DescriptionJson = "{\"en\":\"Internal draft\",\"zh\":\"内部草稿\"}",
            TagsJson = "[\"church\"]",
            TitleDisplayStyle = "Default",
            Visibility = PageVisibility.Draft,
            UpdatedUtc = DateTime.UtcNow.AddDays(-1)
        });
        await dbContext.SaveChangesAsync();
        var handler = new PublishPageCommandHandler(
            dbContext,
            groupAuthorizationService,
            pageCacheInvalidationService);

        var result = await handler.Handle(
            new PublishPageCommand(pageId, reviewerId, PageVisibility.Public),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(Application.Common.Models.AppResultStatus.Forbidden, result.Status);
        await pageCacheInvalidationService.DidNotReceive().RemoveDetailAsync(pageId, Arg.Any<CancellationToken>());
        await pageCacheInvalidationService.DidNotReceive().RemoveGroupPagesAsync(groupId, Arg.Any<CancellationToken>());
    }

    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
