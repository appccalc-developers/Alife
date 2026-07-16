using Alife.Application.Common.Models;
using Alife.Application.Common.Interfaces;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Pages.Queries.GetGroupPages;

public sealed class GetGroupPagesQueryHandler(
    IPageReadService pageReadService,
    IGroupReadService groupReadService,
    IGroupAuthorizationService groupAuthorizationService,
    IAlifeDbContext dbContext)
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

        var pages = await pageReadService.GetGroupPagesAsync(request.GroupId, cancellationToken);

        if (isLeaderOrCoLeader)
        {
            return AppResult<IReadOnlyList<PageDto>>.Success(await AddCurrentRefusalsAsync(pages, cancellationToken));
        }

        if (isApproved)
        {
            return AppResult<IReadOnlyList<PageDto>>.Success(await AddCurrentRefusalsAsync(pages, cancellationToken));
        }

        var publicPageIds = pages
            .Where(x => x.Visibility == PageVisibility.Public)
            .Select(x => x.Id)
            .ToList();

        if (publicPageIds.Count == 0)
        {
            return AppResult<IReadOnlyList<PageDto>>.Success([]);
        }

        var approvedPageIds = await dbContext.PagePublicationReviews
            .AsNoTracking()
            .Where(x =>
                publicPageIds.Contains(x.PageId) &&
                x.Status == PagePublicationReviewStatus.Approved)
            .Select(x => x.PageId)
            .ToListAsync(cancellationToken);
        var approved = approvedPageIds.ToHashSet();

        return AppResult<IReadOnlyList<PageDto>>.Success(pages
            .Where(x => approved.Contains(x.Id))
            .ToList());
    }

    private async Task<IReadOnlyList<PageDto>> AddCurrentRefusalsAsync(
        IReadOnlyList<PageDto> pages,
        CancellationToken cancellationToken)
    {
        if (pages.Count == 0)
        {
            return pages;
        }

        var pageIds = pages.Select(page => page.Id).ToList();

        var refusalRows = await (
            from review in dbContext.PagePublicationReviews.AsNoTracking()
            join actor in dbContext.Members.AsNoTracking()
                on review.ReviewedByMemberId equals actor.Id into actors
            from actor in actors.DefaultIfEmpty()
            where
                review.Status == PagePublicationReviewStatus.Returned &&
                pageIds.Contains(review.PageId)
            orderby review.UpdatedUtc descending
            select new
            {
                review.PageId,
                ActorMemberId = review.ReviewedByMemberId,
                ReviewerDisplayName = actor == null ? null : actor.DisplayName,
                RefusedUtc = review.ReviewedUtc ?? review.UpdatedUtc,
                Reason = review.ReturnReason ?? string.Empty
            })
            .ToListAsync(cancellationToken);

        var refusalsByPageId = refusalRows
            .GroupBy(row => row.PageId)
            .ToDictionary(
                group => group.Key,
                group =>
                {
                    var refusal = group.First();
                    return new PageReviewRefusalDto(
                        refusal.ActorMemberId ?? Guid.Empty,
                        refusal.ReviewerDisplayName,
                        refusal.RefusedUtc,
                        refusal.Reason);
                });

        return pages
            .Select(page => refusalsByPageId.TryGetValue(page.Id, out var refusal)
                ? page with { ReviewRefusal = refusal }
                : page)
            .ToList();
    }

}
