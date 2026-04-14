using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Pages.Commands.UpdatePage;

public sealed class UpdatePageCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IPageCacheInvalidationService pageCacheInvalidationService)
    : IRequestHandler<UpdatePageCommand, AppResult<PageDto>>
{
    public async Task<AppResult<PageDto>> Handle(UpdatePageCommand request, CancellationToken cancellationToken)
    {
        var page = await dbContext.Pages.FirstOrDefaultAsync(x => x.Id == request.PageId, cancellationToken);
        if (page is null)
        {
            return AppResult<PageDto>.NotFound("Page was not found.");
        }

        var canEdit = await CanEditPageAsync(page, request.CurrentMemberId, cancellationToken);
        if (!canEdit)
        {
            return AppResult<PageDto>.Forbidden("You do not have permission to edit this page.");
        }

        page.Title = request.Title;
        page.Description = request.Description;
        page.TagsJson = request.TagsJson ?? page.TagsJson;
        page.TitleDisplayStyle = request.TitleDisplayStyle ?? page.TitleDisplayStyle;
        page.UpdatedUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await InvalidatePageAsync(page, cancellationToken);

        return AppResult<PageDto>.Success(ToDto(page));
    }

    private async Task<bool> CanEditPageAsync(Page page, Guid currentMemberId, CancellationToken cancellationToken)
    {
        if (page.Scope == PageScope.Global)
        {
            return await groupAuthorizationService.IsAdminAsync(currentMemberId, cancellationToken);
        }

        if (page.OwnerGroupId is null)
        {
            return false;
        }

        if (page.CreatedByMemberId == currentMemberId && page.Visibility == PageVisibility.InvisibleDraft)
        {
            return true;
        }

        return await groupAuthorizationService.IsLeaderOrCoLeaderAsync(page.OwnerGroupId.Value, currentMemberId, cancellationToken);
    }

    private async Task InvalidatePageAsync(Page page, CancellationToken cancellationToken)
    {
        await pageCacheInvalidationService.RemoveBySlugAsync(page.Slug, page.Language, cancellationToken);

        if (page.Scope == PageScope.Global)
        {
            await pageCacheInvalidationService.RemoveGlobalAsync(page.Language, cancellationToken);
            return;
        }

        if (page.OwnerGroupId.HasValue)
        {
            await pageCacheInvalidationService.RemoveGroupPagesAsync(page.OwnerGroupId.Value, page.Language, cancellationToken);
        }
    }

    private static PageDto ToDto(Page page)
        => new(
            page.Id,
            page.Scope,
            page.OwnerGroupId,
            page.CreatedByMemberId,
            page.Title,
            page.Description,
            page.TagsJson,
            page.TitleDisplayStyle,
            page.Slug,
            page.Language,
            page.Visibility,
            page.UpdatedUtc);
}
