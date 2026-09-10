using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Application.ContentPosts.Services;
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
        // Active means approved membership, consistent with Group Life.
        if (await db.GroupMemberships.CountAsync(x => x.GroupId == groupId
            && x.Status == MembershipStatus.Approved, ct) != 1) blockers.Add("members");
        if (await db.Groups.AnyAsync(x => x.ParentGroupId == groupId, ct)) blockers.Add("subgroups");
        if (await db.Pages.AnyAsync(x => x.OwnerGroupId == groupId, ct)) blockers.Add("pages");
        if (await db.GroupEvents.AnyAsync(x => x.GroupId == groupId, ct)
            || await db.EventSeries.AnyAsync(x => x.OwningGroupId == groupId, ct)) blockers.Add("events");
        if (await db.Albums.AnyAsync(x => x.GroupId == groupId, ct)) blockers.Add("albums");
        if (await db.Announcements.AnyAsync(x => x.GroupId == groupId, ct)) blockers.Add("announcements");

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
    IAlifeDbContext db, IGroupCacheInvalidationService cache, ICloudflareKvCacheService kv,
    IContentPostCacheInvalidationService contentCache)
    : IRequestHandler<DissolveGroupCommand, AppResult<GroupActionResultDto>>
{
    public async Task<AppResult<GroupActionResultDto>> Handle(DissolveGroupCommand request, CancellationToken ct)
    {
        Guid? parentId;
        List<Guid> affectedMemberIds;
        List<string> contentSlugs;
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
            affectedMemberIds = await db.GroupMemberships.Where(x => x.GroupId == request.GroupId).Select(x => x.MemberId).Distinct().ToListAsync(ct);
            contentSlugs = await db.ContentPosts.Where(x => x.OwnerGroupId == request.GroupId).Select(x => x.Slug).ToListAsync(ct);
            var auditIds = await db.AuditLogs.Where(x => x.GroupId == request.GroupId).Select(x => x.Id).ToListAsync(ct);
            parentId = group.ParentGroupId;
            db.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId,
                Action = "group.dissolved", EntityType = "Group", EntityId = group.Id,
                // EntityId retains the deleted identity without a foreign key to the removed group.
                BeforeJson = JsonSerializer.Serialize(new { group.NameJson, group.ParentGroupId, group.GroupType }),
                MetadataJson = JsonSerializer.Serialize(new { retainedAuditIds = auditIds }),
                OccurredUtc = DateTime.UtcNow
            });
            await db.StageGroupDissolutionAsync(request.GroupId, request.CurrentMemberId, ct);
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

        foreach (var memberId in affectedMemberIds)
        {
            await kv.RemoveMembershipAsync(request.GroupId, memberId, ct);
            await kv.RemoveApiCacheKeyAsync($"member:{memberId}:me", ct);
            await kv.RemoveMemberProfileAsync(memberId, ct);
        }
        await cache.RemoveMembershipsAsync(request.GroupId, ct);
        await contentCache.RemovePublicBatchAsync(request.GroupId, contentSlugs, ct);
        await cache.RemoveGroupAsync(request.GroupId, ct);
        if (parentId.HasValue) await cache.RemoveSubgroupsAsync(parentId.Value, ct);
        return AppResult<GroupActionResultDto>.Success(new GroupActionResultDto(true, request.GroupId, parentId));
    }
}
