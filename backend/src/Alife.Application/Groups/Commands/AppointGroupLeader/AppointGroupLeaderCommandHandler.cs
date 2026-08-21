using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Groups.Commands.AppointGroupLeader;

public sealed class AppointGroupLeaderCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IGroupCacheInvalidationService groupCacheInvalidationService,
    ICloudflareKvCacheService cloudflareKvCacheService)
    : IRequestHandler<AppointGroupLeaderCommand, AppResult<GroupActionResultDto>>
{
    public async Task<AppResult<GroupActionResultDto>> Handle(
        AppointGroupLeaderCommand request,
        CancellationToken cancellationToken)
    {
        if (!await groupAuthorizationService.IsAdminAsync(request.CurrentMemberId, cancellationToken))
        {
            return AppResult<GroupActionResultDto>.Forbidden("Only platform admins can appoint a group leader directly.");
        }

        var groupExists = await dbContext.Groups
            .AsNoTracking()
            .AnyAsync(x => x.Id == request.GroupId, cancellationToken);
        if (!groupExists)
        {
            return AppResult<GroupActionResultDto>.NotFound("Group was not found.");
        }

        var targetExists = await dbContext.Members
            .AsNoTracking()
            .AnyAsync(x => x.Id == request.MemberId && x.IsRegistered, cancellationToken);
        if (!targetExists)
        {
            return AppResult<GroupActionResultDto>.NotFound("Registered member was not found.");
        }

        var now = DateTime.UtcNow;
        var currentLeaders = await dbContext.GroupMemberships
            .Where(x => x.GroupId == request.GroupId &&
                        x.MemberId != request.MemberId &&
                        x.Status == MembershipStatus.Approved &&
                        x.Role == MembershipRole.Leader)
            .ToListAsync(cancellationToken);

        foreach (var currentLeader in currentLeaders)
        {
            currentLeader.Role = MembershipRole.CoLeader;
            currentLeader.UpdatedUtc = now;
        }

        var targetMembership = await dbContext.GroupMemberships.FirstOrDefaultAsync(
            x => x.GroupId == request.GroupId && x.MemberId == request.MemberId,
            cancellationToken);

        if (targetMembership is null)
        {
            targetMembership = new GroupMembership
            {
                Id = Guid.NewGuid(),
                GroupId = request.GroupId,
                MemberId = request.MemberId,
                Status = MembershipStatus.Approved,
                Role = MembershipRole.Leader,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            dbContext.GroupMemberships.Add(targetMembership);
        }
        else
        {
            targetMembership.Status = MembershipStatus.Approved;
            targetMembership.Role = MembershipRole.Leader;
            targetMembership.UpdatedUtc = now;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        foreach (var currentLeader in currentLeaders)
        {
            await RefreshMembershipAuthorizationAsync(
                request.GroupId,
                currentLeader.MemberId,
                MembershipRole.CoLeader,
                now,
                cancellationToken);
        }

        await RefreshMembershipAuthorizationAsync(
            request.GroupId,
            request.MemberId,
            MembershipRole.Leader,
            now,
            cancellationToken);
        await groupCacheInvalidationService.RemoveMembershipsAsync(request.GroupId, cancellationToken);

        return AppResult<GroupActionResultDto>.Success(new GroupActionResultDto(
            true,
            request.GroupId,
            null,
            request.MemberId));
    }

    private async Task RefreshMembershipAuthorizationAsync(
        Guid groupId,
        Guid memberId,
        MembershipRole role,
        DateTime updatedUtc,
        CancellationToken cancellationToken)
    {
        await cloudflareKvCacheService.PutApprovedMembershipAsync(
            groupId,
            memberId,
            role,
            updatedUtc,
            cancellationToken);
        await cloudflareKvCacheService.RemoveApiCacheKeyAsync($"member:{memberId}:me", cancellationToken);
        await cloudflareKvCacheService.RemoveMemberProfileAsync(memberId, cancellationToken);
    }
}
