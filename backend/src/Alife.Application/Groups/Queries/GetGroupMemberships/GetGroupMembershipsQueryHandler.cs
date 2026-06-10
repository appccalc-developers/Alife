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
        var isApproved = await groupAuthorizationService.IsApprovedMemberAsync(
            request.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!isApproved)
        {
            return AppResult<IReadOnlyList<GroupMembershipDto>>.Forbidden("You do not have access to group memberships.");
        }

        var includeChurchLineCandidates = false;
        if (request.IncludeChurchLineCandidates)
        {
            includeChurchLineCandidates = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                request.GroupId,
                request.CurrentMemberId,
                cancellationToken);
        }

        var memberships = await groupReadService.GetMembershipsAsync(
            request.GroupId,
            includeChurchLineCandidates,
            cancellationToken);
        return AppResult<IReadOnlyList<GroupMembershipDto>>.Success(memberships);
    }
}
