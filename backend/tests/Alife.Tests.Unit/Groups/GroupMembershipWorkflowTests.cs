using Alife.Application.Common.Interfaces;
using Alife.Application.Groups.Commands.ApproveGroupMember;
using Alife.Application.Groups.Commands.JoinGroup;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Groups;

public class GroupMembershipWorkflowTests
{
    [Fact]
    public async Task JoinGroup_RequiresParentMembershipForSubgroup()
    {
        using var dbContext = CreateInMemoryDbContext();
        var parentId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.Groups.AddRange(
            CreateGroup(parentId, AccessType.Protected),
            CreateGroup(childId, AccessType.Protected, parentId));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsRegisteredMemberAsync(memberId, Arg.Any<CancellationToken>()).Returns(true);
        authorizationService.IsApprovedMemberAsync(parentId, memberId, Arg.Any<CancellationToken>()).Returns(false);
        var handler = new JoinGroupCommandHandler(
            dbContext,
            authorizationService,
            Substitute.For<IGroupCacheInvalidationService>(),
            Substitute.For<ICloudflareKvCacheService>());

        var result = await handler.Handle(new JoinGroupCommand(childId, memberId), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Empty(dbContext.GroupMemberships);
    }

    [Fact]
    public async Task JoinGroup_PrivateSubgroupCreatesRejectedMembershipForParentMember()
    {
        using var dbContext = CreateInMemoryDbContext();
        var parentId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.Groups.AddRange(
            CreateGroup(parentId, AccessType.Protected),
            CreateGroup(childId, AccessType.Private, parentId));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsRegisteredMemberAsync(memberId, Arg.Any<CancellationToken>()).Returns(true);
        authorizationService.IsApprovedMemberAsync(parentId, memberId, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new JoinGroupCommandHandler(
            dbContext,
            authorizationService,
            Substitute.For<IGroupCacheInvalidationService>(),
            Substitute.For<ICloudflareKvCacheService>());

        var result = await handler.Handle(new JoinGroupCommand(childId, memberId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("rejected", result.Value!.Status);
        Assert.Equal(MembershipStatus.Rejected, dbContext.GroupMemberships.Single().Status);
    }

    [Fact]
    public async Task ApproveGroupMember_CreatesChurchMembershipForRegisteredLineCandidate()
    {
        using var dbContext = CreateInMemoryDbContext();
        var churchId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.Groups.Add(CreateGroup(churchId, AccessType.Protected, isChurch: true));
        dbContext.Members.Add(new Member
        {
            Id = memberId,
            DisplayName = "Line Member",
            LineUID = "line-1",
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService.IsLeaderOrCoLeaderAsync(churchId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new ApproveGroupMemberCommandHandler(
            dbContext,
            authorizationService,
            Substitute.For<IGroupCacheInvalidationService>(),
            Substitute.For<ICloudflareKvCacheService>());

        var result = await handler.Handle(new ApproveGroupMemberCommand(churchId, leaderId, memberId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var membership = dbContext.GroupMemberships.Single();
        Assert.Equal(churchId, membership.GroupId);
        Assert.Equal(memberId, membership.MemberId);
        Assert.Equal(MembershipStatus.Approved, membership.Status);
    }

    private static Group CreateGroup(
        Guid id,
        AccessType accessType,
        Guid? parentGroupId = null,
        bool isChurch = false)
        => new()
        {
            Id = id,
            NameJson = "{\"en\":\"Group\"}",
            ParentGroupId = parentGroupId,
            AccessType = accessType,
            IsChurch = isChurch,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };

    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
