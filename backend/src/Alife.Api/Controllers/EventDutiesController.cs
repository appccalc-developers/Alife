using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController, Authorize, Route("api/events/{eventId:guid}/duties")]
public sealed class EventDutiesController(EventDutyProjectionService duties, ICurrentMemberAccessor memberAccessor) : ControllerBase
{
    [HttpGet("{sourceType}/{sourceId:guid}")]
    public async Task<IActionResult> Get(Guid eventId, string sourceType, Guid sourceId, [FromQuery] string? taskKey, CancellationToken ct)
    {
        this.ApplyPrivateNoStoreHeaders();
        var member = memberAccessor.GetCurrentMemberId();
        if (member is null) return Unauthorized();
        return this.ToActionResult(await duties.GetAsync(eventId, sourceType, sourceId, member.Value, taskKey, ct));
    }
}
