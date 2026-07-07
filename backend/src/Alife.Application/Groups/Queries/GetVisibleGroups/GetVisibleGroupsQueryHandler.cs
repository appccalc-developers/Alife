using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using MediatR;

namespace Alife.Application.Groups.Queries.GetVisibleGroups;

public sealed class GetVisibleGroupsQueryHandler(
    IGroupReadService groupReadService,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<GetVisibleGroupsQuery, AppResult<IReadOnlyList<GroupSummaryDto>>>
{
    public async Task<AppResult<IReadOnlyList<GroupSummaryDto>>> Handle(
        GetVisibleGroupsQuery request,
        CancellationToken cancellationToken)
    {
        if (request.CurrentMemberId.HasValue &&
            !await groupAuthorizationService.IsRegisteredMemberAsync(
                request.CurrentMemberId.Value,
                cancellationToken))
        {
            return AppResult<IReadOnlyList<GroupSummaryDto>>.Forbidden(
                "Guest members cannot browse groups.");
        }

        var groups = await groupReadService.GetVisibleGroupsAsync(
            request.CurrentMemberId,
            cancellationToken);

        return AppResult<IReadOnlyList<GroupSummaryDto>>.Success(groups);
    }
}
