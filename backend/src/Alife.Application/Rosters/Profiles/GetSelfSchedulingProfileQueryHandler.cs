using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Rosters.Profiles;

public sealed class GetSelfSchedulingProfileQueryHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<GetSelfSchedulingProfileQuery, AppResult<SelfSchedulingProfileDto>>
{
    public async Task<AppResult<SelfSchedulingProfileDto>> Handle(GetSelfSchedulingProfileQuery request, CancellationToken cancellationToken)
    {
        if (!await authorization.IsApprovedMemberAsync(request.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<SelfSchedulingProfileDto>.Forbidden("Only approved group members can manage scheduling preferences.");
        var profile = await db.GroupMemberSchedulingProfiles.AsNoTracking()
            .FirstOrDefaultAsync(x => x.GroupId == request.GroupId && x.MemberId == request.CurrentMemberId, cancellationToken);
        return AppResult<SelfSchedulingProfileDto>.Success(profile is null
            ? new SelfSchedulingProfileDto(request.GroupId, request.CurrentMemberId, [], [], 1, string.Empty, null)
            : new SelfSchedulingProfileDto(profile.GroupId, profile.MemberId,
                RosterPolicy.Read<string>(profile.PreferredRoleKeysJson),
                RosterPolicy.Read<SchedulingUnavailableWindowDto>(profile.UnavailableWindowsJson),
                profile.MaxAssignmentsPerDay, profile.SelfNotes, profile.MemberUpdatedUtc));
    }
}
