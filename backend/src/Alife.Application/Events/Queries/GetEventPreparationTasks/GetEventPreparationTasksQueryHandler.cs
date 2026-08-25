using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Queries.GetEventPreparationTasks;

public sealed class GetEventPreparationTasksQueryHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<GetEventPreparationTasksQuery, AppResult<EventPreparationTaskWorkspaceDto>>
{
    public async Task<AppResult<EventPreparationTaskWorkspaceDto>> Handle(GetEventPreparationTasksQuery request, CancellationToken cancellationToken)
    {
        var groupEvent = await db.GroupEvents.AsNoTracking()
            .Include(x => x.PreparationTasks).ThenInclude(x => x.AssignedMember)
            .Include(x => x.PreparationTasks).ThenInclude(x => x.Dependencies).ThenInclude(x => x.DependsOnTask)
            .Include(x => x.Plan).ThenInclude(x => x!.Modules)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null) return AppResult<EventPreparationTaskWorkspaceDto>.NotFound("Event not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<EventPreparationTaskWorkspaceDto>.Forbidden("Only event leaders can manage preparation tasks.");

        var members = await db.GroupMemberships.AsNoTracking()
            .Where(x => x.GroupId == groupEvent.GroupId && x.Status == MembershipStatus.Approved)
            .OrderBy(x => x.Member.DisplayName)
            .Select(x => new EventPreparationTaskMemberDto(x.MemberId, x.Member.DisplayName ?? "Member"))
            .ToListAsync(cancellationToken);
        return AppResult<EventPreparationTaskWorkspaceDto>.Success(new(
            groupEvent.Id,
            groupEvent.GroupId,
            new WorkflowTextDto(groupEvent.TitleEn, groupEvent.TitleZh),
            groupEvent.StartDate,
            groupEvent.Plan?.Modules.Select(x => x.ModuleKey).Order().ToArray() ?? [],
            members,
            groupEvent.PreparationTasks.OrderBy(x => x.DueUtc).ThenBy(x => x.CreatedUtc)
                .Select(EventPreparationTaskPolicy.ToDto).ToArray()));
    }
}
