using Alife.Application.Groups.Services;
using Alife.Application.Members.Commands.UpdateCurrentMemberProfile;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Members;

public class UpdateCurrentMemberProfileCommandHandlerTests
{
    [Fact]
    public async Task Handle_UpdatesOnlyCurrentMemberAndInvalidatesAffectedGroups()
    {
        using var dbContext = CreateDbContext();
        var memberId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        dbContext.Members.Add(new Member
        {
            Id = memberId,
            DisplayName = "Old name",
            Email = "old@example.com",
            PhoneE164 = "+64210000000",
            PhoneVerifiedUtc = DateTime.UtcNow.AddDays(-1),
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow.AddDays(-2),
            UpdatedUtc = DateTime.UtcNow.AddDays(-1)
        });
        dbContext.GroupMemberships.Add(new GroupMembership
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            MemberId = memberId,
            Role = MembershipRole.Member,
            Status = MembershipStatus.Approved,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();
        var cacheInvalidation = Substitute.For<IGroupCacheInvalidationService>();
        var handler = new UpdateCurrentMemberProfileCommandHandler(dbContext, cacheInvalidation);

        var result = await handler.Handle(new UpdateCurrentMemberProfileCommand(
            memberId,
            " New name ",
            "NEW@EXAMPLE.COM",
            "+61412345678"), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Message);
        Assert.Equal("New name", result.Value!.DisplayName);
        Assert.Equal("new@example.com", result.Value.Email);
        Assert.Equal("+61412345678", result.Value.PhoneE164);
        Assert.Null((await dbContext.Members.FindAsync(memberId))!.PhoneVerifiedUtc);
        Assert.Contains(dbContext.AuditLogs, log =>
            log.Action == "member.profile.self-update" &&
            log.ActorMemberId == memberId &&
            log.TargetMemberId == memberId);
        await cacheInvalidation.Received(1).RemoveMembershipsAsync(groupId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_RejectsPhoneUsedByAnotherRegisteredMember()
    {
        using var dbContext = CreateDbContext();
        var memberId = Guid.NewGuid();
        dbContext.Members.AddRange(MemberRecord(memberId, "+64210000000"), MemberRecord(Guid.NewGuid(), "+8613812345678"));
        await dbContext.SaveChangesAsync();
        var handler = new UpdateCurrentMemberProfileCommandHandler(
            dbContext,
            Substitute.For<IGroupCacheInvalidationService>());

        var result = await handler.Handle(new UpdateCurrentMemberProfileCommand(
            memberId,
            "Member",
            null,
            "+8613812345678"), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Contains("already used", result.Message);
        Assert.Equal("+64210000000", (await dbContext.Members.FindAsync(memberId))!.PhoneE164);
    }

    [Fact]
    public async Task Handle_RejectsUnsupportedInternationalRegion()
    {
        using var dbContext = CreateDbContext();
        var memberId = Guid.NewGuid();
        dbContext.Members.Add(MemberRecord(memberId, "+64210000000"));
        await dbContext.SaveChangesAsync();
        var handler = new UpdateCurrentMemberProfileCommandHandler(
            dbContext,
            Substitute.For<IGroupCacheInvalidationService>());

        var result = await handler.Handle(new UpdateCurrentMemberProfileCommand(
            memberId,
            "Member",
            null,
            "+12025550123"), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Contains("supported phone region", result.Message);
        Assert.Equal("+64210000000", (await dbContext.Members.FindAsync(memberId))!.PhoneE164);
    }

    private static Member MemberRecord(Guid id, string phone) => new()
    {
        Id = id,
        DisplayName = "Member",
        PhoneE164 = phone,
        IsRegistered = true,
        CreatedUtc = DateTime.UtcNow,
        UpdatedUtc = DateTime.UtcNow
    };

    private static AlifeDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
