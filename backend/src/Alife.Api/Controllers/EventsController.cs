using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Commands.CreateGroupEvent;
using Alife.Application.Events.Commands.DeleteGroupEvent;
using Alife.Application.Events.Commands.UpdateGroupEvent;
using Alife.Application.Events.Queries.GetGroupEvents;
using Alife.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public class EventsController(
    IMediator mediator,
    ICurrentMemberAccessor currentMemberAccessor,
    AlifeDbContext dbContext) : ControllerBase
{
    [HttpGet("groups/{groupId:guid}/events")]
    public async Task<IActionResult> GroupEvents(Guid groupId, CancellationToken cancellationToken = default)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var updatedUtc = await dbContext.GroupEvents
            .IgnoreQueryFilters()
            .Where(x => x.GroupId == groupId)
            .MaxAsync(x => (DateTime?)x.UpdatedUtc, cancellationToken);
        if (this.IsNotModified(updatedUtc))
        {
            return StatusCode(StatusCodes.Status304NotModified);
        }

        var result = await mediator.Send(new GetGroupEventsQuery(groupId, currentMemberId.Value), cancellationToken);
        this.ApplySyncCacheHeaders(updatedUtc);
        return this.ToActionResult(result);
    }

    [HttpPost("groups/{groupId:guid}/events")]
    public async Task<IActionResult> CreateGroupEvent(Guid groupId, [FromBody] CreateGroupEventRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

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

    [HttpPut("events/{id:guid}")]
    public async Task<IActionResult> UpdateEvent(Guid id, [FromBody] UpdateGroupEventRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new UpdateGroupEventCommand(
                id,
                currentMemberId.Value,
                request.TitleEn,
                request.TitleZh,
                request.StartDate,
                request.EndDate,
                request.EventDataJson),
            cancellationToken);

        return this.ToActionResult(result);
    }

    [HttpDelete("events/{id:guid}")]
    public async Task<IActionResult> DeleteEvent(Guid id, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new DeleteGroupEventCommand(id, currentMemberId.Value), cancellationToken);
        return this.ToActionResult(result);
    }

    public record CreateGroupEventRequest(
        string TitleEn,
        string TitleZh,
        DateTime StartDate,
        DateTime EndDate,
        string EventDataJson);

    public record UpdateGroupEventRequest(
        string TitleEn,
        string TitleZh,
        DateTime StartDate,
        DateTime EndDate,
        string EventDataJson);
}
