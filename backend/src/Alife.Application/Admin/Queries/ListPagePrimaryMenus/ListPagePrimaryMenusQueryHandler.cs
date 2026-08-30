using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Admin.Queries.ListPagePrimaryMenus;

public sealed class ListPagePrimaryMenusQueryHandler(IAlifeDbContext dbContext)
    : IRequestHandler<ListPagePrimaryMenusQuery, AppResult<IReadOnlyList<AdminPagePrimaryMenuDto>>>
{
    public async Task<AppResult<IReadOnlyList<AdminPagePrimaryMenuDto>>> Handle(
        ListPagePrimaryMenusQuery request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.CanReviewPagesAsync(dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<IReadOnlyList<AdminPagePrimaryMenuDto>>.Forbidden("Page reviewer access is required.");
        }

        var rows = await dbContext.PagePrimaryMenus
            .AsNoTracking()
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .Select(x => new
            {
                x.Id,
                x.NameJson,
                x.SortOrder,
                x.HomePlacement,
                ApprovedPageCount = x.PublicationReviews.Count(review =>
                    review.PublishedSnapshotJson != null || review.Status == PagePublicationReviewStatus.Approved)
            })
            .ToListAsync(cancellationToken);

        return AppResult<IReadOnlyList<AdminPagePrimaryMenuDto>>.Success(rows
            .Select(x => new AdminPagePrimaryMenuDto(x.Id, PagePrimaryMenuText.Read(x.NameJson), x.SortOrder, x.ApprovedPageCount, x.HomePlacement))
            .ToList());
    }
}
