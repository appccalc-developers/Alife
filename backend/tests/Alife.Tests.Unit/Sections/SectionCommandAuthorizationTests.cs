using Alife.Application.Groups.Services;
using Alife.Application.Pages.Services;
using Alife.Application.Sections.Commands.CreateSection;
using Alife.Application.Sections.Commands.DeleteSection;
using Alife.Application.Sections.Commands.UpdateSection;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Sections;

public class SectionCommandAuthorizationTests
{
    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    [Fact]
    public async Task CreateSection_WhenGroupLeaderOrCoLeaderIsNotPageAuthor_CreatesSection()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var pageCacheInvalidationService = Substitute.For<IPageCacheInvalidationService>();
        var groupId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var currentMemberId = Guid.NewGuid();
        var pageId = Guid.NewGuid();

        dbContext.Pages.Add(CreateGroupPage(pageId, groupId, authorId, PageVisibility.Group));
        await dbContext.SaveChangesAsync();

        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, currentMemberId, Arg.Any<CancellationToken>())
            .Returns(true);

        var handler = new CreateSectionCommandHandler(
            dbContext,
            groupAuthorizationService,
            pageCacheInvalidationService);

        var result = await handler.Handle(
            new CreateSectionCommand(pageId, currentMemberId, SectionType.RichText, "{\"text\":\"hello\"}", "{}", null),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, await dbContext.Sections.CountAsync());
    }

    [Fact]
    public async Task UpdateSection_WhenGroupLeaderOrCoLeaderIsNotPageAuthor_UpdatesSection()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var pageCacheInvalidationService = Substitute.For<IPageCacheInvalidationService>();
        var groupId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var currentMemberId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        var sectionId = Guid.NewGuid();

        dbContext.Pages.Add(CreateGroupPage(pageId, groupId, authorId, PageVisibility.Group));
        dbContext.Sections.Add(new Section
        {
            Id = sectionId,
            PageId = pageId,
            Order = 1,
            Type = SectionType.LandingHero,
            ContentJson = "{}",
            StyleJson = "{}"
        });
        await dbContext.SaveChangesAsync();

        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, currentMemberId, Arg.Any<CancellationToken>())
            .Returns(true);

        var handler = new UpdateSectionCommandHandler(
            dbContext,
            groupAuthorizationService,
            pageCacheInvalidationService);

        var result = await handler.Handle(
            new UpdateSectionCommand(sectionId, currentMemberId, SectionType.RichText, "{\"text\":\"updated\"}", "{}", 2),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var section = await dbContext.Sections.SingleAsync(x => x.Id == sectionId);
        Assert.Equal(SectionType.RichText, section.Type);
        Assert.Equal(2, section.Order);
        Assert.Equal("{\"text\":\"updated\"}", section.ContentJson);
    }

    [Fact]
    public async Task UpdateSection_OnPublishedPage_SubmitsNewCopyAndKeepsPublishedSnapshot()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var pageCacheInvalidationService = Substitute.For<IPageCacheInvalidationService>();
        var groupId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var currentMemberId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        var sectionId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var page = CreateGroupPage(pageId, groupId, authorId, PageVisibility.Public);
        var section = new Section
        {
            Id = sectionId,
            PageId = pageId,
            Order = 1,
            Type = SectionType.RichText,
            ContentJson = "{\"text\":\"published\"}",
            StyleJson = "{}"
        };
        var publishedSnapshot = PagePublicationSnapshots.Capture(page, [section], now);
        dbContext.Pages.Add(page);
        dbContext.Sections.Add(section);
        dbContext.PagePublicationReviews.Add(new PagePublicationReview
        {
            Id = Guid.NewGuid(),
            PageId = pageId,
            Status = PagePublicationReviewStatus.Approved,
            SubmittedSnapshotJson = publishedSnapshot,
            SubmittedByMemberId = authorId,
            SubmittedUtc = now,
            PublishedSnapshotJson = publishedSnapshot,
            PublishedByMemberId = currentMemberId,
            PublishedUtc = now,
            CreatedUtc = now,
            UpdatedUtc = now
        });
        await dbContext.SaveChangesAsync();
        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, currentMemberId, Arg.Any<CancellationToken>())
            .Returns(true);
        var handler = new UpdateSectionCommandHandler(
            dbContext,
            groupAuthorizationService,
            pageCacheInvalidationService);

        var result = await handler.Handle(
            new UpdateSectionCommand(sectionId, currentMemberId, SectionType.RichText, "{\"text\":\"candidate\"}", "{}", 1),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var review = await dbContext.PagePublicationReviews.SingleAsync(candidate => candidate.PageId == pageId);
        Assert.Equal(PagePublicationReviewStatus.Pending, review.Status);
        Assert.Equal(publishedSnapshot, review.PublishedSnapshotJson);
        Assert.Contains("candidate", review.SubmittedSnapshotJson);
        Assert.DoesNotContain("candidate", review.PublishedSnapshotJson);
    }

    [Fact]
    public async Task DeleteSection_WhenGroupLeaderOrCoLeaderIsNotPageAuthor_SoftDeletesSection()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupAuthorizationService = Substitute.For<IGroupAuthorizationService>();
        var pageCacheInvalidationService = Substitute.For<IPageCacheInvalidationService>();
        var groupId = Guid.NewGuid();
        var authorId = Guid.NewGuid();
        var currentMemberId = Guid.NewGuid();
        var pageId = Guid.NewGuid();
        var sectionId = Guid.NewGuid();

        dbContext.Pages.Add(CreateGroupPage(pageId, groupId, authorId, PageVisibility.Group));
        dbContext.Sections.Add(new Section
        {
            Id = sectionId,
            PageId = pageId,
            Order = 1,
            Type = SectionType.LandingHero,
            ContentJson = "{}",
            StyleJson = "{}"
        });
        await dbContext.SaveChangesAsync();

        groupAuthorizationService
            .IsLeaderOrCoLeaderAsync(groupId, currentMemberId, Arg.Any<CancellationToken>())
            .Returns(true);

        var handler = new DeleteSectionCommandHandler(
            dbContext,
            groupAuthorizationService,
            pageCacheInvalidationService);

        var result = await handler.Handle(new DeleteSectionCommand(sectionId, currentMemberId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var section = await dbContext.Sections
            .IgnoreQueryFilters()
            .SingleAsync(x => x.Id == sectionId);
        Assert.True(section.IsDeleted);
    }

    private static Page CreateGroupPage(Guid pageId, Guid groupId, Guid authorId, PageVisibility visibility)
        => new()
        {
            Id = pageId,
            OwnerGroupId = groupId,
            CreatedByMemberId = authorId,
            TitleJson = "{\"en\":\"Group page\",\"zh\":\"Group page\"}",
            Visibility = visibility,
            UpdatedUtc = DateTime.UtcNow
        };
}
