using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Application.Notifications.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Groups.Commands.InviteGroupMember;

public sealed class InviteGroupMemberCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IGroupCacheInvalidationService groupCacheInvalidationService,
    ICloudflareKvCacheService cloudflareKvCacheService)
    : IRequestHandler<InviteGroupMemberCommand, AppResult<GroupActionResultDto>>
{
    public async Task<AppResult<GroupActionResultDto>> Handle(
        InviteGroupMemberCommand request,
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

        var target = await dbContext.Members.FirstOrDefaultAsync(
            x => x.PhoneE164 == request.TargetPhoneE164 && x.IsRegistered,
            cancellationToken);

        if (target is null)
        {
            return AppResult<GroupActionResultDto>.NotFound("Member not found by phone.");
        }

        var groupExists = await dbContext.Groups
            .AsNoTracking()
            .AnyAsync(x => x.Id == request.GroupId, cancellationToken);

        if (!groupExists)
        {
            return AppResult<GroupActionResultDto>.NotFound("Group was not found.");
        }

        var membership = await dbContext.GroupMemberships
            .Where(x => x.GroupId == request.GroupId && x.MemberId == target.Id)
            .OrderByDescending(x => x.UpdatedUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (membership is null)
        {
            var now = DateTime.UtcNow;
            dbContext.GroupMemberships.Add(new GroupMembership
            {
                Id = Guid.NewGuid(),
                GroupId = request.GroupId,
                MemberId = target.Id,
                Status = MembershipStatus.Invited,
                Role = MembershipRole.Member,
                CreatedUtc = now,
                UpdatedUtc = now
            });
        }
        else if (membership.Status == MembershipStatus.Approved)
        {
            return AppResult<GroupActionResultDto>.Success(new GroupActionResultDto(true, MemberId: target.Id));
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
            target.Id,
            request.CurrentMemberId,
            cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
        await cloudflareKvCacheService.RemoveMembershipAsync(request.GroupId, target.Id, cancellationToken);
        await groupCacheInvalidationService.RemoveMembershipsAsync(request.GroupId, cancellationToken);

        return AppResult<GroupActionResultDto>.Success(new GroupActionResultDto(true, MemberId: target.Id));
    }
}
