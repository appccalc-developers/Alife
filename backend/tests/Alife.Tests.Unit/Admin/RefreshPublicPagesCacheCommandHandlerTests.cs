using Alife.Application.Admin;
using Alife.Application.Admin.Commands.RefreshPublicPagesCache;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Admin;

public sealed class RefreshPublicPagesCacheCommandHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsForbidden_WhenMemberCannotReviewPages()
    {
        await using var dbContext = CreateDbContext();
        var pageCache = Substitute.For<IPageCacheInvalidationService>();
        var handler = new RefreshPublicPagesCacheCommandHandler(dbContext, pageCache);

        var result = await handler.Handle(
            new RefreshPublicPagesCacheCommand(Guid.NewGuid()),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        await pageCache.DidNotReceive().RemovePublicAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_InvalidatesPublicPages_WhenMemberCanReviewPages()
    {
        await using var dbContext = CreateDbContext();
        var reviewerId = Guid.NewGuid();
        await SeedPageReviewerAsync(dbContext, reviewerId);
        var pageCache = Substitute.For<IPageCacheInvalidationService>();
        var handler = new RefreshPublicPagesCacheCommandHandler(dbContext, pageCache);

        var result = await handler.Handle(
            new RefreshPublicPagesCacheCommand(reviewerId),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value?.Ok);
        await pageCache.Received(1).RemovePublicAsync(Arg.Any<CancellationToken>());
    }

    private static async Task SeedPageReviewerAsync(AlifeDbContext dbContext, Guid reviewerId)
    {
        dbContext.Members.Add(new Member
        {
            Id = reviewerId,
            DisplayName = "Website builder",
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        dbContext.PlatformRoles.Add(new PlatformRole
        {
            Id = (int)PlatformRoleId.PageReviewer,
            Code = "page_reviewer",
            NameJson = "{}",
            PermissionsJson = AdminPermissionCatalog.WritePermissions(
                AdminPermissionCatalog.GetDefaultPermissions("page_reviewer")),
            Level = (int)PlatformRoleId.PageReviewer
        });
        dbContext.MemberPlatformRoles.Add(new MemberPlatformRole
        {
            Id = Guid.NewGuid(),
            MemberId = reviewerId,
            RoleId = (int)PlatformRoleId.PageReviewer,
            AssignedByMemberId = reviewerId,
            AssignedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
    }

    private static AlifeDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AlifeDbContext(options);
    }
}
