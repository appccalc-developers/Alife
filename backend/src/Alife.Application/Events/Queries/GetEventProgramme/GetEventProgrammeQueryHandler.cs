using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Queries.GetEventProgramme;

public sealed class GetEventProgrammeQueryHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<GetEventProgrammeQuery, AppResult<EventProgrammeWorkspaceDto>>
{
    public async Task<AppResult<EventProgrammeWorkspaceDto>> Handle(
        GetEventProgrammeQuery request, CancellationToken cancellationToken)
    {
        var groupEvent = await db.GroupEvents.AsNoTracking()
            .Include(x => x.Plan).ThenInclude(x => x!.Occurrences)
            .Include(x => x.ProgrammeItems).ThenInclude(x => x.OwnerMember)
            .Include(x => x.ProgrammeItems).ThenInclude(x => x.RosterShift).ThenInclude(x => x!.Assignments).ThenInclude(x => x.Member)
            .Include(x => x.RosterShifts).ThenInclude(x => x.Assignments).ThenInclude(x => x.Member)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null) return AppResult<EventProgrammeWorkspaceDto>.NotFound("Event not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<EventProgrammeWorkspaceDto>.Forbidden("Only event leaders can manage the programme.");
        if (!EventProgrammePolicy.IsEnabled(groupEvent))
            return AppResult<EventProgrammeWorkspaceDto>.Conflict("Add programme preparation to this event before building a run sheet.");

        var members = await db.GroupMemberships.AsNoTracking()
            .Where(x => x.GroupId == groupEvent.GroupId && x.Status == MembershipStatus.Approved)
            .OrderBy(x => x.Member.DisplayName)
            .Select(x => new EventProgrammeMemberDto(x.MemberId, x.Member.DisplayName ?? "Member"))
            .ToArrayAsync(cancellationToken);
        var occurrences = groupEvent.Plan?.Occurrences.OrderBy(x => x.SortOrder).Select(x => new EventProgrammeOccurrenceDto(
            x.Id, new WorkflowTextDto(x.NameEn, x.NameZh), x.StartUtc, x.EndUtc, x.TimeZoneId)).ToArray() ?? [];
        var rosterOptions = groupEvent.RosterShifts.OrderBy(x => x.StartUtc).ThenBy(x => x.RoleKey).Select(x => new EventProgrammeRosterOptionDto(
            x.Id, new WorkflowTextDto(x.NameEn, x.NameZh), x.StartUtc, x.EndUtc,
            x.Assignments.Where(a => a.Status != EventRosterAssignmentStatus.Cancelled).OrderBy(a => a.Member.DisplayName)
                .Select(a => new EventProgrammeAssigneeDto(a.MemberId, a.Member.DisplayName ?? "Member", a.Status)).ToArray())).ToArray();
        var items = groupEvent.ProgrammeItems.OrderBy(x => x.StartUtc).ThenBy(x => x.SortOrder)
            .Select(EventProgrammePolicy.ToDto).ToArray();
        return AppResult<EventProgrammeWorkspaceDto>.Success(new EventProgrammeWorkspaceDto(
            groupEvent.Id, groupEvent.GroupId, new WorkflowTextDto(groupEvent.TitleEn, groupEvent.TitleZh),
            groupEvent.StartDate, groupEvent.EndDate, EventProgrammePolicy.ModuleStatus(groupEvent.ProgrammeItems),
            occurrences, members, rosterOptions, items));
    }
}
