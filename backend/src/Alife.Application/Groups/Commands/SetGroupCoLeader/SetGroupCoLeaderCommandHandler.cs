using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Groups.Commands.SetGroupCoLeader;

public sealed class SetGroupCoLeaderCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IGroupCacheInvalidationService groupCacheInvalidationService,
    ICloudflareKvCacheService cloudflareKvCacheService)
    : IRequestHandler<SetGroupCoLeaderCommand, AppResult<GroupActionResultDto>>
{
    public async Task<AppResult<GroupActionResultDto>> Handle(
        SetGroupCoLeaderCommand request,
        CancellationToken cancellationToken)
    {
        var canManage = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            request.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canManage)
        {
            return AppResult<GroupActionResultDto>.Forbidden("You do not have permission to manage co-leaders.");
        }

        var membership = await dbContext.GroupMemberships.FirstOrDefaultAsync(
            x => x.GroupId == request.GroupId &&
                 x.MemberId == request.MemberId &&
                 x.Status == MembershipStatus.Approved,
            cancellationToken);

        if (membership is null)
        {
            return AppResult<GroupActionResultDto>.NotFound("Approved membership was not found.");
        }

        if (membership.Role == MembershipRole.Leader)
        {
            return AppResult<GroupActionResultDto>.Forbidden("The primary leader role cannot be changed with this action.");
        }

        membership.Role = request.IsCoLeader ? MembershipRole.CoLeader : MembershipRole.Member;
        membership.UpdatedUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await cloudflareKvCacheService.PutApprovedMembershipAsync(
            request.GroupId,
            request.MemberId,
            membership.Role,
            membership.UpdatedUtc,
            cancellationToken);
        await groupCacheInvalidationService.RemoveMembershipsAsync(request.GroupId, cancellationToken);

        return AppResult<GroupActionResultDto>.Success(new GroupActionResultDto(true));
    }
}
