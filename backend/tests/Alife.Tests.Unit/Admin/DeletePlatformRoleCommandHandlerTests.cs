using Alife.Application.Admin;
using Alife.Application.Admin.Commands.DeletePlatformRole;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Alife.Tests.Unit.Admin;

public class DeletePlatformRoleCommandHandlerTests
{
    [Fact]
    public async Task Handle_ForbidsDeletingPageReviewerRole()
    {
        using var dbContext = CreateDbContext();
        var actorId = Guid.NewGuid();
        dbContext.PlatformRoles.AddRange(
            Role((int)PlatformRoleId.PageReviewer, "page_reviewer", (int)PlatformRoleId.PageReviewer),
            Role((int)PlatformRoleId.SuperAdmin, "superadmin", (int)PlatformRoleId.SuperAdmin));
        dbContext.Members.Add(new Member
        {
            Id = actorId,
            DisplayName = "System Admin",
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        dbContext.MemberPlatformRoles.Add(new MemberPlatformRole
        {
            Id = Guid.NewGuid(),
            MemberId = actorId,
            RoleId = (int)PlatformRoleId.SuperAdmin,
            AssignedByMemberId = actorId,
            AssignedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var handler = new DeletePlatformRoleCommandHandler(dbContext);

        var result = await handler.Handle(
            new DeletePlatformRoleCommand(actorId, (int)PlatformRoleId.PageReviewer),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal("Built-in platform roles cannot be deleted.", result.Message);
        Assert.True(await dbContext.PlatformRoles.AnyAsync(x => x.Code == "page_reviewer"));
    }

    private static PlatformRole Role(int id, string code, int level)
        => new()
        {
            Id = id,
            Code = code,
            Level = level,
            NameJson = "{}",
            PermissionsJson = AdminPermissionCatalog.WritePermissions(AdminPermissionCatalog.GetDefaultPermissions(code))
        };

    private static AlifeDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
