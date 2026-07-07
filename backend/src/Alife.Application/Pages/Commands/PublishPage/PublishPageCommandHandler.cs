using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Pages.Commands.PublishPage;

public sealed class PublishPageCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IPageCacheInvalidationService pageCacheInvalidationService)
    : IRequestHandler<PublishPageCommand, AppResult<PageDto>>
{
    public async Task<AppResult<PageDto>> Handle(PublishPageCommand request, CancellationToken cancellationToken)
    {
        var page = await dbContext.Pages.FirstOrDefaultAsync(x => x.Id == request.PageId, cancellationToken);
        if (page is null)
        {
            return AppResult<PageDto>.NotFound("Page was not found.");
        }

        var canReviewPages = await groupAuthorizationService.CanReviewPagesAsync(request.CurrentMemberId, cancellationToken);

        if (page.OwnerGroupId is null)
        {
            return AppResult<PageDto>.Forbidden("Pages must belong to a group before they can be published.");
        }
        else if (!canReviewPages &&
                  !await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                     page.OwnerGroupId.Value,
                     request.CurrentMemberId,
                     cancellationToken))
        {
            return AppResult<PageDto>.Forbidden("You do not have permission to publish this page.");
        }

        page.Visibility = request.Visibility;
        page.UpdatedUtc = DateTime.UtcNow;

        if (page.Visibility == PageVisibility.Public)
        {
            await EnsurePendingReviewAsync(page.Id, cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await InvalidatePageAsync(page, cancellationToken);

        return AppResult<PageDto>.Success(ToDto(page));
    }

    private async Task EnsurePendingReviewAsync(Guid pageId, CancellationToken cancellationToken)
    {
        var review = await dbContext.PagePublicationReviews
            .FirstOrDefaultAsync(x => x.PageId == pageId, cancellationToken);
        if (review?.Status == PagePublicationReviewStatus.Approved)
        {
            return;
        }

        var now = DateTime.UtcNow;
        if (review is null)
        {
            dbContext.PagePublicationReviews.Add(new Domain.Entities.PagePublicationReview
            {
                Id = Guid.NewGuid(),
                PageId = pageId,
                Status = PagePublicationReviewStatus.Pending,
                CreatedUtc = now,
                UpdatedUtc = now
            });
            return;
        }

        review.Status = PagePublicationReviewStatus.Pending;
        review.ReturnReason = null;
        review.ReviewedByMemberId = null;
        review.ReviewedUtc = null;
        review.UpdatedUtc = now;
    }

    private async Task InvalidatePageAsync(Domain.Entities.Page page, CancellationToken cancellationToken)
    {
        await pageCacheInvalidationService.RemoveDetailAsync(page.Id, cancellationToken);

        if (page.OwnerGroupId is null)
        {
            await pageCacheInvalidationService.RemoveGlobalAsync(cancellationToken);
            return;
        }

        if (page.OwnerGroupId.HasValue)
        {
            await pageCacheInvalidationService.RemoveGroupPagesAsync(page.OwnerGroupId.Value, cancellationToken);
            await pageCacheInvalidationService.RemoveGlobalAsync(cancellationToken);
        }
    }

    private static PageDto ToDto(Domain.Entities.Page page)
        => new(
            page.Id,
            page.OwnerGroupId,
            page.CreatedByMemberId,
            ReadTextMap(page.TitleJson),
            ReadTextMap(page.DescriptionJson),
            page.TagsJson,
            page.TitleDisplayStyle,
            page.Visibility,
            page.UpdatedUtc);

    private static IReadOnlyDictionary<string, string> ReadTextMap(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? new Dictionary<string, string>()
            : JsonSerializer.Deserialize<Dictionary<string, string>>(value) ?? new Dictionary<string, string>();
}
