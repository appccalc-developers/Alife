using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Common.Sync;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Groups.Commands.AcceptGroupInvite;

public sealed class AcceptGroupInviteCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IGroupCacheInvalidationService groupCacheInvalidationService,
    ISyncNotificationService syncNotificationService)
    : IRequestHandler<AcceptGroupInviteCommand, AppResult<GroupActionResultDto>>
{
    public async Task<AppResult<GroupActionResultDto>> Handle(
        AcceptGroupInviteCommand request,
        CancellationToken cancellationToken)
    {
        var isRegistered = await groupAuthorizationService.IsRegisteredMemberAsync(request.CurrentMemberId, cancellationToken);
        if (!isRegistered)
        {
            return AppResult<GroupActionResultDto>.Validation("Registration required.");
        }

        var membership = await dbContext.GroupMemberships.FirstOrDefaultAsync(
            x => x.GroupId == request.GroupId && x.MemberId == request.CurrentMemberId,
            cancellationToken);

        if (membership is null || membership.Status != MembershipStatus.Invited)
        {
            return AppResult<GroupActionResultDto>.NotFound("No invitation found.");
        }

        membership.Status = MembershipStatus.Approved;
        membership.UpdatedUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await groupCacheInvalidationService.RemoveMembershipsAsync(request.GroupId, cancellationToken);
        await syncNotificationService.PublishAsync(
            new SyncEntityChange(
                "group-memberships",
                request.GroupId.ToString("N"),
                $"/api/groups/{request.GroupId}/memberships",
                [SyncKeys.GroupMemberships(request.GroupId), SyncKeys.Member(request.CurrentMemberId)],
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
