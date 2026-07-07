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

        var canReviewPage = request.CurrentMemberId.HasValue &&
                            await groupAuthorizationService.CanReviewPagesAsync(
                                request.CurrentMemberId.Value,
                                cancellationToken);

        if (page.OwnerGroupId is null)
        {
            if (request.CurrentMemberId.HasValue &&
                (canReviewPage || await groupAuthorizationService.IsAdminAsync(request.CurrentMemberId.Value, cancellationToken)))
            {
                return AppResult<PageDetailDto>.Success(page);
            }

            return AppResult<PageDetailDto>.Forbidden("This page is not available for public access.");
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

        var canView = (isApproved && page.Visibility != PageVisibility.Draft) ||
                      isPrivileged ||
                      canReviewPage;
        if (canView)
        {
            return AppResult<PageDetailDto>.Success(page);
        }

        if (page.Visibility == PageVisibility.Public &&
            await HasCurrentGlobalApprovalAsync(page, cancellationToken))
        {
            return AppResult<PageDetailDto>.Success(page);
        }

        return AppResult<PageDetailDto>.Forbidden("You do not have access to this page.");
    }

    private Task<bool> HasCurrentGlobalApprovalAsync(PageDetailDto page, CancellationToken cancellationToken)
    {
        return dbContext.PagePublicationReviews
            .AsNoTracking()
            .AnyAsync(review =>
                review.PageId == page.Id &&
                review.Status == PagePublicationReviewStatus.Approved,
                cancellationToken);
    }
}
