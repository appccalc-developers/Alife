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

public sealed class IdentityAccessFlowTests
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
        var result = await fixture.Service.AlphaLoginAsync("configured", default);

        Assert.Equal(AppResultStatus.NotFound, result.Status);
        Assert.Equal("alpha_login_disabled", result.Message);
    }

    [Fact]
    public async Task AlphaLogin_InvalidAccount_IsDeniedAndAuditedWithoutAccountMetadata()
    {
        await using var fixture = CreateFixture(alphaEnabled: true);

        var result = await fixture.Service.AlphaLoginAsync("not-configured", default);

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

        var result = await fixture.Service.AlphaLoginAsync("configured", default);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value!.Persistent);
        Assert.Equal("alpha", result.Value.AuthenticationMethod);
        Assert.Equal("alpha", result.Value.SessionKind);
        Assert.Equal("/enter", result.Value.ReturnPath);
        Assert.Contains(await fixture.Db.AuditLogs.ToListAsync(), audit => audit.Action == "identity.alpha.signed_in");
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

        var result = await fixture.Service.AlphaLoginAsync("configured", default);

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
    public async Task TwoStageApproval_MaterializesChurchAndGroupMembershipOnlyAfterBothDecisions()
    {
        await using var fixture = CreateFixture();
        var groupActorId = Guid.NewGuid();
        var churchActorId = Guid.NewGuid();
        var churchId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var personId = Guid.NewGuid();
        var applicationId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        fixture.GroupAuthorization.IsLeaderOrCoLeaderAsync(groupId, groupActorId, Arg.Any<CancellationToken>()).Returns(true);
        fixture.GroupAuthorization.IsAdminAsync(churchActorId, Arg.Any<CancellationToken>()).Returns(true);
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
            new DecideMembershipApplicationRequest(ApplicationDecisionKind.Approved, null, "AA=="), default);

        Assert.True(groupDecision.IsSuccess);
        Assert.Equal("approvedWaitingForChurch", groupDecision.Value!.Status);
        Assert.Equal(0, await fixture.Db.Members.CountAsync());
        Assert.Equal(0, await fixture.Db.GroupMemberships.CountAsync());

        var churchDecision = await fixture.Service.DecidePersonApplicationAsync(
            churchActorId, applicationId,
            new DecideMembershipApplicationRequest(ApplicationDecisionKind.Approved, null, "AA==", ContactVerified: true), default);

        Assert.True(churchDecision.IsSuccess);
        Assert.Equal("approved", churchDecision.Value!.Status);
        var linkedMemberId = (await fixture.Db.ChurchPersonApplications.SingleAsync()).LinkedMemberId;
        Assert.NotNull(linkedMemberId);
        Assert.Equal(2, await fixture.Db.GroupMemberships.CountAsync(item => item.MemberId == linkedMemberId));
        Assert.Contains(churchDecision.Value.History, item => item.Kind == "linkedToMember");
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
    public async Task PublicDeviceActivation_ConsumesInvitationAndCreatesShortNonPersistentSession()
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
        fixture.Jwt.CreateToken(Arg.Any<Member>(), "activation_link", "public_device", TimeSpan.FromHours(2))
            .Returns(("public-token", now.AddHours(2)));

        var result = await fixture.Service.CompletePublicDeviceActivationAsync(flowToken, default);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value!.Persistent);
        Assert.Equal("public_device", result.Value.SessionKind);
        Assert.Equal("/tasks", result.Value.ReturnPath);
        Assert.True((await fixture.Db.Members.SingleAsync(item => item.Id == member.Id)).IsRegistered);
        Assert.Equal(ActivationStatus.Used, (await fixture.Db.MemberActivationInvitations.SingleAsync()).Status);
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

    private static Fixture CreateFixture(bool alphaEnabled = false, Guid? alphaMemberId = null, bool isProduction = false)
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        var db = new IdentityTestDbContext(options);
        var groupAuthorization = Substitute.For<IGroupAuthorizationService>();
        var messageSender = Substitute.For<IIdentityMessageSender>();
        messageSender.IsAvailable.Returns(false);
        var jwt = Substitute.For<IJwtTokenService>();
        var memberId = alphaMemberId ?? Guid.NewGuid();
        var configuration = new TestConfiguration
        {
            AlphaLoginEnabled = alphaEnabled,
            IsProduction = isProduction,
            AlphaAccounts = [new AlphaAccountConfiguration("configured", memberId, "Configured account")]
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
        public bool ActivationMessagingAvailable => false;
        public bool ExposeActivationLinks => false;
        public bool AlphaLoginEnabled { get; init; }
        public bool IsProduction { get; init; }
        public string FrontendBaseUrl => "https://alife.example";
        public IReadOnlyList<AlphaAccountConfiguration> AlphaAccounts { get; init; } = [];
    }
}
