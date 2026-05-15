using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Commands.CreateGroupEvent;
using Alife.Application.Events.Commands.DeleteGroupEvent;
using Alife.Application.Events.Queries.GetGroupEvents;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class EventsController(
    IMediator mediator,
    ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    /// <summary>List all events for a group.</summary>
    [HttpGet("groups/{groupId:guid}/events")]
    public async Task<IActionResult> GetGroupEvents(Guid groupId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();

        var result = await mediator.Send(new GetGroupEventsQuery(groupId, currentMemberId.Value), cancellationToken);
        return this.ToActionResult(result);
    }

    /// <summary>Create a new event in a group.</summary>
    [HttpPost("groups/{groupId:guid}/events")]
    public async Task<IActionResult> CreateGroupEvent(Guid groupId, [FromBody] CreateGroupEventRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();

        var result = await mediator.Send(
            new CreateGroupEventCommand(
                groupId,
                currentMemberId.Value,
                request.TitleEn,
                request.TitleZh,
                request.StartDate,
                request.EndDate,
                request.EventDataJson),
            cancellationToken);

        return this.ToActionResult(result);
    }

    /// <summary>Delete a group event.</summary>
    [HttpDelete("groups/{groupId:guid}/events/{eventId:guid}")]
    public async Task<IActionResult> DeleteGroupEvent(Guid groupId, Guid eventId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null) return Unauthorized();

        var result = await mediator.Send(new DeleteGroupEventCommand(eventId, currentMemberId.Value), cancellationToken);
        return this.ToActionResult(result);
    }
}

public record CreateGroupEventRequest(
    string TitleEn,
    string TitleZh,
    DateTime StartDate,
    DateTime EndDate,
    string EventDataJson);
