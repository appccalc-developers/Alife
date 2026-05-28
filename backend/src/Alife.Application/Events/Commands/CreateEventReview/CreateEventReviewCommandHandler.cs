using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.CreateEventReview;

public sealed class CreateEventReviewCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCacheInvalidationService eventCacheInvalidationService)
    : IRequestHandler<CreateEventReviewCommand, AppResult<EventReviewDto>>
{
    public async Task<AppResult<EventReviewDto>> Handle(
        CreateEventReviewCommand request,
        CancellationToken cancellationToken)
    {
        var groupEvent = await dbContext.GroupEvents
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);

        if (groupEvent is null)
        {
            return AppResult<EventReviewDto>.NotFound("Event not found.");
        }

        var canReview = await groupAuthorizationService.IsApprovedMemberAsync(
            groupEvent.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canReview)
        {
            return AppResult<EventReviewDto>.Forbidden("You must be an approved member to review.");
        }

        var existingReview = await dbContext.EventReviews
            .AsNoTracking()
            .AnyAsync(x => x.EventId == request.EventId && x.MemberId == request.CurrentMemberId, cancellationToken);

        if (existingReview)
        {
            return AppResult<EventReviewDto>.Conflict("Review already exists for this event and member.");
        }

        if (request.RequestedId.HasValue)
        {
            var idAlreadyExists = await dbContext.EventReviews
                .AsNoTracking()
                .AnyAsync(x => x.Id == request.RequestedId.Value, cancellationToken);

            if (idAlreadyExists)
            {
                return AppResult<EventReviewDto>.Conflict("Review id already exists.");
            }
        }

        var now = DateTime.UtcNow;
        var review = new EventReview
        {
            Id = request.RequestedId ?? Guid.NewGuid(),
            GroupId = groupEvent.GroupId,
            EventId = request.EventId,
            MemberId = request.CurrentMemberId,
            ReviewJson = request.ReviewJson,
            CreatedUtc = now,
            UpdatedUtc = now,
        };

        dbContext.EventReviews.Add(review);
        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveEventReviewsAsync(request.EventId, cancellationToken);

        return AppResult<EventReviewDto>.Success(ToDto(review));
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
