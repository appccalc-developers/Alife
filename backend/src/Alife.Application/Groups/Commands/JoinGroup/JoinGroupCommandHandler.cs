using Alife.Application.Common;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Groups.Commands.JoinGroup;

public sealed class JoinGroupCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IGroupCacheInvalidationService groupCacheInvalidationService,
    ICloudflareKvCacheService cloudflareKvCacheService)
    : IRequestHandler<JoinGroupCommand, AppResult<GroupStatusResultDto>>
{
    public async Task<AppResult<GroupStatusResultDto>> Handle(JoinGroupCommand request, CancellationToken cancellationToken)
    {
        var isRegistered = await groupAuthorizationService.IsRegisteredMemberAsync(request.CurrentMemberId, cancellationToken);
        if (!isRegistered)
        {
            return AppResult<GroupStatusResultDto>.Validation("Registration required.");
        }

        var group = await dbContext.Groups.FirstOrDefaultAsync(x => x.Id == request.GroupId, cancellationToken);
        if (group is null)
        {
            return AppResult<GroupStatusResultDto>.NotFound("Group was not found.");
        }

        if (group.ParentGroupId is Guid parentGroupId)
        {
            var isApprovedParentMember = await groupAuthorizationService.IsApprovedMemberAsync(
                parentGroupId,
                request.CurrentMemberId,
                cancellationToken);

            if (!isApprovedParentMember)
            {
                return AppResult<GroupStatusResultDto>.Forbidden("You must be an approved member of the parent group before joining this subgroup.");
            }
        }
        else if (group.AccessType == AccessType.Private)
        {
            return AppResult<GroupStatusResultDto>.Forbidden("Private group is invite only.");
        }

        var membership = await dbContext.GroupMemberships
            .Where(x => x.GroupId == request.GroupId && x.MemberId == request.CurrentMemberId)
            .OrderByDescending(x => x.UpdatedUtc)
            .FirstOrDefaultAsync(cancellationToken);

        var status = group.AccessType switch
        {
            AccessType.Public => MembershipStatus.Approved,
            AccessType.Protected => MembershipStatus.Requested,
            AccessType.Private => MembershipStatus.Rejected,
            _ => MembershipStatus.Requested
        };
        DateTime updatedUtc;
        if (membership is null)
        {
            var now = DateTime.UtcNow;
            updatedUtc = now;
            dbContext.GroupMemberships.Add(new GroupMembership
            {
                Id = Guid.NewGuid(),
                GroupId = request.GroupId,
                MemberId = request.CurrentMemberId,
                Status = status,
                Role = MembershipRole.Member,
                CreatedUtc = now,
                UpdatedUtc = now
            });
        }
        else
        {
            membership.Status = status;
            membership.Role = MembershipRole.Member;
            membership.UpdatedUtc = DateTime.UtcNow;
            updatedUtc = membership.UpdatedUtc;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        if (status == MembershipStatus.Approved)
        {
            await cloudflareKvCacheService.PutApprovedMembershipAsync(
                request.GroupId,
                request.CurrentMemberId,
                MembershipRole.Member,
                updatedUtc,
                cancellationToken);
        }
        else
        {
            await cloudflareKvCacheService.RemoveMembershipAsync(request.GroupId, request.CurrentMemberId, cancellationToken);
        }
        await groupCacheInvalidationService.RemoveMembershipsAsync(request.GroupId, cancellationToken);

        return AppResult<GroupStatusResultDto>.Success(new GroupStatusResultDto(EnumName.CamelCase(status)));
    }
}
