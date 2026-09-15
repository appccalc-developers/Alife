using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using MediatR;

namespace Alife.Application.Events.Queries.GetGroupEvents;

public sealed class GetGroupEventsQueryHandler(
    IEventReadService eventReadService,
    IGroupReadService groupReadService,
    IGroupAuthorizationService groupAuthorizationService,
    Alife.Application.Common.Interfaces.IAlifeDbContext? dbContext = null)
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

        var isChurchMember = false;
        if (request.CurrentMemberId.HasValue)
        {
            var churchGroupId = await FindChurchRootIdAsync(group, cancellationToken);
            isChurchMember = churchGroupId.HasValue &&
                await groupAuthorizationService.IsApprovedMemberAsync(
                    churchGroupId.Value,
                    request.CurrentMemberId.Value,
                    cancellationToken);
        }

        var events = await eventReadService.GetGroupEventsAsync(request.GroupId, cancellationToken);

        if (canManage)
        {
            return AppResult<IReadOnlyList<GroupEventSummaryDto>>.Success(events);
        }

        var authorisedPlans = new HashSet<Guid>();
        if (dbContext is not null && request.CurrentMemberId is { } actor)
        {
            var candidates = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToArrayAsync(
                dbContext.GroupEvents.Where(x => x.GroupId == request.GroupId), cancellationToken);
            foreach (var e in candidates)
                if (await EventWorkAccess.PlanReaderAsync(dbContext,e,actor,cancellationToken)) authorisedPlans.Add(e.Id);
        }
        var visibleEvents = events
            .Where(e => authorisedPlans.Contains(e.Id) || EventVisibilityPolicy.IsPublished(e))
            .Where(groupEvent => EventVisibilityPolicy.CanView(
                groupEvent.Visibility,
                isGroupMember,
                isChurchMember) || authorisedPlans.Contains(groupEvent.Id))
            .Select(groupEvent => isGroupMember || authorisedPlans.Contains(groupEvent.Id)
                ? groupEvent
                : EventVisibilityPolicy.SanitizeForExpandedAudience(groupEvent))
            .ToList();

        return AppResult<IReadOnlyList<GroupEventSummaryDto>>.Success(visibleEvents);
    }

    private async Task<Guid?> FindChurchRootIdAsync(GroupDto group, CancellationToken cancellationToken)
    {
        var current = group;
        var visited = new HashSet<Guid>();

        while (visited.Add(current.Id))
        {
            if (current.IsChurch)
            {
                return current.Id;
            }

            if (!current.ParentGroupId.HasValue)
            {
                return null;
            }

            var parent = await groupReadService.GetByIdAsync(current.ParentGroupId.Value, cancellationToken);
            if (parent is null)
            {
                return null;
            }

            current = parent;
        }

        return null;
    }
}
