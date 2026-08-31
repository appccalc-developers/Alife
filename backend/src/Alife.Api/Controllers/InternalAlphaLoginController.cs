using Alife.Api.Http;
using Alife.Api.Identity;
using Alife.Api.Security;
using Alife.Application.IdentityAccess;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/internal/alpha-login")]
public sealed class InternalAlphaLoginController(
    IIdentityAccessService identityAccess,
    IIdentityAccessConfiguration identityConfiguration,
    IServerRateLimiter rateLimiter,
    IConfiguration configuration) : ControllerBase
{
    [HttpGet("accounts")]
    public IActionResult Accounts()
    {
        this.ApplyPrivateNoStoreHeaders();
        return !identityConfiguration.AlphaLoginEnabled
            ? NotFound()
            : Ok(identityAccess.ListAlphaAccounts());
    }

    [HttpPost]
    public async Task<IActionResult> Login(AlphaLoginRequest request, CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        if (!identityConfiguration.AlphaLoginEnabled)
        {
            return NotFound();
        }

        var client = IdentityHttp.GetClientRateLimitKey(Request, configuration);
        var ipDecision = await rateLimiter.TryConsumeAsync(
            "alpha-login-ip-15m", client, 10, TimeSpan.FromMinutes(15), cancellationToken);
        if (!ipDecision.Allowed) return this.RateLimited(ipDecision);
        var accountDecision = await rateLimiter.TryConsumeAsync(
            "alpha-login-account-15m", request.AccountId, 5, TimeSpan.FromMinutes(15), cancellationToken);
        if (!accountDecision.Allowed) return this.RateLimited(accountDecision);

        var result = await identityAccess.AlphaLoginAsync(
            request.AccountId,
            request.PasskeyBootstrapCode,
            cancellationToken);
        if (result.IsSuccess && result.Value is not null)
        {
            AuthCookie.WriteCookie(Request, Response, result.Value.Token, result.Value.ExpiresUtc, persistent: false);
            return Ok(new { ok = true, result.Value.ExpiresUtc, result.Value.ReturnPath });
        }
        return this.ToIdentityResult(result);
    }

    public sealed record AlphaLoginRequest(string AccountId, string? PasskeyBootstrapCode = null);
}
