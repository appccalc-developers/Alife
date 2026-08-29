using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Api.Identity;
using Alife.Application.IdentityAccess;
using Alife.Application.VisitContactRequests.Commands.CreateVisitContactRequest;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/visit-contact-requests")]
public class VisitContactRequestsController(
    IMediator mediator,
    IServerRateLimiter rateLimiter,
    IConfiguration configuration) : ControllerBase
{
    [HttpPost]
    [AllowAnonymous]
    public async Task<IActionResult> Create(
        CreateVisitContactRequestRequest request,
        CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var client = IdentityHttp.GetClientRateLimitKey(Request, configuration);
        var hourly = await rateLimiter.TryConsumeAsync(
            "visitor-contact-ip-1h", client, 3, TimeSpan.FromHours(1), cancellationToken);
        if (!hourly.Allowed) return this.RateLimited(hourly);
        var daily = await rateLimiter.TryConsumeAsync(
            "visitor-contact-ip-1d", client, 10, TimeSpan.FromDays(1), cancellationToken);
        if (!daily.Allowed) return this.RateLimited(daily);

        var result = await mediator.Send(
            new CreateVisitContactRequestCommand(
                request.DisplayName,
                request.Salutation,
                request.Email,
                request.Phone,
                request.PreferredLanguage,
                request.Message,
                request.SourcePage,
                null,
                Request.Headers.UserAgent.ToString(),
                request.RequestKind,
                request.ReplyPreference,
                request.PrivacyConsent,
                request.PrivacyConsentVersion,
                request.Honeypot,
                request.FormStartedUnixMilliseconds),
            cancellationToken);

        return result.IsSuccess
            ? StatusCode(StatusCodes.Status201Created, result.Value)
            : this.ToActionResult(result);
    }

    public sealed record CreateVisitContactRequestRequest(
        string DisplayName,
        string? Salutation,
        string? Email,
        string? Phone,
        string? PreferredLanguage,
        string? Message,
        string? SourcePage,
        string RequestKind = "visitorMessage",
        string? ReplyPreference = null,
        bool PrivacyConsent = false,
        string? PrivacyConsentVersion = null,
        string? Honeypot = null,
        long FormStartedUnixMilliseconds = 0);
}
