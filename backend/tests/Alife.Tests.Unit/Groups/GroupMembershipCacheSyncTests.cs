using Alife.Application.Common.Interfaces;
using Alife.Application.Groups.Commands.ApproveGroupMember;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Groups;

public class GroupMembershipCacheSyncTests
{
    [Fact]
    public async Task ApproveGroupMember_WritesCloudflareAuthzMirrorAndInvalidatesMembershipCache()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.GroupMemberships.Add(new GroupMembership
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            MemberId = memberId,
            Status = MembershipStatus.Requested,
            Role = MembershipRole.Member,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow,
        });
        await dbContext.SaveChangesAsync();
        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>())
            .Returns(true);
        var invalidationService = Substitute.For<IGroupCacheInvalidationService>();
        var cloudflareKvCacheService = Substitute.For<ICloudflareKvCacheService>();
        var handler = new ApproveGroupMemberCommandHandler(
            dbContext,
            authorizationService,
            invalidationService,
            cloudflareKvCacheService);

        var result = await handler.Handle(new ApproveGroupMemberCommand(groupId, leaderId, memberId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        await cloudflareKvCacheService.Received(1).PutApprovedMembershipAsync(
            groupId,
            memberId,
            MembershipRole.Member,
            Arg.Any<DateTime>(),
            Arg.Any<CancellationToken>());
        await invalidationService.Received(1).RemoveMembershipsAsync(groupId, Arg.Any<CancellationToken>());
    }

    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
