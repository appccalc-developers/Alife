using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/events/{eventId:guid}/reviews")]
[Authorize]
public class EventReviewsController(
    AlifeDbContext dbContext,
    ICurrentMemberAccessor currentMemberAccessor,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCacheInvalidationService eventCacheInvalidationService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(Guid eventId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var groupEvent = await GetEventAsync(eventId, cancellationToken);
        if (groupEvent is null)
        {
            return NotFound(new { message = "Event not found." });
        }

        var isApprovedMember = await groupAuthorizationService.IsApprovedMemberAsync(
            groupEvent.GroupId,
            currentMemberId.Value,
            cancellationToken);

        if (!isApprovedMember)
        {
            return Forbid();
        }

        var query = dbContext.EventReviews
            .AsNoTracking()
            .Where(x => x.EventId == eventId);

        var reviews = await query
            .OrderByDescending(x => x.UpdatedUtc)
            .Select(x => ToDto(x))
            .ToListAsync(cancellationToken);

        return Ok(reviews);
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

        var groupEvent = await GetEventAsync(eventId, cancellationToken);
        if (groupEvent is null)
        {
            return NotFound(new { message = "Event not found." });
        }

        var canReview = await groupAuthorizationService.IsApprovedMemberAsync(
            groupEvent.GroupId,
            currentMemberId.Value,
            cancellationToken);

        if (!canReview)
        {
            return Forbid();
        }

        var existingReview = await dbContext.EventReviews
            .AsNoTracking()
            .AnyAsync(x => x.EventId == eventId && x.MemberId == currentMemberId.Value, cancellationToken);
        if (existingReview)
        {
            return Conflict(new { message = "Review already exists for this event and member." });
        }

        if (!TryReadRequestedReviewId(reviewJson, out var requestedReviewId, out var reviewIdError))
        {
            return BadRequest(new { message = reviewIdError });
        }

        if (requestedReviewId.HasValue)
        {
            var idAlreadyExists = await dbContext.EventReviews
                .AsNoTracking()
                .AnyAsync(x => x.Id == requestedReviewId.Value, cancellationToken);
            if (idAlreadyExists)
            {
                return Conflict(new { message = "Review id already exists." });
            }
        }

        var now = DateTime.UtcNow;
        var review = new EventReview
        {
            Id = requestedReviewId ?? Guid.NewGuid(),
            GroupId = groupEvent.GroupId,
            EventId = eventId,
            MemberId = currentMemberId.Value,
            ReviewJson = reviewJson.GetRawText(),
            CreatedUtc = now,
            UpdatedUtc = now,
        };

        dbContext.EventReviews.Add(review);
        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveEventReviewsAsync(eventId, cancellationToken);

        return CreatedAtAction(nameof(List), new { eventId }, ToDto(review));
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

        var review = await dbContext.EventReviews
            .FirstOrDefaultAsync(x => x.Id == reviewId && x.EventId == eventId, cancellationToken);
        if (review is null)
        {
            return NotFound(new { message = "Review not found." });
        }

        if (!await CanMutateReviewAsync(review, currentMemberId.Value, cancellationToken))
        {
            return Forbid();
        }

        review.ReviewJson = reviewJson.GetRawText();
        review.UpdatedUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveEventReviewsAsync(eventId, cancellationToken);

        return Ok(ToDto(review));
    }

    [HttpDelete("{reviewId:guid}")]
    public async Task<IActionResult> Delete(Guid eventId, Guid reviewId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var review = await dbContext.EventReviews
            .FirstOrDefaultAsync(x => x.Id == reviewId && x.EventId == eventId, cancellationToken);
        if (review is null)
        {
            return NotFound(new { message = "Review not found." });
        }

        if (!await CanMutateReviewAsync(review, currentMemberId.Value, cancellationToken))
        {
            return Forbid();
        }

        dbContext.EventReviews.Remove(review);
        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveEventReviewsAsync(eventId, cancellationToken);

        return NoContent();
    }

    private Task<GroupEvent?> GetEventAsync(Guid eventId, CancellationToken cancellationToken)
        => dbContext.GroupEvents
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == eventId, cancellationToken);

    private async Task<bool> CanMutateReviewAsync(EventReview review, Guid currentMemberId, CancellationToken cancellationToken)
    {
        if (review.MemberId == currentMemberId)
        {
            return true;
        }

        return await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            review.GroupId,
            currentMemberId,
            cancellationToken);
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

    private static EventReviewDto ToDto(EventReview review) =>
        new(
            review.Id,
            review.GroupId,
            review.EventId,
            review.MemberId,
            review.ReviewJson,
            review.CreatedUtc,
            review.UpdatedUtc);
}
