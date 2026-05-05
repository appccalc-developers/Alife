using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Common.Sync;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Groups.Commands.CloseGroup;

public sealed class CloseGroupCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IGroupCacheInvalidationService groupCacheInvalidationService,
    ISyncNotificationService syncNotificationService)
    : IRequestHandler<CloseGroupCommand, AppResult<GroupActionResultDto>>
{
    public async Task<AppResult<GroupActionResultDto>> Handle(CloseGroupCommand request, CancellationToken cancellationToken)
    {
        var canManage = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            request.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canManage)
        {
            return AppResult<GroupActionResultDto>.Forbidden("You do not have permission to close this group.");
        }

        var group = await dbContext.Groups.FirstOrDefaultAsync(x => x.Id == request.GroupId, cancellationToken);
        if (group is null)
        {
            return AppResult<GroupActionResultDto>.NotFound("Group was not found.");
        }

        group.IsClosed = true;
        group.UpdatedUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        await groupCacheInvalidationService.RemoveGroupAsync(group.Id, cancellationToken);
        if (group.ParentGroupId.HasValue)
        {
            await groupCacheInvalidationService.RemoveSubgroupsAsync(group.ParentGroupId.Value, cancellationToken);
        }
        await syncNotificationService.PublishAsync(
            new SyncEntityChange(
                "group",
                group.Id.ToString("N"),
                $"/api/groups/{group.Id}",
                group.ParentGroupId.HasValue
                    ? [SyncKeys.Group(group.Id), SyncKeys.GroupTree(group.ParentGroupId.Value)]
                    : [SyncKeys.Group(group.Id)],
                await GetApprovedGroupMemberIdsAsync(group.Id, cancellationToken)),
            cancellationToken);

        return AppResult<GroupActionResultDto>.Success(new GroupActionResultDto(true));
    }

    private async Task<IReadOnlyCollection<Guid>> GetApprovedGroupMemberIdsAsync(Guid groupId, CancellationToken cancellationToken)
        => await dbContext.GroupMemberships
            .Where(x => x.GroupId == groupId && x.Status == Domain.Enums.MembershipStatus.Approved)
            .Select(x => x.MemberId)
            .Distinct()
            .ToArrayAsync(cancellationToken);
}
