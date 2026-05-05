using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Common.Sync;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Groups.Commands.KickGroupMember;

public sealed class KickGroupMemberCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IGroupCacheInvalidationService groupCacheInvalidationService,
    ISyncNotificationService syncNotificationService)
    : IRequestHandler<KickGroupMemberCommand, AppResult<GroupKickResultDto>>
{
    public async Task<AppResult<GroupKickResultDto>> Handle(
        KickGroupMemberCommand request,
        CancellationToken cancellationToken)
    {
        var canManage = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            request.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canManage)
        {
            return AppResult<GroupKickResultDto>.Forbidden("You do not have permission to remove this member.");
        }

        var targetGroupIds = await GetDescendantGroupIdsAsync(request.GroupId, cancellationToken);
        targetGroupIds.Add(request.GroupId);

        var memberships = await dbContext.GroupMemberships
            .Where(x => x.MemberId == request.MemberId && targetGroupIds.Contains(x.GroupId))
            .ToListAsync(cancellationToken);

        foreach (var membership in memberships)
        {
            membership.Status = MembershipStatus.Removed;
            membership.Role = MembershipRole.Member;
            membership.UpdatedUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        foreach (var groupId in targetGroupIds)
        {
            await groupCacheInvalidationService.RemoveMembershipsAsync(groupId, cancellationToken);
        }
        await syncNotificationService.PublishAsync(
            new SyncEntityChange(
                "group-memberships",
                request.GroupId.ToString("N"),
                $"/api/groups/{request.GroupId}/memberships",
                targetGroupIds.Select(SyncKeys.GroupMemberships).Append(SyncKeys.Member(request.MemberId)).ToArray(),
                await GetRemainingMemberIdsAsync(targetGroupIds, request.MemberId, cancellationToken)),
            cancellationToken);

        return AppResult<GroupKickResultDto>.Success(new GroupKickResultDto(true, memberships.Count));
    }

    private async Task<IReadOnlyCollection<Guid>> GetRemainingMemberIdsAsync(
        IReadOnlyCollection<Guid> groupIds,
        Guid removedMemberId,
        CancellationToken cancellationToken)
    {
        var recipients = await dbContext.GroupMemberships
            .Where(x => groupIds.Contains(x.GroupId) && x.Status == MembershipStatus.Approved)
            .Select(x => x.MemberId)
            .Distinct()
            .ToListAsync(cancellationToken);

        if (!recipients.Contains(removedMemberId))
        {
            recipients.Add(removedMemberId);
        }

        return recipients;
    }

    private async Task<List<Guid>> GetDescendantGroupIdsAsync(Guid groupId, CancellationToken cancellationToken)
    {
        var allGroups = await dbContext.Groups
            .AsNoTracking()
            .Select(x => new { x.Id, x.ParentGroupId })
            .ToListAsync(cancellationToken);

        var result = new List<Guid>();
        var queue = new Queue<Guid>();
        queue.Enqueue(groupId);

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            var children = allGroups.Where(x => x.ParentGroupId == current).Select(x => x.Id).ToList();
            foreach (var child in children)
            {
                result.Add(child);
                queue.Enqueue(child);
            }
        }

        return result;
    }
}
