using Alife.Application.Abstractions.Security;
using Alife.Application.Common.Models;
using Alife.Application.Members.Commands.LoginByAccount;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit;

public class LoginByAccountCommandHandlerTests
{
    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    private static IJwtTokenService CreateJwtService()
    {
        var jwtService = Substitute.For<IJwtTokenService>();
        var expiresUtc = DateTime.UtcNow.AddDays(7);
        jwtService.CreateToken(Arg.Any<Member>(), Arg.Any<bool>())
            .Returns(("member-token", expiresUtc));
        return jwtService;
    }

    [Fact]
    public async Task Handle_WithEmptyAccount_ReturnsValidationError()
    {
        using var dbContext = CreateInMemoryDbContext();
        var jwtService = CreateJwtService();
        var handler = new LoginByAccountCommandHandler(dbContext, jwtService);

        var result = await handler.Handle(new LoginByAccountCommand("   "), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(AppResultStatus.ValidationError, result.Status);
    }

    [Fact]
    public async Task Handle_WithNoMatchingMember_ReturnsNotFound()
    {
        using var dbContext = CreateInMemoryDbContext();
        var jwtService = CreateJwtService();
        var handler = new LoginByAccountCommandHandler(dbContext, jwtService);

        var result = await handler.Handle(new LoginByAccountCommand("Unknown Person"), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(AppResultStatus.NotFound, result.Status);
    }

    [Fact]
    public async Task Handle_WithUnregisteredMember_ReturnsNotFound()
    {
        using var dbContext = CreateInMemoryDbContext();
        dbContext.Members.Add(new Member
        {
            Id = Guid.NewGuid(),
            IsRegistered = false,
            DisplayName = "Pending User",
            PhoneE164 = "+64210000000",
            CreatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var jwtService = CreateJwtService();
        var handler = new LoginByAccountCommandHandler(dbContext, jwtService);

        var displayNameResult = await handler.Handle(new LoginByAccountCommand("Pending User"), CancellationToken.None);
        var phoneResult = await handler.Handle(new LoginByAccountCommand("+64210000000"), CancellationToken.None);

        Assert.False(displayNameResult.IsSuccess);
        Assert.Equal(AppResultStatus.NotFound, displayNameResult.Status);
        Assert.False(phoneResult.IsSuccess);
        Assert.Equal(AppResultStatus.NotFound, phoneResult.Status);
    }

    [Fact]
    public async Task Handle_WithMatchingDisplayNameAndEmptyPassword_ReturnsTokenAndMemberDetails()
    {
        using var dbContext = CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        dbContext.Members.Add(new Member
        {
            Id = memberId,
            IsRegistered = true,
            DisplayName = "John Doe",
            Sex = "Male",
            Age = 30,
            Email = "john@example.com",
            CreatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var jwtService = CreateJwtService();
        var handler = new LoginByAccountCommandHandler(dbContext, jwtService);

        var result = await handler.Handle(new LoginByAccountCommand("John Doe", string.Empty), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.True(result.Value.IsRegistered);
        Assert.Equal("John Doe", result.Value.DisplayName);
        Assert.Equal("Male", result.Value.Sex);
        Assert.Equal(30, result.Value.Age);
        Assert.Equal("john@example.com", result.Value.Email);
        Assert.Equal("member-token", result.Value.Token);
        Assert.NotNull(result.Value.ExpiresUtc);

        jwtService.Received(1).CreateToken(Arg.Is<Member>(member => member.Id == memberId), false);
    }

    [Fact]
    public async Task Handle_WithMatchingPhoneNumber_ReturnsTokenForThatMember()
    {
        using var dbContext = CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        dbContext.Members.Add(new Member
        {
            Id = memberId,
            IsRegistered = true,
            DisplayName = "Phone User",
            PhoneE164 = "+64211111111",
            CreatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var jwtService = CreateJwtService();
        var handler = new LoginByAccountCommandHandler(dbContext, jwtService);

        var result = await handler.Handle(new LoginByAccountCommand("+64211111111"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal("Phone User", result.Value.DisplayName);
        jwtService.Received(1).CreateToken(Arg.Is<Member>(member => member.Id == memberId), false);
    }

    [Theory]
    [InlineData("0211111111")]
    [InlineData("021 111 1111")]
    [InlineData("021-111-1111")]
    [InlineData("(021) 111 1111")]
    public async Task Handle_WithLocalPhoneNumber_ReturnsTokenForMatchingE164Member(string account)
    {
        using var dbContext = CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        dbContext.Members.Add(new Member
        {
            Id = memberId,
            IsRegistered = true,
            DisplayName = "Local Phone User",
            PhoneE164 = "+64211111111",
            CreatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var jwtService = CreateJwtService();
        var handler = new LoginByAccountCommandHandler(dbContext, jwtService);

        var result = await handler.Handle(new LoginByAccountCommand(account), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal("Local Phone User", result.Value.DisplayName);
        jwtService.Received(1).CreateToken(Arg.Is<Member>(member => member.Id == memberId), false);
    }

    [Fact]
    public async Task Handle_WithAmbiguousLocalPhoneNumber_ReturnsConflict()
    {
        using var dbContext = CreateInMemoryDbContext();
        dbContext.Members.AddRange(
            new Member
            {
                Id = Guid.NewGuid(),
                IsRegistered = true,
                DisplayName = "New Zealand Member",
                PhoneE164 = "+64211111111",
                CreatedUtc = DateTime.UtcNow
            },
            new Member
            {
                Id = Guid.NewGuid(),
                IsRegistered = true,
                DisplayName = "Taiwan Member",
                PhoneE164 = "+886211111111",
                CreatedUtc = DateTime.UtcNow
            });
        await dbContext.SaveChangesAsync();

        var jwtService = CreateJwtService();
        var handler = new LoginByAccountCommandHandler(dbContext, jwtService);

        var result = await handler.Handle(new LoginByAccountCommand("0211111111"), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(AppResultStatus.Conflict, result.Status);
        jwtService.DidNotReceive().CreateToken(Arg.Any<Member>(), Arg.Any<bool>());
    }

    [Fact]
    public async Task Handle_WithMultipleMatchingMembers_ReturnsConflict()
    {
        using var dbContext = CreateInMemoryDbContext();
        dbContext.Members.AddRange(
            new Member
            {
                Id = Guid.NewGuid(),
                IsRegistered = true,
                DisplayName = "Jane Smith",
                CreatedUtc = DateTime.UtcNow
            },
            new Member
            {
                Id = Guid.NewGuid(),
                IsRegistered = true,
                DisplayName = "Jane Smith",
                CreatedUtc = DateTime.UtcNow
            });
        await dbContext.SaveChangesAsync();

        var jwtService = CreateJwtService();
        var handler = new LoginByAccountCommandHandler(dbContext, jwtService);

        var result = await handler.Handle(new LoginByAccountCommand("Jane Smith"), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(AppResultStatus.Conflict, result.Status);
        jwtService.DidNotReceive().CreateToken(Arg.Any<Member>(), Arg.Any<bool>());
    }

    [Fact]
    public async Task Handle_IgnoresLeadingAndTrailingWhitespace()
    {
        using var dbContext = CreateInMemoryDbContext();
        dbContext.Members.Add(new Member
        {
            Id = Guid.NewGuid(),
            IsRegistered = true,
            DisplayName = "Alice",
            CreatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var jwtService = CreateJwtService();
        var handler = new LoginByAccountCommandHandler(dbContext, jwtService);

        var result = await handler.Handle(new LoginByAccountCommand("  Alice  "), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal("Alice", result.Value.DisplayName);
    }
}
