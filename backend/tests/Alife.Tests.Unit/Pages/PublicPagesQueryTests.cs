using Alife.Application.Pages.Services;
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
        var primaryMenu = CreatePrimaryMenu("Ministries", 0);
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
        dbContext.PagePrimaryMenus.Add(primaryMenu);
        dbContext.PagePublicationReviews.Add(CreateApprovedReview(approvedSubgroupPage.Id, primaryMenu: primaryMenu));
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
        var primaryMenu = CreatePrimaryMenu("Ministries", 0);
        dbContext.Pages.AddRange(approvedGroupPage, unapprovedGroupPage);
        dbContext.PagePrimaryMenus.Add(primaryMenu);
        dbContext.PagePublicationReviews.Add(CreateApprovedReview(approvedGroupPage.Id, "Approved menu", primaryMenu));
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
    public async Task GetPublicPages_ExcludesApprovedPagesWithoutPrimaryMenuConfiguration()
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

        var configuredPage = CreatePage(authorId, groupId, PageVisibility.Public, "Configured");
        var orphanedPage = CreatePage(authorId, groupId, PageVisibility.Public, "Orphaned");
        var primaryMenu = CreatePrimaryMenu("Ministries", 0);
        dbContext.Pages.AddRange(configuredPage, orphanedPage);
        dbContext.PagePrimaryMenus.Add(primaryMenu);
        dbContext.PagePublicationReviews.AddRange(
            CreateApprovedReview(configuredPage.Id, primaryMenu: primaryMenu),
            CreateApprovedReview(orphanedPage.Id));
        await dbContext.SaveChangesAsync();

        var service = new PageReadService(dbContext, services.GetRequiredService<HybridCache>());

        var result = await service.GetPublicPagesAsync(CancellationToken.None);

        Assert.Single(result);
        Assert.Equal(configuredPage.Id, result[0].Id);
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
        var firstMenu = CreatePrimaryMenu("First", 0, "第一", PagePrimaryMenuHomePlacement.ChurchOrganization);
        var secondMenu = CreatePrimaryMenu("Second", 1, "第二");
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
        Assert.Equal(PagePrimaryMenuHomePlacement.ChurchOrganization, result[0].PrimaryMenuHomePlacement);
    }

    [Fact]
    public async Task PublishedPage_RemainsVisibleWithApprovedSnapshotWhileEditedCopyIsPending()
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

        var page = CreatePage(authorId, groupId, PageVisibility.Public, "Published title");
        page.UpdatedUtc = now.AddHours(-1);
        var publishedSection = new Section
        {
            Id = Guid.NewGuid(),
            PageId = page.Id,
            Order = 1,
            Type = SectionType.RichText,
            ContentJson = "{\"body\":{\"en\":\"Published body\",\"zh\":\"已发布内容\"}}",
            StyleJson = "{}"
        };
        var publishedSnapshot = PagePublicationSnapshots.Capture(page, [publishedSection], now.AddHours(-1));

        page.TitleJson = "{\"en\":\"Edited title\",\"zh\":\"编辑中的标题\"}";
        page.UpdatedUtc = now;
        var menu = CreatePrimaryMenu("Ministries", 0);
        dbContext.Pages.Add(page);
        dbContext.Sections.Add(publishedSection);
        dbContext.PagePrimaryMenus.Add(menu);
        dbContext.PagePublicationReviews.Add(new PagePublicationReview
        {
            Id = Guid.NewGuid(),
            PageId = page.Id,
            Status = PagePublicationReviewStatus.Pending,
            PrimaryMenuId = menu.Id,
            PrimaryMenuNameJson = menu.NameJson,
            AccessNameJson = "{\"en\":\"Published menu\",\"zh\":\"已发布菜单\"}",
            PublishedSnapshotJson = publishedSnapshot,
            PublishedByMemberId = authorId,
            PublishedUtc = now.AddHours(-1),
            SubmittedSnapshotJson = PagePublicationSnapshots.Capture(page, [publishedSection], now),
            SubmittedByMemberId = authorId,
            SubmittedUtc = now,
            CreatedUtc = now.AddHours(-1),
            UpdatedUtc = now
        });
        await dbContext.SaveChangesAsync();
        var service = new PageReadService(dbContext, services.GetRequiredService<HybridCache>());

        var publicPages = await service.GetPublicPagesAsync(CancellationToken.None);
        var publicDetail = await service.GetPublishedByIdAsync(page.Id, CancellationToken.None);

        var publicPage = Assert.Single(publicPages);
        Assert.Equal("Published title", publicPage.Title["en"]);
        Assert.NotNull(publicDetail);
        Assert.Equal("Published title", publicDetail.Title["en"]);
        Assert.Contains("Published body", Assert.Single(publicDetail.Sections).ContentJson);
    }

    [Fact]
    public async Task PublishedPage_WithInvalidSnapshot_FailsClosedWithoutExposingWorkingCopy()
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

        var page = CreatePage(authorId, groupId, PageVisibility.Public, "Unreviewed working title");
        var menu = CreatePrimaryMenu("Ministries", 0);
        dbContext.Pages.Add(page);
        dbContext.Sections.Add(new Section
        {
            Id = Guid.NewGuid(),
            PageId = page.Id,
            Order = 1,
            Type = SectionType.RichText,
            ContentJson = "{\"body\":{\"en\":\"Unreviewed working body\"}}",
            StyleJson = "{}"
        });
        dbContext.PagePrimaryMenus.Add(menu);
        dbContext.PagePublicationReviews.Add(new PagePublicationReview
        {
            Id = Guid.NewGuid(),
            PageId = page.Id,
            Status = PagePublicationReviewStatus.Pending,
            PrimaryMenuId = menu.Id,
            PrimaryMenuNameJson = menu.NameJson,
            PublishedSnapshotJson = "{\"version\":999}",
            SubmittedSnapshotJson = PagePublicationSnapshots.Capture(page, [], now),
            SubmittedByMemberId = authorId,
            SubmittedUtc = now,
            CreatedUtc = now,
            UpdatedUtc = now
        });
        await dbContext.SaveChangesAsync();
        var service = new PageReadService(dbContext, services.GetRequiredService<HybridCache>());

        var publicPages = await service.GetPublicPagesAsync(CancellationToken.None);
        var publicDetail = await service.GetPublishedByIdAsync(page.Id, CancellationToken.None);

        Assert.Empty(publicPages);
        Assert.Null(publicDetail);
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

    private static PagePrimaryMenu CreatePrimaryMenu(
        string nameEn,
        int sortOrder,
        string nameZh = "事工",
        PagePrimaryMenuHomePlacement? homePlacement = null)
        => new()
        {
            Id = Guid.NewGuid(),
            NameJson = $$"""{"en":"{{nameEn}}","zh":"{{nameZh}}"}""",
            SortOrder = sortOrder,
            HomePlacement = homePlacement,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };

    private static PagePublicationReview CreateApprovedReview(
        Guid pageId,
        string accessName = "Menu",
        PagePrimaryMenu? primaryMenu = null)
        => new()
        {
            Id = Guid.NewGuid(),
            PageId = pageId,
            Status = PagePublicationReviewStatus.Approved,
            PrimaryMenuId = primaryMenu?.Id,
            PrimaryMenu = primaryMenu,
            PrimaryMenuNameJson = primaryMenu?.NameJson ?? """{"en":"Ministries","zh":"事工"}""",
            AccessNameJson = $$"""{"en":"{{accessName}}","zh":"{{accessName}}"}""",
            CardImageUrl = "https://example.test/ministry.jpg",
            CardTextJson = """{"en":"Approved ministry card","zh":"已批准事工卡片"}""",
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };
}
