using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Groups.Queries.GetGroupMemberProfile;

public sealed class GetGroupMemberProfileQueryHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<GetGroupMemberProfileQuery, AppResult<GroupMemberProfileDto>>
{
    public async Task<AppResult<GroupMemberProfileDto>> Handle(
        GetGroupMemberProfileQuery request,
        CancellationToken cancellationToken)
    {
        if (!await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                request.GroupId,
                request.CurrentMemberId,
                cancellationToken))
        {
            return AppResult<GroupMemberProfileDto>.Forbidden("You do not have permission to manage members in this group.");
        }

        var profile = await dbContext.GroupMemberships
            .AsNoTracking()
            .Where(membership =>
                membership.GroupId == request.GroupId &&
                membership.MemberId == request.TargetMemberId)
            .Select(membership => new GroupMemberProfileDto(
                membership.MemberId,
                membership.Member.DisplayName,
                membership.Member.Email,
                membership.Member.PhoneE164))
            .FirstOrDefaultAsync(cancellationToken);

        return profile is null
            ? AppResult<GroupMemberProfileDto>.NotFound("Group member was not found.")
            : AppResult<GroupMemberProfileDto>.Success(profile);
    }
}
