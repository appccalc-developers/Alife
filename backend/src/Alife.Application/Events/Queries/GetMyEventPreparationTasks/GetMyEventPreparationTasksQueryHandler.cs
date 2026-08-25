using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Queries.GetMyEventPreparationTasks;

public sealed class GetMyEventPreparationTasksQueryHandler(IAlifeDbContext db)
    : IRequestHandler<GetMyEventPreparationTasksQuery, AppResult<IReadOnlyList<EventPreparationTaskDto>>>
{
    public async Task<AppResult<IReadOnlyList<EventPreparationTaskDto>>> Handle(GetMyEventPreparationTasksQuery request, CancellationToken cancellationToken)
    {
        var groupEvent = await db.GroupEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null) return AppResult<IReadOnlyList<EventPreparationTaskDto>>.NotFound("Event not found.");
        var approved = await db.GroupMemberships.AsNoTracking().AnyAsync(x =>
            x.GroupId == groupEvent.GroupId && x.MemberId == request.CurrentMemberId && x.Status == MembershipStatus.Approved,
            cancellationToken);
        if (!approved) return AppResult<IReadOnlyList<EventPreparationTaskDto>>.Forbidden("Only approved group members can view assigned tasks.");

        var tasks = await db.EventPreparationTasks.AsNoTracking()
            .Include(x => x.AssignedMember)
            .Include(x => x.Dependencies).ThenInclude(x => x.DependsOnTask)
            .Where(x => x.EventId == request.EventId && x.AssignedMemberId == request.CurrentMemberId && x.Status != EventPreparationTaskStatus.Cancelled)
            .OrderBy(x => x.DueUtc).ThenBy(x => x.CreatedUtc)
            .ToListAsync(cancellationToken);
        return AppResult<IReadOnlyList<EventPreparationTaskDto>>.Success(tasks.Select(EventPreparationTaskPolicy.ToDto).ToArray());
    }
}
