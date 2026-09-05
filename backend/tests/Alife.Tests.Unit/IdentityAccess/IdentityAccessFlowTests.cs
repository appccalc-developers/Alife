using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Alife.Application.Abstractions.Security;
using Alife.Api.Controllers;
using Alife.Api.Identity;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.IdentityAccess;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Alife.Infrastructure.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using NSubstitute;

namespace Alife.Tests.Unit.IdentityAccess;

public sealed partial class IdentityAccessFlowTests
{
    [Fact]
    public async Task CreateAndResumeFlow_PreservesPublicDeviceAndSafeReturnPath()
    {
        await using var fixture = CreateFixture();

        var created = await fixture.Service.CreateFlowAsync("/groups/abc?tab=applications", true, OnboardingIntent.GroupJoin, default);
        var resumed = await fixture.Service.ResumeFlowAsync(created.Value!.Token, default);

        Assert.True(resumed.IsSuccess);
        Assert.True(resumed.Value!.IsPublicDevice);
        Assert.Equal("groupJoin", resumed.Value.Intent);
        Assert.Equal("/groups/abc?tab=applications", resumed.Value.ReturnPath);
    }

    [Theory]
    [InlineData("https://evil.example/steal")]
    [InlineData("//evil.example/steal")]
    [InlineData("/groups\\escape")]
    [InlineData("/onboarding")]
    public async Task CreateFlow_DropsUnsafeOrLoopingReturnPath(string returnPath)
    {
        await using var fixture = CreateFixture();

        var created = await fixture.Service.CreateFlowAsync(returnPath, false, OnboardingIntent.SignIn, default);

        Assert.True(created.IsSuccess);
        Assert.Empty(created.Value!.Context.ReturnPath);
    }

    [Fact]
    public async Task ResumeFlow_RejectsMissingAndExpiredTokens()
    {
        await using var fixture = CreateFixture();
        var missing = await fixture.Service.ResumeFlowAsync("unknown", default);
        var created = await fixture.Service.CreateFlowAsync("/enter", false, OnboardingIntent.SignIn, default);
        var entity = await fixture.Db.OnboardingFlows.SingleAsync();
        entity.ExpiresUtc = DateTime.UtcNow.AddMinutes(-1);
        await fixture.Db.SaveChangesAsync();

        var expired = await fixture.Service.ResumeFlowAsync(created.Value!.Token, default);

        Assert.Equal(AppResultStatus.NotFound, missing.Status);
        Assert.Equal("onboarding_flow_invalid", missing.Message);
        Assert.Equal(AppResultStatus.NotFound, expired.Status);
    }

    [Fact]
    public async Task LineState_IsFlowBoundAndConsumedOnce()
    {
        await using var fixture = CreateFixture();
        var created = await fixture.Service.CreateFlowAsync("/tasks", false, OnboardingIntent.LineLegacy, default);
        var token = created.Value!.Token;

        Assert.True((await fixture.Service.BindLineStateAsync(token, "oauth-state", default)).IsSuccess);
        Assert.Equal(AppResultStatus.NotFound, (await fixture.Service.ConsumeLineStateAsync(token, "wrong-state", default)).Status);
        Assert.True((await fixture.Service.ConsumeLineStateAsync(token, "oauth-state", default)).IsSuccess);
        Assert.Equal(AppResultStatus.NotFound, (await fixture.Service.ConsumeLineStateAsync(token, "oauth-state", default)).Status);
    }

    [Fact]
    public async Task AlphaLogin_WhenDisabled_IsNotDiscoverable()
    {
        await using var fixture = CreateFixture(alphaEnabled: false);

        Assert.Empty(fixture.Service.ListAlphaAccounts());
        var result = await fixture.Service.AlphaLoginAsync("configured", null, default);

        Assert.Equal(AppResultStatus.NotFound, result.Status);
        Assert.Equal("alpha_login_disabled", result.Message);
    }

    [Fact]
    public async Task AlphaLogin_InvalidAccount_IsDeniedAndAuditedWithoutAccountMetadata()
    {
        await using var fixture = CreateFixture(alphaEnabled: true);

        var result = await fixture.Service.AlphaLoginAsync("not-configured", null, default);

        Assert.Equal(AppResultStatus.Forbidden, result.Status);
        var audit = await fixture.Db.AuditLogs.SingleAsync();
        Assert.Equal("identity.alpha.denied", audit.Action);
        Assert.Null(audit.MetadataJson);
    }

