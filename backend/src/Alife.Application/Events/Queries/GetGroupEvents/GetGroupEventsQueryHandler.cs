using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
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

        var canManage = request.CurrentMemberId.HasValue &&
            await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                request.GroupId,
                request.CurrentMemberId.Value,
                cancellationToken);

        var isGroupMember = request.CurrentMemberId.HasValue &&
            await groupAuthorizationService.IsApprovedMemberAsync(
                request.GroupId,
                request.CurrentMemberId.Value,
                cancellationToken);

        var churchGroupId = group.IsChurch ? group.Id : group.ParentGroupId;
        var isChurchMember = request.CurrentMemberId.HasValue && churchGroupId.HasValue &&
            await groupAuthorizationService.IsApprovedMemberAsync(
                churchGroupId.Value,
                request.CurrentMemberId.Value,
                cancellationToken);

        var events = await eventReadService.GetGroupEventsAsync(request.GroupId, cancellationToken);

        if (canManage)
        {
            return AppResult<IReadOnlyList<GroupEventSummaryDto>>.Success(events);
        }

        var visibleEvents = events
            .Where(EventVisibilityPolicy.IsPublished)
            .Where(groupEvent => EventVisibilityPolicy.CanView(
                groupEvent.Visibility,
                isGroupMember,
                isChurchMember))
            .Select(groupEvent => isGroupMember
                ? groupEvent
                : EventVisibilityPolicy.SanitizeForExpandedAudience(groupEvent))
            .ToList();

        return AppResult<IReadOnlyList<GroupEventSummaryDto>>.Success(visibleEvents);
    }
}
