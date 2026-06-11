using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Groups.Commands.ClaimSubgroupCoLeader;

public sealed class ClaimSubgroupCoLeaderCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IGroupCacheInvalidationService groupCacheInvalidationService,
    ICloudflareKvCacheService cloudflareKvCacheService)
    : IRequestHandler<ClaimSubgroupCoLeaderCommand, AppResult<GroupActionResultDto>>
{
    public async Task<AppResult<GroupActionResultDto>> Handle(
        ClaimSubgroupCoLeaderCommand request,
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

        var now = DateTime.UtcNow;
        var membership = await dbContext.GroupMemberships
            .Where(x => x.GroupId == request.SubgroupId && x.MemberId == request.CurrentMemberId)
            .OrderByDescending(x => x.UpdatedUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (membership is null)
        {
            membership = new GroupMembership
            {
                Id = Guid.NewGuid(),
                GroupId = request.SubgroupId,
                MemberId = request.CurrentMemberId,
                Status = MembershipStatus.Approved,
                Role = MembershipRole.CoLeader,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            dbContext.GroupMemberships.Add(membership);
        }
        else if (membership.Role != MembershipRole.Leader)
        {
            membership.Status = MembershipStatus.Approved;
            membership.Role = MembershipRole.CoLeader;
            membership.UpdatedUtc = now;
        }
        else if (membership.Status != MembershipStatus.Approved)
        {
            membership.Status = MembershipStatus.Approved;
            membership.UpdatedUtc = now;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await cloudflareKvCacheService.PutApprovedMembershipAsync(
            request.SubgroupId,
            request.CurrentMemberId,
            membership.Role,
            membership.UpdatedUtc,
            cancellationToken);
        await cloudflareKvCacheService.RemoveApiCacheKeyAsync($"member:{request.CurrentMemberId}:me", cancellationToken);
        await cloudflareKvCacheService.RemoveMemberProfileAsync(request.CurrentMemberId, cancellationToken);
        await groupCacheInvalidationService.RemoveMembershipsAsync(request.SubgroupId, cancellationToken);

        return AppResult<GroupActionResultDto>.Success(new GroupActionResultDto(true));
    }
}
