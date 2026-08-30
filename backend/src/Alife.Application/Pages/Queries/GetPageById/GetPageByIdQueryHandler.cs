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

        if (request.AllowPublishedFallback && page.Visibility == PageVisibility.Public)
        {
            var publishedPage = await pageReadService.GetPublishedByIdAsync(page.Id, cancellationToken);
            return publishedPage is null
                ? AppResult<PageDetailDto>.Forbidden("This page does not have a published version.")
                : AppResult<PageDetailDto>.Success(publishedPage);
        }

        var isApproved = request.CurrentMemberId.HasValue &&
            await groupAuthorizationService.IsApprovedMemberAsync(
                page.OwnerGroupId,
                request.CurrentMemberId.Value,
                cancellationToken);

        var isCreator = request.CurrentMemberId.HasValue &&
                        page.CreatedByMemberId == request.CurrentMemberId.Value;

        var isPrivileged = request.CurrentMemberId.HasValue &&
                           await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                               page.OwnerGroupId,
                               request.CurrentMemberId.Value,
                               cancellationToken);

        var canView = (isApproved && page.Visibility != PageVisibility.Draft) ||
                      isCreator ||
                      isPrivileged;
        if (canView)
        {
            return AppResult<PageDetailDto>.Success(page);
        }

        return AppResult<PageDetailDto>.Forbidden("You do not have access to this page.");
    }
}
