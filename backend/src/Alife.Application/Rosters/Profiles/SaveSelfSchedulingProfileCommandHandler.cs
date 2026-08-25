using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Rosters.Profiles;

public sealed class SaveSelfSchedulingProfileCommandHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<SaveSelfSchedulingProfileCommand, AppResult<SelfSchedulingProfileDto>>
{
    public async Task<AppResult<SelfSchedulingProfileDto>> Handle(SaveSelfSchedulingProfileCommand request, CancellationToken cancellationToken)
    {
        if (!await authorization.IsApprovedMemberAsync(request.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<SelfSchedulingProfileDto>.Forbidden("Only approved group members can manage scheduling preferences.");
        if (request.MaxAssignmentsPerDay is < 1 or > 10)
            return AppResult<SelfSchedulingProfileDto>.Validation("Daily assignment limit must be between 1 and 10.");
        if (!RosterPolicy.TryValidateWindows(request.UnavailableWindows, out var windows, out var error))
            return AppResult<SelfSchedulingProfileDto>.Validation(error);

        var roles = RosterPolicy.NormalizeTags(request.PreferredRoleKeys);
        var profile = await db.GroupMemberSchedulingProfiles
            .FirstOrDefaultAsync(x => x.GroupId == request.GroupId && x.MemberId == request.CurrentMemberId, cancellationToken);
        var before = profile is null ? null : new { profile.PreferredRoleKeysJson, profile.UnavailableWindowsJson, profile.MaxAssignmentsPerDay, profile.SelfNotes };
        if (profile is null)
        {
            profile = new GroupMemberSchedulingProfile { GroupId = request.GroupId, MemberId = request.CurrentMemberId };
            db.GroupMemberSchedulingProfiles.Add(profile);
        }
        profile.PreferredRoleKeysJson = RosterPolicy.Write(roles);
        profile.UnavailableWindowsJson = RosterPolicy.Write(windows);
        profile.MaxAssignmentsPerDay = request.MaxAssignmentsPerDay;
        profile.SelfNotes = RosterPolicy.Truncate(request.SelfNotes, 1000);
        profile.MemberUpdatedUtc = DateTime.UtcNow;
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId, TargetMemberId = request.CurrentMemberId,
            Action = "roster.profile.self.updated", EntityType = "groupMemberSchedulingProfile", EntityId = request.CurrentMemberId,
            BeforeJson = JsonSerializer.Serialize(before),
            AfterJson = JsonSerializer.Serialize(new { roles, unavailableWindowCount = windows.Length, profile.MaxAssignmentsPerDay }),
            OccurredUtc = profile.MemberUpdatedUtc.Value
        });
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<SelfSchedulingProfileDto>.Success(new SelfSchedulingProfileDto(
            profile.GroupId, profile.MemberId, roles, windows, profile.MaxAssignmentsPerDay, profile.SelfNotes, profile.MemberUpdatedUtc));
    }
}
