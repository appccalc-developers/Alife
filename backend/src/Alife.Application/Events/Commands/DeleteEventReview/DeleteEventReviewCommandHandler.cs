using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.DeleteEventReview;

public sealed class DeleteEventReviewCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCacheInvalidationService eventCacheInvalidationService)
    : IRequestHandler<DeleteEventReviewCommand, AppResult<bool>>
{
    public async Task<AppResult<bool>> Handle(
        DeleteEventReviewCommand request,
        CancellationToken cancellationToken)
    {
        var review = await dbContext.EventReviews
            .FirstOrDefaultAsync(x => x.Id == request.ReviewId && x.EventId == request.EventId, cancellationToken);

        if (review is null)
        {
            return AppResult<bool>.NotFound("Review not found.");
        }

        if (!await CanMutateAsync(review, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<bool>.Forbidden("You do not have permission to delete this review.");
        }

        dbContext.EventReviews.Remove(review);
        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveEventReviewsAsync(request.EventId, cancellationToken);

        return AppResult<bool>.Success(true);
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
}
