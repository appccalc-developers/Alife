using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/events/{eventId:guid}/travel")]
[Authorize]
public sealed class EventTravelController(
    IEventTravelService travel,
    ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet]
    public Task<IActionResult> GetWorkspace(Guid eventId, CancellationToken ct)
        => Run(member => travel.GetWorkspaceAsync(eventId, member, ct));

    [HttpGet("me")]
    public Task<IActionResult> GetMyJourneys(Guid eventId, CancellationToken ct)
        => Run(member => travel.GetMyJourneysAsync(eventId, member, ct));

    [HttpPost("drivers")]
    public Task<IActionResult> CreateDriver(Guid eventId, SaveEventTravelDriverRequest request, CancellationToken ct)
        => Run(member => travel.CreateDriverAsync(eventId, member, request, IdempotencyKey(), ct));

    [HttpPut("drivers/{driverId:guid}")]
    public Task<IActionResult> UpdateDriver(Guid eventId, Guid driverId, SaveEventTravelDriverRequest request, CancellationToken ct)
        => Run(member => travel.UpdateDriverAsync(eventId, driverId, member, request, IfMatch(), ct));

    [HttpPost("vehicles")]
    public Task<IActionResult> CreateVehicle(Guid eventId, SaveEventTravelVehicleRequest request, CancellationToken ct)
        => Run(member => travel.CreateVehicleAsync(eventId, member, request, IdempotencyKey(), ct));

    [HttpPut("vehicles/{vehicleId:guid}")]
    public Task<IActionResult> UpdateVehicle(Guid eventId, Guid vehicleId, SaveEventTravelVehicleRequest request, CancellationToken ct)
        => Run(member => travel.UpdateVehicleAsync(eventId, vehicleId, member, request, IfMatch(), ct));

    [HttpPost("journeys")]
    public Task<IActionResult> CreateJourney(Guid eventId, CreateEventTravelJourneyRequest request, CancellationToken ct)
        => Run(member => travel.CreateJourneyAsync(eventId, member, request, IdempotencyKey(), ct));

    [HttpPut("journeys/{journeyId:guid}")]
    public Task<IActionResult> UpdateJourney(Guid eventId, Guid journeyId, UpdateEventTravelJourneyRequest request, CancellationToken ct)
        => Run(member => travel.UpdateJourneyAsync(eventId, journeyId, member, request, IfMatch(), ct));

    [HttpPost("journeys/{journeyId:guid}/pickup-stops")]
    public Task<IActionResult> AddPickupStop(Guid eventId, Guid journeyId, SaveEventTravelPickupStopRequest request, CancellationToken ct)
        => Run(member => travel.AddPickupStopAsync(eventId, journeyId, member, request, IfMatch(), IdempotencyKey(), ct));

    [HttpPut("journeys/{journeyId:guid}/pickup-stops/{stopId:guid}")]
    public Task<IActionResult> UpdatePickupStop(Guid eventId, Guid journeyId, Guid stopId, SaveEventTravelPickupStopRequest request, CancellationToken ct)
        => Run(member => travel.UpdatePickupStopAsync(eventId, journeyId, stopId, member, request, IfMatch(), ct));

    [HttpPost("journeys/{journeyId:guid}/passengers")]
    public Task<IActionResult> AssignPassenger(Guid eventId, Guid journeyId, AssignEventTravelPassengerRequest request, CancellationToken ct)
        => Run(member => travel.AssignPassengerAsync(eventId, journeyId, member, request, IfMatch(), IdempotencyKey(), ct));

    [HttpPost("journeys/{journeyId:guid}/passengers/{assignmentId:guid}/remove")]
    public Task<IActionResult> RemovePassenger(Guid eventId, Guid journeyId, Guid assignmentId, CancellationToken ct)
        => Run(member => travel.RemovePassengerAsync(eventId, journeyId, assignmentId, member, IfMatch(), IdempotencyKey(), ct));

    private string IfMatch() => Request.Headers.IfMatch.ToString();
    private string IdempotencyKey() => Request.Headers["Idempotency-Key"].ToString();

    private async Task<IActionResult> Run<T>(Func<Guid, Task<Alife.Application.Common.Models.AppResult<T>>> action)
    {
        this.ApplyNoStoreHeaders();
        Response.Headers.CacheControl = "private, no-store";
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue) return Unauthorized();
        return this.ToActionResult(await action(memberId.Value));
    }
}
