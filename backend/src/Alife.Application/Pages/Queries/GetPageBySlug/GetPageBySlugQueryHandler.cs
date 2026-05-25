using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Pages.Queries.GetPageById;

public sealed class GetPageByIdQueryHandler(
    IPageReadService pageReadService,
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

        var isApproved = await groupAuthorizationService.IsApprovedMemberAsync(
            page.OwnerGroupId.Value,
            request.CurrentMemberId,
            cancellationToken);

        var isPrivileged = page.CreatedByMemberId == request.CurrentMemberId ||
                           await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                               page.OwnerGroupId.Value,
                               request.CurrentMemberId,
                               cancellationToken);

        var canView = (isApproved && page.Visibility != PageVisibility.InvisibleDraft) || isPrivileged;
        return canView
            ? AppResult<PageDetailDto>.Success(page)
            : AppResult<PageDetailDto>.Forbidden("You do not have access to this page.");
    }
}
