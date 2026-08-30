using Alife.Application.Common.Interfaces;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Pages.Services;

public static class PagePublicationReviewState
{
    public const string ConcurrentChangeMessage =
        "The publication copy changed while this request was being saved. Reload and try again.";

    public static async Task SubmitCopyIfPublicAsync(
        IAlifeDbContext dbContext,
        Page page,
        Guid submittedByMemberId,
        DateTime now,
        CancellationToken cancellationToken,
        bool linksAlreadyLoaded = false)
    {
        if (page.Visibility != PageVisibility.Public)
        {
            var existingReview = await dbContext.PagePublicationReviews
                .FirstOrDefaultAsync(x => x.PageId == page.Id, cancellationToken);
            if (existingReview is not null)
            {
                existingReview.PublishedSnapshotJson = null;
                existingReview.PublishedByMemberId = null;
                existingReview.PublishedUtc = null;
                existingReview.PrimaryMenuId = null;
                existingReview.PrimaryMenuNameJson = null;
                existingReview.MenuSortOrder = 0;
                existingReview.AccessNameJson = null;
                existingReview.CardImageUrl = null;
                existingReview.CardTextJson = null;
                existingReview.UpdatedUtc = now;
            }

            return;
        }

        if (!linksAlreadyLoaded)
        {
            var activeSectionIds = page.Sections
                .Where(section => !section.IsDeleted)
                .Select(section => section.Id)
                .ToList();
            if (activeSectionIds.Count > 0)
            {
                await dbContext.Links
                    .Where(link => activeSectionIds.Contains(link.OwnerSectionId))
                    .LoadAsync(cancellationToken);
            }
        }

        var submittedSnapshotJson = PagePublicationSnapshots.Capture(page, page.Sections, now);
        var review = await dbContext.PagePublicationReviews
            .FirstOrDefaultAsync(x => x.PageId == page.Id, cancellationToken);

        if (review is null)
        {
            dbContext.PagePublicationReviews.Add(new PagePublicationReview
            {
                Id = Guid.NewGuid(),
                PageId = page.Id,
                Status = PagePublicationReviewStatus.Pending,
                SubmittedSnapshotJson = submittedSnapshotJson,
                SubmittedByMemberId = submittedByMemberId,
                SubmittedUtc = now,
                CreatedUtc = now,
                UpdatedUtc = now
            });
            return;
        }

        review.Status = PagePublicationReviewStatus.Pending;
        review.SubmittedSnapshotJson = submittedSnapshotJson;
        review.SubmittedByMemberId = submittedByMemberId;
        review.SubmittedUtc = now;
        review.ReturnReason = null;
        review.ReviewedByMemberId = null;
        review.ReviewedUtc = null;
        review.UpdatedUtc = now;
    }
}
