using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Groups.Commands.TransferGroupLeadership;

public sealed class TransferGroupLeadershipCommandHandler(
    IAlifeDbContext dbContext,
    IGroupCacheInvalidationService groupCacheInvalidationService,
    ICloudflareKvCacheService cloudflareKvCacheService)
    : IRequestHandler<TransferGroupLeadershipCommand, AppResult<GroupActionResultDto>>
{
    public async Task<AppResult<GroupActionResultDto>> Handle(
        TransferGroupLeadershipCommand request,
        CancellationToken cancellationToken)
    {
        if (request.CurrentMemberId == request.MemberId)
        {
            return AppResult<GroupActionResultDto>.Validation("Choose another co-leader to become the group leader.");
        }

        var currentMembership = await dbContext.GroupMemberships.FirstOrDefaultAsync(
            x => x.GroupId == request.GroupId &&
                 x.MemberId == request.CurrentMemberId &&
                 x.Status == MembershipStatus.Approved,
            cancellationToken);

        if (currentMembership?.Role != MembershipRole.Leader)
        {
            return AppResult<GroupActionResultDto>.Forbidden("Only the current group leader can transfer leadership.");
        }

        var targetMembership = await dbContext.GroupMemberships.FirstOrDefaultAsync(
            x => x.GroupId == request.GroupId &&
                 x.MemberId == request.MemberId &&
                 x.Status == MembershipStatus.Approved,
            cancellationToken);

        if (targetMembership is null)
        {
            return AppResult<GroupActionResultDto>.NotFound("Approved co-leader membership was not found.");
        }

        if (targetMembership.Role != MembershipRole.CoLeader)
        {
            return AppResult<GroupActionResultDto>.Validation("Only an approved co-leader can become the group leader.");
        }

        var now = DateTime.UtcNow;
        currentMembership.Role = MembershipRole.CoLeader;
        currentMembership.UpdatedUtc = now;
        targetMembership.Role = MembershipRole.Leader;
        targetMembership.UpdatedUtc = now;

        await dbContext.SaveChangesAsync(cancellationToken);

        await cloudflareKvCacheService.PutApprovedMembershipAsync(
            request.GroupId,
            request.CurrentMemberId,
            MembershipRole.CoLeader,
            now,
            cancellationToken);
        await cloudflareKvCacheService.PutApprovedMembershipAsync(
            request.GroupId,
            request.MemberId,
            MembershipRole.Leader,
            now,
            cancellationToken);
        await cloudflareKvCacheService.RemoveApiCacheKeyAsync($"member:{request.CurrentMemberId}:me", cancellationToken);
        await cloudflareKvCacheService.RemoveApiCacheKeyAsync($"member:{request.MemberId}:me", cancellationToken);
        await cloudflareKvCacheService.RemoveMemberProfileAsync(request.CurrentMemberId, cancellationToken);
        await cloudflareKvCacheService.RemoveMemberProfileAsync(request.MemberId, cancellationToken);
        await groupCacheInvalidationService.RemoveMembershipsAsync(request.GroupId, cancellationToken);

        return AppResult<GroupActionResultDto>.Success(new GroupActionResultDto(true));
    }
}
