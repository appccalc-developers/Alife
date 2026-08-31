using Alife.Application.Abstractions.Security;
using Alife.Application.Common.Models;
using Alife.Application.IdentityAccess;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Alife.Infrastructure.Security;
using Fido2NetLib;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using System.Text.Json;

namespace Alife.Tests.Unit.IdentityAccess;

public sealed class PasskeyRevocationTests
{
    [Fact]
    public async Task BeginAuthentication_WhenDisabled_DoesNotCreateCeremony()
    {
        await using var db = CreateDb();
        var service = CreateService(db, new TestConfiguration(lineEnabled: true, passkeysEnabled: false));

        var result = await service.BeginAuthenticationAsync(null, default);

        Assert.Equal(AppResultStatus.NotFound, result.Status);
        Assert.Equal("passkeys_disabled", result.Message);
        Assert.Empty(db.PasskeyCeremonies);
    }

    [Fact]
    public async Task BeginRegistration_OnPublicDevice_DoesNotCreateCeremonyOrUserHandle()
    {
        await using var db = CreateDb();
        var member = new Member
        {
            Id = Guid.NewGuid(),
            DisplayName = "Member",
            IsRegistered = false,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };
        var flow = new OnboardingFlow
        {
            Id = Guid.NewGuid(),
            TokenHash = [1],
            Intent = OnboardingIntent.Activation,
            IsPublicDevice = true,
            CreatedUtc = DateTime.UtcNow,
            ExpiresUtc = DateTime.UtcNow.AddMinutes(30)
        };
        db.AddRange(member, flow);
        await db.SaveChangesAsync();
        var service = CreateService(db, new TestConfiguration(lineEnabled: true));

        var result = await service.BeginRegistrationAsync(member.Id, flow.Id, false, default);

        Assert.Equal(AppResultStatus.Forbidden, result.Status);
        Assert.Equal("public_device_registration_disabled", result.Message);
        Assert.Null(member.WebAuthnUserHandle);
        Assert.Empty(db.PasskeyCeremonies);
    }

    [Fact]
    public async Task BeginRegistration_FirstCredentialOnly_RejectsAnyHistoricalPasskey()
    {
        await using var db = CreateDb();
        var member = new Member
        {
            Id = Guid.NewGuid(),
            DisplayName = "Alpha tester",
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };
        member.PasskeyCredentials.Add(new MemberPasskeyCredential
        {
            Id = Guid.NewGuid(),
            MemberId = member.Id,
            CredentialId = [1],
            PublicKey = [2],
            UserHandle = [3],
            DisplayName = "Revoked passkey",
            CreatedUtc = DateTime.UtcNow.AddDays(-1),
            RevokedUtc = DateTime.UtcNow
        });
        db.Members.Add(member);
        await db.SaveChangesAsync();
        var service = CreateService(db, new TestConfiguration(lineEnabled: true));

        var result = await service.BeginRegistrationAsync(member.Id, null, true, default);

        Assert.Equal(AppResultStatus.Forbidden, result.Status);
        Assert.Equal("alpha_passkey_bootstrap_invalid", result.Message);
        Assert.Empty(db.PasskeyCeremonies);
    }

    [Fact]
    public async Task CompleteRegistration_AlphaBootstrapCeremony_RechecksHistoricalPasskeys()
    {
        await using var db = CreateDb();
        var member = new Member
        {
            Id = Guid.NewGuid(),
            DisplayName = "Alpha tester",
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };
        member.PasskeyCredentials.Add(new MemberPasskeyCredential
        {
            Id = Guid.NewGuid(),
            MemberId = member.Id,
            CredentialId = [1],
            PublicKey = [2],
            UserHandle = [3],
            DisplayName = "First passkey",
            CreatedUtc = DateTime.UtcNow
        });
        var ceremony = new PasskeyCeremony
        {
            Id = Guid.NewGuid(),
            Kind = PasskeyCeremonyKind.AlphaBootstrapRegistration,
            MemberId = member.Id,
            OptionsJson = "{}",
            CreatedUtc = DateTime.UtcNow,
            ExpiresUtc = DateTime.UtcNow.AddMinutes(5)
        };
        db.AddRange(member, ceremony);
        await db.SaveChangesAsync();
        var service = CreateService(db, new TestConfiguration(lineEnabled: true));
        using var response = JsonDocument.Parse("{}");

        var result = await service.CompleteRegistrationAsync(ceremony.Id, response.RootElement, null, default);

        Assert.Equal(AppResultStatus.Forbidden, result.Status);
        Assert.Equal("alpha_passkey_bootstrap_invalid", result.Message);
        Assert.NotNull(ceremony.ConsumedUtc);
        Assert.Single(db.MemberPasskeyCredentials);
    }

