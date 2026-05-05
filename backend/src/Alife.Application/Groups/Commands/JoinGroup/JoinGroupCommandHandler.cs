using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Common.Sync;
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
    ISyncNotificationService syncNotificationService)
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

        if (group.AccessType == AccessType.Private)
        {
            return AppResult<GroupStatusResultDto>.Forbidden("Private group is invite only.");
        }

        var membership = await dbContext.GroupMemberships.FirstOrDefaultAsync(
            x => x.GroupId == request.GroupId && x.MemberId == request.CurrentMemberId,
            cancellationToken);

        var status = group.AccessType == AccessType.Public ? MembershipStatus.Approved : MembershipStatus.Requested;
        if (membership is null)
        {
            var now = DateTime.UtcNow;
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
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await groupCacheInvalidationService.RemoveMembershipsAsync(request.GroupId, cancellationToken);
        await syncNotificationService.PublishAsync(
            new SyncEntityChange(
                "group-memberships",
                request.GroupId.ToString("N"),
                $"/api/groups/{request.GroupId}/memberships",
                [SyncKeys.GroupMemberships(request.GroupId), SyncKeys.Member(request.CurrentMemberId)],
                await GetMembershipUpdateRecipientsAsync(request.GroupId, request.CurrentMemberId, cancellationToken)),
            cancellationToken);

        return AppResult<GroupStatusResultDto>.Success(new GroupStatusResultDto(status.ToString()));
    }

    private async Task<IReadOnlyCollection<Guid>> GetMembershipUpdateRecipientsAsync(
        Guid groupId,
        Guid currentMemberId,
        CancellationToken cancellationToken)
    {
        var recipients = await dbContext.GroupMemberships
            .Where(x => x.GroupId == groupId && x.Status == MembershipStatus.Approved)
            .Select(x => x.MemberId)
            .Distinct()
            .ToListAsync(cancellationToken);

        if (!recipients.Contains(currentMemberId))
        {
            recipients.Add(currentMemberId);
        }

        return recipients;
    }
}
