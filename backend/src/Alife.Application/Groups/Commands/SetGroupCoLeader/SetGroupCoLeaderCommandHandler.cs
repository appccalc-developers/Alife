using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Common.Sync;
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
    ISyncNotificationService syncNotificationService)
    : IRequestHandler<SetGroupCoLeaderCommand, AppResult<GroupActionResultDto>>
{
    public async Task<AppResult<GroupActionResultDto>> Handle(
        SetGroupCoLeaderCommand request,
        CancellationToken cancellationToken)
    {
        var isLeader = await groupAuthorizationService.IsLeaderAsync(
            request.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!isLeader)
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

        membership.Role = request.IsCoLeader ? MembershipRole.CoLeader : MembershipRole.Member;
        membership.UpdatedUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await groupCacheInvalidationService.RemoveMembershipsAsync(request.GroupId, cancellationToken);
        await syncNotificationService.PublishAsync(
            new SyncEntityChange(
                "group-memberships",
                request.GroupId.ToString("N"),
                $"/api/groups/{request.GroupId}/memberships",
                [SyncKeys.GroupMemberships(request.GroupId), SyncKeys.Member(request.MemberId)],
                await GetApprovedGroupMemberIdsAsync(request.GroupId, cancellationToken)),
            cancellationToken);

        return AppResult<GroupActionResultDto>.Success(new GroupActionResultDto(true));
    }

    private async Task<IReadOnlyCollection<Guid>> GetApprovedGroupMemberIdsAsync(Guid groupId, CancellationToken cancellationToken)
        => await dbContext.GroupMemberships
            .Where(x => x.GroupId == groupId && x.Status == MembershipStatus.Approved)
            .Select(x => x.MemberId)
            .Distinct()
            .ToArrayAsync(cancellationToken);
}
