using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Queries.GetGroupEvents;

public sealed class GetGroupEventsQueryHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<GetGroupEventsQuery, AppResult<IReadOnlyList<GroupEventSummaryDto>>>
{
    public async Task<AppResult<IReadOnlyList<GroupEventSummaryDto>>> Handle(GetGroupEventsQuery request, CancellationToken cancellationToken)
    {
        var isApproved = await groupAuthorizationService.IsApprovedMemberAsync(
            request.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!isApproved)
        {
            return AppResult<IReadOnlyList<GroupEventSummaryDto>>.Forbidden("You must be a member to view group events.");
        }

        var events = await dbContext.GroupEvents
            .Where(e => e.GroupId == request.GroupId)
            .OrderBy(e => e.StartDate)
            .Select(e => new GroupEventSummaryDto(
                e.Id,
                e.GroupId,
                e.CreatedByMemberId,
                e.TitleEn,
                e.TitleZh,
                e.StartDate,
                e.EndDate,
                e.EventDataJson,
                e.CreatedUtc,
                e.UpdatedUtc))
            .ToListAsync(cancellationToken);

        return AppResult<IReadOnlyList<GroupEventSummaryDto>>.Success(events);
    }
}
