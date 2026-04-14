using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using MediatR;

namespace Alife.Application.Groups.Queries.GetGroupMemberships;

public sealed class GetGroupMembershipsQueryHandler(
    IGroupReadService groupReadService,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<GetGroupMembershipsQuery, AppResult<IReadOnlyList<GroupMembershipDto>>>
{
    public async Task<AppResult<IReadOnlyList<GroupMembershipDto>>> Handle(
        GetGroupMembershipsQuery request,
        CancellationToken cancellationToken)
    {
        var canManage = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            request.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canManage)
        {
            return AppResult<IReadOnlyList<GroupMembershipDto>>.Forbidden("You do not have access to group memberships.");
        }

        var memberships = await groupReadService.GetMembershipsAsync(request.GroupId, cancellationToken);
        return AppResult<IReadOnlyList<GroupMembershipDto>>.Success(memberships);
    }
}
