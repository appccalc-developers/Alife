using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Groups.Commands.ApproveGroupMember;

public sealed class ApproveGroupMemberCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IGroupCacheInvalidationService groupCacheInvalidationService,
    ICloudflareKvCacheService cloudflareKvCacheService)
    : IRequestHandler<ApproveGroupMemberCommand, AppResult<GroupActionResultDto>>
{
    public async Task<AppResult<GroupActionResultDto>> Handle(
        ApproveGroupMemberCommand request,
        CancellationToken cancellationToken)
    {
        var canManage = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            request.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canManage)
        {
            return AppResult<GroupActionResultDto>.Forbidden("You do not have permission to approve memberships.");
        }

        var membership = await dbContext.GroupMemberships
            .Where(x => x.GroupId == request.GroupId && x.MemberId == request.MemberId)
            .OrderByDescending(x => x.UpdatedUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (membership is null)
        {
            var isChurchLineCandidate = await dbContext.Groups
                .AsNoTracking()
                .AnyAsync(x => x.Id == request.GroupId && x.IsChurch, cancellationToken)
                && await dbContext.Members
                    .AsNoTracking()
                    .AnyAsync(
                        x => x.Id == request.MemberId &&
                             x.IsRegistered &&
                             x.LineUID != null,
                        cancellationToken);

            if (!isChurchLineCandidate)
            {
                return AppResult<GroupActionResultDto>.NotFound("Membership was not found.");
            }

            var now = DateTime.UtcNow;
            membership = new GroupMembership
            {
                Id = Guid.NewGuid(),
                GroupId = request.GroupId,
                MemberId = request.MemberId,
                Status = MembershipStatus.Approved,
                Role = MembershipRole.Member,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            dbContext.GroupMemberships.Add(membership);
        }
        else
        {
            membership.Status = MembershipStatus.Approved;
            membership.UpdatedUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await cloudflareKvCacheService.PutApprovedMembershipAsync(
            request.GroupId,
            request.MemberId,
            membership.Role,
            membership.UpdatedUtc,
            cancellationToken);
        await groupCacheInvalidationService.RemoveMembershipsAsync(request.GroupId, cancellationToken);

        return AppResult<GroupActionResultDto>.Success(new GroupActionResultDto(true));
    }
}
