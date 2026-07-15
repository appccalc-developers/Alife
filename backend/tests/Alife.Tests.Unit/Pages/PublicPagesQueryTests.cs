using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Alife.Infrastructure.ReadServices;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Alife.Tests.Unit.Pages;

public class PublicPagesQueryTests
{
    [Fact]
    public async Task GetPublicPages_ReturnsOnlyAnonymousReadableCmsPages()
    {
        using var dbContext = CreateInMemoryDbContext();
        using var services = CreateServiceProvider();
        var authorId = Guid.NewGuid();
        var churchGroupId = Guid.NewGuid();
        var subgroupId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var church = CreateGroup(churchGroupId, isChurch: true, parentGroupId: null);
        var subgroup = CreateGroup(subgroupId, isChurch: false, parentGroupId: churchGroupId);

        dbContext.Members.Add(new Member
        {
            Id = authorId,
            DisplayName = "Author",
            IsRegistered = true,
            CreatedUtc = now,
            UpdatedUtc = now
        });
        dbContext.Groups.AddRange(church, subgroup);

        var draftChurchPage = CreatePage(authorId, churchGroupId, PageVisibility.Draft, "Church Draft");
        var publicChurchPage = CreatePage(authorId, churchGroupId, PageVisibility.Public, "Church Public");
        var groupVisibleChurchPage = CreatePage(authorId, churchGroupId, PageVisibility.Group, "Church Group");
        var publicSubgroupPage = CreatePage(authorId, subgroupId, PageVisibility.Public, "Subgroup Public");
        var approvedSubgroupPage = CreatePage(authorId, subgroupId, PageVisibility.Public, "Subgroup Approved");
        publicChurchPage.OwnerGroup = church;
        groupVisibleChurchPage.OwnerGroup = church;
        publicSubgroupPage.OwnerGroup = subgroup;
        approvedSubgroupPage.OwnerGroup = subgroup;
        dbContext.Pages.AddRange(
            draftChurchPage,
            publicChurchPage,
            groupVisibleChurchPage,
            publicSubgroupPage,
            approvedSubgroupPage);
        dbContext.PagePublicationReviews.Add(CreateApprovedReview(approvedSubgroupPage.Id));
        await dbContext.SaveChangesAsync();

        var service = new PageReadService(dbContext, services.GetRequiredService<HybridCache>());

        var result = await service.GetPublicPagesAsync(CancellationToken.None);

        Assert.Single(result);
        Assert.Contains(result, page => page.Id == approvedSubgroupPage.Id);
        Assert.DoesNotContain(result, page => page.Id == draftChurchPage.Id);
        Assert.DoesNotContain(result, page => page.Id == publicChurchPage.Id);
        Assert.DoesNotContain(result, page => page.Id == groupVisibleChurchPage.Id);
        Assert.DoesNotContain(result, page => page.Id == publicSubgroupPage.Id);
    }

    [Fact]
    public async Task GetPublicPages_ReturnsApprovedPagesWithAccessName()
    {
        using var dbContext = CreateInMemoryDbContext();
        using var services = CreateServiceProvider();
        var authorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        dbContext.Members.Add(new Member
        {
            Id = authorId,
            DisplayName = "Author",
            IsRegistered = true,
            CreatedUtc = now,
            UpdatedUtc = now
        });
        dbContext.Groups.Add(CreateGroup(groupId, isChurch: false, parentGroupId: null));

        var approvedGroupPage = CreatePage(authorId, groupId, PageVisibility.Public, "Approved Group Public");
        var unapprovedGroupPage = CreatePage(authorId, groupId, PageVisibility.Public, "Unapproved Group Public");
        dbContext.Pages.AddRange(approvedGroupPage, unapprovedGroupPage);
        dbContext.PagePublicationReviews.Add(CreateApprovedReview(approvedGroupPage.Id, "Approved menu"));
        await dbContext.SaveChangesAsync();

        var service = new PageReadService(dbContext, services.GetRequiredService<HybridCache>());

        var result = await service.GetPublicPagesAsync(CancellationToken.None);

        Assert.Single(result);
        Assert.Contains(result, page =>
            page.Id == approvedGroupPage.Id &&
            page.OwnerGroupId == groupId &&
            page.PrimaryMenuName != null &&
            page.PrimaryMenuName["en"] == "Ministries" &&
            page.AccessName != null &&
            page.AccessName["en"] == "Approved menu" &&
            page.CardImageUrl == "https://example.test/ministry.jpg" &&
            page.CardText != null &&
            page.CardText["en"] == "Approved ministry card");
        Assert.DoesNotContain(result, page => page.Id == unapprovedGroupPage.Id);
    }

