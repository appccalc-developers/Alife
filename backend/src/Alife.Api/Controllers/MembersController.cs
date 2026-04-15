using Alife.Api.Results;
using Alife.Api.Security;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Common.Models;
using Alife.Application.Members.Commands.ConfirmPhoneVerification;
using Alife.Application.Members.Commands.RegisterMember;
using Alife.Application.Members.Commands.StartPhoneVerification;
using Alife.Application.Members.Dtos;
using Alife.Application.Members.Queries.GetCurrentMemberProfile;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Hybrid;
using PhoneNumbers;
using System.Security.Claims;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class MembersController(
    IMediator mediator,
    ICurrentMemberAccessor currentMemberAccessor,
    HybridCache hybridCache,
    IWebHostEnvironment environment,
    IConfiguration configuration) : ControllerBase
{
    [HttpGet("me")]
    [AllowAnonymous]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
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

        var profile = await hybridCache.GetOrCreateAsync(
            GetMemberProfileCacheKey(currentMemberId.Value),
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

            return Ok(fallbackGuest);
        }

        return Unauthorized();
    }

    [HttpPost("members/phone/start")]
    [AllowAnonymous]
    public async Task<IActionResult> StartPhoneVerification([FromBody] StartPhoneRequest request, CancellationToken cancellationToken)
    {
        if (!TryNormalizeToE164(request.PhoneE164, out var phoneE164, out var errorMessage))
        {
            return this.ToActionResult(AppResult<MemberActionResultDto>.Validation(errorMessage ?? "Invalid phone number."));
        }

        var result = await mediator.Send(new StartPhoneVerificationCommand(phoneE164), cancellationToken);
        if (result.IsSuccess && result.Value is not null)
        {
            return Ok(result.Value with { PhoneE164 = phoneE164 });
        }

        return this.ToActionResult(result);
    }
    [HttpPost("members/phone/confirm")]
    [AllowAnonymous]
    public async Task<IActionResult> ConfirmPhoneVerification([FromBody] ConfirmPhoneRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();

        if (!TryNormalizeToE164(request.PhoneE164, out var phoneE164, out var errorMessage))
        {
            return this.ToActionResult(AppResult<MemberActionResultDto>.Validation(errorMessage ?? "Invalid phone number."));
        }

        var result = await mediator.Send(
            new ConfirmPhoneVerificationCommand(currentMemberId, phoneE164, request.Code),
            cancellationToken);

        if (result.IsSuccess && result.Value is not null)
        {
            if (currentMemberId is not null)
            {
                await hybridCache.RemoveAsync(GetMemberProfileCacheKey(currentMemberId.Value), cancellationToken);
            }

            if (result.Value.Token is not null && result.Value.ExpiresUtc is not null)
            {
                AuthCookie.WriteCookie(Response, result.Value.Token, result.Value.ExpiresUtc.Value, environment.IsDevelopment());
            }

            return Ok(result.Value with { PhoneE164 = phoneE164, Token = null, ExpiresUtc = null });
        }

        if (result.IsSuccess && currentMemberId is not null)
        {
            await hybridCache.RemoveAsync(GetMemberProfileCacheKey(currentMemberId.Value), cancellationToken);
        }

        return this.ToActionResult(result);
    }

    [HttpPost("members/register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new RegisterMemberCommand(currentMemberId.Value, request.Name, request.Sex, request.Age, request.Email),
            cancellationToken);

        if (!result.IsSuccess || result.Value is null)
        {
            return this.ToActionResult(result);
        }

        await hybridCache.RemoveAsync(GetMemberProfileCacheKey(currentMemberId.Value), cancellationToken);
        AuthCookie.WriteCookie(Response, result.Value.Token, result.Value.ExpiresUtc, environment.IsDevelopment());
        return Ok(new { ok = true, expiresUtc = result.Value.ExpiresUtc });
    }

    private static string GetMemberProfileCacheKey(Guid memberId) => $"member-profile:{memberId}";

    private static bool IsGuestPrincipal(ClaimsPrincipal principal)
        => !GetBooleanClaim(principal, "is_registered");

    private static bool IsAdminPrincipal(ClaimsPrincipal principal)
        => GetBooleanClaim(principal, "is_admin");

    private static bool GetBooleanClaim(ClaimsPrincipal principal, string claimName)
        => bool.TryParse(principal.FindFirstValue(claimName), out var value) && value;

    private bool TryNormalizeToE164(string? input, out string phoneE164, out string? errorMessage)
    {
        phoneE164 = string.Empty;
        errorMessage = null;

        if (string.IsNullOrWhiteSpace(input))
        {
            errorMessage = "phoneE164 is required.";
            return false;
        }

        var defaultRegion = configuration["PhoneNumber:DefaultRegion"]?.Trim();
        if (string.IsNullOrWhiteSpace(defaultRegion))
        {
            defaultRegion = "US";
        }

        var phoneUtil = PhoneNumberUtil.GetInstance();

        try
        {
            var parsed = phoneUtil.Parse(input, defaultRegion.ToUpperInvariant());
            if (!phoneUtil.IsValidNumber(parsed))
            {
                errorMessage = "Invalid phone number.";
                return false;
            }

            phoneE164 = phoneUtil.Format(parsed, PhoneNumberFormat.E164);
            return true;
        }
        catch (NumberParseException)
        {
            errorMessage = "Invalid phone number.";
            return false;
        }
    }

    public record StartPhoneRequest(string PhoneE164);
    public record ConfirmPhoneRequest(string PhoneE164, string Code);
    public record RegisterRequest(string Name, string? Sex, int? Age, string? Email);
}