    [Fact]
    public async Task AlphaLogin_RegisteredWhitelistedMember_GetsShortNonPersistentSession()
    {
        var memberId = Guid.NewGuid();
        await using var fixture = CreateFixture(alphaEnabled: true, alphaMemberId: memberId);
        fixture.Db.Members.Add(new Member
        {
            Id = memberId,
            DisplayName = "Alpha tester",
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await fixture.Db.SaveChangesAsync();
        fixture.Jwt.CreateToken(Arg.Any<Member>(), "alpha", "alpha", TimeSpan.FromHours(12))
            .Returns(("signed-token", DateTime.UtcNow.AddHours(12)));

        var result = await fixture.Service.AlphaLoginAsync("configured", null, default);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value!.Persistent);
        Assert.Equal("alpha", result.Value.AuthenticationMethod);
        Assert.Equal("alpha", result.Value.SessionKind);
        Assert.Equal("/enter", result.Value.ReturnPath);
        Assert.Contains(await fixture.Db.AuditLogs.ToListAsync(), audit => audit.Action == "identity.alpha.signed_in");
    }

    [Fact]
    public async Task AlphaLogin_ValidBootstrapCode_AllowsOnlyFirstPasskeyRegistrationWindow()
    {
        const string bootstrapCode = "stephen-alpha-bootstrap-code-123456";
        var memberId = Guid.NewGuid();
        await using var fixture = CreateFixture(
            alphaEnabled: true,
            alphaMemberId: memberId,
            passkeyBootstrapCode: bootstrapCode);
        fixture.Db.Members.Add(new Member
        {
            Id = memberId,
            DisplayName = "Stephen",
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await fixture.Db.SaveChangesAsync();
        fixture.Jwt.CreateToken(Arg.Any<Member>(), "alpha_bootstrap", "alpha", TimeSpan.FromHours(12))
            .Returns(("bootstrap-token", DateTime.UtcNow.AddHours(12)));

        var result = await fixture.Service.AlphaLoginAsync("configured", bootstrapCode, default);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value!.Persistent);
        Assert.Equal("alpha_bootstrap", result.Value.AuthenticationMethod);
        Assert.Equal("alpha", result.Value.SessionKind);
        Assert.Equal("/profile", result.Value.ReturnPath);
        var audit = await fixture.Db.AuditLogs.SingleAsync();
        Assert.Equal("identity.alpha.bootstrap_authenticated", audit.Action);
        Assert.Null(audit.MetadataJson);
    }

    [Fact]
    public async Task AlphaLogin_InvalidBootstrapCode_IsDeniedWithoutSecretMetadata()
    {
        const string bootstrapCode = "stephen-alpha-bootstrap-code-123456";
        var memberId = Guid.NewGuid();
        await using var fixture = CreateFixture(
            alphaEnabled: true,
            alphaMemberId: memberId,
            passkeyBootstrapCode: bootstrapCode);
        fixture.Db.Members.Add(new Member
        {
            Id = memberId,
            DisplayName = "Stephen",
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await fixture.Db.SaveChangesAsync();

        var result = await fixture.Service.AlphaLoginAsync("configured", "incorrect-bootstrap-code-123456", default);

        Assert.Equal(AppResultStatus.Forbidden, result.Status);
        Assert.Equal("alpha_passkey_bootstrap_invalid", result.Message);
        var audit = await fixture.Db.AuditLogs.SingleAsync();
        Assert.Equal("identity.alpha.bootstrap_denied", audit.Action);
        Assert.Null(audit.ActorMemberId);
        Assert.Null(audit.MetadataJson);
        fixture.Jwt.DidNotReceiveWithAnyArgs().CreateToken(default!, default!, default!, default);
    }

    [Fact]
    public async Task AlphaLogin_UnconfiguredBootstrapCode_IsDeniedWithoutSecretMetadata()
    {
        var memberId = Guid.NewGuid();
        await using var fixture = CreateFixture(alphaEnabled: true, alphaMemberId: memberId);
        fixture.Db.Members.Add(new Member
        {
            Id = memberId,
            DisplayName = "Stephen",
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await fixture.Db.SaveChangesAsync();

        var result = await fixture.Service.AlphaLoginAsync(
            "configured",
            "unconfigured-bootstrap-code-123456",
            default);

        Assert.Equal(AppResultStatus.Forbidden, result.Status);
        Assert.Equal("alpha_passkey_bootstrap_invalid", result.Message);
        var audit = await fixture.Db.AuditLogs.SingleAsync();
        Assert.Equal("identity.alpha.bootstrap_denied", audit.Action);
        Assert.Null(audit.ActorMemberId);
        Assert.Null(audit.MetadataJson);
        fixture.Jwt.DidNotReceiveWithAnyArgs().CreateToken(default!, default!, default!, default);
    }

    [Fact]
    public async Task AlphaLogin_BootstrapCodeCannotBeReusedAfterAnyPasskeyExisted()
    {
        const string bootstrapCode = "stephen-alpha-bootstrap-code-123456";
        var memberId = Guid.NewGuid();
        await using var fixture = CreateFixture(
            alphaEnabled: true,
            alphaMemberId: memberId,
            passkeyBootstrapCode: bootstrapCode);
        fixture.Db.Members.Add(new Member
        {
            Id = memberId,
            DisplayName = "Stephen",
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        fixture.Db.MemberPasskeyCredentials.Add(new MemberPasskeyCredential
        {
            Id = Guid.NewGuid(),
            MemberId = memberId,
            CredentialId = [1],
            PublicKey = [2],
            UserHandle = [3],
            DisplayName = "Revoked passkey",
            CreatedUtc = DateTime.UtcNow.AddDays(-1),
            RevokedUtc = DateTime.UtcNow
        });
        await fixture.Db.SaveChangesAsync();

        var result = await fixture.Service.AlphaLoginAsync("configured", bootstrapCode, default);

        Assert.Equal(AppResultStatus.Forbidden, result.Status);
        Assert.Equal("alpha_passkey_bootstrap_invalid", result.Message);
        Assert.Contains(await fixture.Db.AuditLogs.ToListAsync(), audit =>
            audit.Action == "identity.alpha.bootstrap_denied" && audit.MetadataJson == null);
    }

    [Fact]
    public void AlphaLogin_ExplicitlyEnabledProductionConfiguration_RemainsEnabled()
    {
        var values = new Dictionary<string, string?>
        {
            ["AlphaLogin:Enabled"] = "true"
        };
        var environment = Substitute.For<IHostEnvironment>();
        environment.EnvironmentName.Returns(Environments.Production);

        var configuration = new IdentityAccessConfiguration(
            new ConfigurationBuilder().AddInMemoryCollection(values).Build(),
            environment);

        Assert.True(configuration.AlphaLoginEnabled);
        Assert.True(configuration.IsProduction);
    }

    [Fact]
    public void AlphaLoginConfiguration_BindsStephenBootstrapCodeAsHashOnly()
    {
        const string bootstrapCode = "stephen-alpha-bootstrap-code-123456";
        var values = new Dictionary<string, string?>
        {
            ["AlphaLogin:Enabled"] = "true",
            ["AlphaLogin:Accounts:0:AccountId"] = "Stephen",
            ["AlphaLogin:Accounts:0:MemberId"] = "22222222-2222-2222-2222-222222222222",
            ["AlphaLogin:Accounts:0:Label"] = "Stephen Alpha Test",
            ["AlphaLogin:PasskeyBootstrapCodes:Stephen"] = bootstrapCode
        };
        var environment = Substitute.For<IHostEnvironment>();
        environment.EnvironmentName.Returns(Environments.Development);

        var configuration = new IdentityAccessConfiguration(
            new ConfigurationBuilder().AddInMemoryCollection(values).Build(),
            environment);

        var account = Assert.Single(configuration.AlphaAccounts);
        Assert.Equal("Stephen", account.AccountId);
        Assert.Equal(SHA256.HashData(Encoding.UTF8.GetBytes(bootstrapCode)), account.PasskeyBootstrapCodeHash);
        Assert.False(Encoding.UTF8.GetBytes(bootstrapCode).SequenceEqual(account.PasskeyBootstrapCodeHash!));
    }

    [Fact]
    public void AlphaLoginConfiguration_IgnoresShortBootstrapCode()
    {
        var values = new Dictionary<string, string?>
        {
            ["AlphaLogin:Accounts:0:AccountId"] = "Stephen",
            ["AlphaLogin:Accounts:0:MemberId"] = "22222222-2222-2222-2222-222222222222",
            ["AlphaLogin:Accounts:0:Label"] = "Stephen Alpha Test",
            ["AlphaLogin:PasskeyBootstrapCodes:Stephen"] = "too-short"
        };
        var environment = Substitute.For<IHostEnvironment>();
        environment.EnvironmentName.Returns(Environments.Development);

        var configuration = new IdentityAccessConfiguration(
            new ConfigurationBuilder().AddInMemoryCollection(values).Build(),
            environment);

        Assert.Null(Assert.Single(configuration.AlphaAccounts).PasskeyBootstrapCodeHash);
    }

    [Fact]
    public async Task AlphaLogin_ExplicitlyEnabledInProduction_GetsShortNonPersistentSession()
    {
        var memberId = Guid.NewGuid();
        await using var fixture = CreateFixture(alphaEnabled: true, alphaMemberId: memberId, isProduction: true);
        fixture.Db.Members.Add(new Member
        {
            Id = memberId,
            DisplayName = "Production alpha tester",
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await fixture.Db.SaveChangesAsync();
        fixture.Jwt.CreateToken(Arg.Any<Member>(), "alpha", "alpha", TimeSpan.FromHours(12))
            .Returns(("signed-token", DateTime.UtcNow.AddHours(12)));

        var result = await fixture.Service.AlphaLoginAsync("configured", null, default);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value!.Persistent);
    }

    [Fact]
    public void AlphaLoginAccounts_ExplicitlyEnabledInProduction_AreDiscoverable()
    {
        var identityAccess = Substitute.For<IIdentityAccessService>();
        identityAccess.ListAlphaAccounts().Returns([new AlphaAccountDto("configured", "Configured account")]);
        var configuration = Substitute.For<IIdentityAccessConfiguration>();
        configuration.AlphaLoginEnabled.Returns(true);
        configuration.IsProduction.Returns(true);
        var controller = new InternalAlphaLoginController(
            identityAccess,
            configuration,
            Substitute.For<IServerRateLimiter>(),
            new ConfigurationBuilder().Build())
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };

        var result = controller.Accounts();

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.IsAssignableFrom<IReadOnlyList<AlphaAccountDto>>(ok.Value);
    }

    [Theory]
    [InlineData(ActivationStatus.PendingDelivery, false, AppResultStatus.Conflict, "activation_not_delivered")]
    [InlineData(ActivationStatus.Used, false, AppResultStatus.Conflict, "activation_used")]
    [InlineData(ActivationStatus.Revoked, false, AppResultStatus.Conflict, "activation_revoked")]
    [InlineData(ActivationStatus.Active, true, AppResultStatus.Conflict, "activation_expired")]
    [InlineData(ActivationStatus.Active, false, AppResultStatus.Success, null)]
    public async Task ResolveActivation_EnforcesInvitationLifecycle(
        ActivationStatus status,
        bool expired,
        AppResultStatus expectedStatus,
        string? expectedCode)
    {
        await using var fixture = CreateFixture();
        var member = NewMember(isRegistered: false);
        var secret = fixture.TokenService.CreateSecret();
        fixture.Db.Members.Add(member);
        fixture.Db.MemberActivationInvitations.Add(new MemberActivationInvitation
        {
            Id = Guid.NewGuid(),
            MemberId = member.Id,
            IssuedByMemberId = member.Id,
            Selector = "activation-selector",
            SecretHash = fixture.TokenService.HashToken(secret),
            Status = status,
            DeliveryStatus = MessageDeliveryStatus.Sent,
            CreatedUtc = DateTime.UtcNow.AddMinutes(-5),
            ExpiresUtc = expired ? DateTime.UtcNow.AddMinutes(-1) : DateTime.UtcNow.AddHours(1)
        });
        await fixture.Db.SaveChangesAsync();

        var result = await fixture.Service.ResolveActivationAsync(
            "activation-selector", secret, false, "/tasks", default);

        Assert.Equal(expectedStatus, result.Status);
        Assert.Equal(expectedCode, result.Message);
        if (result.IsSuccess)
        {
            Assert.Equal("activation", result.Value!.Context.Intent);
            Assert.Equal("/tasks", result.Value.Context.ReturnPath);
        }
    }

    [Theory]
    [InlineData(ActivationStatus.Revoked, false)]
    [InlineData(ActivationStatus.Used, false)]
    [InlineData(ActivationStatus.IdentityMismatch, false)]
    [InlineData(ActivationStatus.Active, true)]
    public async Task GetActiveFlow_RejectsActivationThatBecameUnavailable(
        ActivationStatus status,
        bool expired)
    {
        await using var fixture = CreateFixture();
        var member = NewMember(isRegistered: false);
        var secret = fixture.TokenService.CreateSecret();
        var invitation = new MemberActivationInvitation
        {
            Id = Guid.NewGuid(),
            MemberId = member.Id,
            IssuedByMemberId = member.Id,
            Selector = "activation-selector",
            SecretHash = fixture.TokenService.HashToken(secret),
            Status = ActivationStatus.Active,
            DeliveryStatus = MessageDeliveryStatus.Sent,
            CreatedUtc = DateTime.UtcNow.AddMinutes(-5),
            ExpiresUtc = DateTime.UtcNow.AddHours(1)
        };
        fixture.Db.AddRange(member, invitation);
        await fixture.Db.SaveChangesAsync();
        var resolved = await fixture.Service.ResolveActivationAsync(
            invitation.Selector,
            secret,
            false,
            "/profile",
            default);
        Assert.True(resolved.IsSuccess);

        invitation.Status = status;
        invitation.ExpiresUtc = expired ? DateTime.UtcNow.AddSeconds(-1) : invitation.ExpiresUtc;
        await fixture.Db.SaveChangesAsync();

        Assert.Null(await fixture.Service.GetActiveFlowAsync(resolved.Value!.Token, default));
    }

    [Fact]
    public async Task ResolveActivation_IgnoresLegacyPublicDeviceRequest()
    {
        await using var fixture = CreateFixture();
        var member = NewMember(isRegistered: false);
        var secret = fixture.TokenService.CreateSecret();
        fixture.Db.Members.Add(member);
        fixture.Db.MemberActivationInvitations.Add(new MemberActivationInvitation
        {
            Id = Guid.NewGuid(),
            MemberId = member.Id,
            IssuedByMemberId = member.Id,
            Selector = "mobile-only-activation",
            SecretHash = fixture.TokenService.HashToken(secret),
            Status = ActivationStatus.Active,
            DeliveryStatus = MessageDeliveryStatus.Sent,
            CreatedUtc = DateTime.UtcNow,
            ExpiresUtc = DateTime.UtcNow.AddHours(1)
        });
        await fixture.Db.SaveChangesAsync();

        var result = await fixture.Service.ResolveActivationAsync(
            "mobile-only-activation", secret, true, "/profile", default);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value!.Context.IsPublicDevice);
        Assert.False((await fixture.Db.OnboardingFlows.SingleAsync()).IsPublicDevice);
    }

    [Theory]
    [InlineData(ActivationStatus.Active, false, true)]
    [InlineData(ActivationStatus.Revoked, false, false)]
    [InlineData(ActivationStatus.Used, false, false)]
    [InlineData(ActivationStatus.Active, true, false)]
    public async Task CompletePasskeyActivation_RequiresActiveInvitationAndPendingCredential(
        ActivationStatus status,
        bool expired,
        bool expectedSuccess)
    {
        await using var fixture = CreateFixture();
        var member = NewMember(isRegistered: false);
        var invitation = new MemberActivationInvitation
        {
            Id = Guid.NewGuid(),
            MemberId = member.Id,
            IssuedByMemberId = member.Id,
            Selector = "activation-selector",
            SecretHash = [1],
            Status = status,
            DeliveryStatus = MessageDeliveryStatus.Sent,
            CreatedUtc = DateTime.UtcNow.AddMinutes(-5),
            ExpiresUtc = expired ? DateTime.UtcNow.AddSeconds(-1) : DateTime.UtcNow.AddHours(1)
        };
        var flow = new OnboardingFlow
        {
            Id = Guid.NewGuid(),
            TokenHash = [2],
            Intent = OnboardingIntent.Activation,
            ActivationInvitationId = invitation.Id,
            CreatedUtc = DateTime.UtcNow,
            ExpiresUtc = DateTime.UtcNow.AddMinutes(30)
        };
        fixture.Db.AddRange(member, invitation, flow);
        await fixture.Db.SaveChangesAsync();
        var pendingCredential = new MemberPasskeyCredential
        {
            Id = Guid.NewGuid(),
            MemberId = member.Id,
            CredentialId = [3],
            PublicKey = [4],
            UserHandle = [5],
            DisplayName = "Pending passkey",
            CreatedUtc = DateTime.UtcNow
        };
        fixture.Db.MemberPasskeyCredentials.Add(pendingCredential);
        fixture.Jwt.CreateToken(Arg.Any<Member>(), "passkey", "standard", TimeSpan.FromDays(30))
            .Returns(("activation-token", DateTime.UtcNow.AddDays(30)));

        var result = await fixture.Service.CompletePasskeyActivationAsync(
            flow.Id,
            pendingCredential.Id,
            default);

        Assert.Equal(expectedSuccess, result.IsSuccess);
        if (expectedSuccess)
        {
            Assert.Equal(ActivationStatus.Used, invitation.Status);
            Assert.True(member.IsRegistered);
            Assert.Equal(EntityState.Unchanged, fixture.Db.Entry(pendingCredential).State);
        }
        else
        {
            Assert.Equal(AppResultStatus.Conflict, result.Status);
            Assert.False(member.IsRegistered);
            Assert.Equal(EntityState.Added, fixture.Db.Entry(pendingCredential).State);
        }
    }

    [Fact]
    public async Task CompletePasskeyActivation_RejectsCredentialThatWasAlreadyPersisted()
    {
        await using var fixture = CreateFixture();
        var member = NewMember(isRegistered: false);
        var invitation = new MemberActivationInvitation
        {
            Id = Guid.NewGuid(),
            MemberId = member.Id,
            IssuedByMemberId = member.Id,
            Selector = "activation-selector",
            SecretHash = [1],
            Status = ActivationStatus.Active,
            DeliveryStatus = MessageDeliveryStatus.Sent,
            CreatedUtc = DateTime.UtcNow,
            ExpiresUtc = DateTime.UtcNow.AddHours(1)
        };
        var flow = new OnboardingFlow
        {
            Id = Guid.NewGuid(),
            TokenHash = [2],
            Intent = OnboardingIntent.Activation,
            ActivationInvitationId = invitation.Id,
            CreatedUtc = DateTime.UtcNow,
            ExpiresUtc = DateTime.UtcNow.AddMinutes(30)
        };
        var credential = new MemberPasskeyCredential
        {
            Id = Guid.NewGuid(),
            MemberId = member.Id,
            CredentialId = [3],
            PublicKey = [4],
            UserHandle = [5],
            DisplayName = "Persisted passkey",
            CreatedUtc = DateTime.UtcNow
        };
        fixture.Db.AddRange(member, invitation, flow, credential);
        await fixture.Db.SaveChangesAsync();

        var result = await fixture.Service.CompletePasskeyActivationAsync(
            flow.Id,
            credential.Id,
            default);

        Assert.Equal(AppResultStatus.Conflict, result.Status);
        Assert.Equal("passkey_required", result.Message);
        Assert.False(member.IsRegistered);
        Assert.Equal(ActivationStatus.Active, invitation.Status);
    }

    [Fact]
    public async Task GroupInviteLifecycle_RotatesAtomicallyAndExpiresOldCurrentInvite()
    {
        await using var fixture = CreateFixture();
        var actorId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        fixture.GroupAuthorization.IsLeaderOrCoLeaderAsync(groupId, actorId, Arg.Any<CancellationToken>()).Returns(true);
        fixture.Db.Groups.Add(new Group { Id = groupId, NameJson = "{\"en\":\"Group\",\"zh\":\"小组\"}", CreatedUtc = now, UpdatedUtc = now });
        await fixture.Db.SaveChangesAsync();

        var created = await fixture.Service.GetOrCreateGroupInviteAsync(actorId, groupId, default);
        Assert.True(created.IsSuccess);
        Assert.Contains("/join/", created.Value!.JoinUrl);
        Assert.DoesNotContain(groupId.ToString(), created.Value.JoinUrl, StringComparison.OrdinalIgnoreCase);
        Assert.True((await fixture.Service.ChangeGroupInviteStatusAsync(actorId, groupId, "pause", default)).IsSuccess);
        Assert.True((await fixture.Service.ChangeGroupInviteStatusAsync(actorId, groupId, "resume", default)).IsSuccess);
        var rotated = await fixture.Service.ChangeGroupInviteStatusAsync(actorId, groupId, "rotate", default);

        Assert.True(rotated.IsSuccess);
        Assert.NotEqual(created.Value.Id, rotated.Value!.Id);
        Assert.Equal(GroupJoinInviteStatus.Rotated, (await fixture.Db.GroupJoinInvites.SingleAsync(item => item.Id == created.Value.Id)).Status);
        Assert.Equal(GroupJoinInviteStatus.Active, (await fixture.Db.GroupJoinInvites.SingleAsync(item => item.Id == rotated.Value.Id)).Status);

        var current = await fixture.Db.GroupJoinInvites.SingleAsync(item => item.Id == rotated.Value.Id);
        current.ExpiresUtc = DateTime.UtcNow.AddMinutes(-1);
        await fixture.Db.SaveChangesAsync();
        var replaced = await fixture.Service.GetOrCreateGroupInviteAsync(actorId, groupId, default);

        Assert.True(replaced.IsSuccess);
        Assert.NotEqual(current.Id, replaced.Value!.Id);
        Assert.Equal(GroupJoinInviteStatus.Expired, current.Status);
    }

    [Fact]
    public async Task AnonymousGroupApplication_CreatesApplicationsWithoutAccountOrMembership()
    {
        await using var fixture = CreateFixture();
        var groupId = Guid.NewGuid();
        var invite = NewJoinInvite(groupId);
        fixture.Db.Groups.Add(new Group { Id = groupId, NameJson = "{\"en\":\"Group\",\"zh\":\"小组\"}", CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow });
        fixture.Db.GroupJoinInvites.Add(invite);
        await fixture.Db.SaveChangesAsync();
        var signature = fixture.TokenService.SignGroupInvite(invite.Selector, invite.Version);
        var flow = await fixture.Service.ResolveGroupInviteAsync(invite.Selector, signature, false, null, default);

        var result = await fixture.Service.SubmitGroupApplicationAsync(
            flow.Value!.Token,
            null,
            new SubmitGroupApplicationRequest(
                "New applicant", "+64210000000", "sms", "en", "I want to join.",
                "group-application-v1", true, string.Empty,
                DateTimeOffset.UtcNow.AddSeconds(-3).ToUnixTimeMilliseconds()),
            default);

        Assert.True(result.IsSuccess);
        Assert.Equal(0, await fixture.Db.Members.CountAsync());
        Assert.Equal(0, await fixture.Db.GroupMemberships.CountAsync());
        Assert.Equal(1, await fixture.Db.ChurchPersonApplications.CountAsync());
        Assert.Equal(1, await fixture.Db.GroupMembershipApplications.CountAsync());
    }

    [Fact]
    public async Task ManualActivation_CreateListAndRegenerate_ExposeSecretOnlyInMutationResponses()
    {
        await using var fixture = CreateFixture();
        var actorId = Guid.NewGuid();
        var churchId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        fixture.GroupAuthorization.IsAdminAsync(actorId, Arg.Any<CancellationToken>()).Returns(true);
        fixture.Db.Groups.Add(new Group
        {
            Id = churchId,
            IsChurch = true,
            NameJson = "{}",
            CreatedUtc = now,
            UpdatedUtc = now
        });
        await fixture.Db.SaveChangesAsync();

        var first = await fixture.Service.CreateActivationAsync(
            actorId,
            new CreateActivationRequest("Preset member", "+64210000001", ActivationPurpose.FirstActivation, []),
            default);

        Assert.True(first.IsSuccess);
        Assert.Equal(ActivationStatus.Active, first.Value!.Status);
        Assert.Equal(MessageDeliveryStatus.Manual, first.Value.DeliveryStatus);
        Assert.Equal("+64210000001", first.Value.ManualActivationMessage!.RecipientPhoneE164);
        var firstMessage = first.Value.ManualActivationMessage.Message;
        var firstUrl = firstMessage.Split('\n').Last();
        Assert.Equal(
            $"ALIFE 帐号激活 / Account activation\n" +
            $"请在手机打开以下链接并建立 Passkey / Open this link on your phone to create a Passkey:\n" +
            firstUrl,
            firstMessage);
        var firstSecret = firstUrl[(firstUrl.IndexOf('#') + 1)..];
        var persisted = await fixture.Db.MemberActivationInvitations.SingleAsync();
        Assert.True(fixture.TokenService.VerifyToken(firstSecret, persisted.SecretHash));
        Assert.Equal(persisted.CreatedUtc.AddHours(72), persisted.ExpiresUtc);
        Assert.DoesNotContain(firstSecret, JsonSerializer.Serialize(new
        {
            persisted.Selector,
            persisted.SecretHash,
            persisted.DeliveryErrorCode
        }), StringComparison.Ordinal);
        Assert.DoesNotContain(firstSecret, JsonSerializer.Serialize(await fixture.Db.AuditLogs.AsNoTracking().ToListAsync()), StringComparison.Ordinal);

        var listed = await fixture.Service.ListActivationsAsync(actorId, default);

        Assert.True(listed.IsSuccess);
        var listedInvitation = Assert.Single(listed.Value!);
        Assert.Null(listedInvitation.ManualActivationMessage);
        Assert.Equal("•••• 0001", listedInvitation.MaskedPhone);
        Assert.DoesNotContain("manualActivationMessage", JsonSerializer.Serialize(listed.Value), StringComparison.OrdinalIgnoreCase);

        var regenerated = await fixture.Service.ResendActivationAsync(actorId, first.Value.Id, default);

        Assert.True(regenerated.IsSuccess);
        Assert.NotNull(regenerated.Value!.ManualActivationMessage);
        Assert.NotEqual(firstMessage, regenerated.Value.ManualActivationMessage.Message);
        Assert.Equal(
            ActivationStatus.Revoked,
            (await fixture.Db.MemberActivationInvitations.SingleAsync(item => item.Id == first.Value.Id)).Status);
        Assert.Equal(2, await fixture.Db.MemberActivationInvitations.CountAsync());
    }

    [Fact]
    public async Task ManualActivation_GenerateListAndRegenerateRequireChurchManagementPermission()
    {
        await using var fixture = CreateFixture();
        var authorizedActorId = Guid.NewGuid();
        var unauthorizedActorId = Guid.NewGuid();
        fixture.GroupAuthorization.IsAdminAsync(authorizedActorId, Arg.Any<CancellationToken>()).Returns(true);
        fixture.Db.Groups.Add(new Group
        {
            Id = Guid.NewGuid(),
            IsChurch = true,
            NameJson = "{}",
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await fixture.Db.SaveChangesAsync();

        var created = await fixture.Service.CreateActivationAsync(
            authorizedActorId,
            new CreateActivationRequest("Preset member", "+64210000001", ActivationPurpose.FirstActivation, []),
            default);
        var generate = await fixture.Service.CreateActivationAsync(
            unauthorizedActorId,
            new CreateActivationRequest("Another member", "+64210000002", ActivationPurpose.FirstActivation, []),
            default);
        var list = await fixture.Service.ListActivationsAsync(unauthorizedActorId, default);
        var regenerate = await fixture.Service.ResendActivationAsync(unauthorizedActorId, created.Value!.Id, default);

        Assert.True(created.IsSuccess);
        Assert.Equal(AppResultStatus.Forbidden, generate.Status);
        Assert.Equal(AppResultStatus.Forbidden, list.Status);
        Assert.Equal(AppResultStatus.Forbidden, regenerate.Status);
        Assert.Single(await fixture.Db.MemberActivationInvitations.ToListAsync());
    }

    [Fact]
    public async Task ManualPasskeyRecovery_ExpiresAfterTenMinutes()
    {
        await using var fixture = CreateFixture();
        var actorId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        fixture.GroupAuthorization.IsAdminAsync(actorId, Arg.Any<CancellationToken>()).Returns(true);
        fixture.Db.Groups.Add(new Group
        {
            Id = Guid.NewGuid(),
            IsChurch = true,
            NameJson = "{}",
            CreatedUtc = now,
            UpdatedUtc = now
        });
        fixture.Db.Members.Add(new Member
        {
            Id = Guid.NewGuid(),
            DisplayName = "Recovery member",
            PhoneE164 = "+64210000003",
            IsRegistered = true,
            CreatedUtc = now,
            UpdatedUtc = now
        });
        await fixture.Db.SaveChangesAsync();

        var result = await fixture.Service.CreateActivationAsync(
            actorId,
            new CreateActivationRequest("Recovery member", "+64210000003", ActivationPurpose.PasskeyRecovery, [], IdentityVerified: true),
            default);

        Assert.True(result.IsSuccess);
        var persisted = await fixture.Db.MemberActivationInvitations.SingleAsync();
        Assert.Equal(persisted.CreatedUtc.AddMinutes(10), persisted.ExpiresUtc);
        Assert.Equal(MessageDeliveryStatus.Manual, result.Value!.DeliveryStatus);
    }

    [Fact]
    public async Task VerifiedGroupLeaderApproval_MaterializesMembershipAndReturnsManualActivationMessage()
    {
        await using var fixture = CreateFixture();
        var groupActorId = Guid.NewGuid();
        var churchId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var personId = Guid.NewGuid();
        var applicationId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        fixture.GroupAuthorization.IsLeaderOrCoLeaderAsync(groupId, groupActorId, Arg.Any<CancellationToken>()).Returns(true);
        fixture.Db.Groups.AddRange(
            new Group { Id = churchId, IsChurch = true, NameJson = "{}", CreatedUtc = now, UpdatedUtc = now },
            new Group { Id = groupId, NameJson = "{}", CreatedUtc = now, UpdatedUtc = now });
        var person = NewPerson(personId, now);
        fixture.Db.ChurchPersonApplications.Add(person);
        fixture.Db.GroupMembershipApplications.Add(NewApplication(applicationId, groupId, person, now));
        await fixture.Db.SaveChangesAsync();
        fixture.Db.ChangeTracker.Clear();

        var groupDecision = await fixture.Service.DecideGroupApplicationAsync(
            groupActorId, groupId, applicationId,
            new DecideMembershipApplicationRequest(
                ApplicationDecisionKind.Approved,
                null,
                "AA==",
                ContactVerified: true),
            default);

        Assert.True(groupDecision.IsSuccess);
        Assert.Equal("approved", groupDecision.Value!.Status);
        Assert.Equal("approved", groupDecision.Value.PersonStatus);
        Assert.True(groupDecision.Value.IsContactVerified);
        Assert.Equal("manual", groupDecision.Value.ActivationDeliveryStatus);
        Assert.NotNull(groupDecision.Value.ManualActivationMessage);
        Assert.Equal("+64210000000", groupDecision.Value.ManualActivationMessage.RecipientPhoneE164);
        Assert.StartsWith(
            "ALIFE 帐号激活 / Account activation\n请在手机打开以下链接并建立 Passkey / Open this link on your phone to create a Passkey:\nhttps://alife.example/activate/",
            groupDecision.Value.ManualActivationMessage.Message,
            StringComparison.Ordinal);
        var linkedMemberId = (await fixture.Db.ChurchPersonApplications.SingleAsync()).LinkedMemberId;
        Assert.NotNull(linkedMemberId);
        Assert.Equal(2, await fixture.Db.GroupMemberships.CountAsync(item => item.MemberId == linkedMemberId));
        Assert.Contains(groupDecision.Value.History, item => item.Kind == "linkedToMember");
        var activation = await fixture.Db.MemberActivationInvitations.SingleAsync();
        Assert.Equal(linkedMemberId, activation.MemberId);
        Assert.Equal(ActivationStatus.Active, activation.Status);
        Assert.Equal(MessageDeliveryStatus.Manual, activation.DeliveryStatus);
    }

    [Fact]
    public async Task VerifiedGroupLeaderApproval_DoesNotGenerateActivationForMemberWithActivePasskey()
    {
        await using var fixture = CreateFixture();
        var actorId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var churchId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        fixture.GroupAuthorization.IsLeaderOrCoLeaderAsync(groupId, actorId, Arg.Any<CancellationToken>()).Returns(true);
        fixture.Db.Groups.AddRange(
            new Group { Id = churchId, IsChurch = true, NameJson = "{}", CreatedUtc = now, UpdatedUtc = now },
            new Group { Id = groupId, NameJson = "{}", CreatedUtc = now, UpdatedUtc = now });
        fixture.Db.Members.Add(new Member
        {
            Id = memberId,
            DisplayName = "Existing member",
            PhoneE164 = "+64210000002",
            IsRegistered = true,
            CreatedUtc = now,
            UpdatedUtc = now
        });
        fixture.Db.MemberPasskeyCredentials.Add(new MemberPasskeyCredential
        {
            Id = Guid.NewGuid(),
            MemberId = memberId,
            CredentialId = [1],
            PublicKey = [2],
            UserHandle = [3],
            DisplayName = "Phone",
            CreatedUtc = now
        });
        var person = NewPerson(Guid.NewGuid(), now);
        person.LinkedMemberId = memberId;
        person.MatchState = ApplicantMatchState.Linked;
        fixture.Db.ChurchPersonApplications.Add(person);
        fixture.Db.GroupMembershipApplications.Add(NewApplication(Guid.NewGuid(), groupId, person, now));
        await fixture.Db.SaveChangesAsync();
        fixture.Db.ChangeTracker.Clear();
        var application = await fixture.Db.GroupMembershipApplications.AsNoTracking().SingleAsync();

        var result = await fixture.Service.DecideGroupApplicationAsync(
            actorId,
            groupId,
            application.Id,
            new DecideMembershipApplicationRequest(
                ApplicationDecisionKind.Approved,
                null,
                "AA==",
                ContactVerified: true),
            default);

        Assert.True(result.IsSuccess);
        Assert.Null(result.Value!.ManualActivationMessage);
        Assert.Null(result.Value.ActivationDeliveryStatus);
        Assert.Empty(await fixture.Db.MemberActivationInvitations.ToListAsync());
    }

    [Fact]
    public async Task GroupLeaderApproval_RequiresExplicitIdentityVerification()
    {
        await using var fixture = CreateFixture();
        var actorId = Guid.NewGuid();
        var churchId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var personId = Guid.NewGuid();
        var applicationId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        fixture.GroupAuthorization.IsLeaderOrCoLeaderAsync(groupId, actorId, Arg.Any<CancellationToken>()).Returns(true);
        fixture.Db.Groups.AddRange(
            new Group { Id = churchId, IsChurch = true, NameJson = "{}", CreatedUtc = now, UpdatedUtc = now },
            new Group { Id = groupId, NameJson = "{}", CreatedUtc = now, UpdatedUtc = now });
        var person = NewPerson(personId, now);
        fixture.Db.ChurchPersonApplications.Add(person);
        fixture.Db.GroupMembershipApplications.Add(NewApplication(applicationId, groupId, person, now));
        await fixture.Db.SaveChangesAsync();
        fixture.Db.ChangeTracker.Clear();

        var result = await fixture.Service.DecideGroupApplicationAsync(
            actorId,
            groupId,
            applicationId,
            new DecideMembershipApplicationRequest(ApplicationDecisionKind.Approved, null, "AA=="),
            default);

        Assert.Equal(AppResultStatus.Conflict, result.Status);
        Assert.Equal("identity_verification_required", result.Message);
        Assert.Empty(await fixture.Db.Members.ToListAsync());
        Assert.Empty(await fixture.Db.GroupMemberships.ToListAsync());
        Assert.Empty(await fixture.Db.MemberActivationInvitations.ToListAsync());
    }

    [Fact]
    public async Task AnonymousApplicationResponse_IsConsumedOnceAndKeepsHistory()
    {
        await using var fixture = CreateFixture();
        var groupId = Guid.NewGuid();
        var personId = Guid.NewGuid();
        var applicationId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var secret = fixture.TokenService.CreateSecret();
        var person = NewPerson(personId, now);
        person.Status = MembershipApplicationStatus.NeedsInfo;
        var application = NewApplication(applicationId, groupId, person, now);
        application.Status = MembershipApplicationStatus.NeedsInfo;
        fixture.Db.Groups.Add(new Group { Id = groupId, NameJson = "{}", CreatedUtc = now, UpdatedUtc = now });
        fixture.Db.ChurchPersonApplications.Add(person);
        fixture.Db.GroupMembershipApplications.Add(application);
        fixture.Db.ApplicationResponseTokens.Add(new ApplicationResponseToken
        {
            Id = Guid.NewGuid(),
            GroupMembershipApplicationId = applicationId,
            Selector = "response-selector",
            SecretHash = fixture.TokenService.HashToken(secret),
            DeliveryStatus = MessageDeliveryStatus.Sent,
            CreatedUtc = now,
            ExpiresUtc = now.AddHours(1)
        });
        await fixture.Db.SaveChangesAsync();
        fixture.Db.ChangeTracker.Clear();
        var resolved = await fixture.Service.ResolveApplicationResponseAsync("response-selector", secret, default);

        var supplemented = await fixture.Service.SupplementApplicationAsync(
            resolved.Value!.Token, null, null, "Here is the requested information.", null, default);
        var replay = await fixture.Service.ResolveApplicationResponseAsync("response-selector", secret, default);

        Assert.True(supplemented.IsSuccess);
        Assert.Equal("submitted", supplemented.Value!.Status);
        Assert.Contains(supplemented.Value.History, item => item.Kind == "supplemented");
        Assert.Equal(AppResultStatus.Conflict, replay.Status);
        Assert.Equal("application_response_used", replay.Message);
    }

    [Fact]
    public async Task PublicDeviceActivation_IsRejectedWithoutConsumingInvitation()
    {
        await using var fixture = CreateFixture();
        var member = NewMember(isRegistered: false);
        var issuer = NewMember(isRegistered: true);
        var churchId = Guid.NewGuid();
        var invitationId = Guid.NewGuid();
        var flowToken = fixture.TokenService.CreateSecret();
        var now = DateTime.UtcNow;
        fixture.Db.Members.AddRange(member, issuer);
        fixture.Db.Groups.Add(new Group { Id = churchId, IsChurch = true, NameJson = "{}", CreatedUtc = now, UpdatedUtc = now });
        fixture.Db.MemberActivationInvitations.Add(new MemberActivationInvitation
        {
            Id = invitationId,
            MemberId = member.Id,
            IssuedByMemberId = issuer.Id,
            Selector = "public-activation",
            SecretHash = fixture.TokenService.HashToken("secret"),
            Status = ActivationStatus.Active,
            DeliveryStatus = MessageDeliveryStatus.Sent,
            CreatedUtc = now,
            ExpiresUtc = now.AddHours(1),
            Grants = [new ActivationGroupGrant { Id = Guid.NewGuid(), GroupId = churchId, Role = MembershipRole.Member, Status = StagedGrantStatus.Pending, CreatedUtc = now, UpdatedUtc = now }]
        });
        fixture.Db.OnboardingFlows.Add(new OnboardingFlow
        {
            Id = Guid.NewGuid(),
            TokenHash = fixture.TokenService.HashToken(flowToken),
            Intent = OnboardingIntent.Activation,
            IsPublicDevice = true,
            ActivationInvitationId = invitationId,
            ReturnPath = "/tasks",
            CreatedUtc = now,
            ExpiresUtc = now.AddMinutes(30)
        });
        await fixture.Db.SaveChangesAsync();
        var result = await fixture.Service.CompletePublicDeviceActivationAsync(flowToken, default);

        Assert.Equal(AppResultStatus.Conflict, result.Status);
        Assert.Equal("activation_mobile_passkey_required", result.Message);
        Assert.False((await fixture.Db.Members.SingleAsync(item => item.Id == member.Id)).IsRegistered);
        Assert.Equal(ActivationStatus.Active, (await fixture.Db.MemberActivationInvitations.SingleAsync()).Status);
    }

    [Fact]
    public async Task SqlRateLimiter_RejectsAfterLimitAndDoesNotStoreRawKey()
    {
        await using var fixture = CreateFixture();
        var limiter = new SqlServerRateLimiter(fixture.Db, fixture.TokenService);

        Assert.True((await limiter.TryConsumeAsync("test", "raw-ip-value", 2, TimeSpan.FromMinutes(10), default)).Allowed);
        Assert.True((await limiter.TryConsumeAsync("test", "raw-ip-value", 2, TimeSpan.FromMinutes(10), default)).Allowed);
        Assert.False((await limiter.TryConsumeAsync("test", "raw-ip-value", 2, TimeSpan.FromMinutes(10), default)).Allowed);
        var bucket = await fixture.Db.RateLimitBuckets.SingleAsync();
        Assert.Equal(32, bucket.KeyHash.Length);
    }

    [Fact]
    public async Task ApprovingPersonApplication_PreservesExistingLeadershipRole()
    {
        await using var fixture = CreateFixture();
        var actorId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var churchId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var personId = Guid.NewGuid();
        var applicationId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        fixture.GroupAuthorization.IsAdminAsync(actorId, Arg.Any<CancellationToken>()).Returns(true);
        fixture.Db.Groups.AddRange(
            new Group { Id = churchId, IsChurch = true, NameJson = "{}", CreatedUtc = now, UpdatedUtc = now },
            new Group { Id = groupId, NameJson = "{}", CreatedUtc = now, UpdatedUtc = now });
        fixture.Db.Members.Add(new Member
        {
            Id = memberId,
            DisplayName = "Existing leader",
            PhoneE164 = "+64210000000",
            IsRegistered = true,
            CreatedUtc = now,
            UpdatedUtc = now
        });
        fixture.Db.GroupMemberships.Add(new GroupMembership
        {
            Id = Guid.NewGuid(),
            GroupId = churchId,
            MemberId = memberId,
            Status = MembershipStatus.Approved,
            Role = MembershipRole.Leader,
            CreatedUtc = now,
            UpdatedUtc = now
        });
        var person = new ChurchPersonApplication
        {
            Id = personId,
            LinkedMemberId = memberId,
            DisplayName = "Existing leader",
            PhoneE164 = "+64210000000",
            PhoneLookupHash = [1],
            ReplyPreference = "sms",
            PreferredLanguage = "en",
            Declaration = "I am applying.",
            PrivacyConsentVersion = "v1",
            PrivacyConsentedUtc = now,
            IsContactVerified = true,
            IsIdentityVerified = true,
            MatchState = ApplicantMatchState.Linked,
            Status = MembershipApplicationStatus.Submitted,
            SubmittedUtc = now,
            UpdatedUtc = now
        };
        fixture.Db.ChurchPersonApplications.Add(person);
        fixture.Db.GroupMembershipApplications.Add(new GroupMembershipApplication
        {
            Id = applicationId,
            ChurchPersonApplicationId = personId,
            ChurchPersonApplication = person,
            GroupId = groupId,
            DeduplicationKey = [2],
            Status = MembershipApplicationStatus.Submitted,
            Source = "groupJoinQr",
            SubmittedUtc = now,
            UpdatedUtc = now
        });
        await fixture.Db.SaveChangesAsync();
        fixture.Db.ChangeTracker.Clear();

        var result = await fixture.Service.DecidePersonApplicationAsync(
            actorId,
            applicationId,
            new DecideMembershipApplicationRequest(ApplicationDecisionKind.Approved, null, "AA==", memberId),
            default);

        Assert.True(result.IsSuccess);
        var membership = await fixture.Db.GroupMemberships.SingleAsync(item => item.GroupId == churchId && item.MemberId == memberId);
        Assert.Equal(MembershipRole.Leader, membership.Role);
    }

    private static Member NewMember(bool isRegistered) => new()
    {
        Id = Guid.NewGuid(),
        DisplayName = "Member",
        IsRegistered = isRegistered,
        CreatedUtc = DateTime.UtcNow,
        UpdatedUtc = DateTime.UtcNow
    };

    private static GroupJoinInvite NewJoinInvite(Guid groupId) => new()
    {
        Id = Guid.NewGuid(),
        GroupId = groupId,
        CreatedByMemberId = Guid.NewGuid(),
        Selector = "join-selector",
        Version = 1,
        Status = GroupJoinInviteStatus.Active,
        CreatedUtc = DateTime.UtcNow,
        UpdatedUtc = DateTime.UtcNow,
        ExpiresUtc = DateTime.UtcNow.AddDays(1)
    };

    private static ChurchPersonApplication NewPerson(Guid id, DateTime now) => new()
    {
        Id = id,
        DisplayName = "Applicant",
        PhoneE164 = "+64210000000",
        PhoneLookupHash = [1],
        ReplyPreference = "sms",
        PreferredLanguage = "en",
        Declaration = "I am applying.",
        PrivacyConsentVersion = "v1",
        PrivacyConsentedUtc = now,
        MatchState = ApplicantMatchState.None,
        Status = MembershipApplicationStatus.Submitted,
        SubmittedUtc = now,
        UpdatedUtc = now
    };

    private static GroupMembershipApplication NewApplication(
        Guid id,
        Guid groupId,
        ChurchPersonApplication person,
        DateTime now) => new()
    {
        Id = id,
        ChurchPersonApplicationId = person.Id,
        ChurchPersonApplication = person,
        GroupId = groupId,
        GroupJoinInviteId = Guid.Empty,
        DeduplicationKey = [2],
        Status = MembershipApplicationStatus.Submitted,
        Source = "groupJoinQr",
        SubmittedUtc = now,
        UpdatedUtc = now
    };

    private static Fixture CreateFixture(
        bool alphaEnabled = false,
        Guid? alphaMemberId = null,
        bool isProduction = false,
        string? passkeyBootstrapCode = null)
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        var db = new IdentityTestDbContext(options);
        var groupAuthorization = Substitute.For<IGroupAuthorizationService>();
        var messageSender = Substitute.For<IIdentityMessageSender>();
        messageSender.IsAvailable.Returns(false);
        messageSender.SendApplicationResponseAsync(
                Arg.Any<string>(),
                Arg.Any<string>(),
                Arg.Any<string>(),
                Arg.Any<CancellationToken>())
            .Returns(new IdentityMessageResult(false, "provider_unavailable"));
        var jwt = Substitute.For<IJwtTokenService>();
        var memberId = alphaMemberId ?? Guid.NewGuid();
        var configuration = new TestConfiguration
        {
            AlphaLoginEnabled = alphaEnabled,
            IsProduction = isProduction,
            AlphaAccounts =
            [
                new AlphaAccountConfiguration(
                    "configured",
                    memberId,
                    "Configured account",
                    passkeyBootstrapCode is null
                        ? null
                        : SHA256.HashData(Encoding.UTF8.GetBytes(passkeyBootstrapCode)))
            ]
        };
        var tokenValues = new Dictionary<string, string?>
        {
            ["TokenProtection:SigningKey"] = "identity-token-test-key-at-least-32-bytes-long",
            ["RateLimiting:HashKey"] = "identity-rate-test-key-at-least-32-bytes-long"
        };
        var environment = Substitute.For<IHostEnvironment>();
        environment.EnvironmentName.Returns(Environments.Development);
        var tokenService = new IdentityTokenService(
            new ConfigurationBuilder().AddInMemoryCollection(tokenValues).Build(), environment);
        var service = new IdentityAccessService(
            db, groupAuthorization, tokenService, messageSender, configuration, jwt, new InlineExecutor());
        return new Fixture(db, service, jwt, groupAuthorization, tokenService, messageSender);
    }

    private sealed record Fixture(
        AlifeDbContext Db,
        IdentityAccessService Service,
        IJwtTokenService Jwt,
        IGroupAuthorizationService GroupAuthorization,
        IIdentityTokenService TokenService,
        IIdentityMessageSender MessageSender) : IAsyncDisposable
    {
        public ValueTask DisposeAsync() => Db.DisposeAsync();
    }

    private sealed class InlineExecutor : IIdentitySerializableExecutor
    {
        public Task<T> ExecuteAsync<T>(Func<CancellationToken, Task<T>> action, CancellationToken cancellationToken)
            => action(cancellationToken);
    }

    private sealed class IdentityTestDbContext(DbContextOptions<AlifeDbContext> options) : AlifeDbContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.Entity<ChurchPersonApplication>().Property(item => item.RowVersion)
                .IsConcurrencyToken(false).ValueGeneratedNever();
            modelBuilder.Entity<GroupMembershipApplication>().Property(item => item.RowVersion)
                .IsConcurrencyToken(false).ValueGeneratedNever();
        }
    }

    private sealed class TestConfiguration : IIdentityAccessConfiguration
    {
        public bool PasskeysEnabled { get; init; } = true;
        public bool LineLegacyEnabled { get; init; } = true;
        public bool AlphaLoginEnabled { get; init; }
        public bool IsProduction { get; init; }
        public string FrontendBaseUrl => "https://alife.example";
        public IReadOnlyList<AlphaAccountConfiguration> AlphaAccounts { get; init; } = [];
    }
}
