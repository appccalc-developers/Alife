using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Admin.Commands.DeletePagePrimaryMenu;

public sealed class DeletePagePrimaryMenuCommandHandler(
    IAlifeDbContext dbContext,
    IPageCacheInvalidationService pageCacheInvalidationService)
    : IRequestHandler<DeletePagePrimaryMenuCommand, AppResult<AdminActionResultDto>>
{
    public async Task<AppResult<AdminActionResultDto>> Handle(
        DeletePagePrimaryMenuCommand request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.CanReviewPagesAsync(dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<AdminActionResultDto>.Forbidden("Page reviewer access is required.");
        }

        var menu = await dbContext.PagePrimaryMenus.FirstOrDefaultAsync(x => x.Id == request.PrimaryMenuId, cancellationToken);
        if (menu is null)
        {
            return AppResult<AdminActionResultDto>.NotFound("Primary menu was not found.");
        }

        var relatedReviews = await dbContext.PagePublicationReviews
            .Where(x => x.PrimaryMenuId == menu.Id)
            .ToListAsync(cancellationToken);
        if (relatedReviews.Any(x =>
                x.PublishedSnapshotJson is not null ||
                x.Status == Domain.Enums.PagePublicationReviewStatus.Approved))
        {
            return AppResult<AdminActionResultDto>.Conflict("Only an empty primary menu can be deleted.");
        }

        relatedReviews.ForEach(review =>
        {
            review.PrimaryMenuId = null;
            review.PrimaryMenuNameJson = null;
            review.MenuSortOrder = 0;
        });

        var now = DateTime.UtcNow;
        dbContext.PagePrimaryMenus.Remove(menu);
        var remainingMenus = await dbContext.PagePrimaryMenus
            .Where(x => x.Id != menu.Id)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);
        for (var index = 0; index < remainingMenus.Count; index++)
        {
            remainingMenus[index].SortOrder = index;
            remainingMenus[index].UpdatedUtc = now;
        }

        await dbContext.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = PagePublicationReviewActions.PrimaryMenuDelete,
            EntityType = "page_primary_menu",
            EntityId = menu.Id,
            BeforeJson = JsonSerializer.Serialize(new { name = PagePrimaryMenuText.Read(menu.NameJson), menu.SortOrder, menu.HomePlacement }),
            OccurredUtc = now
        }, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
        await pageCacheInvalidationService.RemovePublicAsync(cancellationToken);
        return AppResult<AdminActionResultDto>.Success(new AdminActionResultDto(true));
    }
}
