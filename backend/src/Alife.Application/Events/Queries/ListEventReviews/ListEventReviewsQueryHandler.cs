using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Queries.ListEventReviews;

public sealed class ListEventReviewsQueryHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<ListEventReviewsQuery, AppResult<IReadOnlyList<EventReviewDto>>>
{
    public async Task<AppResult<IReadOnlyList<EventReviewDto>>> Handle(
        ListEventReviewsQuery request,
        CancellationToken cancellationToken)
    {
        var groupEvent = await dbContext.GroupEvents
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);

        if (groupEvent is null)
        {
            return AppResult<IReadOnlyList<EventReviewDto>>.NotFound("Event not found.");
        }

        var isApprovedMember = await groupAuthorizationService.IsApprovedMemberAsync(
            groupEvent.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!isApprovedMember)
        {
            return AppResult<IReadOnlyList<EventReviewDto>>.Forbidden("You must be an approved member to view reviews.");
        }

        var reviews = await dbContext.EventReviews
            .AsNoTracking()
            .Where(x => x.EventId == request.EventId)
            .OrderByDescending(x => x.UpdatedUtc)
            .Select(x => new EventReviewDto(
                x.Id,
                x.GroupId,
                x.EventId,
                x.MemberId,
                x.ReviewJson,
                x.CreatedUtc,
                x.UpdatedUtc))
            .ToListAsync(cancellationToken);

        return AppResult<IReadOnlyList<EventReviewDto>>.Success(reviews);
    }
}
