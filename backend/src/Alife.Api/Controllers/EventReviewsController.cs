using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Commands.CreateEventReview;
using Alife.Application.Events.Commands.DeleteEventReview;
using Alife.Application.Events.Commands.UpdateEventReview;
using Alife.Application.Events.Queries.ListEventReviews;
using Alife.Api.Results;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/events/{eventId:guid}/reviews")]
[Authorize]
public class EventReviewsController(
    IMediator mediator,
    ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(Guid eventId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new ListEventReviewsQuery(eventId, currentMemberId.Value),
            cancellationToken);

        return this.ToActionResult(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid eventId, [FromBody] JsonElement reviewJson, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        if (!IsJsonObject(reviewJson))
        {
            return BadRequest(new { message = "Review payload must be a JSON object." });
        }

        if (!TryReadRequestedReviewId(reviewJson, out var requestedReviewId, out var reviewIdError))
        {
            return BadRequest(new { message = reviewIdError });
        }

        var result = await mediator.Send(
            new CreateEventReviewCommand(eventId, currentMemberId.Value, reviewJson.GetRawText(), requestedReviewId),
            cancellationToken);

        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        return CreatedAtAction(nameof(List), new { eventId }, result.Value);
    }

    [HttpPut("{reviewId:guid}")]
    public async Task<IActionResult> Update(Guid eventId, Guid reviewId, [FromBody] JsonElement reviewJson, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        if (!IsJsonObject(reviewJson))
        {
            return BadRequest(new { message = "Review payload must be a JSON object." });
        }

        var result = await mediator.Send(
            new UpdateEventReviewCommand(eventId, reviewId, currentMemberId.Value, reviewJson.GetRawText()),
            cancellationToken);

        return this.ToActionResult(result);
    }

    [HttpDelete("{reviewId:guid}")]
    public async Task<IActionResult> Delete(Guid eventId, Guid reviewId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new DeleteEventReviewCommand(eventId, reviewId, currentMemberId.Value),
            cancellationToken);

        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        return NoContent();
    }

    private static bool IsJsonObject(JsonElement value)
        => value.ValueKind == JsonValueKind.Object;

    private static bool TryReadRequestedReviewId(
        JsonElement reviewJson,
        out Guid? reviewId,
        out string? error)
    {
        reviewId = null;
        error = null;

        foreach (var propertyName in new[] { "id", "reviewId" })
        {
            if (!reviewJson.TryGetProperty(propertyName, out var property))
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

            reviewId = parsed;
            return true;
        }

        return true;
    }
}
