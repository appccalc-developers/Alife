using Alife.Application.Abstractions.Identity;
using Alife.Application.Common.Sync;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/sync")]
public sealed class SyncController(
    ICurrentMemberAccessor currentMemberAccessor,
    IPushSubscriptionStore subscriptionStore,
    ISyncVersionService versionService,
    IConfiguration configuration)
    : ControllerBase
{
    [HttpGet("vapid-public-key")]
    [AllowAnonymous]
    public IActionResult GetVapidPublicKey()
    {
        var publicKey = configuration["Push:VapidPublicKey"];
        return Ok(new { publicKey });
    }

    [HttpGet("versions")]
    [AllowAnonymous]
    public async Task<IActionResult> GetVersions([FromQuery] string? keys, CancellationToken cancellationToken)
    {
        var requestedKeys = (keys ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(x => x.Length <= 250)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(100)
            .ToArray();

        var snapshot = await versionService.GetBulkAsync(requestedKeys, cancellationToken);
        return Ok(snapshot);
    }

    [HttpPost("subscriptions")]
    [Authorize]
    public async Task<IActionResult> UpsertSubscription(
        [FromBody] PushSubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.Endpoint) ||
            string.IsNullOrWhiteSpace(request.Keys?.P256dh) ||
            string.IsNullOrWhiteSpace(request.Keys?.Auth))
        {
            return BadRequest(new { message = "Push subscription endpoint and keys are required." });
        }

        await subscriptionStore.UpsertAsync(
            currentMemberId.Value,
            new PushSubscriptionDto(
                request.Endpoint,
                request.Keys.P256dh,
                request.Keys.Auth,
                Request.Headers.UserAgent.ToString()),
            cancellationToken);

        return Ok(new { ok = true });
    }

    [HttpDelete("subscriptions")]
    [Authorize]
    public async Task<IActionResult> DeleteSubscription(
        [FromBody] DeletePushSubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        await subscriptionStore.DeleteAsync(currentMemberId.Value, request.Endpoint, cancellationToken);
        return Ok(new { ok = true });
    }

    public sealed record PushSubscriptionRequest(string Endpoint, PushSubscriptionKeys? Keys);
    public sealed record PushSubscriptionKeys(string P256dh, string Auth);
    public sealed record DeletePushSubscriptionRequest(string Endpoint);
}
