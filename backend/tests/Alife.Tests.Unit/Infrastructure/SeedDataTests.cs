using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Alife.Tests.Unit.Infrastructure;

public sealed class SeedDataTests
{
    [Fact]
    public async Task DisabledDemoMembers_AreNotRecreatedAfterCleanup()
    {
        await using var db = new AlifeDbContext(new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N")).Options);
        await SeedData.EnsureSeededAsync(db);
        var ids = Enumerable.Range(10, 10)
            .Select(x => Guid.Parse($"eeeeeeee-eeee-eeee-eeee-eeeeeeeeee{x}")).ToArray();
        Assert.Equal(10, await db.Members.CountAsync(x => ids.Contains(x.Id)));
        db.GroupMemberships.RemoveRange(db.GroupMemberships.Where(x => ids.Contains(x.MemberId)));
        db.Members.RemoveRange(db.Members.Where(x => ids.Contains(x.Id)));
        await db.SaveChangesAsync();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Seed:IncludeDemoMembers"] = "false"
        }).Build();
        await SeedData.EnsureSeededAsync(db, config);
        Assert.False(await db.Members.AnyAsync(x => ids.Contains(x.Id)));
        Assert.True(await db.Members.AnyAsync(x => x.DisplayName == "Demo Leader"));
    }

    [Fact]
    public async Task EnsureSeededAsync_DoesNotCreateEventInstances()
    {
        await using var dbContext = new AlifeDbContext(
            new DbContextOptionsBuilder<AlifeDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
                .Options);

        await SeedData.EnsureSeededAsync(dbContext);
        await SeedData.EnsureSeededAsync(dbContext);

        Assert.Empty(await dbContext.GroupEvents.ToListAsync());
        Assert.False(await dbContext.NotificationMessages.AnyAsync(x => x.EventId != null));
        Assert.True(await dbContext.Groups.AnyAsync());
        Assert.True(await dbContext.Pages.AnyAsync());
    }

    [Fact]
    public async Task EnsureSeededAsync_DoesNotModifyAnExistingEvent()
    {
        await using var dbContext = new AlifeDbContext(
            new DbContextOptionsBuilder<AlifeDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
                .Options);
        await SeedData.EnsureSeededAsync(dbContext);
        var group = await dbContext.Groups.FirstAsync();
        var owner = await dbContext.Members.FirstAsync();
        var existing = new Alife.Domain.Entities.GroupEvent
        {
            Id = Guid.NewGuid(), GroupId = group.Id, CreatedByMemberId = owner.Id,
            AccountableOwnerMemberId = owner.Id, TitleEn = "Fixture", TitleZh = "测试",
            StartDate = DateTime.UtcNow.AddDays(1), EndDate = DateTime.UtcNow.AddDays(1).AddHours(1),
            EventDataJson = "{\"visibility\":\"groupVisible\"}", CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };
        dbContext.GroupEvents.Add(existing);
        await dbContext.SaveChangesAsync();
        dbContext.ChangeTracker.Clear();

        await SeedData.EnsureSeededAsync(dbContext);

        Assert.Equal("Fixture", (await dbContext.GroupEvents.SingleAsync()).TitleEn);
    }
}
