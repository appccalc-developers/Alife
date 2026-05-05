using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Common.Sync;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Groups.Commands.InviteGroupMember;

public sealed class InviteGroupMemberCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IGroupCacheInvalidationService groupCacheInvalidationService,
    ISyncNotificationService syncNotificationService)
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
            x => x.PhoneE164 == request.TargetPhoneE164,
            cancellationToken);

        if (target is null)
        {
            return AppResult<GroupActionResultDto>.NotFound("Member not found by phone.");
        }

        var membership = await dbContext.GroupMemberships.FirstOrDefaultAsync(
            x => x.GroupId == request.GroupId && x.MemberId == target.Id,
            cancellationToken);

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
        else
        {
            membership.Status = MembershipStatus.Invited;
            membership.Role = MembershipRole.Member;
            membership.UpdatedUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await groupCacheInvalidationService.RemoveMembershipsAsync(request.GroupId, cancellationToken);
        await syncNotificationService.PublishAsync(
            new SyncEntityChange(
                "group-memberships",
                request.GroupId.ToString("N"),
                $"/api/groups/{request.GroupId}/memberships",
                [SyncKeys.GroupMemberships(request.GroupId), SyncKeys.Member(target.Id)],
                await GetRecipientsAsync(request.GroupId, target.Id, cancellationToken)),
            cancellationToken);

        return AppResult<GroupActionResultDto>.Success(new GroupActionResultDto(true));
    }

    private async Task<IReadOnlyCollection<Guid>> GetRecipientsAsync(
        Guid groupId,
        Guid targetMemberId,
        CancellationToken cancellationToken)
    {
        var recipients = await dbContext.GroupMemberships
            .Where(x => x.GroupId == groupId && x.Status == MembershipStatus.Approved)
            .Select(x => x.MemberId)
            .Distinct()
            .ToListAsync(cancellationToken);

        if (!recipients.Contains(targetMemberId))
        {
            recipients.Add(targetMemberId);
        }

        return recipients;
    }
}
