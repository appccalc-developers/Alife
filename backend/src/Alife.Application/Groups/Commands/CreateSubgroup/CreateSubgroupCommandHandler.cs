using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
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
    IGroupCacheInvalidationService groupCacheInvalidationService)
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
}
