using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Groups.Commands.InviteGroupMemberById;

public sealed class InviteGroupMemberByIdCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IGroupCacheInvalidationService groupCacheInvalidationService)
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
            x => x.Id == request.TargetMemberId,
            cancellationToken);

        if (!targetExists)
        {
            return AppResult<GroupActionResultDto>.NotFound("Member not found.");
        }

        var membership = await dbContext.GroupMemberships.FirstOrDefaultAsync(
            x => x.GroupId == request.GroupId && x.MemberId == request.TargetMemberId,
            cancellationToken);

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
        else
        {
            membership.Status = MembershipStatus.Invited;
            membership.Role = MembershipRole.Member;
            membership.UpdatedUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await groupCacheInvalidationService.RemoveMembershipsAsync(request.GroupId, cancellationToken);

        return AppResult<GroupActionResultDto>.Success(new GroupActionResultDto(true));
    }
}
