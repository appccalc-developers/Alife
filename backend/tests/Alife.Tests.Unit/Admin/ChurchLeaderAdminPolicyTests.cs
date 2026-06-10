using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Alife.Infrastructure.ReadServices;
using Alife.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace Alife.Tests.Unit.Admin;

public class ChurchLeaderAdminPolicyTests
{
    [Theory]
    [InlineData(MembershipRole.Leader)]
    [InlineData(MembershipRole.CoLeader)]
    public async Task IsAdminAsync_ReturnsTrue_ForApprovedChurchLeaderOrCoLeader(MembershipRole role)
    {
        using var dbContext = CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        await SeedMemberWithMembershipAsync(dbContext, memberId, isChurch: true, MembershipStatus.Approved, role);
        var service = new GroupAuthorizationService(dbContext);

        var isAdmin = await service.IsAdminAsync(memberId, CancellationToken.None);

        Assert.True(isAdmin);
    }

    [Fact]
    public async Task IsAdminAsync_ReturnsFalse_ForApprovedNonChurchCoLeader()
    {
        using var dbContext = CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        await SeedMemberWithMembershipAsync(
            dbContext,
            memberId,
            isChurch: false,
            MembershipStatus.Approved,
            MembershipRole.CoLeader);
        var service = new GroupAuthorizationService(dbContext);

        var isAdmin = await service.IsAdminAsync(memberId, CancellationToken.None);

        Assert.False(isAdmin);
    }

    [Fact]
    public async Task GetCurrentMemberAsync_ReportsEffectiveAdmin_ForApprovedChurchCoLeader()
    {
        using var dbContext = CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        await SeedMemberWithMembershipAsync(
            dbContext,
            memberId,
            isChurch: true,
            MembershipStatus.Approved,
            MembershipRole.CoLeader);
        var service = new MemberReadService(dbContext);

        var member = await service.GetCurrentMemberAsync(memberId, CancellationToken.None);

        Assert.NotNull(member);
        Assert.True(member.IsAdmin);
    }

    private static async Task SeedMemberWithMembershipAsync(
        AlifeDbContext dbContext,
        Guid memberId,
        bool isChurch,
        MembershipStatus status,
        MembershipRole role)
    {
        var now = DateTime.UtcNow;
        var groupId = Guid.NewGuid();
        dbContext.Groups.Add(new Group
        {
            Id = groupId,
            NameJson = "{\"en\":\"Group\"}",
            AccessType = AccessType.Protected,
            IsChurch = isChurch,
            CreatedUtc = now,
            UpdatedUtc = now
        });
        dbContext.Members.Add(new Member
        {
            Id = memberId,
            DisplayName = "Church Leader",
            IsRegistered = true,
            IsAdmin = false,
            CreatedUtc = now,
            UpdatedUtc = now
        });
        dbContext.GroupMemberships.Add(new GroupMembership
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            MemberId = memberId,
            Status = status,
            Role = role,
            CreatedUtc = now,
            UpdatedUtc = now
        });
        await dbContext.SaveChangesAsync();
    }

    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
