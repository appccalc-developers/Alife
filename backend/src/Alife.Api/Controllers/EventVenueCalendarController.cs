using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace Alife.Api.Controllers;
[ApiController, Authorize, Route("api/groups/{groupId:guid}/event-venues/{venueId:guid}")]
public sealed class EventVenueCalendarController(EventVenueCalendarService service, ICurrentMemberAccessor current) : ControllerBase
{
    [HttpGet("calendar")]
    public async Task<IActionResult> Get(Guid groupId, Guid venueId, [FromQuery] DateOnly from, [FromQuery] DateOnly until, CancellationToken ct)
    {
        this.ApplyNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? this.ToActionResult(await service.CalendarAsync(groupId, venueId, actor, from, until, ct)) : Unauthorized();
    }
    [HttpPost("weekly")]
    public async Task<IActionResult> Save(Guid groupId, Guid venueId, [FromBody] WeeklyVenueRequest body, CancellationToken ct)
    {
        this.ApplyNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? this.ToActionResult(await service.SaveWeeklyAsync(groupId, venueId, actor, body, Request.Headers.IfMatch, Request.Headers["Idempotency-Key"], ct)) : Unauthorized();
    }
    [HttpPost("weekly/{ruleId:guid}/exceptions")]
    public async Task<IActionResult> Exception(Guid groupId, Guid venueId, Guid ruleId, [FromBody] VenueExceptionRequest body, CancellationToken ct)
    {
        this.ApplyNoStoreHeaders();
        return current.GetCurrentMemberId() is { } actor ? this.ToActionResult(await service.ExceptionAsync(groupId, venueId, ruleId, actor, body, Request.Headers.IfMatch, Request.Headers["Idempotency-Key"], ct)) : Unauthorized();
    }
}
