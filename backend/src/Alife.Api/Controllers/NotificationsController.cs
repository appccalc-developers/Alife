using System.Text.Json;
using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Notifications.Commands.CreateNotification;
using Alife.Application.Notifications.Commands.MarkNotificationRead;
using Alife.Application.Notifications.Commands.ReplyNotification;
using Alife.Application.Notifications.Queries.ListNotifications;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController(
    IMediator mediator,
    ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new ListNotificationsQuery(currentMemberId.Value), cancellationToken);
        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateNotificationRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        if (!IsJsonObject(request.ActionDataJson))
        {
            return BadRequest(new { message = "Action data must be a JSON object." });
        }

        var result = await mediator.Send(
            new CreateNotificationCommand(
                currentMemberId.Value,
                request.RecipientMemberId,
                request.GroupId,
                request.EventId,
                request.OccurredUtc,
                request.ActionType,
                request.ActionDataJson.GetRawText()),
            cancellationToken);

        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        this.ApplyPrivateNoCacheHeaders();
        return CreatedAtAction(nameof(List), null, result.Value);
    }

    [HttpPost("{id:guid}/reply")]
    public async Task<IActionResult> Reply(Guid id, [FromBody] ReplyNotificationRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        if (!IsJsonObject(request.ResponseDataJson))
        {
            return BadRequest(new { message = "Response data must be a JSON object." });
        }

        var result = await mediator.Send(
            new ReplyNotificationCommand(id, currentMemberId.Value, request.ResponseDataJson.GetRawText()),
            cancellationToken);

        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new MarkNotificationReadCommand(id, currentMemberId.Value),
            cancellationToken);

        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    private static bool IsJsonObject(JsonElement value)
        => value.ValueKind == JsonValueKind.Object;

    public sealed record CreateNotificationRequest(
        Guid RecipientMemberId,
        Guid? GroupId,
        Guid? EventId,
        DateTime? OccurredUtc,
        string ActionType,
        JsonElement ActionDataJson);

    public sealed record ReplyNotificationRequest(JsonElement ResponseDataJson);
}