    [Fact]
    public async Task GetPublicPages_UsesConfiguredPrimaryAndSecondaryMenuOrder()
    {
        using var dbContext = CreateInMemoryDbContext();
        using var services = CreateServiceProvider();
        var authorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        dbContext.Members.Add(new Member { Id = authorId, DisplayName = "Author", IsRegistered = true, CreatedUtc = now, UpdatedUtc = now });
        dbContext.Groups.Add(CreateGroup(groupId, isChurch: false, parentGroupId: null));
        var firstPage = CreatePage(authorId, groupId, PageVisibility.Public, "First");
        var secondPage = CreatePage(authorId, groupId, PageVisibility.Public, "Second");
        var thirdPage = CreatePage(authorId, groupId, PageVisibility.Public, "Third");
        dbContext.Pages.AddRange(firstPage, secondPage, thirdPage);
        var firstMenu = new PagePrimaryMenu { Id = Guid.NewGuid(), NameJson = "{\"en\":\"First\",\"zh\":\"第一\"}", SortOrder = 0, CreatedUtc = now, UpdatedUtc = now };
        var secondMenu = new PagePrimaryMenu { Id = Guid.NewGuid(), NameJson = "{\"en\":\"Second\",\"zh\":\"第二\"}", SortOrder = 1, CreatedUtc = now, UpdatedUtc = now };
        dbContext.PagePrimaryMenus.AddRange(firstMenu, secondMenu);
        var firstReview = CreateApprovedReview(firstPage.Id, "First page");
        firstReview.PrimaryMenu = firstMenu;
        firstReview.PrimaryMenuId = firstMenu.Id;
        firstReview.MenuSortOrder = 1;
        var secondReview = CreateApprovedReview(secondPage.Id, "Second page");
        secondReview.PrimaryMenu = firstMenu;
        secondReview.PrimaryMenuId = firstMenu.Id;
        secondReview.MenuSortOrder = 0;
        var thirdReview = CreateApprovedReview(thirdPage.Id, "Third page");
        thirdReview.PrimaryMenu = secondMenu;
        thirdReview.PrimaryMenuId = secondMenu.Id;
        thirdReview.MenuSortOrder = 0;
        dbContext.PagePublicationReviews.AddRange(firstReview, secondReview, thirdReview);
        await dbContext.SaveChangesAsync();
        var service = new PageReadService(dbContext, services.GetRequiredService<HybridCache>());

        var result = await service.GetPublicPagesAsync(CancellationToken.None);

        Assert.Equal([secondPage.Id, firstPage.Id, thirdPage.Id], result.Select(page => page.Id));
        Assert.Equal(firstMenu.Id, result[0].PrimaryMenuId);
        Assert.Equal(0, result[0].PrimaryMenuSortOrder);
        Assert.Equal(0, result[0].MenuSortOrder);
    }

    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    private static ServiceProvider CreateServiceProvider()
    {
        var services = new ServiceCollection();
        services.AddHybridCache();
        return services.BuildServiceProvider();
    }

    private static Group CreateGroup(Guid groupId, bool isChurch, Guid? parentGroupId)
        => new()
        {
            Id = groupId,
            NameJson = "{\"en\":\"Group\",\"zh\":\"小组\"}",
            ParentGroupId = parentGroupId,
            AccessType = AccessType.Public,
            IsChurch = isChurch,
            IsClosed = false,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };

    private static Page CreatePage(
        Guid authorId,
        Guid ownerGroupId,
        PageVisibility visibility,
        string title)
        => new()
        {
            Id = Guid.NewGuid(),
            OwnerGroupId = ownerGroupId,
            CreatedByMemberId = authorId,
            TitleJson = $$"""{"en":"{{title}}","zh":"{{title}}"}""",
            DescriptionJson = null,
            TagsJson = "[]",
            TitleDisplayStyle = "Default",
            Visibility = visibility,
            UpdatedUtc = DateTime.UtcNow
        };

    private static PagePublicationReview CreateApprovedReview(Guid pageId, string accessName = "Menu")
        => new()
        {
            Id = Guid.NewGuid(),
            PageId = pageId,
            Status = PagePublicationReviewStatus.Approved,
            PrimaryMenuNameJson = """{"en":"Ministries","zh":"事工"}""",
            AccessNameJson = $$"""{"en":"{{accessName}}","zh":"{{accessName}}"}""",
            CardImageUrl = "https://example.test/ministry.jpg",
            CardTextJson = """{"en":"Approved ministry card","zh":"已批准事工卡片"}""",
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };
}
