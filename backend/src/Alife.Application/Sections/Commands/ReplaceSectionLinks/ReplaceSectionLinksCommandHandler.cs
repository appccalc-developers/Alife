using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Services;
using Alife.Application.Sections.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Sections.Commands.ReplaceSectionLinks;

public sealed class ReplaceSectionLinksCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IPageCacheInvalidationService pageCacheInvalidationService)
    : IRequestHandler<ReplaceSectionLinksCommand, AppResult<IReadOnlyList<LinkDto>>>
{
    public async Task<AppResult<IReadOnlyList<LinkDto>>> Handle(
        ReplaceSectionLinksCommand request,
        CancellationToken cancellationToken)
    {
        var section = await dbContext.Sections
            .Include(x => x.Page)
            .FirstOrDefaultAsync(x => x.Id == request.SectionId, cancellationToken);

        if (section is null)
        {
            return AppResult<IReadOnlyList<LinkDto>>.NotFound("Section was not found.");
        }

        var allowed = section.Page.CreatedByMemberId == request.CurrentMemberId &&
                      section.Page.Visibility == PageVisibility.Draft;

        if (!allowed)
        {
            allowed = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                section.Page.OwnerGroupId,
                request.CurrentMemberId,
                cancellationToken);
        }

        if (!allowed)
        {
            return AppResult<IReadOnlyList<LinkDto>>.Forbidden("You do not have permission to edit this section.");
        }

        var existing = await dbContext.Links.Where(x => x.OwnerSectionId == request.SectionId).ToListAsync(cancellationToken);
        dbContext.Links.RemoveRange(existing);

        var links = request.Links.Select(x => new Link
        {
            Id = Guid.NewGuid(),
            OwnerSectionId = request.SectionId,
            Type = x.Type,
            TargetGroupId = x.TargetGroupId,
            TargetPageId = x.TargetPageId,
            Title = x.Title,
            ImageUrl = x.ImageUrl,
            SortOrder = x.SortOrder
        }).ToList();

        await dbContext.Links.AddRangeAsync(links, cancellationToken);
        var now = DateTime.UtcNow;
        section.Page.UpdatedUtc = now;
        await PagePublicationReviewState.MarkPendingIfPublicAsync(dbContext, section.Page, now, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        await pageCacheInvalidationService.RemoveDetailAsync(section.Page.Id, cancellationToken);
        await pageCacheInvalidationService.RemoveGroupPagesAsync(section.Page.OwnerGroupId, cancellationToken);

        return AppResult<IReadOnlyList<LinkDto>>.Success(links
            .Select(x => new LinkDto(
                x.Id,
                x.OwnerSectionId,
                x.Type,
                x.TargetGroupId,
                x.TargetPageId,
                x.Title,
                x.ImageUrl,
                x.SortOrder))
            .ToList());
    }
}
