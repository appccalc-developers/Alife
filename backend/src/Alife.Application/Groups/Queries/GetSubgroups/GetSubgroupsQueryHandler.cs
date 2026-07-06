using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Groups.Queries.GetSubgroups;

public sealed class GetSubgroupsQueryHandler(
    IGroupReadService groupReadService,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<GetSubgroupsQuery, AppResult<IReadOnlyList<GroupSummaryDto>>>
{
    public async Task<AppResult<IReadOnlyList<GroupSummaryDto>>> Handle(GetSubgroupsQuery request, CancellationToken cancellationToken)
    {
        var group = await groupReadService.GetByIdAsync(request.GroupId, cancellationToken);
        if (group is null)
        {
            return AppResult<IReadOnlyList<GroupSummaryDto>>.NotFound("Group was not found.");
        }

        var isAnonymous = request.CurrentMemberId is null;
        var isRegistered = !isAnonymous
            && await groupAuthorizationService.IsRegisteredMemberAsync(request.CurrentMemberId!.Value, cancellationToken);

        if (isAnonymous || !isRegistered)
        {
            if (group.AccessType != AccessType.Public && !group.IsChurch)
            {
                return AppResult<IReadOnlyList<GroupSummaryDto>>.Forbidden("You do not have access to this group's subgroups.");
            }

            var publicSubgroups = (await groupReadService.GetSubgroupsAsync(request.GroupId, cancellationToken))
                .Where(x => x.AccessType == AccessType.Public)
                .ToList();
            return AppResult<IReadOnlyList<GroupSummaryDto>>.Success(publicSubgroups);
        }

        if (group.AccessType != AccessType.Public && !group.IsChurch)
        {
            var approved = await groupAuthorizationService.IsApprovedMemberAsync(
                request.GroupId,
                request.CurrentMemberId!.Value,
                cancellationToken);

            if (!approved)
            {
                return AppResult<IReadOnlyList<GroupSummaryDto>>.Forbidden("You do not have access to this group's subgroups.");
            }
        }

        var subgroups = await groupReadService.GetSubgroupsAsync(request.GroupId, cancellationToken);
        return AppResult<IReadOnlyList<GroupSummaryDto>>.Success(subgroups);
    }
}
