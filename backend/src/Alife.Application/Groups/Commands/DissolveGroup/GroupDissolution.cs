using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Groups.Commands.DissolveGroup;

public sealed record GroupDissolutionDto(bool CanDissolve, IReadOnlyList<string> Blockers);
public sealed record GetGroupDissolutionQuery(Guid GroupId, Guid CurrentMemberId)
    : IRequest<AppResult<GroupDissolutionDto>>;
public sealed record DissolveGroupCommand(Guid GroupId, Guid CurrentMemberId)
    : IRequest<AppResult<GroupActionResultDto>>;

internal static class GroupDissolutionRules
{
    public static async Task<AppResult<GroupDissolutionDto>> CheckAsync(
        IAlifeDbContext db, Guid groupId, Guid memberId, CancellationToken ct)
    {
        // Actual approved leadership is required; platform administration is not a substitute.
        if (!await db.GroupMemberships.AnyAsync(x => x.GroupId == groupId && x.MemberId == memberId
            && x.Status == MembershipStatus.Approved && x.Role == MembershipRole.Leader, ct))
            return AppResult<GroupDissolutionDto>.Forbidden("Only the group leader can dissolve this group.");

        var group = await db.Groups.AsNoTracking().FirstOrDefaultAsync(x => x.Id == groupId, ct);
        if (group is null) return AppResult<GroupDissolutionDto>.NotFound("Group was not found.");
        var blockers = new List<string>();
        if (group.IsChurch) blockers.Add("church");
        // Pending, invited and historical memberships also prevent destructive removal.
        if (await db.GroupMemberships.CountAsync(x => x.GroupId == groupId, ct) != 1) blockers.Add("members");
        if (await db.Groups.AnyAsync(x => x.ParentGroupId == groupId, ct)) blockers.Add("subgroups");
        if (await db.Pages.AnyAsync(x => x.OwnerGroupId == groupId, ct)) blockers.Add("pages");
        if (await db.GroupEvents.AnyAsync(x => x.GroupId == groupId, ct)
            || await db.EventSeries.AnyAsync(x => x.OwningGroupId == groupId, ct)) blockers.Add("events");
        if (await db.Albums.AnyAsync(x => x.GroupId == groupId, ct)) blockers.Add("albums");
        if (await db.Announcements.AnyAsync(x => x.GroupId == groupId, ct)) blockers.Add("announcements");

        // Never cascade-delete other community data merely because the six primary lists are empty.
        if (await db.ContactProfiles.AnyAsync(x => x.OwnerGroupId == groupId, ct)
            || await db.ContactInquiries.AnyAsync(x => x.OwnerGroupId == groupId, ct)
            || await db.ForumPosts.AnyAsync(x => x.GroupId == groupId, ct)
            || await db.ContentPosts.AnyAsync(x => x.OwnerGroupId == groupId, ct)
            || await db.FileAssets.AnyAsync(x => x.GroupId == groupId, ct)
            || await db.Links.AnyAsync(x => x.TargetGroupId == groupId, ct)
            || await db.NotificationMessages.AnyAsync(x => x.GroupId == groupId, ct)
            || await db.AuditLogs.AnyAsync(x => x.GroupId == groupId, ct)
            || await db.GroupJoinInvites.AnyAsync(x => x.GroupId == groupId, ct)
            || await db.GroupMembershipApplications.AnyAsync(x => x.GroupId == groupId, ct)
            || await db.ActivationGroupGrants.AnyAsync(x => x.GroupId == groupId, ct)
            || await db.MemberActivationInvitations.AnyAsync(x => x.RecoveryGroupId == groupId, ct)
            || await db.EventEnrollments.AnyAsync(x => x.GroupId == groupId, ct)
            || await db.EventReviews.AnyAsync(x => x.GroupId == groupId, ct)
            || await db.EventWorkflowTemplates.AnyAsync(x => x.OwnerGroupId == groupId, ct)
            || await db.EventVenues.AnyAsync(x => x.ManagingGroupId == groupId, ct)
            || await db.EventSafeguardingPolicyVersions.AnyAsync(x => x.GroupId == groupId, ct)
            || await db.EventPackageGovernancePolicyVersions.AnyAsync(x => x.OrganisationId == groupId, ct)
            || await db.EventPackageApprovalDelegations.AnyAsync(x => x.OrganisationId == groupId, ct))
            blockers.Add("relatedRecords");

        return AppResult<GroupDissolutionDto>.Success(new(blockers.Count == 0, blockers));
    }
}

public sealed class GetGroupDissolutionQueryHandler(IAlifeDbContext db)
    : IRequestHandler<GetGroupDissolutionQuery, AppResult<GroupDissolutionDto>>
{
    public Task<AppResult<GroupDissolutionDto>> Handle(GetGroupDissolutionQuery request, CancellationToken ct)
        => GroupDissolutionRules.CheckAsync(db, request.GroupId, request.CurrentMemberId, ct);
}

public sealed class DissolveGroupCommandHandler(
    IAlifeDbContext db, IGroupCacheInvalidationService cache, ICloudflareKvCacheService kv)
    : IRequestHandler<DissolveGroupCommand, AppResult<GroupActionResultDto>>
{
    public async Task<AppResult<GroupActionResultDto>> Handle(DissolveGroupCommand request, CancellationToken ct)
    {
        Guid? parentId;
        // Check and delete in one transaction. SQL range locks protect against new children/content/members.
        await using (var transaction = await db.BeginSerializableTransactionAsync(ct))
        {
            var check = await GroupDissolutionRules.CheckAsync(db, request.GroupId, request.CurrentMemberId, ct);
            if (!check.IsSuccess)
                return check.Status == AppResultStatus.NotFound
                    ? AppResult<GroupActionResultDto>.NotFound(check.Message!)
                    : AppResult<GroupActionResultDto>.Forbidden(check.Message!);
            if (!check.Value!.CanDissolve)
                return AppResult<GroupActionResultDto>.Conflict("This group is not empty. Refresh its dissolution requirements.");

            var group = await db.Groups.SingleAsync(x => x.Id == request.GroupId, ct);
            var membership = await db.GroupMemberships.SingleAsync(x => x.GroupId == request.GroupId, ct);
            parentId = group.ParentGroupId;
            db.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId,
                Action = "group.dissolved", EntityType = "Group", EntityId = group.Id,
                // EntityId retains the deleted identity without a foreign key to the removed group.
                BeforeJson = JsonSerializer.Serialize(new { group.NameJson, group.ParentGroupId, group.GroupType }),
                OccurredUtc = DateTime.UtcNow
            });
            db.GroupMemberships.Remove(membership);
            db.Groups.Remove(group);
            try
            {
                await db.SaveChangesAsync(ct);
                if (transaction is not null) await transaction.CommitAsync(ct);
            }
            catch (DbUpdateException)
            {
                return AppResult<GroupActionResultDto>.Conflict("The group changed or has linked records. Refresh before trying again.");
            }
        }

        await kv.RemoveMembershipAsync(request.GroupId, request.CurrentMemberId, ct);
        await kv.RemoveApiCacheKeyAsync($"member:{request.CurrentMemberId}:me", ct);
        await kv.RemoveMemberProfileAsync(request.CurrentMemberId, ct);
        await cache.RemoveMembershipsAsync(request.GroupId, ct);
        await cache.RemoveGroupAsync(request.GroupId, ct);
        if (parentId.HasValue) await cache.RemoveSubgroupsAsync(parentId.Value, ct);
        return AppResult<GroupActionResultDto>.Success(new GroupActionResultDto(true, request.GroupId, parentId));
    }
}
