using Alife.Application.Abstractions.Security;
using Alife.Application.Common.Models;
using Alife.Application.IdentityAccess;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Alife.Infrastructure.Security;
using Fido2NetLib;
using Fido2NetLib.Exceptions;
using Fido2NetLib.Objects;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
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

        var expiredResult = await service.CompleteAuthenticationAsync(expired.Id, response.RootElement, "test-correlation", default);
        var failedResult = await service.CompleteAuthenticationAsync(active.Id, response.RootElement, "test-correlation", default);
        var replayResult = await service.CompleteAuthenticationAsync(active.Id, response.RootElement, "test-correlation", default);

        Assert.Equal(AppResultStatus.Conflict, expiredResult.Status);
        Assert.Equal("passkey_challenge_invalid", expiredResult.Message);
        Assert.Equal(AppResultStatus.Forbidden, failedResult.Status);
        Assert.NotNull(active.ConsumedUtc);
        Assert.Equal(AppResultStatus.Conflict, replayResult.Status);
        Assert.Equal("passkey_challenge_invalid", replayResult.Message);
        Assert.Empty(db.AuditLogs);
    }

    [Fact]
    public async Task CompleteAuthentication_PersistsAndLogsOnlySafeVerificationDiagnostics()
    {
        const string sensitiveExceptionMessage = "sentinel-credential-challenge-signature";
        await using var db = CreateDb();
        var member = new Member
        {
            Id = Guid.NewGuid(),
            DisplayName = "Member",
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
            DisplayName = "Test passkey",
            CreatedUtc = DateTime.UtcNow
        });
        var options = new AssertionOptions
        {
            Challenge = [7],
            Timeout = 60_000,
            RpId = "alife.example",
            AllowCredentials = [],
            UserVerification = UserVerificationRequirement.Required,
            Extensions = new AuthenticationExtensionsClientInputs { Extensions = true }
        };
        var ceremony = NewAuthenticationCeremony(DateTime.UtcNow.AddMinutes(5));
        ceremony.OptionsJson = options.ToJson();
        db.AddRange(member, ceremony);
        await db.SaveChangesAsync();
        var fido2 = Substitute.For<IFido2>();
        fido2.MakeAssertionAsync(Arg.Any<MakeAssertionParams>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<VerifyAssertionResult>(new Fido2VerificationException(
                Fido2ErrorCode.InvalidSignature,
                sensitiveExceptionMessage)));
        var logger = new RecordingLogger<PasskeyService>();
        var service = CreateService(db, new TestConfiguration(lineEnabled: true), fido2, logger);
        using var response = JsonDocument.Parse("""
            {
              "id": "AQ",
              "rawId": "AQ",
              "type": "public-key",
              "response": {
                "authenticatorData": "AQ",
                "clientDataJSON": "AQ",
                "signature": "AQ",
                "userHandle": "Aw"
              },
              "clientExtensionResults": {}
            }
            """);

        var result = await service.CompleteAuthenticationAsync(
            ceremony.Id,
            response.RootElement,
            "trace-700/unsafe",
            default);

        Assert.Equal(AppResultStatus.Forbidden, result.Status);
        Assert.Equal("passkey_verification_failed", result.Message);
        var entry = Assert.Single(logger.Entries);
        Assert.Contains("verify_assertion", entry);
        Assert.Contains(nameof(Fido2VerificationException), entry);
        Assert.Contains(nameof(Fido2ErrorCode.InvalidSignature), entry);
        Assert.Contains("trace-700unsafe", entry);
        Assert.DoesNotContain(sensitiveExceptionMessage, entry);
        Assert.Null(member.PasskeyCredentials.Single().LastUsedUtc);
        var audit = Assert.Single(db.AuditLogs);
        Assert.Null(audit.ActorMemberId);
        Assert.Null(audit.EntityId);
        Assert.Null(audit.TargetMemberId);
        Assert.Equal("identity.passkey.authentication_failed", audit.Action);
        Assert.Equal("PasskeyAuthentication", audit.EntityType);
        Assert.Contains("verify_assertion", audit.MetadataJson);
        Assert.Contains(nameof(Fido2VerificationException), audit.MetadataJson);
        Assert.Contains(nameof(Fido2ErrorCode.InvalidSignature), audit.MetadataJson);
        Assert.Contains("trace-700unsafe", audit.MetadataJson);
        Assert.DoesNotContain(sensitiveExceptionMessage, audit.MetadataJson);
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

    private static PasskeyService CreateService(
        AlifeDbContext db,
        IIdentityAccessConfiguration configuration,
        IFido2? fido2 = null,
        ILogger<PasskeyService>? logger = null)
        => new(
            fido2 ?? Substitute.For<IFido2>(),
            db,
            configuration,
            Substitute.For<IJwtTokenService>(),
            Substitute.For<IIdentityAccessService>(),
            new InlineExecutor(),
            logger ?? NullLogger<PasskeyService>.Instance);

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

    private sealed class RecordingLogger<T> : ILogger<T>
    {
        public List<string> Entries { get; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull
            => NoopScope.Instance;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
            => Entries.Add(formatter(state, exception));

        private sealed class NoopScope : IDisposable
        {
            public static NoopScope Instance { get; } = new();
            public void Dispose() { }
        }
    }
}
