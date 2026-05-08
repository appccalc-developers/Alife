using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Api.Security;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Abstractions.Integrations;
using Alife.Application.Members.Commands.LineLogin;
using Alife.Application.Members.Commands.LoginByDisplayName;
using Alife.Application.Members.Commands.RegisterMember;
using Alife.Application.Members.Dtos;
using Alife.Application.Members.Queries.GetCurrentMemberProfile;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Hybrid;
using System.Security.Claims;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class MembersController(
    IMediator mediator,
    ICurrentMemberAccessor currentMemberAccessor,
    HybridCache hybridCache,
    IConfiguration configuration,
    ILineLoginService lineLoginService,
    AlifeDbContext dbContext) : ControllerBase
{
    [HttpGet("me")]
    [AllowAnonymous]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            this.ApplySyncCacheHeaders(null);
            return Ok(new CurrentMemberDto(
                Guid.Empty,
                DisplayName: null,
                Sex: null,
                Age: null,
                Email: null,
                PhoneE164: null,
                IsGuest: true,
                IsRegistered: false,
                IsAdmin: false,
                Memberships: []));
        }

        var memberUpdatedUtc = await dbContext.Members
            .Where(x => x.Id == currentMemberId.Value)
            .Select(x => (DateTime?)x.UpdatedUtc)
            .FirstOrDefaultAsync(cancellationToken);
        var membershipUpdatedUtc = await dbContext.GroupMemberships
            .Where(x => x.MemberId == currentMemberId.Value)
            .MaxAsync(x => (DateTime?)x.UpdatedUtc, cancellationToken);
        var updatedUtc = new[] { memberUpdatedUtc, membershipUpdatedUtc }.Max();
        if (this.IsNotModified(updatedUtc))
        {
            return StatusCode(StatusCodes.Status304NotModified);
        }

        var profile = await hybridCache.GetOrCreateAsync(
            GetMemberProfileCacheKey(currentMemberId.Value, updatedUtc),
            async cancel =>
            {
                var result = await mediator.Send(new GetCurrentMemberProfileQuery(currentMemberId.Value), cancel);
                return result.Status == Application.Common.Models.AppResultStatus.Success ? result.Value : null;
            },
            new HybridCacheEntryOptions
            {
                Expiration = TimeSpan.FromMinutes(2),
                LocalCacheExpiration = TimeSpan.FromMinutes(1)
            },
            cancellationToken: cancellationToken);

        if (profile is not null)
        {
            this.ApplySyncCacheHeaders(updatedUtc);
            return Ok(profile);
        }

        if (User.Identity?.IsAuthenticated == true && IsGuestPrincipal(User))
        {
            var fallbackGuest = new CurrentMemberDto(
                currentMemberId.Value,
                DisplayName: null,
                Sex: null,
                Age: null,
                Email: null,
                PhoneE164: null,
                IsGuest: true,
                IsRegistered: false,
                IsAdmin: IsAdminPrincipal(User),
                Memberships: []);

            this.ApplySyncCacheHeaders(updatedUtc);
            return Ok(fallbackGuest);
        }

        return Unauthorized();
    }

    [HttpGet("members/line/login")]
    [AllowAnonymous]
    public IActionResult LineLogin()
    {
        var state = Guid.NewGuid().ToString("N");
        Response.Cookies.Append(
            "line_oauth_state",
            state,
            AuthCookie.CreateStateCookieOptions(Request, DateTimeOffset.UtcNow.AddMinutes(10)));

        var authUrl = lineLoginService.GetAuthorizationUrl(state);
        Console.WriteLine($"Redirecting to LINE login URL: {authUrl}");
        return Ok(new { authUrl });
    }

    [HttpGet("members/line/login/redirect")]
    [AllowAnonymous]
    public IActionResult LineLoginRedirect()
    {
        var state = Guid.NewGuid().ToString("N");
        Response.Cookies.Append(
            "line_oauth_state",
            state,
            AuthCookie.CreateStateCookieOptions(Request, DateTimeOffset.UtcNow.AddMinutes(10)));

        var authUrl = lineLoginService.GetAuthorizationUrl(state);
        Console.WriteLine($"Redirecting to LINE login URL: {authUrl}");
        return Redirect(authUrl);
    }

    [HttpGet("members/line/callback")]
    [AllowAnonymous]
    public async Task<IActionResult> LineCallback([FromQuery] string? code, [FromQuery] string? state, CancellationToken cancellationToken)
    {
        var frontendBaseUrl = (configuration["Frontend:BaseUrl"] ?? "").TrimEnd('/');

        if (string.IsNullOrWhiteSpace(code))
        {
            return Redirect($"{frontendBaseUrl}/onboarding?line_error=missing_code");
        }

        var storedState = Request.Cookies["line_oauth_state"];
        if (!string.IsNullOrWhiteSpace(storedState) && storedState != state)
        {
            return Redirect($"{frontendBaseUrl}/onboarding?line_error=invalid_state");
        }

        Response.Cookies.Delete("line_oauth_state");

        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        var result = await mediator.Send(new LineLoginCommand(currentMemberId, code), cancellationToken);

        if (!result.IsSuccess || result.Value is null)
        {
            return Redirect($"{frontendBaseUrl}/onboarding?line_error=login_failed");
        }

        if (result.Value.Token is not null && result.Value.ExpiresUtc is not null)
        {
            AuthCookie.WriteCookie(Request, Response, result.Value.Token, result.Value.ExpiresUtc.Value);
        }

        if (result.Value.IsRegistered)
        {
            return Redirect($"{frontendBaseUrl}?login=success&t={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}");
        }

        var queryParams = new System.Text.StringBuilder($"{frontendBaseUrl}/onboarding?line_login=true");
        if (!string.IsNullOrWhiteSpace(result.Value.DisplayName))
        {
            queryParams.Append($"&line_display_name={Uri.EscapeDataString(result.Value.DisplayName)}");
        }

        if (!string.IsNullOrWhiteSpace(result.Value.Email))
        {
            queryParams.Append($"&line_email={Uri.EscapeDataString(result.Value.Email)}");
        }

        return Redirect(queryParams.ToString());
    }

    [HttpPost("members/register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        var verifiedLineUID = currentMemberAccessor.GetVerifiedLineUID();

        if (currentMemberId is null && string.IsNullOrWhiteSpace(verifiedLineUID))
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new RegisterMemberCommand(currentMemberId, verifiedLineUID, request.Name, request.Sex, request.Age, request.Email),
            cancellationToken);

        if (!result.IsSuccess || result.Value is null)
        {
            return this.ToActionResult(result);
        }

        if (currentMemberId is not null)
        {
            await hybridCache.RemoveAsync(GetMemberProfileCacheKey(currentMemberId.Value, null), cancellationToken);
        }

        AuthCookie.WriteCookie(Request, Response, result.Value.Token, result.Value.ExpiresUtc);
        return Ok(new { ok = true, expiresUtc = result.Value.ExpiresUtc });
    }

    [HttpPost("members/login/display-name")]
    [AllowAnonymous]
    public async Task<IActionResult> LoginByDisplayName([FromBody] LoginByDisplayNameRequest request, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new LoginByDisplayNameCommand(request.DisplayName), cancellationToken);

        if (!result.IsSuccess || result.Value is null)
        {
            return this.ToActionResult(result);
        }

        if (result.Value.Token is not null && result.Value.ExpiresUtc is not null)
        {
            AuthCookie.WriteCookie(Request, Response, result.Value.Token, result.Value.ExpiresUtc.Value);
        }

        return Ok(new { ok = true, expiresUtc = result.Value.ExpiresUtc });
    }

    private static string GetMemberProfileCacheKey(Guid memberId, DateTime? updatedUtc)
        => $"member-profile:{memberId}:{updatedUtc?.Ticks ?? 0L}";

    private static bool IsGuestPrincipal(ClaimsPrincipal principal)
        => !GetBooleanClaim(principal, "is_registered");

    private static bool IsAdminPrincipal(ClaimsPrincipal principal)
        => GetBooleanClaim(principal, "is_admin");

    private static bool GetBooleanClaim(ClaimsPrincipal principal, string claimName)
        => bool.TryParse(principal.FindFirstValue(claimName), out var value) && value;
    public record RegisterRequest(string Name, string? Sex, int? Age, string? Email);
    public record LoginByDisplayNameRequest(string DisplayName);
}
