using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Application.Notifications.Services;
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
        var canManageRoles = await groupAuthorizationService.IsLeaderAsync(
            request.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canManageRoles)
        {
            return AppResult<GroupActionResultDto>.Forbidden("Only the group leader or platform admins can manage co-leaders.");
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

        var nextRole = request.IsCoLeader ? MembershipRole.CoLeader : MembershipRole.Member;
        var roleChanged = membership.Role != nextRole;
        membership.Role = nextRole;
        membership.UpdatedUtc = DateTime.UtcNow;

        if (roleChanged)
        {
            await MembershipNotificationWriter.NotifyMemberOfGroupRoleChangedAsync(
                dbContext,
                request.GroupId,
                request.MemberId,
                request.CurrentMemberId,
                request.IsCoLeader,
                cancellationToken);
        }

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
