using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Common.Sync;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Groups.Commands.CreateSubgroup;

public sealed class CreateSubgroupCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IGroupCacheInvalidationService groupCacheInvalidationService,
    ISyncNotificationService syncNotificationService)
    : IRequestHandler<CreateSubgroupCommand, AppResult<GroupDto>>
{
    public async Task<AppResult<GroupDto>> Handle(CreateSubgroupCommand request, CancellationToken cancellationToken)
    {
        var canManage = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            request.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canManage)
        {
            return AppResult<GroupDto>.Forbidden("You do not have permission to create a subgroup.");
        }

        var parentGroupExists = await dbContext.Groups.AnyAsync(x => x.Id == request.GroupId, cancellationToken);
        if (!parentGroupExists)
        {
            return AppResult<GroupDto>.NotFound("Parent group was not found.");
        }

        var now = DateTime.UtcNow;
        var subgroup = new Group
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            ParentGroupId = request.GroupId,
            AccessType = request.AccessType,
            IsChurch = false,
            IsClosed = false,
            CreatedUtc = now,
            UpdatedUtc = now
        };

        dbContext.Groups.Add(subgroup);
        dbContext.GroupMemberships.Add(new GroupMembership
        {
            Id = Guid.NewGuid(),
            GroupId = subgroup.Id,
            MemberId = request.CurrentMemberId,
            Status = MembershipStatus.Approved,
            Role = MembershipRole.Leader,
            CreatedUtc = now,
            UpdatedUtc = now
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        await groupCacheInvalidationService.RemoveSubgroupsAsync(request.GroupId, cancellationToken);
        await syncNotificationService.PublishAsync(
            new SyncEntityChange(
                "group",
                subgroup.Id.ToString("N"),
                $"/api/groups/{subgroup.Id}",
                [SyncKeys.Group(subgroup.Id), SyncKeys.GroupTree(request.GroupId)],
                await GetApprovedGroupMemberIdsAsync(request.GroupId, cancellationToken)),
            cancellationToken);

        return AppResult<GroupDto>.Success(new GroupDto(
            subgroup.Id,
            subgroup.Name,
            subgroup.ParentGroupId,
            subgroup.AccessType,
            subgroup.IsChurch,
            subgroup.IsClosed,
            subgroup.CreatedUtc,
            subgroup.UpdatedUtc));
    }

    private async Task<IReadOnlyCollection<Guid>> GetApprovedGroupMemberIdsAsync(Guid groupId, CancellationToken cancellationToken)
        => await dbContext.GroupMemberships
            .Where(x => x.GroupId == groupId && x.Status == MembershipStatus.Approved)
            .Select(x => x.MemberId)
            .Distinct()
            .ToArrayAsync(cancellationToken);
}
