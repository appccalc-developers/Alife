using Alife.Api.Http;
using Alife.Api.Identity;
using Alife.Api.Security;
using Alife.Application.Abstractions.Identity;
using Alife.Application.IdentityAccess;
using Alife.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/onboarding")]
public sealed class OnboardingController(
    IIdentityAccessService identityAccess,
    ICurrentMemberAccessor currentMemberAccessor,
    IServerRateLimiter rateLimiter,
    IConfiguration configuration) : ControllerBase
{
    [HttpGet("capabilities")]
    public IActionResult Capabilities()
    {
        this.ApplyPrivateNoStoreHeaders();
        return Ok(identityAccess.GetCapabilities());
    }

    [HttpPost("flows")]
    public async Task<IActionResult> CreateFlow(CreateFlowRequest request, CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        if (!Enum.TryParse<OnboardingIntent>(request.Intent, true, out var intent))
        {
            intent = OnboardingIntent.SignIn;
        }
        var result = await identityAccess.CreateFlowAsync(request.ReturnPath, request.IsPublicDevice, intent, cancellationToken);
        if (result.IsSuccess && result.Value is not null)
        {
            AuthCookie.WriteOnboardingCookie(Request, Response, result.Value.Token);
            return Ok(result.Value.Context);
        }
        return this.ToIdentityResult(result);
    }

    [HttpPost("resume")]
    public async Task<IActionResult> Resume(CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var result = await identityAccess.ResumeFlowAsync(ReadFlowToken(), cancellationToken);
        return this.ToIdentityResult(result);
    }

    [HttpPost("activation/resolve")]
    public async Task<IActionResult> ResolveActivation(ResolveSecretRequest request, CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var limited = await LimitAsync("activation-ip-15m", "ip", 10, TimeSpan.FromMinutes(15), cancellationToken);
        if (limited is not null) return limited;
        limited = await LimitAsync("activation-selector-15m", request.Selector, 5, TimeSpan.FromMinutes(15), cancellationToken);
        if (limited is not null) return limited;

        var result = await identityAccess.ResolveActivationAsync(
            request.Selector, request.Secret, request.IsPublicDevice, request.ReturnPath, cancellationToken);
        if (result.IsSuccess && result.Value is not null)
        {
            AuthCookie.WriteOnboardingCookie(Request, Response, result.Value.Token);
            return Ok(result.Value.Context);
        }
        return this.ToIdentityResult(result);
    }

    [HttpPost("activation/not-me")]
    public async Task<IActionResult> ActivationNotMe(CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var result = await identityAccess.MarkActivationMismatchAsync(ReadFlowToken(), cancellationToken);
        if (result.IsSuccess) AuthCookie.ClearOnboardingCookie(Request, Response);
        return this.ToIdentityResult(result);
    }

    [HttpPost("activation/complete-public-device")]
    public async Task<IActionResult> CompletePublicDeviceActivation(CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var limited = await LimitAsync("activation-complete-ip-15m", "ip", 10, TimeSpan.FromMinutes(15), cancellationToken);
        if (limited is not null) return limited;
        limited = await LimitAsync("activation-complete-flow-15m", ReadFlowToken(), 5, TimeSpan.FromMinutes(15), cancellationToken);
        if (limited is not null) return limited;
        var flow = await identityAccess.GetActiveFlowAsync(ReadFlowToken(), cancellationToken);
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (flow?.ActivationMemberId is Guid activationMemberId &&
            currentMemberId is Guid signedInMemberId &&
            signedInMemberId != activationMemberId)
        {
            return Conflict(new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title = "Sign out before activating a different identity.",
                Extensions = { ["code"] = "activation_session_conflict" }
            });
        }
        var result = await identityAccess.CompletePublicDeviceActivationAsync(ReadFlowToken(), cancellationToken);
        if (result.IsSuccess && result.Value is not null)
        {
            AuthCookie.WriteCookie(Request, Response, result.Value.Token, result.Value.ExpiresUtc, persistent: false);
            AuthCookie.ClearOnboardingCookie(Request, Response);
            return Ok(new { ok = true, result.Value.ExpiresUtc, result.Value.ReturnPath, result.Value.SessionKind });
        }
        return this.ToIdentityResult(result);
    }

    [HttpPost("group-invites/resolve")]
    public async Task<IActionResult> ResolveGroupInvite(ResolveSecretRequest request, CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var limited = await LimitAsync("group-invite-ip-1h", "ip", 30, TimeSpan.FromHours(1), cancellationToken);
        if (limited is not null) return limited;
        var result = await identityAccess.ResolveGroupInviteAsync(
            request.Selector, request.Secret, request.IsPublicDevice, request.ReturnPath, cancellationToken);
        if (result.IsSuccess && result.Value is not null)
        {
            AuthCookie.WriteOnboardingCookie(Request, Response, result.Value.Token);
            return Ok(result.Value.Context);
        }
        return this.ToIdentityResult(result);
    }

    [HttpPost("group-applications")]
    public async Task<IActionResult> SubmitGroupApplication(
        SubmitGroupApplicationRequest request,
        CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var limited = await LimitAsync("group-application-ip-1h", "ip", 3, TimeSpan.FromHours(1), cancellationToken);
        if (limited is not null) return limited;
        limited = await LimitAsync("group-application-ip-1d", "ip", 10, TimeSpan.FromDays(1), cancellationToken);
        if (limited is not null) return limited;
        limited = await LimitAsync("group-application-flow-1h", ReadFlowToken(), 3, TimeSpan.FromHours(1), cancellationToken);
        if (limited is not null) return limited;
        var result = await identityAccess.SubmitGroupApplicationAsync(
            ReadFlowToken(), currentMemberAccessor.GetCurrentMemberId(), request, cancellationToken);
        return this.ToIdentityResult(result);
    }

    [HttpPost("application-responses/resolve")]
    public async Task<IActionResult> ResolveApplicationResponse(ResolveSecretRequest request, CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var limited = await LimitAsync("application-response-ip-15m", "ip", 10, TimeSpan.FromMinutes(15), cancellationToken);
        if (limited is not null) return limited;
        limited = await LimitAsync("application-response-selector-15m", request.Selector, 5, TimeSpan.FromMinutes(15), cancellationToken);
        if (limited is not null) return limited;
        var result = await identityAccess.ResolveApplicationResponseAsync(request.Selector, request.Secret, cancellationToken);
        if (result.IsSuccess && result.Value is not null)
        {
            AuthCookie.WriteOnboardingCookie(Request, Response, result.Value.Token);
            return Ok(result.Value.Context);
        }
        return this.ToIdentityResult(result);
    }

    [HttpPost("application-responses/supplement")]
    public async Task<IActionResult> SupplementAnonymousApplication(SupplementRequest request, CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var limited = await LimitAsync("application-response-flow-15m", ReadFlowToken(), 5, TimeSpan.FromMinutes(15), cancellationToken);
        if (limited is not null) return limited;
        var result = await identityAccess.SupplementApplicationAsync(ReadFlowToken(), null, null, request.Note, null, cancellationToken);
        if (result.IsSuccess) AuthCookie.ClearOnboardingCookie(Request, Response);
        return this.ToIdentityResult(result);
    }

    [HttpGet("personal-applications")]
    [Authorize]
    public async Task<IActionResult> PersonalApplications(CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (memberId is null) return Unauthorized();
        return this.ToIdentityResult(await identityAccess.ListPersonalApplicationsAsync(memberId.Value, cancellationToken));
    }

    [HttpPost("personal-applications/{applicationId:guid}/supplements")]
    [Authorize]
    public async Task<IActionResult> SupplementPersonalApplication(Guid applicationId, SupplementRequest request, CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        return memberId is null
            ? Unauthorized()
            : this.ToIdentityResult(await identityAccess.SupplementApplicationAsync(
                string.Empty, memberId.Value, applicationId, request.Note, request.RowVersion, cancellationToken));
    }

    private string ReadFlowToken() => Request.Cookies["alife_onboarding"] ?? string.Empty;

    private async Task<IActionResult?> LimitAsync(
        string scope,
        string discriminator,
        int limit,
        TimeSpan window,
        CancellationToken cancellationToken)
    {
        var client = IdentityHttp.GetClientRateLimitKey(Request, configuration);
        var result = await rateLimiter.TryConsumeAsync(scope, $"{client}\n{discriminator}", limit, window, cancellationToken);
        return result.Allowed ? null : this.RateLimited(result);
    }

    public sealed record CreateFlowRequest(string? ReturnPath, bool IsPublicDevice, string? Intent);
    public sealed record ResolveSecretRequest(string Selector, string Secret, bool IsPublicDevice, string? ReturnPath);
    public sealed record SupplementRequest(string Note, string? RowVersion = null);
}
