using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
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
