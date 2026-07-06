using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Events.Queries.GetGroupEvents;

public sealed class GetGroupEventsQueryHandler(
    IEventReadService eventReadService,
    IGroupReadService groupReadService,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<GetGroupEventsQuery, AppResult<IReadOnlyList<GroupEventSummaryDto>>>
{
    public async Task<AppResult<IReadOnlyList<GroupEventSummaryDto>>> Handle(GetGroupEventsQuery request, CancellationToken cancellationToken)
    {
        var group = await groupReadService.GetByIdAsync(request.GroupId, cancellationToken);
        if (group is null)
        {
            return AppResult<IReadOnlyList<GroupEventSummaryDto>>.NotFound("Group not found.");
        }

        var isApproved = request.CurrentMemberId.HasValue &&
            await groupAuthorizationService.IsApprovedMemberAsync(
                request.GroupId,
                request.CurrentMemberId.Value,
                cancellationToken);

        if (!group.IsChurch && group.AccessType != AccessType.Public && !isApproved)
        {
            return AppResult<IReadOnlyList<GroupEventSummaryDto>>.Forbidden("You must be a member to view group events.");
        }

        var events = await eventReadService.GetGroupEventsAsync(request.GroupId, cancellationToken);

        return AppResult<IReadOnlyList<GroupEventSummaryDto>>.Success(events);
    }
}
