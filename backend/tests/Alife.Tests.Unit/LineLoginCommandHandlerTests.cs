using Alife.Application.Abstractions.Integrations;
using Alife.Application.Abstractions.Security;
using Alife.Application.Common.Models;
using Alife.Application.Members.Commands.LineLogin;
using Alife.Domain.Entities;
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
        jwtService.CreateVerifiedLineToken(Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<string?>())
            .Returns(("line-onboarding-token", expiresUtc));

        return jwtService;
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
        var handler = new LineLoginCommandHandler(dbContext, lineService, jwtService);

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

        jwtService.Received(1).CreateToken(Arg.Is<Member>(m => m.Id == existingMemberId), false);
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
        var handler = new LineLoginCommandHandler(dbContext, lineService, jwtService);

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
        var handler = new LineLoginCommandHandler(dbContext, lineService, jwtService);

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
}
