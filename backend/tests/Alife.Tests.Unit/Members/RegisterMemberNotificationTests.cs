using Alife.Application.Abstractions.Security;
using Alife.Application.Members.Commands.RegisterMember;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Members;

public class RegisterMemberNotificationTests
{
    [Fact]
    public async Task RegisterMember_OnPublicDevice_IssuesTwoHourSessionToken()
    {
        using var dbContext = CreateInMemoryDbContext();
        var jwtTokenService = Substitute.For<IJwtTokenService>();
        jwtTokenService.CreateToken(
                Arg.Any<Member>(),
                "line",
                "public_device",
                Arg.Is<TimeSpan>(lifetime => lifetime == TimeSpan.FromHours(2)))
            .Returns(("public-device-token", DateTime.UtcNow.AddHours(2)));
        var handler = new RegisterMemberCommandHandler(
            dbContext,
            jwtTokenService,
            Substitute.For<IGroupCacheInvalidationService>());

        var result = await handler.Handle(
            new RegisterMemberCommand(
                null,
                "line-public-device",
                "Public Device User",
                null,
                null,
                null,
                true),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("public-device-token", result.Value?.Token);
        jwtTokenService.Received(1).CreateToken(
            Arg.Any<Member>(),
            "line",
            "public_device",
            Arg.Is<TimeSpan>(lifetime => lifetime == TimeSpan.FromHours(2)));
    }

    [Fact]
    public async Task RegisterMember_WithVerifiedLineUidNotifiesChurchLeaders()
    {
        using var dbContext = CreateInMemoryDbContext();
        var churchId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        dbContext.Groups.Add(new Group
        {
            Id = churchId,
            NameJson = "{\"en\":\"Alife Church\",\"zh\":\"丰盛生命教会\"}",
            AccessType = AccessType.Protected,
            IsChurch = true,
            CreatedUtc = now,
            UpdatedUtc = now
        });
        dbContext.Members.Add(new Member
        {
            Id = leaderId,
            DisplayName = "Church Leader",
            IsRegistered = true,
            CreatedUtc = now,
            UpdatedUtc = now
        });
        dbContext.GroupMemberships.Add(new GroupMembership
        {
            Id = Guid.NewGuid(),
            GroupId = churchId,
            MemberId = leaderId,
            Status = MembershipStatus.Approved,
            Role = MembershipRole.CoLeader,
            CreatedUtc = now,
            UpdatedUtc = now
        });
        await dbContext.SaveChangesAsync();

        var jwtTokenService = Substitute.For<IJwtTokenService>();
        jwtTokenService.CreateToken(Arg.Any<Member>(), false)
            .Returns(("member-token", now.AddDays(7)));
        var cacheInvalidationService = Substitute.For<IGroupCacheInvalidationService>();
        var handler = new RegisterMemberCommandHandler(dbContext, jwtTokenService, cacheInvalidationService);

        var result = await handler.Handle(
            new RegisterMemberCommand(null, "line-new-member", "New LINE User", null, null, "new@example.com"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var registeredMember = await dbContext.Members.SingleAsync(x => x.LineUID == "line-new-member");
        var notification = await dbContext.NotificationMessages.SingleAsync();
        Assert.Equal(leaderId, notification.RecipientMemberId);
        Assert.Equal(registeredMember.Id, notification.CreatedByMemberId);
        Assert.Equal(churchId, notification.GroupId);
        Assert.Equal("church.line-member.waiting", notification.ActionType);
        Assert.Contains(registeredMember.Id.ToString(), notification.ActionDataJson);
        Assert.Contains("/admin?church=members", notification.ActionDataJson);
        await cacheInvalidationService.Received(1).RemoveMembershipsAsync(churchId, Arg.Any<CancellationToken>());
    }

    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
