using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Rosters.Queries;

public sealed class GetMyEventRosterQueryHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<GetMyEventRosterQuery, AppResult<MyEventRosterWorkspaceDto>>
{
    public async Task<AppResult<MyEventRosterWorkspaceDto>> Handle(GetMyEventRosterQuery request, CancellationToken cancellationToken)
    {
        var groupEvent = await db.GroupEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null) return AppResult<MyEventRosterWorkspaceDto>.NotFound("Event not found.");
        if (!await authorization.IsApprovedMemberAsync(groupEvent.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<MyEventRosterWorkspaceDto>.Forbidden("Approved group membership is required to view assignments.");

        var assignments = await db.EventRosterAssignments.AsNoTracking()
            .Include(x => x.Shift)
            .Where(x => x.MemberId == request.CurrentMemberId && x.Shift.EventId == groupEvent.Id)
            .OrderBy(x => x.Shift.StartUtc)
            .Select(x => new MyRosterAssignmentDto(
                x.Id, x.ShiftId, x.Shift.RoleKey, new WorkflowTextDto(x.Shift.NameEn, x.Shift.NameZh),
                x.Shift.StartUtc, x.Shift.EndUtc, x.Status, x.ConfirmedUtc, x.MemberResponseNotes, x.RespondedUtc))
            .ToListAsync(cancellationToken);

        return AppResult<MyEventRosterWorkspaceDto>.Success(new MyEventRosterWorkspaceDto(
            groupEvent.Id, groupEvent.GroupId, new WorkflowTextDto(groupEvent.TitleEn, groupEvent.TitleZh), assignments));
    }
}
