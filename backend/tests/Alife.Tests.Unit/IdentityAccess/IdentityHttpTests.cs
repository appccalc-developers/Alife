using System.Net;
using System.Security.Claims;
using System.Text.Json;
using Alife.Api.Controllers;
using Alife.Api.Identity;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Abstractions.Integrations;
using Alife.Application.Common.Models;
using Alife.Application.IdentityAccess;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using NSubstitute;

namespace Alife.Tests.Unit.IdentityAccess;

public sealed class IdentityHttpTests
{
    [Theory]
    [InlineData("https://alife.example", true)]
    [InlineData("https://evil.example", false)]
    [InlineData("https://alife.example.evil.example", false)]
    [InlineData("null", false)]
    [InlineData("", false)]
    public void Continuation_RequiresConfiguredOrigin(string origin, bool expected)
    {
        var context = new DefaultHttpContext();
        context.Request.Headers.Origin = origin;
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Frontend:BaseUrl"] = "https://alife.example" }).Build();
        Assert.Equal(expected, IdentityHttp.IsTrustedBrowserOrigin(context.Request, config));
    }

    [Fact]
    public void BrowserReceiptCookie_IsSeparateSecureHttpOnlyAndExpiresAfter72Hours()
    {
        var context = new DefaultHttpContext();
        context.Request.Scheme = "https";
        Alife.Api.Security.AuthCookie.WriteApplicationCookie(context.Request, context.Response, "secret");
        var cookie = context.Response.Headers.SetCookie.ToString();
        Assert.Contains("alife_application=", cookie);
        Assert.Contains("httponly", cookie);
        Assert.Contains("secure", cookie);
        Assert.Contains("samesite=lax", cookie);
        Assert.Contains("max-age=259200", cookie);
        Assert.DoesNotContain("alife_onboarding", cookie);
    }

