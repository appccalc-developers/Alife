using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Admin.Commands.UpdatePagePrimaryMenu;

public sealed class UpdatePagePrimaryMenuCommandHandler(
    IAlifeDbContext dbContext,
    IPageCacheInvalidationService pageCacheInvalidationService)
    : IRequestHandler<UpdatePagePrimaryMenuCommand, AppResult<AdminPagePrimaryMenuDto>>
{
    public async Task<AppResult<AdminPagePrimaryMenuDto>> Handle(
        UpdatePagePrimaryMenuCommand request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.CanReviewPagesAsync(dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<AdminPagePrimaryMenuDto>.Forbidden("Page reviewer access is required.");
        }

        var name = PagePrimaryMenuText.Normalize(request.Name);
        if (name is null)
        {
            return AppResult<AdminPagePrimaryMenuDto>.Validation("English and Chinese primary menu names are required.");
        }

        var menu = await dbContext.PagePrimaryMenus.FirstOrDefaultAsync(x => x.Id == request.PrimaryMenuId, cancellationToken);
        if (menu is null)
        {
            return AppResult<AdminPagePrimaryMenuDto>.NotFound("Primary menu was not found.");
        }

        var nameJson = PagePrimaryMenuText.Write(name);
        if (await dbContext.PagePrimaryMenus.AnyAsync(x => x.Id != menu.Id && x.NameJson == nameJson, cancellationToken))
        {
            return AppResult<AdminPagePrimaryMenuDto>.Validation("A primary menu with these names already exists.");
        }

        if (request.HomePlacement is not null &&
            await dbContext.PagePrimaryMenus.AnyAsync(
                x => x.Id != menu.Id && x.HomePlacement == request.HomePlacement,
                cancellationToken))
        {
            return AppResult<AdminPagePrimaryMenuDto>.Conflict("This home page placement is already assigned to another primary menu.");
        }

        var beforeNameJson = menu.NameJson;
        var beforeHomePlacement = menu.HomePlacement;
        var now = DateTime.UtcNow;
        menu.NameJson = nameJson;
        menu.HomePlacement = request.HomePlacement;
        menu.UpdatedUtc = now;
        var reviews = await dbContext.PagePublicationReviews
            .Where(x => x.PrimaryMenuId == menu.Id)
            .ToListAsync(cancellationToken);
        reviews.ForEach(review =>
        {
            review.PrimaryMenuNameJson = nameJson;
            review.UpdatedUtc = now;
        });

        await dbContext.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = PagePublicationReviewActions.PrimaryMenuUpdate,
            EntityType = "page_primary_menu",
            EntityId = menu.Id,
            BeforeJson = JsonSerializer.Serialize(new { name = PagePrimaryMenuText.Read(beforeNameJson), menu.SortOrder, homePlacement = beforeHomePlacement }),
            AfterJson = JsonSerializer.Serialize(new { name, menu.SortOrder, menu.HomePlacement }),
            OccurredUtc = now
        }, cancellationToken);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return AppResult<AdminPagePrimaryMenuDto>.Conflict(PagePublicationReviewState.ConcurrentChangeMessage);
        }
        await pageCacheInvalidationService.RemovePublicAsync(cancellationToken);

        var approvedPageCount = reviews.Count(x =>
            x.PublishedSnapshotJson is not null || x.Status == PagePublicationReviewStatus.Approved);
        return AppResult<AdminPagePrimaryMenuDto>.Success(new AdminPagePrimaryMenuDto(menu.Id, name, menu.SortOrder, approvedPageCount, menu.HomePlacement));
    }
}
