using Alife.Application.Admin;
using Alife.Application.Admin.Commands.UpdateMemberProfile;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Admin;

public class UpdateMemberProfileCommandHandlerTests
{
    [Fact]
    public async Task Handle_UpdatesProfileAndClearsPhoneVerification_WhenAuthorized()
    {
        using var dbContext = CreateDbContext();
        var actorId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        await SeedActorAsync(dbContext, actorId, [AdminPermissionCatalog.ManageMemberProfiles]);
        dbContext.Members.Add(new Member
        {
            Id = targetId,
            DisplayName = "Old name",
            Email = "old@example.com",
            PhoneE164 = "+64210000000",
            PhoneVerifiedUtc = DateTime.UtcNow.AddDays(-2),
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow.AddDays(-5),
            UpdatedUtc = DateTime.UtcNow.AddDays(-2)
        });
        var groupId = Guid.NewGuid();
        dbContext.GroupMemberships.Add(new GroupMembership
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            MemberId = targetId,
            Role = MembershipRole.Member,
            Status = MembershipStatus.Approved,
            CreatedUtc = DateTime.UtcNow.AddDays(-4),
            UpdatedUtc = DateTime.UtcNow.AddDays(-4)
        });
        await dbContext.SaveChangesAsync();
        var cacheInvalidation = Substitute.For<IGroupCacheInvalidationService>();
        var handler = new UpdateMemberProfileCommandHandler(dbContext, cacheInvalidation);

        var result = await handler.Handle(
            new UpdateMemberProfileCommand(actorId, targetId, " New name ", "NEW@EXAMPLE.COM", "+64211111111"),
            CancellationToken.None);

        Assert.True(result.IsSuccess, result.Message);
        Assert.Equal("New name", result.Value!.DisplayName);
        Assert.Equal("new@example.com", result.Value.Email);
        Assert.Equal("+64211111111", result.Value.PhoneE164);
        Assert.Null((await dbContext.Members.FindAsync(targetId))!.PhoneVerifiedUtc);
        Assert.Contains(dbContext.AuditLogs, log =>
            log.Action == "member.profile.update" &&
            log.ActorMemberId == actorId &&
            log.TargetMemberId == targetId);
        await cacheInvalidation.Received(1).RemoveMembershipsAsync(groupId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ForbidsActorWithoutManagePermission()
    {
        using var dbContext = CreateDbContext();
        var actorId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        await SeedActorAsync(dbContext, actorId, [AdminPermissionCatalog.ViewMembers]);
        dbContext.Members.Add(MemberRecord(targetId));
        await dbContext.SaveChangesAsync();
        var handler = new UpdateMemberProfileCommandHandler(
            dbContext,
            Substitute.For<IGroupCacheInvalidationService>());

        var result = await handler.Handle(
            new UpdateMemberProfileCommand(actorId, targetId, "Changed", null, null),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal("You do not have permission to edit member profiles.", result.Message);
        Assert.Equal("Member", (await dbContext.Members.FindAsync(targetId))!.DisplayName);
    }

    [Fact]
    public async Task Handle_RejectsInvalidPhoneNumber()
    {
        using var dbContext = CreateDbContext();
        var actorId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        await SeedActorAsync(dbContext, actorId, [AdminPermissionCatalog.ManageMemberProfiles]);
        dbContext.Members.Add(MemberRecord(targetId));
        await dbContext.SaveChangesAsync();
        var handler = new UpdateMemberProfileCommandHandler(
            dbContext,
            Substitute.For<IGroupCacheInvalidationService>());

        var result = await handler.Handle(
            new UpdateMemberProfileCommand(actorId, targetId, "Member", null, "021 123 456"),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Contains("supported phone region", result.Message);
    }

    private static Member MemberRecord(Guid id) => new()
    {
        Id = id,
        DisplayName = "Member",
        IsRegistered = true,
        CreatedUtc = DateTime.UtcNow,
        UpdatedUtc = DateTime.UtcNow
    };

    private static async Task SeedActorAsync(AlifeDbContext dbContext, Guid actorId, IReadOnlyList<string> permissions)
    {
        var role = new PlatformRole
        {
            Id = 30,
            Code = "member_manager",
            Level = 30,
            NameJson = "{}",
            PermissionsJson = AdminPermissionCatalog.WritePermissions(permissions)
        };
        dbContext.PlatformRoles.Add(role);
        dbContext.Members.Add(MemberRecord(actorId));
        dbContext.MemberPlatformRoles.Add(new MemberPlatformRole
        {
            Id = Guid.NewGuid(),
            MemberId = actorId,
            RoleId = role.Id,
            AssignedByMemberId = actorId,
            AssignedUtc = DateTime.UtcNow
        });
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
