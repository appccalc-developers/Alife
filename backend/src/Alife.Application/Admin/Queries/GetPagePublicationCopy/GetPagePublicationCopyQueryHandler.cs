using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Admin.Queries.GetPagePublicationCopy;

public sealed class GetPagePublicationCopyQueryHandler(IAlifeDbContext dbContext)
    : IRequestHandler<GetPagePublicationCopyQuery, AppResult<PageDetailDto>>
{
    public async Task<AppResult<PageDetailDto>> Handle(
        GetPagePublicationCopyQuery request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.CanReviewPagesAsync(dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<PageDetailDto>.Forbidden("Page reviewer access is required.");
        }

        var page = await dbContext.Pages
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.PageId, cancellationToken);
        if (page is null)
        {
            return AppResult<PageDetailDto>.NotFound("Page was not found.");
        }

        var review = await dbContext.PagePublicationReviews
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.PageId == page.Id, cancellationToken);
        if (review is null)
        {
            return AppResult<PageDetailDto>.NotFound("A publication copy has not been submitted.");
        }

        var snapshotJson = review.Status == PagePublicationReviewStatus.Approved
            ? review.PublishedSnapshotJson ?? review.SubmittedSnapshotJson
            : review.SubmittedSnapshotJson;
        var snapshot = PagePublicationSnapshots.Read(snapshotJson);

        return snapshot is null
            ? AppResult<PageDetailDto>.Conflict("The submitted page copy is unavailable. Ask the group to submit it again.")
            : AppResult<PageDetailDto>.Success(PagePublicationSnapshots.ToDetailDto(snapshot));
    }
}
