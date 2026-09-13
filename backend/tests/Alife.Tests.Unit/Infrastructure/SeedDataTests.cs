using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Alife.Tests.Unit.Infrastructure;

public sealed class SeedDataTests
{
    private static readonly Guid PicnicId = Guid.Parse("ffffffff-ffff-ffff-ffff-fffffffffff1");
    private static readonly Guid TrainingId = Guid.Parse("ffffffff-ffff-ffff-ffff-fffffffffff2");

    [Fact]
    public async Task EnsureSeededAsync_CreatesOnlyThePicnicFixtureAndIsIdempotent()
    {
        await using var dbContext = new AlifeDbContext(
            new DbContextOptionsBuilder<AlifeDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
                .Options);

        await SeedData.EnsureSeededAsync(dbContext);
        await SeedData.EnsureSeededAsync(dbContext);

        var picnic = await dbContext.GroupEvents.SingleAsync(x => x.Id == PicnicId);
        Assert.NotEqual(Guid.Empty, picnic.AccountableOwnerMemberId);
        Assert.Equal(picnic.CreatedByMemberId, picnic.AccountableOwnerMemberId);
        Assert.True(await dbContext.Members.AnyAsync(x => x.Id == picnic.AccountableOwnerMemberId));
        Assert.Equal("Community Picnic", picnic.TitleEn);
        Assert.Equal("社区野餐", picnic.TitleZh);
        Assert.False(await dbContext.GroupEvents.AnyAsync(x => x.Id == TrainingId));

        var enrollment = await dbContext.EventEnrollments.SingleAsync(x => x.EventId == PicnicId);
        Assert.Equal(Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3"), enrollment.MemberId);

        var invitation = await dbContext.NotificationMessages.SingleAsync(x => x.EventId == PicnicId);
        Assert.Equal("event.invitation", invitation.ActionType);
        Assert.False(await dbContext.NotificationMessages.AnyAsync(x => x.ActionType == "group.join.requested"));
    }

    [Fact]
    public async Task EnsureSeededAsync_PreservesAnExistingFixtureOwner()
    {
        await using var dbContext = new AlifeDbContext(
            new DbContextOptionsBuilder<AlifeDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
                .Options);
        await SeedData.EnsureSeededAsync(dbContext);
        var picnic = await dbContext.GroupEvents.SingleAsync(x => x.Id == PicnicId);
        var existingOwner = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3");
        Assert.True(await dbContext.Members.AnyAsync(x => x.Id == existingOwner));
        picnic.AccountableOwnerMemberId = existingOwner;
        await dbContext.SaveChangesAsync();
        dbContext.ChangeTracker.Clear();

        await SeedData.EnsureSeededAsync(dbContext);

        Assert.Equal(existingOwner, (await dbContext.GroupEvents.SingleAsync(x => x.Id == PicnicId)).AccountableOwnerMemberId);
    }
}
