using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Rosters.Queries;

public sealed class GetEventRosterWorkspaceQueryHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<GetEventRosterWorkspaceQuery, AppResult<EventRosterWorkspaceDto>>
{
    public async Task<AppResult<EventRosterWorkspaceDto>> Handle(GetEventRosterWorkspaceQuery request, CancellationToken cancellationToken)
    {
        var groupEvent = await db.GroupEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null) return AppResult<EventRosterWorkspaceDto>.NotFound("Event not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<EventRosterWorkspaceDto>.Forbidden("Only event group leaders can manage the roster.");
        if (!RosterPolicy.IsEnabled(groupEvent))
            return AppResult<EventRosterWorkspaceDto>.Conflict("Add roster preparation to this event before creating shifts.");

        var memberships = await db.GroupMemberships.AsNoTracking().Include(x => x.Member)
            .Where(x => x.GroupId == groupEvent.GroupId && x.Status == MembershipStatus.Approved)
            .OrderBy(x => x.Member.DisplayName).ToListAsync(cancellationToken);
        var profiles = await db.GroupMemberSchedulingProfiles.AsNoTracking()
            .Where(x => x.GroupId == groupEvent.GroupId).ToDictionaryAsync(x => x.MemberId, cancellationToken);
        var shifts = await db.EventRosterShifts.AsNoTracking()
            .Include(x => x.Assignments).ThenInclude(x => x.Member)
            .Where(x => x.EventId == groupEvent.Id).OrderBy(x => x.StartUtc).ThenBy(x => x.RoleKey)
            .ToListAsync(cancellationToken);
        var capabilityCatalog = await db.GroupRosterCapabilities.AsNoTracking()
            .Where(x => x.GroupId == groupEvent.GroupId && x.IsActive)
            .OrderBy(x => x.NameEn).ThenBy(x => x.Key)
            .Select(x => new RosterCapabilityDto(
                x.Id, x.GroupId, x.Key, new Events.Dtos.WorkflowTextDto(x.NameEn, x.NameZh),
                new Events.Dtos.WorkflowTextDto(x.DescriptionEn, x.DescriptionZh), x.RequiresExpiry,
                x.DefaultValidityDays, x.IsActive, x.UpdatedUtc))
            .ToListAsync(cancellationToken);

        var members = memberships.Select(x =>
        {
            profiles.TryGetValue(x.MemberId, out var profile);
            var managerProfile = RosterPolicy.ReadManagerProfile(profile?.ManagerLabelsJson, profile?.ManagerUpdatedUtc);
            return new RosterMemberDto(
                x.MemberId, x.Member.DisplayName ?? "Member",
                RosterPolicy.Read<string>(profile?.PreferredRoleKeysJson),
                RosterPolicy.ReadWindowsForRoster(profile?.UnavailableWindowsJson),
                profile?.MaxAssignmentsPerDay ?? 1, string.Empty,
                managerProfile.Labels, profile?.ManagerNotes ?? string.Empty,
                managerProfile.UnavailableWindows, managerProfile.ConfirmationStatus, managerProfile.ConfirmationMethod,
                managerProfile.ConfirmedUtc, managerProfile.ReviewDueUtc, managerProfile.Qualifications);
        }).ToArray();

        return AppResult<EventRosterWorkspaceDto>.Success(new EventRosterWorkspaceDto(
            groupEvent.Id, groupEvent.GroupId, new Events.Dtos.WorkflowTextDto(groupEvent.TitleEn, groupEvent.TitleZh),
            groupEvent.StartDate, groupEvent.EndDate, capabilityCatalog, members, shifts.Select(RosterPolicy.ToDto).ToArray()));
    }
}
