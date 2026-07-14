using Alife.Application.Groups.Commands.UpdateGroupMemberProfile;
using Alife.Application.Groups.Queries.GetGroupMemberProfile;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Groups;

public class UpdateGroupMemberProfileCommandHandlerTests
{
    [Fact]
    public async Task GetProfile_ReturnsPrivateFields_WhenActorCanManageMembers()
    {
        using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        dbContext.Members.Add(MemberRecord(targetId));
        dbContext.GroupMemberships.Add(Membership(groupId, targetId));
        await dbContext.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, actorId, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new GetGroupMemberProfileQueryHandler(dbContext, authorization);

        var result = await handler.Handle(
            new GetGroupMemberProfileQuery(groupId, actorId, targetId),
            CancellationToken.None);

        Assert.True(result.IsSuccess, result.Message);
        Assert.Equal("member@example.com", result.Value!.Email);
        Assert.Equal("+64210000000", result.Value.PhoneE164);
    }

    [Fact]
    public async Task GetProfile_DoesNotExposePrivateFields_WhenActorCannotManageMembers()
    {
        using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        dbContext.Members.Add(MemberRecord(targetId));
        dbContext.GroupMemberships.Add(Membership(groupId, targetId));
        await dbContext.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, actorId, Arg.Any<CancellationToken>()).Returns(false);
        var handler = new GetGroupMemberProfileQueryHandler(dbContext, authorization);

        var result = await handler.Handle(
            new GetGroupMemberProfileQuery(groupId, actorId, targetId),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Null(result.Value);
    }

    [Fact]
    public async Task Handle_UpdatesGroupMember_WhenActorCanManageMembers()
    {
        using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        dbContext.Members.Add(MemberRecord(targetId));
        dbContext.GroupMemberships.Add(Membership(groupId, targetId));
        await dbContext.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, actorId, Arg.Any<CancellationToken>()).Returns(true);
        var cacheInvalidation = Substitute.For<IGroupCacheInvalidationService>();
        var handler = new UpdateGroupMemberProfileCommandHandler(dbContext, authorization, cacheInvalidation);

        var result = await handler.Handle(
            new UpdateGroupMemberProfileCommand(groupId, actorId, targetId, " New name ", "NEW@EXAMPLE.COM", "+64211111111"),
            CancellationToken.None);

        Assert.True(result.IsSuccess, result.Message);
        Assert.Equal("New name", result.Value!.DisplayName);
        Assert.Equal("new@example.com", result.Value.Email);
        Assert.Null((await dbContext.Members.FindAsync(targetId))!.PhoneVerifiedUtc);
        Assert.Contains(dbContext.AuditLogs, log =>
            log.Action == "group.member.profile.update" &&
            log.ActorMemberId == actorId &&
            log.TargetMemberId == targetId);
        await cacheInvalidation.Received(1).RemoveMembershipsAsync(groupId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_DoesNotUpdateMember_WhenActorCannotManageMembers()
    {
        using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var targetId = Guid.NewGuid();
        dbContext.Members.Add(MemberRecord(targetId));
        dbContext.GroupMemberships.Add(Membership(groupId, targetId));
        await dbContext.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, actorId, Arg.Any<CancellationToken>()).Returns(false);
        var handler = new UpdateGroupMemberProfileCommandHandler(
            dbContext,
            authorization,
            Substitute.For<IGroupCacheInvalidationService>());

        var result = await handler.Handle(
            new UpdateGroupMemberProfileCommand(groupId, actorId, targetId, "Changed", null, null),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal("Member", (await dbContext.Members.FindAsync(targetId))!.DisplayName);
    }

    private static Member MemberRecord(Guid id) => new()
    {
        Id = id,
        DisplayName = "Member",
        Email = "member@example.com",
        PhoneE164 = "+64210000000",
        PhoneVerifiedUtc = DateTime.UtcNow.AddDays(-1),
        IsRegistered = true,
        CreatedUtc = DateTime.UtcNow.AddDays(-2),
        UpdatedUtc = DateTime.UtcNow.AddDays(-1)
    };

    private static GroupMembership Membership(Guid groupId, Guid memberId) => new()
    {
        Id = Guid.NewGuid(),
        GroupId = groupId,
        MemberId = memberId,
        Status = MembershipStatus.Approved,
        Role = MembershipRole.Member,
        CreatedUtc = DateTime.UtcNow.AddDays(-2),
        UpdatedUtc = DateTime.UtcNow.AddDays(-1)
    };

    private static AlifeDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
