using Alife.Application.Abstractions.Integrations;
using Alife.Application.Abstractions.Security;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Members.Commands.LineLogin;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit;

public class LineLoginCommandHandlerTests
{
    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    private static ILineLoginService CreateLineLoginService(LineTokenResult lineTokenResult)
    {
        var lineService = Substitute.For<ILineLoginService>();
        lineService.ExchangeCodeAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(lineTokenResult);
        return lineService;
    }

    private static IJwtTokenService CreateJwtService()
    {
        var jwtService = Substitute.For<IJwtTokenService>();
        var expiresUtc = DateTime.UtcNow.AddDays(7);

        jwtService.CreateToken(Arg.Any<Member>(), Arg.Any<bool>())
            .Returns(("member-token", expiresUtc));
        jwtService.CreateToken(Arg.Any<Member>(), "line", "standard", Arg.Any<TimeSpan>())
            .Returns(("member-token", expiresUtc));
        jwtService.CreateToken(Arg.Any<Member>(), "line", "public_device", Arg.Any<TimeSpan>())
            .Returns(("member-token", expiresUtc));
        jwtService.CreateVerifiedLineToken(Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<string?>())
            .Returns(("line-onboarding-token", expiresUtc));

        return jwtService;
    }

    [Fact]
    public async Task Handle_OnPublicDevice_IssuesTwoHourNonStandardSessionToken()
    {
        using var dbContext = CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        dbContext.Members.Add(new Member
        {
            Id = memberId,
            IsRegistered = true,
            LineUID = "line-public-device",
            DisplayName = "Public device member",
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var jwtService = CreateJwtService();
        var handler = CreateHandler(
            dbContext,
            CreateLineLoginService(new LineTokenResult("line-public-device", "Member", null)),
            jwtService);

        var result = await handler.Handle(new LineLoginCommand(null, "auth-code", true), CancellationToken.None);

        Assert.True(result.IsSuccess);
        jwtService.Received(1).CreateToken(
            Arg.Is<Member>(member => member.Id == memberId),
            "line",
            "public_device",
            Arg.Is<TimeSpan>(lifetime => lifetime == TimeSpan.FromHours(2)));
    }

    [Fact]
    public async Task Handle_WithExistingRegisteredMemberByLineUid_ReturnsMemberDetailsAndToken()
    {
        using var dbContext = CreateInMemoryDbContext();
        var existingMemberId = Guid.NewGuid();
        dbContext.Members.Add(new Member
        {
            Id = existingMemberId,
            IsRegistered = true,
            LineUID = "line-uid-123",
            DisplayName = "Existing Member",
            Sex = "Female",
            Age = 31,
            Email = "existing@example.com",
            CreatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var lineService = CreateLineLoginService(new LineTokenResult("line-uid-123", "Line Name", "line@example.com"));
        var jwtService = CreateJwtService();
        var handler = CreateHandler(dbContext, lineService, jwtService);

        var result = await handler.Handle(new LineLoginCommand(null, "auth-code"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.True(result.Value.IsRegistered);
        Assert.Equal("Existing Member", result.Value.DisplayName);
        Assert.Equal("Female", result.Value.Sex);
        Assert.Equal(31, result.Value.Age);
        Assert.Equal("existing@example.com", result.Value.Email);
        Assert.Equal("member-token", result.Value.Token);
        Assert.NotNull(result.Value.ExpiresUtc);

        jwtService.Received(1).CreateToken(
            Arg.Is<Member>(m => m.Id == existingMemberId),
            "line",
            "standard",
            Arg.Is<TimeSpan>(value => value == TimeSpan.FromDays(30)));
        jwtService.DidNotReceive().CreateVerifiedLineToken(Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<string?>());
    }

    [Fact]
    public async Task Handle_WithRegisteredCurrentMemberAndAnotherMemberUsingSameLineUid_ReturnsConflict()
    {
        using var dbContext = CreateInMemoryDbContext();
        var currentMemberId = Guid.NewGuid();
        dbContext.Members.AddRange(
            new Member
            {
                Id = currentMemberId,
                IsRegistered = true,
                LineUID = "current-line-uid",
                DisplayName = "Current",
                CreatedUtc = DateTime.UtcNow
            },
            new Member
            {
                Id = Guid.NewGuid(),
                IsRegistered = true,
                LineUID = "line-uid-123",
                DisplayName = "Existing Member",
                CreatedUtc = DateTime.UtcNow
            });
        await dbContext.SaveChangesAsync();

        var lineService = CreateLineLoginService(new LineTokenResult("line-uid-123", "Line Name", "line@example.com"));
        var jwtService = CreateJwtService();
        var handler = CreateHandler(dbContext, lineService, jwtService);

        var result = await handler.Handle(new LineLoginCommand(currentMemberId, "auth-code"), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(AppResultStatus.Conflict, result.Status);
        Assert.Equal("LINE account already registered to another member.", result.Message);
    }

    [Fact]
    public async Task Handle_WithoutMatchingMember_ReturnsVerifiedLineTokenForOnboarding()
    {
        using var dbContext = CreateInMemoryDbContext();
        const string lineUid = "line-uid-new";
        const string lineDisplayName = "New User";
        const string lineEmail = "new@example.com";

        var lineService = CreateLineLoginService(new LineTokenResult(lineUid, lineDisplayName, lineEmail));
        var jwtService = CreateJwtService();
        var handler = CreateHandler(dbContext, lineService, jwtService);

        var result = await handler.Handle(new LineLoginCommand(null, "auth-code"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.False(result.Value.IsRegistered);
        Assert.Equal(lineDisplayName, result.Value.DisplayName);
        Assert.Equal(lineEmail, result.Value.Email);
        Assert.Equal("line-onboarding-token", result.Value.Token);
        Assert.NotNull(result.Value.ExpiresUtc);

        jwtService.Received(1).CreateVerifiedLineToken(lineUid, lineDisplayName, lineEmail);
        jwtService.DidNotReceive().CreateToken(Arg.Any<Member>(), Arg.Any<bool>());
    }

    [Fact]
    public async Task Handle_WithRegisteredLineMemberMissingChurchMembership_CreatesRequestAndNotifiesLeadersOnce()
    {
        using var dbContext = CreateInMemoryDbContext();
        var churchId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
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
        dbContext.Members.AddRange(
            new Member
            {
                Id = leaderId,
                DisplayName = "Church Leader",
                IsRegistered = true,
                CreatedUtc = now,
                UpdatedUtc = now
            },
            new Member
            {
                Id = memberId,
                DisplayName = "James Wong",
                IsRegistered = true,
                LineUID = "line-james",
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

        var lineService = CreateLineLoginService(new LineTokenResult("line-james", "James Wong", null));
        var jwtService = CreateJwtService();
        var groupCacheInvalidationService = Substitute.For<IGroupCacheInvalidationService>();
        var cloudflareKvCacheService = Substitute.For<ICloudflareKvCacheService>();
        var handler = CreateHandler(
            dbContext,
            lineService,
            jwtService,
            groupCacheInvalidationService,
            cloudflareKvCacheService);

        var firstResult = await handler.Handle(
            new LineLoginCommand(null, "first-auth-code"),
            CancellationToken.None);
        var secondResult = await handler.Handle(
            new LineLoginCommand(null, "second-auth-code"),
            CancellationToken.None);

        Assert.True(firstResult.IsSuccess);
        Assert.True(secondResult.IsSuccess);

        var membership = await dbContext.GroupMemberships
            .SingleAsync(x => x.GroupId == churchId && x.MemberId == memberId);
        Assert.Equal(MembershipStatus.Requested, membership.Status);
        Assert.Equal(MembershipRole.Member, membership.Role);

        var notification = await dbContext.NotificationMessages.SingleAsync();
        Assert.Equal(leaderId, notification.RecipientMemberId);
        Assert.Equal(memberId, notification.CreatedByMemberId);
        Assert.Equal(churchId, notification.GroupId);
        Assert.Equal("group.join-request.received", notification.ActionType);
        Assert.Contains("James Wong", notification.ActionDataJson);
        Assert.Contains("/admin?church=members", notification.ActionDataJson);

        await groupCacheInvalidationService.Received(1)
            .RemoveMembershipsAsync(churchId, Arg.Any<CancellationToken>());
        await cloudflareKvCacheService.Received(1)
            .RemoveMembershipAsync(churchId, memberId, Arg.Any<CancellationToken>());
        await cloudflareKvCacheService.Received(1)
            .RemoveMemberProfileAsync(memberId, Arg.Any<CancellationToken>());
        await cloudflareKvCacheService.Received(1)
            .RemoveApiCacheKeyAsync($"member:{memberId}:me", Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(MembershipStatus.Invited)]
    [InlineData(MembershipStatus.Requested)]
    [InlineData(MembershipStatus.Approved)]
    [InlineData(MembershipStatus.Rejected)]
    [InlineData(MembershipStatus.Removed)]
    public async Task Handle_WithChurchMembershipHistory_DoesNotOverwriteOrRepeatRequest(
        MembershipStatus existingStatus)
    {
        using var dbContext = CreateInMemoryDbContext();
        var churchId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
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
            Id = memberId,
            DisplayName = "Existing Member",
            IsRegistered = true,
            LineUID = "line-existing",
            CreatedUtc = now,
            UpdatedUtc = now
        });
        dbContext.GroupMemberships.Add(new GroupMembership
        {
            Id = Guid.NewGuid(),
            GroupId = churchId,
            MemberId = memberId,
            Status = existingStatus,
            Role = MembershipRole.Member,
            CreatedUtc = now,
            UpdatedUtc = now
        });
        await dbContext.SaveChangesAsync();

        var groupCacheInvalidationService = Substitute.For<IGroupCacheInvalidationService>();
        var cloudflareKvCacheService = Substitute.For<ICloudflareKvCacheService>();
        var handler = CreateHandler(
            dbContext,
            CreateLineLoginService(new LineTokenResult("line-existing", "Existing Member", null)),
            CreateJwtService(),
            groupCacheInvalidationService,
            cloudflareKvCacheService);

        var result = await handler.Handle(
            new LineLoginCommand(null, "auth-code"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var membership = await dbContext.GroupMemberships.SingleAsync();
        Assert.Equal(existingStatus, membership.Status);
        Assert.Equal(now, membership.UpdatedUtc);
        Assert.Empty(dbContext.NotificationMessages);
        await groupCacheInvalidationService.DidNotReceive()
            .RemoveMembershipsAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await cloudflareKvCacheService.DidNotReceive()
            .RemoveMembershipAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    private static LineLoginCommandHandler CreateHandler(
        AlifeDbContext dbContext,
        ILineLoginService lineLoginService,
        IJwtTokenService jwtTokenService,
        IGroupCacheInvalidationService? groupCacheInvalidationService = null,
        ICloudflareKvCacheService? cloudflareKvCacheService = null)
        => new(
            dbContext,
            lineLoginService,
            jwtTokenService,
            groupCacheInvalidationService ?? Substitute.For<IGroupCacheInvalidationService>(),
            cloudflareKvCacheService ?? Substitute.For<ICloudflareKvCacheService>());
}
