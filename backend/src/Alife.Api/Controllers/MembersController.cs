using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Api.Security;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Abstractions.Integrations;
using Alife.Application.Members.Commands.LineLogin;
using Alife.Application.Members.Commands.LoginByDisplayName;
using Alife.Application.Members.Commands.RegisterMember;
using Alife.Application.Members.Commands.UpdateCurrentMemberLanguage;
using Alife.Application.Members.Dtos;
using Alife.Application.Members.Queries.GetCurrentMemberProfile;
using Alife.Application.Members.Queries.GetMembers;
using Alife.Domain.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class MembersController(
    IMediator mediator,
    ICurrentMemberAccessor currentMemberAccessor,
    IConfiguration configuration,
    ILineLoginService lineLoginService) : ControllerBase
{
    [HttpGet("me")]
    [AllowAnonymous]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            this.ApplyNoStoreHeaders();
            return Ok(new CurrentMemberDto(
                Guid.Empty, null, null, null, null, null, MemberLanguage.Zh,
                IsGuest: true,
                IsRegistered: false,
                IsAdmin: false,
                Memberships: []));
        }

        var result = await mediator.Send(
            new GetCurrentMemberProfileQuery(currentMemberId.Value),
            cancellationToken);

        if (result.IsSuccess && result.Value is not null)
        {
            this.ApplyNoStoreHeaders();
            return Ok(result.Value);
        }

        if (User.Identity?.IsAuthenticated == true && IsGuestPrincipal(User))
        {
            this.ApplyNoStoreHeaders();
            return Ok(new CurrentMemberDto(
                currentMemberId.Value, null, null, null, null, null, GetLanguageClaim(User),
                IsGuest: true,
                IsRegistered: false,
                IsAdmin: IsAdminPrincipal(User),
                Memberships: []));
        }

        return Unauthorized();
    }

    [HttpPut("me/profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateCurrentMemberProfileRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new UpdateCurrentMemberLanguageCommand(currentMemberId.Value, request.Language),
            cancellationToken);

        if (!result.IsSuccess || result.Value is null)
        {
            return this.ToActionResult(result);
        }

        AuthCookie.WriteCookie(Request, Response, result.Value.Token, result.Value.ExpiresUtc);
        this.ApplyNoStoreHeaders();
        return Ok(new { ok = true, language = result.Value.Language, expiresUtc = result.Value.ExpiresUtc });
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

	private static string GetLanguageClaim(ClaimsPrincipal principal)
		=> MemberLanguage.Normalize(principal.FindFirstValue("language"));

    private static bool GetBooleanClaim(ClaimsPrincipal principal, string claimName)
        => bool.TryParse(principal.FindFirstValue(claimName), out var value) && value;

    [HttpGet("members")]
    public async Task<IActionResult> ListMembers(CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new GetMembersQuery(), cancellationToken);
        return this.ToActionResult(result);
    }

    public record RegisterRequest(string Name, string? Sex, int? Age, string? Email);
    public record UpdateCurrentMemberProfileRequest(string Language);
    public record LoginByDisplayNameRequest(string DisplayName);
}
