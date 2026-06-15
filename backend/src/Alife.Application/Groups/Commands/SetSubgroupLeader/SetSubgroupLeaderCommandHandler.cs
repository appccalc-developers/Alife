using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Groups.Commands.SetSubgroupLeader;

public sealed class SetSubgroupLeaderCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IGroupCacheInvalidationService groupCacheInvalidationService,
    ICloudflareKvCacheService cloudflareKvCacheService)
    : IRequestHandler<SetSubgroupLeaderCommand, AppResult<GroupActionResultDto>>
{
    public async Task<AppResult<GroupActionResultDto>> Handle(
        SetSubgroupLeaderCommand request,
        CancellationToken cancellationToken)
    {
        var canManageParent = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            request.ParentGroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canManageParent)
        {
            return AppResult<GroupActionResultDto>.Forbidden("You do not have permission to manage this parent group.");
        }

        var isDirectSubgroup = await dbContext.Groups
            .AsNoTracking()
            .AnyAsync(
                x => x.Id == request.SubgroupId &&
                     x.ParentGroupId == request.ParentGroupId &&
                     !x.IsClosed,
                cancellationToken);

        if (!isDirectSubgroup)
        {
            return AppResult<GroupActionResultDto>.NotFound("Subgroup was not found under this parent group.");
        }

        var targetIsApprovedParentMember = await dbContext.GroupMemberships
            .AsNoTracking()
            .AnyAsync(
                x => x.GroupId == request.ParentGroupId &&
                     x.MemberId == request.MemberId &&
                     x.Status == MembershipStatus.Approved,
                cancellationToken);

        if (!targetIsApprovedParentMember)
        {
            return AppResult<GroupActionResultDto>.Forbidden("The new subgroup leader must be an approved member of the parent group.");
        }

        var now = DateTime.UtcNow;
        var affectedMemberIds = new HashSet<Guid> { request.MemberId };
        var currentLeaders = await dbContext.GroupMemberships
            .Where(x => x.GroupId == request.SubgroupId &&
                        x.Role == MembershipRole.Leader &&
                        x.MemberId != request.MemberId)
            .ToListAsync(cancellationToken);

        foreach (var leader in currentLeaders)
        {
            leader.Status = MembershipStatus.Approved;
            leader.Role = MembershipRole.CoLeader;
            leader.UpdatedUtc = now;
            affectedMemberIds.Add(leader.MemberId);
        }

        var targetMembership = await dbContext.GroupMemberships
            .Where(x => x.GroupId == request.SubgroupId && x.MemberId == request.MemberId)
            .OrderByDescending(x => x.UpdatedUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (targetMembership is null)
        {
            targetMembership = new GroupMembership
            {
                Id = Guid.NewGuid(),
                GroupId = request.SubgroupId,
                MemberId = request.MemberId,
                Status = MembershipStatus.Approved,
                Role = MembershipRole.Leader,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            dbContext.GroupMemberships.Add(targetMembership);
        }
        else
        {
            targetMembership.Status = MembershipStatus.Approved;
            targetMembership.Role = MembershipRole.Leader;
            targetMembership.UpdatedUtc = now;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        await cloudflareKvCacheService.PutApprovedMembershipAsync(
            request.SubgroupId,
            request.MemberId,
            MembershipRole.Leader,
            targetMembership.UpdatedUtc,
            cancellationToken);

        foreach (var previousLeader in currentLeaders)
        {
            await cloudflareKvCacheService.PutApprovedMembershipAsync(
                request.SubgroupId,
                previousLeader.MemberId,
                MembershipRole.CoLeader,
                previousLeader.UpdatedUtc,
                cancellationToken);
        }

        foreach (var memberId in affectedMemberIds)
        {
            await cloudflareKvCacheService.RemoveApiCacheKeyAsync($"member:{memberId}:me", cancellationToken);
            await cloudflareKvCacheService.RemoveMemberProfileAsync(memberId, cancellationToken);
        }

        await groupCacheInvalidationService.RemoveSubgroupsAsync(request.ParentGroupId, cancellationToken);
        await groupCacheInvalidationService.RemoveMembershipsAsync(request.SubgroupId, cancellationToken);

        return AppResult<GroupActionResultDto>.Success(new GroupActionResultDto(true));
    }
}
