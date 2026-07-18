using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Tests.Unit.Pages;

public sealed class NzalcAboutPagesSeedTests
{
    [Fact]
    public async Task EnsureSeededAsync_CreatesSixApprovedPublicPagesInOneFlatAboutMenu()
    {
        await using var dbContext = CreateDbContext();
        var church = CreateChurch();
        var creator = CreateCreator();
        dbContext.Groups.Add(church);
        dbContext.Members.Add(creator);
        await dbContext.SaveChangesAsync();

        var insertedSections = await NzalcAboutPagesSeed.EnsureSeededAsync(
            dbContext,
            church.Id,
            creator.Id,
            DateTime.UtcNow);
        await dbContext.SaveChangesAsync();

        Assert.Equal(12, insertedSections);
        var pages = await dbContext.Pages
            .Include(page => page.Sections)
            .OrderBy(page => page.Id)
            .ToListAsync();
        Assert.Equal(6, pages.Count);
        Assert.All(pages, page =>
        {
            Assert.Equal(church.Id, page.OwnerGroupId);
            Assert.Equal(creator.Id, page.CreatedByMemberId);
            Assert.Equal(PageVisibility.Public, page.Visibility);
            Assert.Equal(2, page.Sections.Count);
            Assert.Contains(page.Sections, section => section.Order == 1 && section.Type == SectionType.LandingHero);
            Assert.Contains(page.Sections, section => section.Order == 2 && section.Type == SectionType.RichText);

            var title = JsonSerializer.Deserialize<Dictionary<string, string>>(page.TitleJson);
            Assert.False(string.IsNullOrWhiteSpace(title?["en"]));
            Assert.False(string.IsNullOrWhiteSpace(title?["zh"]));

            var richText = page.Sections.Single(section => section.Type == SectionType.RichText);
            using var content = JsonDocument.Parse(richText.ContentJson);
            var text = content.RootElement.GetProperty("text");
            Assert.Contains("<", text.GetProperty("en").GetString());
            Assert.Contains("<", text.GetProperty("zh").GetString());
        });

        var menu = Assert.Single(await dbContext.PagePrimaryMenus.ToListAsync());
        var menuName = JsonSerializer.Deserialize<Dictionary<string, string>>(menu.NameJson);
        Assert.Equal("About Us", menuName?["en"]);
        Assert.Equal("关于我们", menuName?["zh"]);

        var reviews = await dbContext.PagePublicationReviews
            .OrderBy(review => review.MenuSortOrder)
            .ToListAsync();
        Assert.Equal(6, reviews.Count);
        Assert.Equal(Enumerable.Range(0, 6), reviews.Select(review => review.MenuSortOrder));
        Assert.Equal(
            ["教牧团队", "教会介绍", "教会理念", "教会异象", "我们的信仰", "教会目标"],
            reviews.Select(review =>
                JsonSerializer.Deserialize<Dictionary<string, string>>(review.AccessNameJson!)!["zh"]));
        Assert.All(reviews, review =>
        {
            Assert.Equal(PagePublicationReviewStatus.Approved, review.Status);
            Assert.Equal(menu.Id, review.PrimaryMenuId);
            Assert.Equal(creator.Id, review.ReviewedByMemberId);
            Assert.StartsWith("https://pages.nzalc.org/images/", review.CardImageUrl);
        });
    }

    [Fact]
    public async Task EnsureSeededAsync_DoesNotDuplicateOrOverwriteImportedPages()
    {
        await using var dbContext = CreateDbContext();
        var church = CreateChurch();
        var creator = CreateCreator();
        dbContext.Groups.Add(church);
        dbContext.Members.Add(creator);
        await dbContext.SaveChangesAsync();

        await NzalcAboutPagesSeed.EnsureSeededAsync(
            dbContext,
            church.Id,
            creator.Id,
            DateTime.UtcNow);
        await dbContext.SaveChangesAsync();

        var editedPage = await dbContext.Pages.FirstAsync();
        editedPage.TitleJson = """{"en":"Edited by a leader","zh":"组长已修改"}""";
        await dbContext.SaveChangesAsync();

        var insertedSections = await NzalcAboutPagesSeed.EnsureSeededAsync(
            dbContext,
            church.Id,
            creator.Id,
            DateTime.UtcNow.AddDays(1));
        await dbContext.SaveChangesAsync();

        Assert.Equal(0, insertedSections);
        Assert.Equal(6, await dbContext.Pages.CountAsync());
        Assert.Equal(12, await dbContext.Sections.CountAsync());
        Assert.Equal(6, await dbContext.PagePublicationReviews.CountAsync());
        Assert.Equal("""{"en":"Edited by a leader","zh":"组长已修改"}""", editedPage.TitleJson);
    }

    [Fact]
    public async Task EnsureSeededAsync_ReusesAndNormalizesAnExistingTraditionalChineseAboutMenu()
    {
        await using var dbContext = CreateDbContext();
        var church = CreateChurch();
        var creator = CreateCreator();
        dbContext.Groups.Add(church);
        dbContext.Members.Add(creator);
        dbContext.PagePrimaryMenus.Add(new PagePrimaryMenu
        {
            Id = Guid.NewGuid(),
            NameJson = """{"en":"About Us","zh":"關於我們"}""",
            SortOrder = 3,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        await NzalcAboutPagesSeed.EnsureSeededAsync(
            dbContext,
            church.Id,
            creator.Id,
            DateTime.UtcNow);
        await dbContext.SaveChangesAsync();

        var menu = Assert.Single(await dbContext.PagePrimaryMenus.ToListAsync());
        var name = JsonSerializer.Deserialize<Dictionary<string, string>>(menu.NameJson);
        Assert.Equal("About Us", name?["en"]);
        Assert.Equal("关于我们", name?["zh"]);
        Assert.Equal(6, await dbContext.PagePublicationReviews.CountAsync(
            review => review.PrimaryMenuId == menu.Id));
    }

    private static AlifeDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AlifeDbContext(options);
    }

    private static Group CreateChurch()
        => new()
        {
            Id = Guid.NewGuid(),
            NameJson = """{"en":"Abundant Life Church","zh":"丰盛生命教会"}""",
            IsChurch = true,
            AccessType = AccessType.Protected,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };

    private static Member CreateCreator()
        => new()
        {
            Id = Guid.NewGuid(),
            DisplayName = "Content migration administrator",
            PhoneE164 = "+640000009999",
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };
}
