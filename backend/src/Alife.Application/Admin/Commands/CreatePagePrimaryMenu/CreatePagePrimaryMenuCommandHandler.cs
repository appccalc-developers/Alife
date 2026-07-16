using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Admin.Commands.CreatePagePrimaryMenu;

public sealed class CreatePagePrimaryMenuCommandHandler(
    IAlifeDbContext dbContext,
    IPageCacheInvalidationService pageCacheInvalidationService)
    : IRequestHandler<CreatePagePrimaryMenuCommand, AppResult<AdminPagePrimaryMenuDto>>
{
    public async Task<AppResult<AdminPagePrimaryMenuDto>> Handle(
        CreatePagePrimaryMenuCommand request,
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

        var nameJson = PagePrimaryMenuText.Write(name);
        if (await dbContext.PagePrimaryMenus.AnyAsync(x => x.NameJson == nameJson, cancellationToken))
        {
            return AppResult<AdminPagePrimaryMenuDto>.Validation("A primary menu with these names already exists.");
        }

        if (request.HomePlacement is not null &&
            await dbContext.PagePrimaryMenus.AnyAsync(x => x.HomePlacement == request.HomePlacement, cancellationToken))
        {
            return AppResult<AdminPagePrimaryMenuDto>.Conflict("This home page placement is already assigned to another primary menu.");
        }

        var now = DateTime.UtcNow;
        var sortOrder = (await dbContext.PagePrimaryMenus
            .Select(x => (int?)x.SortOrder)
            .MaxAsync(cancellationToken) ?? -1) + 1;
        var menu = new PagePrimaryMenu
        {
            Id = Guid.NewGuid(),
            NameJson = nameJson,
            SortOrder = sortOrder,
            HomePlacement = request.HomePlacement,
            CreatedUtc = now,
            UpdatedUtc = now
        };

        await dbContext.PagePrimaryMenus.AddAsync(menu, cancellationToken);
        await dbContext.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = PagePublicationReviewActions.PrimaryMenuCreate,
            EntityType = "page_primary_menu",
            EntityId = menu.Id,
            AfterJson = JsonSerializer.Serialize(new { name, menu.SortOrder, menu.HomePlacement }),
            OccurredUtc = now
        }, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
        await pageCacheInvalidationService.RemovePublicAsync(cancellationToken);
        return AppResult<AdminPagePrimaryMenuDto>.Success(new AdminPagePrimaryMenuDto(menu.Id, name, menu.SortOrder, 0, menu.HomePlacement));
    }
}
