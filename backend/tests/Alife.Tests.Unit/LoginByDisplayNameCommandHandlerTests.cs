using Alife.Application.Abstractions.Security;
using Alife.Application.Common.Models;
using Alife.Application.Members.Commands.LoginByDisplayName;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit;

public class LoginByDisplayNameCommandHandlerTests
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
    public async Task Handle_WithEmptyDisplayName_ReturnsValidationError()
    {
        using var dbContext = CreateInMemoryDbContext();
        var jwtService = CreateJwtService();
        var handler = new LoginByDisplayNameCommandHandler(dbContext, jwtService);

        var result = await handler.Handle(new LoginByDisplayNameCommand("   "), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(AppResultStatus.ValidationError, result.Status);
    }

    [Fact]
    public async Task Handle_WithNoMatchingMember_ReturnsNotFound()
    {
        using var dbContext = CreateInMemoryDbContext();
        var jwtService = CreateJwtService();
        var handler = new LoginByDisplayNameCommandHandler(dbContext, jwtService);

        var result = await handler.Handle(new LoginByDisplayNameCommand("Unknown Person"), CancellationToken.None);

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
            CreatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var jwtService = CreateJwtService();
        var handler = new LoginByDisplayNameCommandHandler(dbContext, jwtService);

        var result = await handler.Handle(new LoginByDisplayNameCommand("Pending User"), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(AppResultStatus.NotFound, result.Status);
    }

    [Fact]
    public async Task Handle_WithExactlyOneMatchAndEmptyPassword_ReturnsTokenAndMemberDetails()
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
        var handler = new LoginByDisplayNameCommandHandler(dbContext, jwtService);

        var result = await handler.Handle(new LoginByDisplayNameCommand("John Doe", string.Empty), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.True(result.Value.IsRegistered);
        Assert.Equal("John Doe", result.Value.DisplayName);
        Assert.Equal("Male", result.Value.Sex);
        Assert.Equal(30, result.Value.Age);
        Assert.Equal("john@example.com", result.Value.Email);
        Assert.Equal("member-token", result.Value.Token);
        Assert.NotNull(result.Value.ExpiresUtc);

        jwtService.Received(1).CreateToken(Arg.Is<Member>(m => m.Id == memberId), false);
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
        var handler = new LoginByDisplayNameCommandHandler(dbContext, jwtService);

        var result = await handler.Handle(new LoginByDisplayNameCommand("Jane Smith"), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(AppResultStatus.Conflict, result.Status);

        jwtService.DidNotReceive().CreateToken(Arg.Any<Member>(), Arg.Any<bool>());
    }

    [Fact]
    public async Task Handle_IgnoresLeadingAndTrailingWhitespace()
    {
        using var dbContext = CreateInMemoryDbContext();
        var memberId = Guid.NewGuid();
        dbContext.Members.Add(new Member
        {
            Id = memberId,
            IsRegistered = true,
            DisplayName = "Alice",
            CreatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var jwtService = CreateJwtService();
        var handler = new LoginByDisplayNameCommandHandler(dbContext, jwtService);

        var result = await handler.Handle(new LoginByDisplayNameCommand("  Alice  "), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal("Alice", result.Value.DisplayName);
    }
}
