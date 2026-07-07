using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Pages.Queries.GetPageById;

public sealed class GetPageByIdQueryHandler(
    IPageReadService pageReadService,
    IGroupAuthorizationService groupAuthorizationService,
    IAlifeDbContext dbContext)
    : IRequestHandler<GetPageByIdQuery, AppResult<PageDetailDto>>
{
    public async Task<AppResult<PageDetailDto>> Handle(GetPageByIdQuery request, CancellationToken cancellationToken)
    {
        var page = await pageReadService.GetByIdAsync(request.PageId, cancellationToken);
        if (page is null)
        {
            return AppResult<PageDetailDto>.NotFound("Page was not found.");
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

        var canReviewPage = request.CurrentMemberId.HasValue &&
                            await groupAuthorizationService.CanReviewPagesAsync(
                                request.CurrentMemberId.Value,
                                cancellationToken);

        var canView = (isApproved && page.Visibility != PageVisibility.Draft) ||
                      isCreator ||
                      isPrivileged ||
                      (canReviewPage && page.Visibility == PageVisibility.Public);
        if (canView)
        {
            return AppResult<PageDetailDto>.Success(page);
        }

        if (page.Visibility == PageVisibility.Public &&
            await HasCurrentPublicationApprovalAsync(page, cancellationToken))
        {
            return AppResult<PageDetailDto>.Success(page);
        }

        return AppResult<PageDetailDto>.Forbidden("You do not have access to this page.");
    }

    private Task<bool> HasCurrentPublicationApprovalAsync(PageDetailDto page, CancellationToken cancellationToken)
    {
        return dbContext.PagePublicationReviews
            .AsNoTracking()
            .AnyAsync(review =>
                review.PageId == page.Id &&
                review.Status == PagePublicationReviewStatus.Approved,
                cancellationToken);
    }
}