    [Fact]
    public async Task RecoveryController_AllowsEffectiveAlphaSessionAndReturnsNoStore()
    {
        var actor = Guid.NewGuid(); var member = Guid.NewGuid(); var group = Guid.NewGuid();
        var identity = Substitute.For<IIdentityAccessService>();
        identity.IssuePersonalPasskeyAsync(actor, group, member, true, Arg.Any<CancellationToken>())
            .Returns(AppResult<PersonalPasskeyInvitation>.Success(new(Guid.NewGuid(), member, "Member", "https://alife.example/activate/selector#secret", DateTime.UtcNow.AddMinutes(10))));
        var accessor = Substitute.For<ICurrentMemberAccessor>();
        accessor.GetCurrentMemberId().Returns(actor);
        var limiter = Substitute.For<IServerRateLimiter>();
        limiter.TryConsumeAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(new RateLimitDecision(true, DateTime.UtcNow, 9));
        var context = new DefaultHttpContext();
        context.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("amr", "alpha")], "test"));
        context.Request.Headers.Origin = "https://alife.example";
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Frontend:BaseUrl"] = "https://alife.example" }).Build();
        var controller = new IdentityContinuationController(identity, accessor, limiter, config) { ControllerContext = new() { HttpContext = context } };
        Assert.IsType<OkObjectResult>(await controller.Issue(group, member, new(true), default));
        Assert.Equal("private, no-store", context.Response.Headers.CacheControl);
        Assert.Contains("Cookie", context.Response.Headers.Vary.ToString());
        context.Request.Headers.Origin = "https://evil.example";
        Assert.Equal(403, Assert.IsType<ObjectResult>(await controller.Issue(group, member, new(true), default)).StatusCode);
        await identity.Received(1).IssuePersonalPasskeyAsync(actor, group, member, true, Arg.Any<CancellationToken>());
    }

    [Fact]
    public void ClientKey_IgnoresForwardedAddressFromUnconfiguredLoopbackPeer()
    {
        var request = CreateRequest(IPAddress.Loopback, "203.0.113.25");

        var result = IdentityHttp.GetClientRateLimitKey(request, new ConfigurationBuilder().Build());

        Assert.Equal("127.0.0.1", result);
    }

    [Fact]
    public void ClientKey_UsesForwardedAddressOnlyForConfiguredProxyNetwork()
    {
        var request = CreateRequest(IPAddress.Parse("10.20.30.40"), "203.0.113.25");
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["TrustedProxyNetworks:0"] = "10.20.0.0/16"
        }).Build();

        var result = IdentityHttp.GetClientRateLimitKey(request, configuration);

        Assert.Equal("203.0.113.25", result);
    }

    [Fact]
    public void ClientKey_FallsBackToPeerWhenTrustedProxyHeaderIsInvalid()
    {
        var request = CreateRequest(IPAddress.Parse("10.20.30.40"), "not-an-address");
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["TrustedProxyNetworks:0"] = "10.20.30.40/32"
        }).Build();

        var result = IdentityHttp.GetClientRateLimitKey(request, configuration);

        Assert.Equal("10.20.30.40", result);
    }

    [Fact]
    public void LegacyAccountLogin_Returns404WithPrivateNoStoreHeaders()
    {
        var context = new DefaultHttpContext();
        var controller = new MembersController(
            Substitute.For<IMediator>(),
            Substitute.For<ICurrentMemberAccessor>(),
            new ConfigurationBuilder().Build(),
            Substitute.For<ILineLoginService>(),
            Substitute.For<IIdentityAccessService>())
        {
            ControllerContext = new ControllerContext { HttpContext = context }
        };

        var result = controller.LoginByAccount();

        Assert.IsType<NotFoundResult>(result);
        Assert.Equal("private, no-store", context.Response.Headers.CacheControl);
        Assert.Contains("Cookie", context.Response.Headers.Vary.ToString());
        Assert.Contains("Authorization", context.Response.Headers.Vary.ToString());
    }

    [Fact]
    public void IdentityFailure_IncludesRequestTraceIdentifier()
    {
        var context = new DefaultHttpContext { TraceIdentifier = "trace-700" };
        var controller = new TestController
        {
            ControllerContext = new ControllerContext { HttpContext = context }
        };

        var result = controller.ToIdentityResult(AppResult<bool>.Forbidden("passkey_verification_failed"));

        var forbidden = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, forbidden.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(forbidden.Value);
        Assert.Equal("passkey_verification_failed", problem.Extensions["code"]);
        Assert.Equal("trace-700", problem.Extensions["traceId"]);
    }

    [Fact]
    public async Task ManualActivationMutation_ReturnsPrivateNoStoreResponse()
    {
        var context = new DefaultHttpContext();
        var actorId = Guid.NewGuid();
        var identityAccess = Substitute.For<IIdentityAccessService>();
        var currentMember = Substitute.For<ICurrentMemberAccessor>();
        currentMember.GetCurrentMemberId().Returns(actorId);
        identityAccess.CreateActivationAsync(actorId, Arg.Any<CreateActivationRequest>(), Arg.Any<CancellationToken>())
            .Returns(AppResult<ActivationInvitationDto>.Success(new ActivationInvitationDto(
                Guid.NewGuid(),
                Guid.NewGuid(),
                "Preset member",
                "•••• 0001",
                ActivationPurpose.FirstActivation,
                ActivationStatus.Active,
                MessageDeliveryStatus.Manual,
                DateTime.UtcNow.AddHours(72),
                new ManualActivationMessageDto("+64210000001", "activation message"),
                [])));
        var controller = new IdentityManagementController(identityAccess, currentMember)
        {
            ControllerContext = new ControllerContext { HttpContext = context }
        };

        var result = await controller.CreateActivation(
            new CreateActivationRequest("Preset member", "+64210000001", ActivationPurpose.FirstActivation, []),
            default);

        Assert.IsType<ObjectResult>(result);
        Assert.Equal("private, no-store", context.Response.Headers.CacheControl);
        Assert.Contains("Cookie", context.Response.Headers.Vary.ToString());
        Assert.Contains("Authorization", context.Response.Headers.Vary.ToString());
    }

    [Fact]
    public async Task PasskeyRegistration_StandardAlphaSession_RequiresRecentStrongAuthentication()
    {
        var (controller, _, identityAccess) = CreatePasskeysController("alpha");
        identityAccess.GetActiveFlowAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((ActiveOnboardingFlow?)null);

        var result = await controller.RegistrationOptions(default);

        var forbidden = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, forbidden.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(forbidden.Value);
        Assert.Equal("recent_authentication_required", problem.Extensions["code"]);
    }

    [Fact]
    public async Task PasskeyRegistration_GenericOnboardingFlow_DoesNotBypassRecentAuthentication()
    {
        var (controller, _, identityAccess) = CreatePasskeysController("alpha");
        identityAccess.GetActiveFlowAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(new ActiveOnboardingFlow(
                Guid.NewGuid(),
                OnboardingIntent.SignIn,
                false,
                null,
                null,
                null,
                "/profile"));

        var result = await controller.RegistrationOptions(default);

        var forbidden = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, forbidden.StatusCode);
    }

    [Fact]
    public async Task PasskeyRegistration_GenericFlowWithStrongAuthentication_IsNotTreatedAsActivation()
    {
        var (controller, passkeys, identityAccess) = CreatePasskeysController("passkey");
        identityAccess.GetActiveFlowAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(new ActiveOnboardingFlow(
                Guid.NewGuid(),
                OnboardingIntent.SignIn,
                false,
                null,
                null,
                null,
                "/profile"));
        passkeys.BeginRegistrationAsync(Arg.Any<Guid>(), null, false, Arg.Any<CancellationToken>())
            .Returns(AppResult<PasskeyOptionsDto>.Success(new PasskeyOptionsDto(
                Guid.NewGuid(),
                JsonDocument.Parse("{}").RootElement.Clone())));

        var result = await controller.RegistrationOptions(default);

        Assert.IsType<OkObjectResult>(result);
        await passkeys.Received(1).BeginRegistrationAsync(
            Arg.Any<Guid>(),
            null,
            false,
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task PasskeyRegistration_FreshAlphaBootstrapSession_IsAllowed()
    {
        var (controller, passkeys, identityAccess) = CreatePasskeysController("alpha_bootstrap");
        identityAccess.GetActiveFlowAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((ActiveOnboardingFlow?)null);
        passkeys.BeginRegistrationAsync(Arg.Any<Guid>(), null, true, Arg.Any<CancellationToken>())
            .Returns(AppResult<PasskeyOptionsDto>.Success(new PasskeyOptionsDto(
                Guid.NewGuid(),
                JsonDocument.Parse("{}").RootElement.Clone())));

        var result = await controller.RegistrationOptions(default);

        Assert.IsType<OkObjectResult>(result);
        await passkeys.Received(1).BeginRegistrationAsync(
            Arg.Any<Guid>(),
            null,
            true,
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task PasskeyRegistration_ExpiredAlphaBootstrapSession_IsDenied()
    {
        var (controller, _, identityAccess) = CreatePasskeysController(
            "alpha_bootstrap",
            authenticationTime: DateTimeOffset.UtcNow.AddMinutes(-6));
        identityAccess.GetActiveFlowAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((ActiveOnboardingFlow?)null);

        var result = await controller.RegistrationOptions(default);

        var forbidden = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status403Forbidden, forbidden.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(forbidden.Value);
        Assert.Equal("recent_authentication_required", problem.Extensions["code"]);
    }

    [Fact]
    public async Task PasskeyRegistration_ActivationFlow_RemainsAvailableWithoutExistingSession()
    {
        var activationMemberId = Guid.NewGuid();
        var (controller, passkeys, identityAccess) = CreatePasskeysController(null, currentMemberId: null);
        var flowId = Guid.NewGuid();
        identityAccess.GetActiveFlowAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(new ActiveOnboardingFlow(
                flowId,
                OnboardingIntent.Activation,
                false,
                Guid.NewGuid(),
                activationMemberId,
                null,
                "/enter"));
        passkeys.BeginRegistrationAsync(activationMemberId, flowId, false, Arg.Any<CancellationToken>())
            .Returns(AppResult<PasskeyOptionsDto>.Success(new PasskeyOptionsDto(
                Guid.NewGuid(),
                JsonDocument.Parse("{}").RootElement.Clone())));

        var result = await controller.RegistrationOptions(default);

        Assert.IsType<OkObjectResult>(result);
        await passkeys.Received(1).BeginRegistrationAsync(
            activationMemberId,
            flowId,
            false,
            Arg.Any<CancellationToken>());
    }

    private static (PasskeysController Controller, IPasskeyService Passkeys, IIdentityAccessService IdentityAccess)
        CreatePasskeysController(
            string? authenticationMethod,
            Guid? currentMemberId = null,
            DateTimeOffset? authenticationTime = null)
    {
        var context = new DefaultHttpContext();
        if (authenticationMethod is not null)
        {
            context.User = new ClaimsPrincipal(new ClaimsIdentity(
            [
                new Claim("amr", authenticationMethod),
                new Claim(
                    "auth_time",
                    (authenticationTime ?? DateTimeOffset.UtcNow).ToUnixTimeSeconds().ToString())
            ], "test"));
        }

        var passkeys = Substitute.For<IPasskeyService>();
        var identityAccess = Substitute.For<IIdentityAccessService>();
        var memberAccessor = Substitute.For<ICurrentMemberAccessor>();
        memberAccessor.GetCurrentMemberId().Returns(currentMemberId ?? Guid.NewGuid());
        if (currentMemberId is null && authenticationMethod is null)
        {
            memberAccessor.GetCurrentMemberId().Returns((Guid?)null);
        }
        var rateLimiter = Substitute.For<IServerRateLimiter>();
        rateLimiter.TryConsumeAsync(
                Arg.Any<string>(),
                Arg.Any<string>(),
                Arg.Any<int>(),
                Arg.Any<TimeSpan>(),
                Arg.Any<CancellationToken>())
            .Returns(new RateLimitDecision(true, DateTime.UtcNow.AddMinutes(1), 1));
        var controller = new PasskeysController(
            passkeys,
            identityAccess,
            memberAccessor,
            rateLimiter,
            new ConfigurationBuilder().Build())
        {
            ControllerContext = new ControllerContext { HttpContext = context }
        };
        return (controller, passkeys, identityAccess);
    }

    private static HttpRequest CreateRequest(IPAddress peer, string forwarded)
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = peer;
        context.Request.Headers["CF-Connecting-IP"] = forwarded;
        return context.Request;
    }

    private sealed class TestController : ControllerBase;
}
