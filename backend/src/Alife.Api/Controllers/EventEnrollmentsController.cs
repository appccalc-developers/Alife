using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Commands.EnrollGroupEvent;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/group")]
[Authorize]
public class EventEnrollmentsController(
    IMediator mediator,
    ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpPost("{groupId:guid}/enroll")]
    public async Task<IActionResult> Enroll(Guid groupId, [FromBody] JsonElement enrollmentJson, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        if (enrollmentJson.ValueKind != JsonValueKind.Object)
        {
            return BadRequest(new { message = "Enrollment payload must be a JSON object." });
        }

        if (!enrollmentJson.TryGetProperty("eventId", out var eventIdNode) ||
            eventIdNode.ValueKind != JsonValueKind.String ||
            !Guid.TryParse(eventIdNode.GetString(), out var eventId))
        {
            return BadRequest(new { message = "Enrollment payload must include eventId (GUID)." });
        }

        var result = await mediator.Send(
            new EnrollGroupEventCommand(
                groupId,
                currentMemberId.Value,
                eventId,
                enrollmentJson.GetRawText()),
            cancellationToken);

        return this.ToActionResult(result);
    }
}
