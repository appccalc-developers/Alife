using Alife.Api.Http;
using Alife.Api.Identity;
using Alife.Api.Security;
using Alife.Application.Abstractions.Identity;
using Alife.Application.IdentityAccess;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
public sealed class IdentityContinuationController(
    IIdentityAccessService identityAccess, ICurrentMemberAccessor currentMemberAccessor,
    IServerRateLimiter rateLimiter, IConfiguration configuration) : ControllerBase
{
    [HttpPost("api/onboarding/browser-applications/status")]
    public async Task<IActionResult> Status(BrowserStatusRequest request, CancellationToken token)
    {
        var denied = await GuardAsync("browser-status", 60, token);
        return denied ?? this.ToIdentityResult(await identityAccess.GetBrowserApplicationAsync(BrowserToken, request.ApplicationId, request.InviteId, token));
    }

    [HttpPost("api/onboarding/browser-applications/{applicationId:guid}/activate")]
    public async Task<IActionResult> Activate(Guid applicationId, CancellationToken token)
    {
        var denied = await GuardAsync("browser-activate", 10, token);
        if (denied is not null) return denied;
        var result = await identityAccess.StartBrowserActivationAsync(BrowserToken, applicationId, token);
        if (!result.IsSuccess) return this.ToIdentityResult(result);
        AuthCookie.WriteOnboardingCookie(Request, Response, result.Value!.Token);
        return Ok(result.Value.Context);
    }

    [HttpPost("api/onboarding/browser-applications/{applicationId:guid}/supplements")]
    public async Task<IActionResult> Supplement(Guid applicationId, OnboardingController.SupplementRequest request, CancellationToken token)
    {
        var denied = await GuardAsync("browser-supplement", 10, token);
        return denied ?? this.ToIdentityResult(await identityAccess.SupplementBrowserApplicationAsync(BrowserToken, applicationId, request.Note, request.RowVersion, token));
    }

    [Authorize]
    [HttpPost("api/groups/{groupId:guid}/members/{memberId:guid}/passkey-recovery")]
    public async Task<IActionResult> Issue(Guid groupId, Guid memberId, RecoveryRequest request, CancellationToken token)
    {
        var denied = await GuardAsync("recovery-issue", 10, token);
        if (denied is not null) return denied;
        var actor = currentMemberAccessor.GetCurrentMemberId();
        return actor is null ? Unauthorized() : this.ToIdentityResult(await identityAccess.IssuePersonalPasskeyAsync(actor.Value, groupId, memberId, request.IdentityVerified, token));
    }

    [Authorize]
    [HttpPost("api/groups/{groupId:guid}/members/{memberId:guid}/passkey-recovery/{invitationId:guid}/revoke")]
    public async Task<IActionResult> Revoke(Guid groupId, Guid memberId, Guid invitationId, CancellationToken token)
    {
        var denied = await GuardAsync("recovery-revoke", 10, token);
        if (denied is not null) return denied;
        var actor = currentMemberAccessor.GetCurrentMemberId();
        return actor is null ? Unauthorized() : this.ToIdentityResult(await identityAccess.RevokePersonalPasskeyAsync(actor.Value, groupId, memberId, invitationId, token));
    }

    private string BrowserToken => Request.Cookies["alife_application"] ?? string.Empty;

    private async Task<IActionResult?> GuardAsync(string scope, int limit, CancellationToken token)
    {
        this.ApplyPrivateNoStoreHeaders();
        if (!IdentityHttp.IsTrustedBrowserOrigin(Request, configuration)) return StatusCode(403, new { code = "identity_origin_invalid" });
        var client = IdentityHttp.GetClientRateLimitKey(Request, configuration);
        var decision = await rateLimiter.TryConsumeAsync(scope, client, limit, TimeSpan.FromMinutes(1), token);
        return decision.Allowed ? null : this.RateLimited(decision);
    }

    public sealed record BrowserStatusRequest(Guid? ApplicationId, Guid? InviteId);
    public sealed record RecoveryRequest(bool IdentityVerified);
}
