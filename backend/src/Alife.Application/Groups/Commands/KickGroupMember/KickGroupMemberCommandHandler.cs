using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Application.Notifications.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Groups.Commands.KickGroupMember;

public sealed class KickGroupMemberCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IGroupCacheInvalidationService groupCacheInvalidationService,
    ICloudflareKvCacheService cloudflareKvCacheService)
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

        if (request.CurrentMemberId == request.MemberId)
        {
            return AppResult<GroupKickResultDto>.Forbidden("You cannot remove yourself from the group.");
        }

        var isPlatformAdmin = await groupAuthorizationService.IsAdminAsync(request.CurrentMemberId, cancellationToken);
        var currentMembership = await dbContext.GroupMemberships
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.GroupId == request.GroupId &&
                     x.MemberId == request.CurrentMemberId &&
                     x.Status == MembershipStatus.Approved,
                cancellationToken);

        if (!isPlatformAdmin &&
            (currentMembership is null ||
            currentMembership.Role is not (MembershipRole.Leader or MembershipRole.CoLeader))
        )
        {
            return AppResult<GroupKickResultDto>.Forbidden("You do not have permission to remove this member.");
        }

        var targetMembership = await dbContext.GroupMemberships
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.GroupId == request.GroupId &&
                     x.MemberId == request.MemberId &&
                     x.Status == MembershipStatus.Approved,
                cancellationToken);

        if (targetMembership?.Role == MembershipRole.Leader)
        {
            return AppResult<GroupKickResultDto>.Forbidden("The group leader cannot be removed.");
        }

        if (!isPlatformAdmin &&
            currentMembership?.Role == MembershipRole.CoLeader &&
            targetMembership?.Role == MembershipRole.CoLeader)
        {
            return AppResult<GroupKickResultDto>.Forbidden("Co-leaders cannot remove other co-leaders.");
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

        if (memberships.Count > 0)
        {
            await MembershipNotificationWriter.NotifyMemberOfGroupRemovalAsync(
                dbContext,
                request.GroupId,
                request.MemberId,
                request.CurrentMemberId,
                cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        foreach (var groupId in targetGroupIds)
        {
            await cloudflareKvCacheService.RemoveMembershipAsync(groupId, request.MemberId, cancellationToken);
            await groupCacheInvalidationService.RemoveMembershipsAsync(groupId, cancellationToken);
        }

        return AppResult<GroupKickResultDto>.Success(new GroupKickResultDto(true, memberships.Count));
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
