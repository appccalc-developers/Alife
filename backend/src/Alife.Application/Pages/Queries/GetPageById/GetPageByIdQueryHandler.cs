using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Pages.Queries.GetPageById;

public sealed class GetPageByIdQueryHandler(
    IPageReadService pageReadService,
    IGroupReadService groupReadService,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<GetPageByIdQuery, AppResult<PageDetailDto>>
{
    public async Task<AppResult<PageDetailDto>> Handle(GetPageByIdQuery request, CancellationToken cancellationToken)
    {
        var page = await pageReadService.GetByIdAsync(request.PageId, cancellationToken);
        if (page is null)
        {
            return AppResult<PageDetailDto>.NotFound("Page was not found.");
        }

        if (page.Scope == PageScope.Global)
        {
            return AppResult<PageDetailDto>.Success(page);
        }

        if (page.OwnerGroupId is null)
        {
            return AppResult<PageDetailDto>.Validation("Group page owner missing.");
        }

        var isApproved = request.CurrentMemberId.HasValue &&
            await groupAuthorizationService.IsApprovedMemberAsync(
                page.OwnerGroupId.Value,
                request.CurrentMemberId.Value,
                cancellationToken);

        var isPrivileged = request.CurrentMemberId.HasValue &&
                           (page.CreatedByMemberId == request.CurrentMemberId.Value ||
                            await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                                page.OwnerGroupId.Value,
                                request.CurrentMemberId.Value,
                                cancellationToken));

        var canView = (isApproved && page.Visibility != PageVisibility.Draft) || isPrivileged;
        if (canView)
        {
            return AppResult<PageDetailDto>.Success(page);
        }

        var ownerGroup = await groupReadService.GetByIdAsync(page.OwnerGroupId.Value, cancellationToken);
        if (ownerGroup?.IsChurch == true && page.Visibility == PageVisibility.Public)
        {
            return AppResult<PageDetailDto>.Success(page);
        }

        return AppResult<PageDetailDto>.Forbidden("You do not have access to this page.");
    }
}
