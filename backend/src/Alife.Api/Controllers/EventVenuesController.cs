using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public sealed class EventVenuesController(
    IEventVenueService venues,
    ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet("groups/{groupId:guid}/venues")]
    public Task<IActionResult> ListCatalogue(Guid groupId, CancellationToken ct)
        => Run(member => venues.ListCatalogueAsync(groupId, member, ct));

    [HttpPost("groups/{groupId:guid}/venues")]
    public Task<IActionResult> CreateVenue(Guid groupId, SaveEventVenueRequest request, CancellationToken ct)
        => Run(member => venues.CreateVenueAsync(groupId, member, request,
            Request.Headers["Idempotency-Key"].ToString(), ct), value => value.ETag);

    [HttpPut("groups/{groupId:guid}/venues/{venueId:guid}")]
    public Task<IActionResult> UpdateVenue(Guid groupId, Guid venueId, SaveEventVenueRequest request, CancellationToken ct)
        => Run(member => venues.UpdateVenueAsync(groupId, venueId, member, request,
            Request.Headers.IfMatch.ToString(), ct), value => value.ETag);

    [HttpGet("events/{eventId:guid}/venue-reservations")]
    public Task<IActionResult> GetWorkspace(Guid eventId, CancellationToken ct)
        => Run(member => venues.GetWorkspaceAsync(eventId, member, ct));

    [HttpPost("events/{eventId:guid}/venue-reservations")]
    public Task<IActionResult> Reserve(Guid eventId, ReserveEventVenueRequest request, CancellationToken ct)
        => Run(member => venues.ReserveAsync(eventId, member, request,
            Request.Headers.IfMatch.ToString(), Request.Headers["Idempotency-Key"].ToString(), ct));

    [HttpPost("events/{eventId:guid}/venue-reservations/{reservationId:guid}/release")]
    public Task<IActionResult> Release(Guid eventId, Guid reservationId, CancellationToken ct)
        => Run(member => venues.ReleaseAsync(eventId, reservationId, member,
            Request.Headers.IfMatch.ToString(), Request.Headers["Idempotency-Key"].ToString(), ct));

    private async Task<IActionResult> Run<T>(
        Func<Guid, Task<Alife.Application.Common.Models.AppResult<T>>> action,
        Func<T, string>? eTag = null)
    {
        this.ApplyNoStoreHeaders();
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        var result = await action(memberId.Value);
        if (result.IsSuccess && eTag is not null) Response.Headers.ETag = eTag(result.Value!);
        return this.ToActionResult(result);
    }
}
