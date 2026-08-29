using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Api.Security;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Abstractions.Integrations;
using Alife.Application.Members.Commands.LineLogin;
using Alife.Application.Members.Commands.RegisterMember;
using Alife.Application.Members.Commands.SaveBibleReadingProgress;
using Alife.Application.Members.Commands.UpdateCurrentMemberProfile;
using Alife.Application.Members.Dtos;
using Alife.Application.Members.Queries.GetCurrentMemberProfile;
using Alife.Application.Members.Queries.GetBibleReadingProgress;
using Alife.Application.Members.Queries.GetMembers;
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
    ILineLoginService lineLoginService,
    Alife.Application.IdentityAccess.IIdentityAccessService identityAccess) : ControllerBase
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
                Guid.Empty, null, null, null, null, null,
                IsGuest: true,
                IsRegistered: false,
                IsAdmin: false,
                PlatformRole: "user",
                Permissions: [],
                Memberships: []));
        }

        var result = await mediator.Send(
            new GetCurrentMemberProfileQuery(currentMemberId.Value),
            cancellationToken);

        if (result.IsSuccess && result.Value is not null)
        {
            var sessionKind = User.FindFirstValue("session_kind") ?? "standard";
            this.ApplyPrivateNoStoreHeaders();
            return Ok(result.Value with
            {
                AuthenticationMethod = User.FindFirstValue("amr"),
                SessionKind = sessionKind,
                NeedsPasskey = sessionKind == "standard" && result.Value.NeedsPasskey
            });
        }

        if (User.Identity?.IsAuthenticated == true && IsGuestPrincipal(User))
        {
            this.ApplyPrivateNoStoreHeaders();
            return Ok(new CurrentMemberDto(
                currentMemberId.Value, null, null, null, null, null,
                IsGuest: true,
                IsRegistered: false,
                IsAdmin: IsAdminPrincipal(User),
                PlatformRole: ReadPlatformRolePrincipal(User),
                Permissions: [],
                Memberships: []));
        }

        return Unauthorized();
    }

    [HttpGet("members/line/login")]
    [AllowAnonymous]
    public async Task<IActionResult> LineLogin(CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var state = Guid.NewGuid().ToString("N");
        var binding = await identityAccess.BindLineStateAsync(ReadOnboardingFlowToken(), state, cancellationToken);
        if (!binding.IsSuccess) return NotFound();
        Response.Cookies.Append(
            "line_oauth_state",
            state,
            AuthCookie.CreateStateCookieOptions(Request, DateTimeOffset.UtcNow.AddMinutes(10)));

        var authUrl = lineLoginService.GetAuthorizationUrl(state);
        return Ok(new { authUrl });
    }

    [HttpGet("members/line/login/redirect")]
    [AllowAnonymous]
    public async Task<IActionResult> LineLoginRedirect(CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var state = Guid.NewGuid().ToString("N");
        var binding = await identityAccess.BindLineStateAsync(ReadOnboardingFlowToken(), state, cancellationToken);
        if (!binding.IsSuccess)
        {
            var frontend = (configuration["Frontend:BaseUrl"] ?? "").TrimEnd('/');
            return Redirect($"{frontend}/onboarding?line_error=missing_flow");
        }
        Response.Cookies.Append(
            "line_oauth_state",
            state,
            AuthCookie.CreateStateCookieOptions(Request, DateTimeOffset.UtcNow.AddMinutes(10)));

        var authUrl = lineLoginService.GetAuthorizationUrl(state);
        return Redirect(authUrl);
    }

    [HttpGet("members/line/callback")]
    [AllowAnonymous]
    public async Task<IActionResult> LineCallback([FromQuery] string? code, [FromQuery] string? state, CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var frontendBaseUrl = (configuration["Frontend:BaseUrl"] ?? "").TrimEnd('/');

        if (string.IsNullOrWhiteSpace(code))
        {
            return Redirect($"{frontendBaseUrl}/onboarding?line_error=missing_code");
        }

        var storedState = Request.Cookies["line_oauth_state"];
        if (string.IsNullOrWhiteSpace(storedState) ||
            string.IsNullOrWhiteSpace(state) ||
            storedState.Length != state.Length ||
            !System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
                System.Text.Encoding.UTF8.GetBytes(storedState),
                System.Text.Encoding.UTF8.GetBytes(state)))
        {
            return Redirect($"{frontendBaseUrl}/onboarding?line_error=invalid_state");
        }

        var flowResult = await identityAccess.ConsumeLineStateAsync(ReadOnboardingFlowToken(), state, cancellationToken);
        if (!flowResult.IsSuccess || flowResult.Value is null)
        {
            return Redirect($"{frontendBaseUrl}/onboarding?line_error=invalid_state");
        }

        Response.Cookies.Delete("line_oauth_state");

        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        var result = await mediator.Send(
            new LineLoginCommand(currentMemberId, code, flowResult.Value.IsPublicDevice),
            cancellationToken);

        if (!result.IsSuccess || result.Value is null)
        {
            return Redirect($"{frontendBaseUrl}/onboarding?line_error=login_failed");
        }

        if (result.Value.Token is not null && result.Value.ExpiresUtc is not null)
        {
            AuthCookie.WriteCookie(
                Request,
                Response,
                result.Value.Token,
                result.Value.ExpiresUtc.Value,
                persistent: !flowResult.Value.IsPublicDevice);
        }

        if (result.Value.IsRegistered)
        {
            var context = flowResult.Value;
            if (context.Intent is "activation" or "groupJoin" or "applicationResponse")
            {
                return Redirect($"{frontendBaseUrl}/onboarding?intent={Uri.EscapeDataString(context.Intent)}");
            }
            return Redirect($"{frontendBaseUrl}{(string.IsNullOrWhiteSpace(context.ReturnPath) ? "/enter" : context.ReturnPath)}");
        }

        return Redirect($"{frontendBaseUrl}/onboarding?line_login=true&intent={Uri.EscapeDataString(flowResult.Value.Intent)}");
    }

    [HttpPost("members/register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        var verifiedLineUID = currentMemberAccessor.GetVerifiedLineUID();

        if (currentMemberId is null && string.IsNullOrWhiteSpace(verifiedLineUID))
        {
            return Unauthorized();
        }

        var flow = await identityAccess.GetActiveFlowAsync(ReadOnboardingFlowToken(), cancellationToken);
        var isPublicDevice = flow?.IsPublicDevice == true;
        var result = await mediator.Send(
            new RegisterMemberCommand(
                currentMemberId,
                verifiedLineUID,
                request.Name,
                request.Sex,
                request.Age,
                request.Email,
                isPublicDevice),
            cancellationToken);

        if (!result.IsSuccess || result.Value is null)
        {
            return this.ToActionResult(result);
        }

        AuthCookie.WriteCookie(
            Request,
            Response,
            result.Value.Token,
            result.Value.ExpiresUtc,
            persistent: !isPublicDevice);
        return Ok(new { ok = true, expiresUtc = result.Value.ExpiresUtc });
    }

    [HttpPost("members/login/account")]
    [AllowAnonymous]
    public IActionResult LoginByAccount()
    {
        this.ApplyPrivateNoStoreHeaders();
        return NotFound();
    }

    private string ReadOnboardingFlowToken() => Request.Cookies["alife_onboarding"] ?? string.Empty;

    private static string GetMemberProfileCacheKey(Guid memberId, DateTime? updatedUtc)
        => $"member-profile:{memberId}:{updatedUtc?.Ticks ?? 0L}";

    private static bool IsGuestPrincipal(ClaimsPrincipal principal)
        => !GetBooleanClaim(principal, "is_registered");

    private static bool IsAdminPrincipal(ClaimsPrincipal principal)
        => GetBooleanClaim(principal, "is_admin");

    private static string ReadPlatformRolePrincipal(ClaimsPrincipal principal)
        => principal.FindFirstValue("platform_role") ?? (IsAdminPrincipal(principal) ? "admin" : "user");

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

    [HttpPut("me/profile")]
    public async Task<IActionResult> UpdateCurrentMemberProfile(
        [FromBody] UpdateCurrentMemberProfileRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new UpdateCurrentMemberProfileCommand(
            currentMemberId.Value,
            request.DisplayName,
            request.Email,
            request.PhoneE164), cancellationToken);
        this.ApplyNoStoreHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("me/bible-reading-progress")]
    public async Task<IActionResult> GetBibleReadingProgress(CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();

        var result = await mediator.Send(
            new GetBibleReadingProgressQuery(currentMemberId.Value),
            cancellationToken);
        this.ApplyNoStoreHeaders();
        return this.ToActionResult(result);
    }

    [HttpPut("me/bible-reading-progress")]
    public async Task<IActionResult> SaveBibleReadingProgress(
        [FromBody] SaveBibleReadingProgressRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();

        var result = await mediator.Send(new SaveBibleReadingProgressCommand(
            currentMemberId.Value,
            request.Book,
            request.Chapter,
            request.Language,
            request.ZhVersion,
            request.EnVersion), cancellationToken);
        this.ApplyNoStoreHeaders();
        return this.ToActionResult(result);
    }

    public record RegisterRequest(string Name, string? Sex, int? Age, string? Email);
    public record UpdateCurrentMemberProfileRequest(string? DisplayName, string? Email, string? PhoneE164);
    public record SaveBibleReadingProgressRequest(
        string Book,
        int Chapter,
        string Language,
        string? ZhVersion,
        string? EnVersion);
}
