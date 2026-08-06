using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Commands.CreateEventEnrollment;
using Alife.Application.Events.Commands.DeleteEventEnrollment;
using Alife.Application.Events.Commands.UpdateEventEnrollment;
using Alife.Application.Events.Queries.ListEventEnrollments;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/events/{eventId:guid}/enrollments")]
[Authorize]
public class EventEnrollmentsController(
    IMediator mediator,
    ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> List(Guid eventId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new ListEventEnrollmentsQuery(eventId, currentMemberId.Value),
            cancellationToken);

        return this.ToActionResult(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid eventId, [FromBody] JsonElement enrollmentJson, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        if (!IsJsonObject(enrollmentJson))
        {
            return BadRequest(new { message = "Enrollment payload must be a JSON object." });
        }

        if (!TryReadRequestedEnrollmentId(enrollmentJson, out var requestedEnrollmentId, out var enrollmentIdError))
        {
            return BadRequest(new { message = enrollmentIdError });
        }

        var result = await mediator.Send(
            new CreateEventEnrollmentCommand(eventId, currentMemberId.Value, enrollmentJson.GetRawText(), requestedEnrollmentId),
            cancellationToken);

        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        return CreatedAtAction(nameof(List), new { eventId }, result.Value);
    }

    [HttpPut("{enrollmentId:guid}")]
    public async Task<IActionResult> Update(Guid eventId, Guid enrollmentId, [FromBody] JsonElement enrollmentJson, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        if (!IsJsonObject(enrollmentJson))
        {
            return BadRequest(new { message = "Enrollment payload must be a JSON object." });
        }

        var result = await mediator.Send(
            new UpdateEventEnrollmentCommand(eventId, enrollmentId, currentMemberId.Value, enrollmentJson.GetRawText()),
            cancellationToken);

        return this.ToActionResult(result);
    }

    [HttpDelete("{enrollmentId:guid}")]
    public async Task<IActionResult> Delete(Guid eventId, Guid enrollmentId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new DeleteEventEnrollmentCommand(eventId, enrollmentId, currentMemberId.Value),
            cancellationToken);

        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        return NoContent();
    }

    private static bool IsJsonObject(JsonElement value)
        => value.ValueKind == JsonValueKind.Object;

    private static bool TryReadRequestedEnrollmentId(
        JsonElement enrollmentJson,
        out Guid? enrollmentId,
        out string? error)
    {
        enrollmentId = null;
        error = null;

        foreach (var propertyName in new[] { "id", "enrollmentId" })
        {
            if (!enrollmentJson.TryGetProperty(propertyName, out var property))
            {
                continue;
            }

            if (property.ValueKind == JsonValueKind.Null)
            {
                continue;
            }

            if (property.ValueKind != JsonValueKind.String ||
                !Guid.TryParse(property.GetString(), out var parsed) ||
                parsed == Guid.Empty)
            {
                error = $"{propertyName} must be a non-empty GUID when provided.";
                return false;
            }

            enrollmentId = parsed;
            return true;
        }

        return true;
    }
}
