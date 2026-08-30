using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Admin.Commands.SavePageMenuLayout;

public sealed class SavePageMenuLayoutCommandHandler(
    IAlifeDbContext dbContext,
    IPageCacheInvalidationService pageCacheInvalidationService)
    : IRequestHandler<SavePageMenuLayoutCommand, AppResult<AdminActionResultDto>>
{
    public async Task<AppResult<AdminActionResultDto>> Handle(
        SavePageMenuLayoutCommand request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.CanReviewPagesAsync(dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<AdminActionResultDto>.Forbidden("Page reviewer access is required.");
        }

        var menus = await dbContext.PagePrimaryMenus
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);
        var publishedReviews = await (
            from review in dbContext.PagePublicationReviews
            join page in dbContext.Pages on review.PageId equals page.Id
            where (review.PublishedSnapshotJson != null || review.Status == PagePublicationReviewStatus.Approved) &&
                  page.Visibility == PageVisibility.Public
            select review)
            .ToListAsync(cancellationToken);

        var requestedMenuIds = request.Menus.Select(x => x.PrimaryMenuId).ToList();
        if (requestedMenuIds.Count != requestedMenuIds.Distinct().Count() ||
            !requestedMenuIds.ToHashSet().SetEquals(menus.Select(x => x.Id)))
        {
            return AppResult<AdminActionResultDto>.Conflict("The primary menu layout is stale. Refresh and try again.");
        }

        var requestedPageIds = request.Menus.SelectMany(x => x.PageIds).ToList();
        if (requestedPageIds.Count != requestedPageIds.Distinct().Count() ||
            !requestedPageIds.ToHashSet().SetEquals(publishedReviews.Select(x => x.PageId)))
        {
            return AppResult<AdminActionResultDto>.Conflict("The approved page layout is stale. Refresh and try again.");
        }

        var menusById = menus.ToDictionary(x => x.Id);
        var reviewsByPageId = publishedReviews.ToDictionary(x => x.PageId);
        var before = menus
            .OrderBy(menu => menu.SortOrder)
            .ThenBy(menu => menu.Id)
            .Select(menu => new
        {
            PrimaryMenuId = menu.Id,
            PageIds = publishedReviews
                .Where(review => review.PrimaryMenuId == menu.Id)
                .OrderBy(review => review.MenuSortOrder)
                .Select(review => review.PageId)
                .ToList()
        }).ToList();
        var now = DateTime.UtcNow;

        for (var menuIndex = 0; menuIndex < request.Menus.Count; menuIndex++)
        {
            var layoutMenu = request.Menus[menuIndex];
            var menu = menusById[layoutMenu.PrimaryMenuId];
            menu.SortOrder = menuIndex;
            menu.UpdatedUtc = now;

            for (var pageIndex = 0; pageIndex < layoutMenu.PageIds.Count; pageIndex++)
            {
                var review = reviewsByPageId[layoutMenu.PageIds[pageIndex]];
                review.PrimaryMenuId = menu.Id;
                review.PrimaryMenuNameJson = menu.NameJson;
                review.MenuSortOrder = pageIndex;
                review.UpdatedUtc = now;
            }
        }

        await dbContext.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = PagePublicationReviewActions.MenuLayoutUpdate,
            EntityType = "page_menu_layout",
            BeforeJson = JsonSerializer.Serialize(before),
            AfterJson = JsonSerializer.Serialize(request.Menus),
            OccurredUtc = now
        }, cancellationToken);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return AppResult<AdminActionResultDto>.Conflict(PagePublicationReviewState.ConcurrentChangeMessage);
        }
        await pageCacheInvalidationService.RemovePublicAsync(cancellationToken);
        return AppResult<AdminActionResultDto>.Success(new AdminActionResultDto(true));
    }
}
