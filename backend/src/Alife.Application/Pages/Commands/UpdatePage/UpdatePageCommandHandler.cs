using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Common.Sync;
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
    IPageCacheInvalidationService pageCacheInvalidationService,
    ISyncNotificationService syncNotificationService)
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
        await syncNotificationService.PublishAsync(
            new SyncEntityChange(
                "page",
                page.Id.ToString("N"),
                $"/api/pages/{Uri.EscapeDataString(page.Slug)}?lang={Uri.EscapeDataString(page.Language)}",
                GetVersionKeys(page),
                await GetRecipientIdsAsync(page, cancellationToken)),
            cancellationToken);

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

    private static IReadOnlyCollection<string> GetVersionKeys(Page page)
    {
        var keys = new List<string>
        {
            SyncKeys.Page(page.Id),
            SyncKeys.PageSlug(page.Slug, page.Language)
        };

        if (page.Scope == PageScope.Global)
        {
            keys.Add(SyncKeys.GlobalPages(page.Language));
        }
        else if (page.OwnerGroupId.HasValue)
        {
            keys.Add(SyncKeys.GroupPages(page.OwnerGroupId.Value, page.Language));
        }

        return keys;
    }

    private async Task<IReadOnlyCollection<Guid>> GetRecipientIdsAsync(Page page, CancellationToken cancellationToken)
    {
        if (page.Scope == PageScope.Global)
        {
            return await dbContext.Members
                .Where(x => x.IsRegistered)
                .Select(x => x.Id)
                .ToArrayAsync(cancellationToken);
        }

        if (page.OwnerGroupId is not Guid groupId)
        {
            return [page.CreatedByMemberId];
        }

        return await dbContext.GroupMemberships
            .Where(x => x.GroupId == groupId && x.Status == MembershipStatus.Approved)
            .Select(x => x.MemberId)
            .Distinct()
            .ToArrayAsync(cancellationToken);
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
