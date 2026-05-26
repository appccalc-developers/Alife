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
            Type = SectionType.Hero,
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
            Type = SectionType.Hero,
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
            Scope = PageScope.Group,
            OwnerGroupId = groupId,
            CreatedByMemberId = authorId,
            TitleJson = "{\"en\":\"Group page\",\"cn\":\"Group page\"}",
            Visibility = visibility,
            UpdatedUtc = DateTime.UtcNow
        };
}
