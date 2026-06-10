using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Application.Notifications.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Groups.Commands.InviteGroupMemberById;

public sealed class InviteGroupMemberByIdCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IGroupCacheInvalidationService groupCacheInvalidationService,
    ICloudflareKvCacheService cloudflareKvCacheService)
    : IRequestHandler<InviteGroupMemberByIdCommand, AppResult<GroupActionResultDto>>
{
    public async Task<AppResult<GroupActionResultDto>> Handle(
        InviteGroupMemberByIdCommand request,
        CancellationToken cancellationToken)
    {
        var canManage = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            request.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canManage)
        {
            return AppResult<GroupActionResultDto>.Forbidden("You do not have permission to invite members.");
        }

        var targetExists = await dbContext.Members.AnyAsync(
            x => x.Id == request.TargetMemberId && x.IsRegistered,
            cancellationToken);

        if (!targetExists)
        {
            return AppResult<GroupActionResultDto>.NotFound("Member not found.");
        }

        var group = await dbContext.Groups
            .AsNoTracking()
            .Where(x => x.Id == request.GroupId)
            .Select(x => new { x.ParentGroupId })
            .FirstOrDefaultAsync(cancellationToken);

        if (group is null)
        {
            return AppResult<GroupActionResultDto>.NotFound("Group was not found.");
        }

        if (group.ParentGroupId is Guid parentGroupId)
        {
            var isParentMember = await dbContext.GroupMemberships
                .AsNoTracking()
                .AnyAsync(
                    x => x.GroupId == parentGroupId &&
                         x.MemberId == request.TargetMemberId &&
                         x.Status == MembershipStatus.Approved,
                    cancellationToken);

            if (!isParentMember)
            {
                return AppResult<GroupActionResultDto>.Forbidden("Only approved members of the parent group can be invited to this subgroup.");
            }
        }

        var membership = await dbContext.GroupMemberships
            .Where(x => x.GroupId == request.GroupId && x.MemberId == request.TargetMemberId)
            .OrderByDescending(x => x.UpdatedUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (membership is null)
        {
            var now = DateTime.UtcNow;
            dbContext.GroupMemberships.Add(new GroupMembership
            {
                Id = Guid.NewGuid(),
                GroupId = request.GroupId,
                MemberId = request.TargetMemberId,
                Status = MembershipStatus.Invited,
                Role = MembershipRole.Member,
                CreatedUtc = now,
                UpdatedUtc = now
            });
        }
        else if (membership.Status == MembershipStatus.Approved)
        {
            return AppResult<GroupActionResultDto>.Success(new GroupActionResultDto(true));
        }
        else
        {
            membership.Status = MembershipStatus.Invited;
            membership.Role = MembershipRole.Member;
            membership.UpdatedUtc = DateTime.UtcNow;
        }

        await MembershipNotificationWriter.NotifyMemberOfGroupInvitationAsync(
            dbContext,
            request.GroupId,
            request.TargetMemberId,
            request.CurrentMemberId,
            cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
        await cloudflareKvCacheService.RemoveMembershipAsync(request.GroupId, request.TargetMemberId, cancellationToken);
        await groupCacheInvalidationService.RemoveMembershipsAsync(request.GroupId, cancellationToken);

        return AppResult<GroupActionResultDto>.Success(new GroupActionResultDto(true));
    }
}
