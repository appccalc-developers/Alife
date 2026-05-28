using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.UpdateEventReview;

public sealed class UpdateEventReviewCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCacheInvalidationService eventCacheInvalidationService)
    : IRequestHandler<UpdateEventReviewCommand, AppResult<EventReviewDto>>
{
    public async Task<AppResult<EventReviewDto>> Handle(
        UpdateEventReviewCommand request,
        CancellationToken cancellationToken)
    {
        var review = await dbContext.EventReviews
            .FirstOrDefaultAsync(x => x.Id == request.ReviewId && x.EventId == request.EventId, cancellationToken);

        if (review is null)
        {
            return AppResult<EventReviewDto>.NotFound("Review not found.");
        }

        if (!await CanMutateAsync(review, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<EventReviewDto>.Forbidden("You do not have permission to update this review.");
        }

        review.ReviewJson = request.ReviewJson;
        review.UpdatedUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveEventReviewsAsync(request.EventId, cancellationToken);

        return AppResult<EventReviewDto>.Success(ToDto(review));
    }

    private async Task<bool> CanMutateAsync(EventReview review, Guid currentMemberId, CancellationToken cancellationToken)
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
