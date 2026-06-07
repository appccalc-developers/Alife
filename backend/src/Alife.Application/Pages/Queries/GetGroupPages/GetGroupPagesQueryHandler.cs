using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Pages.Queries.GetGroupPages;

public sealed class GetGroupPagesQueryHandler(
    IPageReadService pageReadService,
    IGroupReadService groupReadService,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<GetGroupPagesQuery, AppResult<IReadOnlyList<PageDto>>>
{
    public async Task<AppResult<IReadOnlyList<PageDto>>> Handle(GetGroupPagesQuery request, CancellationToken cancellationToken)
    {
        var group = await groupReadService.GetByIdAsync(request.GroupId, cancellationToken);
        if (group is null)
        {
            return AppResult<IReadOnlyList<PageDto>>.NotFound("Group not found.");
        }

        var isLeaderOrCoLeader = request.CurrentMemberId.HasValue &&
            await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                request.GroupId,
                request.CurrentMemberId.Value,
                cancellationToken);

        var isApproved = request.CurrentMemberId.HasValue &&
            await groupAuthorizationService.IsApprovedMemberAsync(
                request.GroupId,
                request.CurrentMemberId.Value,
                cancellationToken);

        // Subgroup pages are members-only regardless of page visibility.
        if (!group.IsChurch && !isApproved)
        {
            return AppResult<IReadOnlyList<PageDto>>.Forbidden("You do not have access to this group's pages.");
        }

        var pages = await pageReadService.GetGroupPagesAsync(request.GroupId, cancellationToken);

        if (isLeaderOrCoLeader)
        {
            return AppResult<IReadOnlyList<PageDto>>.Success(pages);
        }

        if (isApproved)
        {
            return AppResult<IReadOnlyList<PageDto>>.Success(pages);
        }

        if (group.IsChurch)
        {
            pages = pages
                .Where(x => x.Visibility == PageVisibility.Public)
                .ToList();

            return AppResult<IReadOnlyList<PageDto>>.Success(pages);
        }

        return AppResult<IReadOnlyList<PageDto>>.Forbidden("You do not have access to this group's pages.");
    }
}
