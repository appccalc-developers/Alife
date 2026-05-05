using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Common.Sync;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Pages.Commands.PublishPage;

public sealed class PublishPageCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IPageCacheInvalidationService pageCacheInvalidationService,
    ISyncNotificationService syncNotificationService)
    : IRequestHandler<PublishPageCommand, AppResult<PageActionResultDto>>
{
    public async Task<AppResult<PageActionResultDto>> Handle(PublishPageCommand request, CancellationToken cancellationToken)
    {
        var page = await dbContext.Pages.FirstOrDefaultAsync(x => x.Id == request.PageId, cancellationToken);
        if (page is null)
        {
            return AppResult<PageActionResultDto>.NotFound("Page was not found.");
        }

        if (page.Scope == PageScope.Global)
        {
            if (!await groupAuthorizationService.IsAdminAsync(request.CurrentMemberId, cancellationToken))
            {
                return AppResult<PageActionResultDto>.Forbidden("You do not have permission to publish this page.");
            }
        }
        else if (page.OwnerGroupId is null ||
                 !await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                     page.OwnerGroupId.Value,
                     request.CurrentMemberId,
                     cancellationToken))
        {
            return AppResult<PageActionResultDto>.Forbidden("You do not have permission to publish this page.");
        }

        page.Visibility = request.Visibility;
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

        return AppResult<PageActionResultDto>.Success(new PageActionResultDto(true));
    }

    private async Task InvalidatePageAsync(Domain.Entities.Page page, CancellationToken cancellationToken)
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

    private static IReadOnlyCollection<string> GetVersionKeys(Domain.Entities.Page page)
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

    private async Task<IReadOnlyCollection<Guid>> GetRecipientIdsAsync(Domain.Entities.Page page, CancellationToken cancellationToken)
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
}
