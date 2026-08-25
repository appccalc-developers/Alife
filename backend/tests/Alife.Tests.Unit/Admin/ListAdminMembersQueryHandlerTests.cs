using Alife.Application.Admin;
using Alife.Application.Admin.Queries.ListAdminMembers;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Alife.Tests.Unit.Admin;

public class ListAdminMembersQueryHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsMergedMemberRows_InNameOrder()
    {
        await using var dbContext = CreateDbContext();
        var data = await SeedDirectoryAsync(dbContext);
        var handler = new ListAdminMembersQueryHandler(dbContext);

        var result = await handler.Handle(
            new ListAdminMembersQuery(
                data.ActorId,
                Search: null,
                Role: null,
                IsRegistered: null,
                ManagementOnly: null,
                LeadersOnly: null,
                MemberStatuses: "pending,active,inactive",
                GroupIds: null,
                Page: 1,
                PageSize: 25),
            CancellationToken.None);

        Assert.True(result.IsSuccess, result.Message);
        Assert.Equal(["Alice", "Ben", "Zulu Admin"], result.Value!.Items.Select(member => member.DisplayName));

        var alice = result.Value.Items[0];
        Assert.Equal("Sister", alice.Salutation);
        Assert.Equal("Female", alice.Sex);
        Assert.Equal(MembershipStatus.Approved, alice.ChurchMembershipStatus);
        Assert.True(alice.IsGroupLeader);
        var group = Assert.Single(alice.Groups);
        Assert.Equal(data.GroupId, group.Id);
        Assert.Equal(MembershipRole.Leader, group.Role);
        Assert.Contains("member_manager", alice.PlatformRoles);

        var ben = result.Value.Items[1];
        Assert.Equal(MembershipStatus.Requested, ben.ChurchMembershipStatus);
        Assert.Empty(ben.Groups);
    }

    [Fact]
    public async Task Handle_AppliesCombinedManagementLeaderStatusAndGroupFilters()
    {
        await using var dbContext = CreateDbContext();
        var data = await SeedDirectoryAsync(dbContext);
        var handler = new ListAdminMembersQueryHandler(dbContext);

        var result = await handler.Handle(
            new ListAdminMembersQuery(
                data.ActorId,
                Search: null,
                Role: null,
                IsRegistered: null,
                ManagementOnly: true,
                LeadersOnly: true,
                MemberStatuses: "active",
                GroupIds: data.GroupId.ToString(),
                Page: 1,
                PageSize: 25),
            CancellationToken.None);

        Assert.True(result.IsSuccess, result.Message);
        Assert.Equal("Alice", Assert.Single(result.Value!.Items).DisplayName);
    }

    [Fact]
    public async Task Handle_FiltersPendingMemberships()
    {
        await using var dbContext = CreateDbContext();
        var data = await SeedDirectoryAsync(dbContext);
        var handler = new ListAdminMembersQueryHandler(dbContext);

        var result = await handler.Handle(
            new ListAdminMembersQuery(
                data.ActorId,
                Search: null,
                Role: null,
                IsRegistered: null,
                ManagementOnly: false,
                LeadersOnly: false,
                MemberStatuses: "pending",
                GroupIds: null,
                Page: 1,
                PageSize: 25),
            CancellationToken.None);

        Assert.True(result.IsSuccess, result.Message);
        Assert.Equal("Ben", Assert.Single(result.Value!.Items).DisplayName);
    }

    private static async Task<(Guid ActorId, Guid GroupId)> SeedDirectoryAsync(AlifeDbContext dbContext)
    {
        var now = DateTime.UtcNow;
        var actorId = Guid.NewGuid();
        var aliceId = Guid.NewGuid();
        var benId = Guid.NewGuid();
        var churchId = Guid.NewGuid();
        var groupId = Guid.NewGuid();

        dbContext.PlatformRoles.AddRange(
            new PlatformRole
            {
                Id = 30,
                Code = "directory_viewer",
                Level = 30,
                NameJson = "{}",
                PermissionsJson = AdminPermissionCatalog.WritePermissions([AdminPermissionCatalog.ViewMembers])
            },
            new PlatformRole
            {
                Id = 31,
                Code = "member_manager",
                Level = 31,
                NameJson = "{}",
                PermissionsJson = AdminPermissionCatalog.WritePermissions([AdminPermissionCatalog.ManageMemberProfiles])
            });
        dbContext.Groups.AddRange(
            new Group
            {
                Id = churchId,
                NameJson = "{\"en\":\"Church\",\"zh\":\"教会\"}",
                IsChurch = true,
                AccessType = AccessType.Protected,
                CreatedUtc = now,
                UpdatedUtc = now
            },
            new Group
            {
                Id = groupId,
                NameJson = "{\"en\":\"Alpha group\",\"zh\":\"阿尔法小组\"}",
                ParentGroupId = churchId,
                AccessType = AccessType.Protected,
                CreatedUtc = now,
                UpdatedUtc = now
            });
        dbContext.Members.AddRange(
            new Member { Id = actorId, DisplayName = "Zulu Admin", IsRegistered = true, CreatedUtc = now, UpdatedUtc = now },
            new Member { Id = aliceId, DisplayName = "Alice", Salutation = "Sister", Sex = "Female", IsRegistered = true, CreatedUtc = now, UpdatedUtc = now },
            new Member { Id = benId, DisplayName = "Ben", Sex = "Male", IsRegistered = true, CreatedUtc = now, UpdatedUtc = now });
        dbContext.MemberPlatformRoles.AddRange(
            new MemberPlatformRole { Id = Guid.NewGuid(), MemberId = actorId, RoleId = 30, AssignedByMemberId = actorId, AssignedUtc = now },
            new MemberPlatformRole { Id = Guid.NewGuid(), MemberId = aliceId, RoleId = 31, AssignedByMemberId = actorId, AssignedUtc = now });
        dbContext.GroupMemberships.AddRange(
            new GroupMembership { Id = Guid.NewGuid(), GroupId = churchId, MemberId = aliceId, Status = MembershipStatus.Approved, Role = MembershipRole.Member, CreatedUtc = now, UpdatedUtc = now },
            new GroupMembership { Id = Guid.NewGuid(), GroupId = groupId, MemberId = aliceId, Status = MembershipStatus.Approved, Role = MembershipRole.Leader, CreatedUtc = now, UpdatedUtc = now },
            new GroupMembership { Id = Guid.NewGuid(), GroupId = churchId, MemberId = benId, Status = MembershipStatus.Requested, Role = MembershipRole.Member, CreatedUtc = now, UpdatedUtc = now });
        await dbContext.SaveChangesAsync();
        return (actorId, groupId);
    }

    private static AlifeDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
