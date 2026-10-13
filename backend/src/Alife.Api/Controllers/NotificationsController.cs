using System.Text.Json;
using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Notifications.Commands.CreateNotification;
using Alife.Application.Notifications.Commands.MarkNotificationRead;
using Alife.Application.Notifications.Commands.ReplyNotification;
using Alife.Application.Notifications.Queries.ListCurrentNotificationTasks;
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
    ICurrentMemberAccessor currentMemberAccessor,
    EventWriteFreezeState eventFreeze,
    IEventNotificationLinkProbe eventLinkProbe) : ControllerBase
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

    [HttpGet("current")]
    public async Task<IActionResult> ListCurrent(CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new ListCurrentNotificationTasksQuery(currentMemberId.Value),
            cancellationToken);
        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

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

        var eventLinked = request.EventId.HasValue ||
            request.ActionType?.StartsWith("event.", StringComparison.OrdinalIgnoreCase) == true;
        using var mutation = eventLinked ? eventFreeze.TryEnterMutation() : null;
        if (eventLinked && mutation is null) return EventFrozen();

        var result = await mediator.Send(
            new CreateNotificationCommand(
                currentMemberId.Value,
                request.RecipientMemberId,
                request.GroupId,
                request.EventId,
                request.OccurredUtc,
                request.ActionType ?? string.Empty,
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

        var eventLinked = await eventLinkProbe.IsEventLinkedToRecipientAsync(id, currentMemberId.Value, cancellationToken);
        using var mutation = eventLinked ? eventFreeze.TryEnterMutation() : null;
        if (eventLinked && mutation is null) return EventFrozen();

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

        var eventLinked = await eventLinkProbe.IsEventLinkedToRecipientAsync(id, currentMemberId.Value, cancellationToken);
        using var mutation = eventLinked ? eventFreeze.TryEnterMutation() : null;
        if (eventLinked && mutation is null) return EventFrozen();

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

    private IActionResult EventFrozen()
    {
        var status = eventFreeze.GetStatus();
        Response.Headers.CacheControl = "private, no-store";
        Response.Headers.RetryAfter = status.RetryAfterSeconds.ToString(System.Globalization.CultureInfo.InvariantCulture);
        if (status.ResetEpoch is not null)
            Response.Headers["X-Alife-Event-Reset-Epoch"] = status.ResetEpoch;
        if (status.SchemaEpoch is not null)
            Response.Headers["X-Alife-Event-Schema-Epoch"] = status.SchemaEpoch;
        return StatusCode(StatusCodes.Status503ServiceUnavailable, new
        {
            code = status.ConfigurationValid ? "event.reset.frozen" : "event.reset.configuration",
            message = "Event changes are temporarily unavailable while Event data maintenance is in progress.",
            frozen = true,
            epoch = status.Epoch,
            resetEpoch = status.ResetEpoch,
            schemaVersion = status.SchemaVersion,
            schemaEpoch = status.SchemaEpoch
        });
    }

    public sealed record CreateNotificationRequest(
        Guid RecipientMemberId,
        Guid? GroupId,
        Guid? EventId,
        DateTime? OccurredUtc,
        string ActionType,
        JsonElement ActionDataJson);

    public sealed record ReplyNotificationRequest(JsonElement ResponseDataJson);
}
