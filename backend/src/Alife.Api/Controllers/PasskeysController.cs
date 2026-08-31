using System.Security.Claims;
using System.Text.Json;
using Alife.Api.Http;
using Alife.Api.Identity;
using Alife.Api.Security;
using Alife.Application.Abstractions.Identity;
using Alife.Application.IdentityAccess;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class PasskeysController(
    IPasskeyService passkeys,
    IIdentityAccessService identityAccess,
    ICurrentMemberAccessor currentMemberAccessor,
    IServerRateLimiter rateLimiter,
    IConfiguration configuration) : ControllerBase
{
    [HttpPost("auth/passkeys/authentication/options")]
    [AllowAnonymous]
    public async Task<IActionResult> AuthenticationOptions(CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var limited = await LimitPasskeysAsync("passkey-options-ip-10m", 20, cancellationToken);
        if (limited is not null) return limited;
        var flow = await identityAccess.GetActiveFlowAsync(ReadFlowToken(), cancellationToken);
        return this.ToIdentityResult(await passkeys.BeginAuthenticationAsync(flow?.Id, cancellationToken));
    }

    [HttpPost("auth/passkeys/authentication/complete")]
    [AllowAnonymous]
    public async Task<IActionResult> CompleteAuthentication(CompletePasskeyRequest request, CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var limited = await LimitPasskeysAsync("passkey-assertion-ip-10m", 20, cancellationToken);
        if (limited is not null) return limited;
        var result = await passkeys.CompleteAuthenticationAsync(request.CeremonyId, request.Response, cancellationToken);
        if (result.IsSuccess && result.Value?.Session is { } session)
        {
            AuthCookie.WriteCookie(Request, Response, session.Token, session.ExpiresUtc, session.Persistent);
            return Ok(new { ok = true, session.ExpiresUtc, session.ReturnPath, session.SessionKind });
        }
        var failed = await LimitPasskeyFailureAsync(request.Response, cancellationToken);
        if (failed is not null) return failed;
        return this.ToIdentityResult(result);
    }

    [HttpPost("auth/passkeys/registration/options")]
    [AllowAnonymous]
    public async Task<IActionResult> RegistrationOptions(CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var limited = await LimitPasskeysAsync("passkey-registration-options-ip-10m", 20, cancellationToken);
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
        var activationMemberIdForRegistration = flow?.ActivationMemberId;
        var memberId = activationMemberIdForRegistration ?? currentMemberId;
        if (memberId is null) return Unauthorized();
        if (activationMemberIdForRegistration is null && !HasRecentStrongAuthentication())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ProblemDetails
            {
                Status = StatusCodes.Status403Forbidden,
                Title = "Recent authentication is required.",
                Extensions = { ["code"] = "recent_authentication_required" }
            });
        }
        Guid? activationFlowId = activationMemberIdForRegistration is null ? null : flow!.Id;
        var firstCredentialOnly = activationFlowId is null &&
                                  User.FindFirstValue("amr") == "alpha_bootstrap";
        return this.ToIdentityResult(await passkeys.BeginRegistrationAsync(
            memberId.Value,
            activationFlowId,
            firstCredentialOnly,
            cancellationToken));
    }

    [HttpPost("auth/passkeys/registration/complete")]
    [AllowAnonymous]
    public async Task<IActionResult> CompleteRegistration(CompletePasskeyRequest request, CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var limited = await LimitPasskeysAsync("passkey-registration-ip-10m", 20, cancellationToken);
        if (limited is not null) return limited;
        var result = await passkeys.CompleteRegistrationAsync(request.CeremonyId, request.Response, request.DisplayName, cancellationToken);
        if (result.IsSuccess && result.Value is not null)
        {
            if (result.Value.Session is { } session)
            {
                AuthCookie.WriteCookie(Request, Response, session.Token, session.ExpiresUtc, session.Persistent);
                AuthCookie.ClearOnboardingCookie(Request, Response);
            }
            return Ok(new
            {
                ok = true,
                result.Value.Credential,
                expiresUtc = result.Value.Session?.ExpiresUtc,
                returnPath = result.Value.Session?.ReturnPath ?? "/profile"
            });
        }
        var failed = await LimitPasskeyFailureAsync(request.Response, cancellationToken);
        if (failed is not null) return failed;
        return this.ToIdentityResult(result);
    }

    [HttpGet("me/passkeys")]
    [Authorize]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        return memberId is null
            ? Unauthorized()
            : this.ToIdentityResult(await passkeys.ListAsync(memberId.Value, cancellationToken));
    }

    [HttpDelete("me/passkeys/{credentialId:guid}")]
    [Authorize]
    public async Task<IActionResult> Revoke(Guid credentialId, CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (memberId is null) return Unauthorized();
        if (!HasRecentStrongAuthentication())
        {
            return StatusCode(StatusCodes.Status403Forbidden, new ProblemDetails
            {
                Status = StatusCodes.Status403Forbidden,
                Title = "Recent authentication is required.",
                Extensions = { ["code"] = "recent_authentication_required" }
            });
        }
        return this.ToIdentityResult(await passkeys.RevokeAsync(memberId.Value, credentialId, cancellationToken));
    }

    private bool HasRecentStrongAuthentication()
    {
        var method = User.FindFirstValue("amr");
        var value = User.FindFirstValue("auth_time");
        return method is "passkey" or "line" or "alpha_bootstrap" &&
               long.TryParse(value, out var seconds) &&
               DateTimeOffset.UtcNow - DateTimeOffset.FromUnixTimeSeconds(seconds) <= TimeSpan.FromMinutes(5);
    }

    private async Task<IActionResult?> LimitPasskeysAsync(string scope, int limit, CancellationToken cancellationToken)
    {
        var key = IdentityHttp.GetClientRateLimitKey(Request, configuration);
        var decision = await rateLimiter.TryConsumeAsync(scope, key, limit, TimeSpan.FromMinutes(10), cancellationToken);
        return decision.Allowed ? null : this.RateLimited(decision);
    }

    private async Task<IActionResult?> LimitPasskeyFailureAsync(JsonElement response, CancellationToken cancellationToken)
    {
        var rawId = response.TryGetProperty("rawId", out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
        var discriminator = string.IsNullOrWhiteSpace(rawId) ? ReadFlowToken() : rawId;
        if (string.IsNullOrWhiteSpace(discriminator))
        {
            discriminator = IdentityHttp.GetClientRateLimitKey(Request, configuration);
        }
        var decision = await rateLimiter.TryConsumeAsync(
            "passkey-failure-10m", discriminator!, 10, TimeSpan.FromMinutes(10), cancellationToken);
        return decision.Allowed ? null : this.RateLimited(decision);
    }

    private string ReadFlowToken() => Request.Cookies["alife_onboarding"] ?? string.Empty;

    public sealed record CompletePasskeyRequest(Guid CeremonyId, JsonElement Response, string? DisplayName = null);
}
