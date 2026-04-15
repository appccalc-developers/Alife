using Alife.Application.Abstractions.Integrations;
using Alife.Application.Abstractions.Security;
using Alife.Application.Common.Models;
using Alife.Application.Members.Commands.ConfirmPhoneVerification;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Auth;

public class ConfirmPhoneVerificationCommandHandlerTests
{
    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    private static ITwilioVerifyService CreateSuccessfulTwilioService()
    {
        var twilioService = Substitute.For<ITwilioVerifyService>();
        twilioService.ConfirmCodeAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(AppResult<bool>.Success(true));
        return twilioService;
    }

    private static IJwtTokenService CreateJwtService()
    {
        var jwtService = Substitute.For<IJwtTokenService>();
        var expiresUtc = DateTime.UtcNow.AddDays(7);
        jwtService.CreateToken(Arg.Any<Member>(), Arg.Any<bool>())
            .Returns(("fake-token", expiresUtc));
        return jwtService;
    }

    [Fact]
    public async Task Handle_WithNullMemberId_CreatesNewMemberAndReturnsToken()
    {
        // Arrange
        using var dbContext = CreateInMemoryDbContext();
        var twilioService = CreateSuccessfulTwilioService();
        var jwtService = CreateJwtService();
        var handler = new ConfirmPhoneVerificationCommandHandler(dbContext, twilioService, jwtService);

        var command = new ConfirmPhoneVerificationCommand(null, "+12025551234", "123456");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.NotNull(result.Value.Token);
        Assert.NotNull(result.Value.ExpiresUtc);

        var createdMember = await dbContext.Members.SingleAsync();
        Assert.Equal("+12025551234", createdMember.PhoneE164);
        Assert.NotNull(createdMember.PhoneVerifiedUtc);
        Assert.False(createdMember.IsRegistered);

        jwtService.Received(1).CreateToken(Arg.Any<Member>(), isGuest: true);
    }

    [Fact]
    public async Task Handle_WithExistingMemberId_DoesNotCreateNewMemberOrReturnToken()
    {
        // Arrange
        using var dbContext = CreateInMemoryDbContext();
        var existingMemberId = Guid.NewGuid();
        dbContext.Members.Add(new Member
        {
            Id = existingMemberId,
            IsRegistered = false,
            IsAdmin = false,
            CreatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var twilioService = CreateSuccessfulTwilioService();
        var jwtService = CreateJwtService();
        var handler = new ConfirmPhoneVerificationCommandHandler(dbContext, twilioService, jwtService);

        var command = new ConfirmPhoneVerificationCommand(existingMemberId, "+12025551234", "123456");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Null(result.Value.Token);
        Assert.Null(result.Value.ExpiresUtc);

        var member = await dbContext.Members.SingleAsync();
        Assert.Equal(existingMemberId, member.Id);
        Assert.Equal("+12025551234", member.PhoneE164);

        jwtService.DidNotReceive().CreateToken(Arg.Any<Member>(), Arg.Any<bool>());
    }

    [Fact]
    public async Task Handle_WithNullMemberId_ReturnsExistingRegisteredMemberInfo_WhenPhoneAlreadyRegistered()
    {
        // Arrange
        using var dbContext = CreateInMemoryDbContext();
        var registeredMemberId = Guid.NewGuid();
        dbContext.Members.Add(new Member
        {
            Id = registeredMemberId,
            IsRegistered = true,
            IsAdmin = false,
            PhoneE164 = "+12025551234",
            DisplayName = "Existing User",
            CreatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var twilioService = CreateSuccessfulTwilioService();
        var jwtService = CreateJwtService();
        var handler = new ConfirmPhoneVerificationCommandHandler(dbContext, twilioService, jwtService);

        var command = new ConfirmPhoneVerificationCommand(null, "+12025551234", "123456");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert: The existing registered member's info is surfaced in the response so the
        // frontend can pre-fill the registration form.  A new unregistered member is created
        // for the current session and a token is issued so the user can proceed to /register.
        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Value);
        Assert.Equal("Existing User", result.Value.DisplayName);
        Assert.True(result.Value.IsRegistered);
        Assert.NotNull(result.Value.Token);
    }

    [Fact]
    public async Task Handle_WithInvalidCode_ReturnsValidationError()
    {
        // Arrange
        using var dbContext = CreateInMemoryDbContext();
        var twilioService = Substitute.For<ITwilioVerifyService>();
        twilioService.ConfirmCodeAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(AppResult<bool>.Validation("Invalid code."));
        var jwtService = CreateJwtService();
        var handler = new ConfirmPhoneVerificationCommandHandler(dbContext, twilioService, jwtService);

        var command = new ConfirmPhoneVerificationCommand(null, "+12025551234", "wrong");

        // Act
        var result = await handler.Handle(command, CancellationToken.None);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Equal(AppResultStatus.ValidationError, result.Status);
    }
}
