using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using MediatR;

namespace Alife.Application.Events.Queries.GetGroupEvents;

public sealed class GetGroupEventsQueryHandler(
    IEventReadService eventReadService,
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

        var events = await eventReadService.GetGroupEventsAsync(request.GroupId, cancellationToken);

        return AppResult<IReadOnlyList<GroupEventSummaryDto>>.Success(events);
    }
}
