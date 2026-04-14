using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Pages.Queries.GetPageBySlug;

public sealed class GetPageBySlugQueryHandler(
    IPageReadService pageReadService,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<GetPageBySlugQuery, AppResult<PageDto>>
{
    public async Task<AppResult<PageDto>> Handle(GetPageBySlugQuery request, CancellationToken cancellationToken)
    {
        var page = await pageReadService.GetBySlugAsync(request.Slug, request.Language, cancellationToken);
        if (page is null)
        {
            return AppResult<PageDto>.NotFound("Page was not found.");
        }

        if (page.Scope == PageScope.Global)
        {
            return AppResult<PageDto>.Success(page);
        }

        if (page.OwnerGroupId is null)
        {
            return AppResult<PageDto>.Validation("Group page owner missing.");
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
            ? AppResult<PageDto>.Success(page)
            : AppResult<PageDto>.Forbidden("You do not have access to this page.");
    }
}
