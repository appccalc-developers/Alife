using Alife.Application.Admin;
using Alife.Application.Admin.Queries.ListPlatformRoles;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Alife.Tests.Unit.Admin;

public class ListPlatformRolesQueryHandlerTests
{
    [Fact]
    public async Task Handle_CountsRegisteredMembersAsAssignedToUserRole()
    {
        using var dbContext = CreateDbContext();
        var actorId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var guestId = Guid.NewGuid();
        var adminId = Guid.NewGuid();

        dbContext.PlatformRoles.AddRange(
            Role((int)PlatformRoleId.User, "user", (int)PlatformRoleId.User),
            Role((int)PlatformRoleId.Admin, "admin", (int)PlatformRoleId.Admin),
            Role((int)PlatformRoleId.SuperAdmin, "superadmin", (int)PlatformRoleId.SuperAdmin));
        dbContext.Members.AddRange(
            Member(actorId, isRegistered: true),
            Member(memberId, isRegistered: true),
            Member(guestId, isRegistered: false),
            Member(adminId, isRegistered: true));
        dbContext.MemberPlatformRoles.AddRange(
            MemberRole(actorId, (int)PlatformRoleId.SuperAdmin),
            MemberRole(adminId, (int)PlatformRoleId.Admin));
        await dbContext.SaveChangesAsync();
        var handler = new ListPlatformRolesQueryHandler(dbContext);

        var result = await handler.Handle(new ListPlatformRolesQuery(actorId), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Message);
        var userRole = Assert.Single(result.Value!, role => role.Code == "user");
        var adminRole = Assert.Single(result.Value!, role => role.Code == "admin");
        Assert.Equal(3, userRole.AssignedMemberCount);
        Assert.Equal(1, adminRole.AssignedMemberCount);
    }

    private static PlatformRole Role(int id, string code, int level)
        => new()
        {
            Id = id,
            Code = code,
            Level = level,
            NameJson = $$"""{"en":"{{code}}","zh":"{{code}}"}""",
            PermissionsJson = AdminPermissionCatalog.WritePermissions(AdminPermissionCatalog.GetDefaultPermissions(code))
        };

    private static Member Member(Guid id, bool isRegistered)
        => new()
        {
            Id = id,
            DisplayName = id.ToString("N"),
            IsRegistered = isRegistered,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };

    private static MemberPlatformRole MemberRole(Guid memberId, int roleId)
        => new()
        {
            Id = Guid.NewGuid(),
            MemberId = memberId,
            RoleId = roleId,
            AssignedByMemberId = memberId,
            AssignedUtc = DateTime.UtcNow
        };

    private static AlifeDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
