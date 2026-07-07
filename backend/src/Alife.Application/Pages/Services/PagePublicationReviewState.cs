using Alife.Application.Common.Interfaces;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Pages.Services;

public static class PagePublicationReviewState
{
    public static async Task MarkPendingIfPublicAsync(
        IAlifeDbContext dbContext,
        Page page,
        DateTime now,
        CancellationToken cancellationToken)
    {
        if (page.Visibility != PageVisibility.Public)
        {
            return;
        }

        var review = await dbContext.PagePublicationReviews
            .FirstOrDefaultAsync(x => x.PageId == page.Id, cancellationToken);

        if (review is null)
        {
            dbContext.PagePublicationReviews.Add(new PagePublicationReview
            {
                Id = Guid.NewGuid(),
                PageId = page.Id,
                Status = PagePublicationReviewStatus.Pending,
                CreatedUtc = now,
                UpdatedUtc = now
            });
            return;
        }

        review.Status = PagePublicationReviewStatus.Pending;
        review.AccessNameJson = null;
        review.ReturnReason = null;
        review.ReviewedByMemberId = null;
        review.ReviewedUtc = null;
        review.UpdatedUtc = now;
    }
}