    [Fact]
    public async Task CompleteAuthentication_RejectsExpiredChallengeAndConsumesFailedAttemptOnce()
    {
        await using var db = CreateDb();
        var expired = NewAuthenticationCeremony(DateTime.UtcNow.AddSeconds(-1));
        var active = NewAuthenticationCeremony(DateTime.UtcNow.AddMinutes(5));
        db.AddRange(expired, active);
        await db.SaveChangesAsync();
        var service = CreateService(db, new TestConfiguration(lineEnabled: true));
        using var response = JsonDocument.Parse("{}");

        var expiredResult = await service.CompleteAuthenticationAsync(expired.Id, response.RootElement, default);
        var failedResult = await service.CompleteAuthenticationAsync(active.Id, response.RootElement, default);
        var replayResult = await service.CompleteAuthenticationAsync(active.Id, response.RootElement, default);

        Assert.Equal(AppResultStatus.Conflict, expiredResult.Status);
        Assert.Equal("passkey_challenge_invalid", expiredResult.Message);
        Assert.Equal(AppResultStatus.Forbidden, failedResult.Status);
        Assert.NotNull(active.ConsumedUtc);
        Assert.Equal(AppResultStatus.Conflict, replayResult.Status);
        Assert.Equal("passkey_challenge_invalid", replayResult.Message);
    }

    [Theory]
    [InlineData(null, true, 1, false)]
    [InlineData("line-user", false, 1, false)]
    [InlineData("line-user", true, 1, true)]
    [InlineData(null, true, 2, true)]
    public async Task Revoke_RequiresAnotherCurrentlyAvailableAuthenticator(
        string? lineUid,
        bool lineEnabled,
        int passkeyCount,
        bool expectedSuccess)
    {
        await using var db = CreateDb();
        var member = new Member
        {
            Id = Guid.NewGuid(),
            DisplayName = "Member",
            LineUID = lineUid,
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };
        for (var index = 0; index < passkeyCount; index++)
        {
            member.PasskeyCredentials.Add(new MemberPasskeyCredential
            {
                Id = Guid.NewGuid(),
                MemberId = member.Id,
                CredentialId = [(byte)(index + 1)],
                PublicKey = [1],
                UserHandle = [1],
                DisplayName = $"Passkey {index + 1}",
                CreatedUtc = DateTime.UtcNow
            });
        }
        db.Members.Add(member);
        await db.SaveChangesAsync();
        var targetId = member.PasskeyCredentials.First().Id;
        var service = CreateService(db, new TestConfiguration(lineEnabled));

        var result = await service.RevokeAsync(member.Id, targetId, default);

        Assert.Equal(expectedSuccess, result.IsSuccess);
        Assert.Equal(expectedSuccess ? AppResultStatus.Success : AppResultStatus.Conflict, result.Status);
        Assert.Equal(expectedSuccess, member.PasskeyCredentials.First(item => item.Id == targetId).RevokedUtc is not null);
    }

    private static AlifeDbContext CreateDb()
        => new(new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options);

    private static PasskeyService CreateService(AlifeDbContext db, IIdentityAccessConfiguration configuration)
        => new(
            Substitute.For<IFido2>(),
            db,
            configuration,
            Substitute.For<IJwtTokenService>(),
            Substitute.For<IIdentityAccessService>(),
            new InlineExecutor());

    private static PasskeyCeremony NewAuthenticationCeremony(DateTime expiresUtc)
        => new()
        {
            Id = Guid.NewGuid(),
            Kind = PasskeyCeremonyKind.Authentication,
            OptionsJson = "{}",
            CreatedUtc = DateTime.UtcNow.AddMinutes(-1),
            ExpiresUtc = expiresUtc
        };

    private sealed class TestConfiguration(bool lineEnabled, bool passkeysEnabled = true) : IIdentityAccessConfiguration
    {
        public bool PasskeysEnabled => passkeysEnabled;
        public bool LineLegacyEnabled => lineEnabled;
        public bool ActivationMessagingAvailable => false;
        public bool ExposeActivationLinks => false;
        public bool AlphaLoginEnabled => false;
        public bool IsProduction => false;
        public string FrontendBaseUrl => "https://alife.example";
        public IReadOnlyList<AlphaAccountConfiguration> AlphaAccounts => [];
    }

    private sealed class InlineExecutor : IIdentitySerializableExecutor
    {
        public Task<T> ExecuteAsync<T>(Func<CancellationToken, Task<T>> action, CancellationToken cancellationToken)
            => action(cancellationToken);
    }
}
