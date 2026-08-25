using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Rosters.Profiles;

public sealed class SaveManagerSchedulingLabelsCommandHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<SaveManagerSchedulingLabelsCommand, AppResult<RosterMemberDto>>
{
    public async Task<AppResult<RosterMemberDto>> Handle(SaveManagerSchedulingLabelsCommand request, CancellationToken cancellationToken)
    {
        if (!await authorization.IsLeaderOrCoLeaderAsync(request.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<RosterMemberDto>.Forbidden("Only group leaders can maintain scheduling labels.");
        var membership = await db.GroupMemberships.Include(x => x.Member).FirstOrDefaultAsync(
            x => x.GroupId == request.GroupId && x.MemberId == request.TargetMemberId && x.Status == MembershipStatus.Approved,
            cancellationToken);
        if (membership is null) return AppResult<RosterMemberDto>.NotFound("Approved group member not found.");
        if (!RosterPolicy.TryValidateWindows(request.UnavailableWindows, out var unavailableWindows, out var windowError))
            return AppResult<RosterMemberDto>.Validation(windowError);
        var confirmationStatus = RosterPolicy.NormalizeManagerConfirmationStatus(request.ConfirmationStatus);
        var confirmationMethod = RosterPolicy.NormalizeManagerConfirmationMethod(request.ConfirmationMethod);
        if (confirmationStatus is not ("confirmed" or "pending"))
            return AppResult<RosterMemberDto>.Validation("Choose whether the manager-assisted information is pending or confirmed.");
        if (confirmationStatus == "confirmed" && string.IsNullOrWhiteSpace(confirmationMethod))
            return AppResult<RosterMemberDto>.Validation("Choose how the member confirmed this scheduling information.");
        if (request.ReviewDueUtc.HasValue && request.ReviewDueUtc.Value <= DateTime.UtcNow)
            return AppResult<RosterMemberDto>.Validation("The review date must be in the future.");
        var qualifications = RosterPolicy.NormalizeQualifications(request.Qualifications);
        var capabilityKeys = qualifications.Select(x => x.Key).ToArray();
        var capabilities = (await db.GroupRosterCapabilities.AsNoTracking()
            .Where(x => x.GroupId == request.GroupId && capabilityKeys.Contains(x.Key))
            .ToListAsync(cancellationToken)).ToDictionary(x => x.Key, StringComparer.Ordinal);
        if (capabilities.Count != capabilityKeys.Length || capabilities.Values.Any(x => !x.IsActive))
            return AppResult<RosterMemberDto>.Validation("Every qualification must use an active capability from this group's catalog.");
        if (confirmationStatus == "confirmed" && qualifications.Any(x =>
                capabilities[x.Key].RequiresExpiry && (!x.ValidUntilUtc.HasValue || x.ValidUntilUtc.Value <= DateTime.UtcNow)))
            return AppResult<RosterMemberDto>.Validation("A confirmed expiring qualification needs a future valid-until date.");
        qualifications = qualifications.Select(x => capabilities[x.Key].RequiresExpiry ? x : x with { ValidUntilUtc = null }).ToArray();
        var profile = await db.GroupMemberSchedulingProfiles.FirstOrDefaultAsync(
            x => x.GroupId == request.GroupId && x.MemberId == request.TargetMemberId, cancellationToken);
        if (profile is null)
        {
            profile = new GroupMemberSchedulingProfile { GroupId = request.GroupId, MemberId = request.TargetMemberId };
            db.GroupMemberSchedulingProfiles.Add(profile);
        }
        var beforeProfile = RosterPolicy.ReadManagerProfile(profile.ManagerLabelsJson, profile.ManagerUpdatedUtc);
        var before = new
        {
            LabelCount = beforeProfile.Labels.Count,
            WindowCount = beforeProfile.UnavailableWindows.Count,
            QualificationCount = beforeProfile.Qualifications.Count,
            beforeProfile.ConfirmationStatus,
            beforeProfile.ConfirmationMethod,
            beforeProfile.ReviewDueUtc
        };
        var labels = RosterPolicy.NormalizeTags(request.ManagerLabels);
        var nowUtc = DateTime.UtcNow;
        var managerProfile = new ManagerSchedulingProfileDto(
            labels,
            unavailableWindows.Select(x => x with { Reason = string.Empty }).ToArray(),
            confirmationStatus,
            confirmationStatus == "confirmed" ? confirmationMethod : string.Empty,
            confirmationStatus == "confirmed" ? nowUtc : null,
            request.ReviewDueUtc,
            qualifications);
        profile.ManagerLabelsJson = RosterPolicy.WriteManagerProfile(managerProfile);
        profile.ManagerNotes = RosterPolicy.Truncate(request.ManagerNotes, 1000);
        profile.ManagerUpdatedUtc = nowUtc;
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId, TargetMemberId = request.TargetMemberId,
            Action = "roster.profile.manager.updated", EntityType = "groupMemberSchedulingProfile", EntityId = request.TargetMemberId,
            BeforeJson = JsonSerializer.Serialize(before),
            AfterJson = JsonSerializer.Serialize(new
            {
                LabelCount = labels.Length,
                WindowCount = unavailableWindows.Length,
                QualificationCount = qualifications.Length,
                managerProfile.ConfirmationStatus,
                managerProfile.ConfirmationMethod,
                managerProfile.ReviewDueUtc
            }),
            OccurredUtc = profile.ManagerUpdatedUtc.Value
        });
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<RosterMemberDto>.Success(new RosterMemberDto(
            membership.MemberId, membership.Member.DisplayName ?? "Member",
            RosterPolicy.Read<string>(profile.PreferredRoleKeysJson),
            RosterPolicy.ReadWindowsForRoster(profile.UnavailableWindowsJson),
            profile.MaxAssignmentsPerDay, string.Empty, labels, profile.ManagerNotes,
            managerProfile.UnavailableWindows, managerProfile.ConfirmationStatus, managerProfile.ConfirmationMethod,
            managerProfile.ConfirmedUtc, managerProfile.ReviewDueUtc, managerProfile.Qualifications));
    }
}
