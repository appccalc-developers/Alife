using Alife.Application.Admin;
using Alife.Application.Admin.Commands.SetMemberPlatformRole;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Alife.Tests.Unit.Admin;

public class SetMemberPlatformRoleCommandHandlerTests
{
    [Fact]
    public async Task Handle_AllowsSuperAdminToAssignAdminRole()
    {
        using var dbContext = CreateDbContext();
        var actorId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        await SeedRolesAsync(dbContext);
        await SeedMemberAsync(dbContext, actorId, "superadmin");
        await SeedMemberAsync(dbContext, targetId);
        var handler = new SetMemberPlatformRoleCommandHandler(dbContext);

        var result = await handler.Handle(
            new SetMemberPlatformRoleCommand(actorId, targetId, ["admin"]),
            CancellationToken.None);

        Assert.True(result.IsSuccess, result.Message);
        Assert.Contains("admin", result.Value!.PlatformRoles);
    }

    [Fact]
    public async Task Handle_AllowsAdminToAssignCustomRole()
    {
        using var dbContext = CreateDbContext();
        var actorId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        await SeedRolesAsync(dbContext);
        await SeedMemberAsync(dbContext, actorId, "admin");
        await SeedMemberAsync(dbContext, targetId);
        var handler = new SetMemberPlatformRoleCommandHandler(dbContext);

        var result = await handler.Handle(
            new SetMemberPlatformRoleCommand(actorId, targetId, ["volunteer"]),
            CancellationToken.None);

        Assert.True(result.IsSuccess, result.Message);
        Assert.Contains("volunteer", result.Value!.PlatformRoles);
    }

    [Fact]
    public async Task Handle_ForbidsAdminFromAssigningAdminRole()
    {
        using var dbContext = CreateDbContext();
        var actorId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        await SeedRolesAsync(dbContext);
        await SeedMemberAsync(dbContext, actorId, "admin");
        await SeedMemberAsync(dbContext, targetId);
        var handler = new SetMemberPlatformRoleCommandHandler(dbContext);

        var result = await handler.Handle(
            new SetMemberPlatformRoleCommand(actorId, targetId, ["admin"]),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal("Only system admins can assign or remove Admin roles.", result.Message);
    }

    [Fact]
    public async Task Handle_ReactivatesPreviouslyRevokedRole()
    {
        using var dbContext = CreateDbContext();
        var actorId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        await SeedRolesAsync(dbContext);
        await SeedMemberAsync(dbContext, actorId, "superadmin");
        await SeedMemberAsync(dbContext, targetId);
        dbContext.MemberPlatformRoles.Add(new MemberPlatformRole
        {
            Id = Guid.NewGuid(),
            MemberId = targetId,
            RoleId = 20,
            AssignedByMemberId = actorId,
            AssignedUtc = DateTime.UtcNow.AddDays(-2),
            RevokedUtc = DateTime.UtcNow.AddDays(-1)
        });
        await dbContext.SaveChangesAsync();
        var handler = new SetMemberPlatformRoleCommandHandler(dbContext);

        var result = await handler.Handle(
            new SetMemberPlatformRoleCommand(actorId, targetId, ["volunteer"]),
            CancellationToken.None);

        Assert.True(result.IsSuccess, result.Message);
        Assert.Contains("volunteer", result.Value!.PlatformRoles);
        Assert.Equal(1, dbContext.MemberPlatformRoles.Count(role =>
            role.MemberId == targetId &&
            role.RoleId == 20 &&
            role.RevokedUtc == null));
    }

    private static async Task SeedRolesAsync(AlifeDbContext dbContext)
    {
        dbContext.PlatformRoles.AddRange(
            Role(0, "user", 0),
            Role((int)PlatformRoleId.Admin, "admin", (int)PlatformRoleId.Admin),
            Role((int)PlatformRoleId.SuperAdmin, "superadmin", (int)PlatformRoleId.SuperAdmin),
            Role(20, "volunteer", 20));
        await dbContext.SaveChangesAsync();
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

    private static async Task SeedMemberAsync(AlifeDbContext dbContext, Guid memberId, string? roleCode = null)
    {
        dbContext.Members.Add(new Member
        {
            Id = memberId,
            DisplayName = memberId.ToString("N"),
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });

        if (!string.IsNullOrWhiteSpace(roleCode))
        {
            var role = await dbContext.PlatformRoles.FirstAsync(x => x.Code == roleCode);
            dbContext.MemberPlatformRoles.Add(new MemberPlatformRole
            {
                Id = Guid.NewGuid(),
                MemberId = memberId,
                RoleId = role.Id,
                AssignedByMemberId = memberId,
                AssignedUtc = DateTime.UtcNow
            });
        }

        await dbContext.SaveChangesAsync();
    }

    private static AlifeDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
