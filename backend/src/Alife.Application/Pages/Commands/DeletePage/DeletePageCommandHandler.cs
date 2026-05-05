using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Common.Sync;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Dtos;
using Alife.Application.Pages.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Pages.Commands.DeletePage;

public sealed class DeletePageCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IPageCacheInvalidationService pageCacheInvalidationService,
    ISyncNotificationService syncNotificationService)
    : IRequestHandler<DeletePageCommand, AppResult<PageActionResultDto>>
{
    public async Task<AppResult<PageActionResultDto>> Handle(DeletePageCommand request, CancellationToken cancellationToken)
    {
        var page = await dbContext.Pages.FirstOrDefaultAsync(x => x.Id == request.PageId, cancellationToken);
        if (page is null)
        {
            return AppResult<PageActionResultDto>.NotFound("Page was not found.");
        }

        var isCreatorDraft = page.CreatedByMemberId == request.CurrentMemberId &&
                             page.Visibility == PageVisibility.InvisibleDraft;
        var canDelete = page.Scope == PageScope.Group &&
                        page.OwnerGroupId.HasValue &&
                        await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                            page.OwnerGroupId.Value,
                            request.CurrentMemberId,
                            cancellationToken);

        if (!isCreatorDraft && !canDelete)
        {
            return AppResult<PageActionResultDto>.Forbidden("You do not have permission to delete this page.");
        }

        dbContext.Pages.Remove(page);
        await dbContext.SaveChangesAsync(cancellationToken);

        await pageCacheInvalidationService.RemoveBySlugAsync(page.Slug, page.Language, cancellationToken);
        if (page.Scope == PageScope.Global)
        {
            await pageCacheInvalidationService.RemoveGlobalAsync(page.Language, cancellationToken);
        }
        else if (page.OwnerGroupId.HasValue)
        {
            await pageCacheInvalidationService.RemoveGroupPagesAsync(page.OwnerGroupId.Value, page.Language, cancellationToken);
        }
        await syncNotificationService.PublishAsync(
            new SyncEntityChange(
                "page",
                page.Id.ToString("N"),
                null,
                GetVersionKeys(page),
                await GetRecipientIdsAsync(page, request.CurrentMemberId, cancellationToken)),
            cancellationToken);

        return AppResult<PageActionResultDto>.Success(new PageActionResultDto(true));
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
            keys.Add(SyncKeys.GroupTree(page.OwnerGroupId.Value));
        }

        return keys;
    }

    private async Task<IReadOnlyCollection<Guid>> GetRecipientIdsAsync(
        Domain.Entities.Page page,
        Guid currentMemberId,
        CancellationToken cancellationToken)
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
            return [currentMemberId];
        }

        return await dbContext.GroupMemberships
            .Where(x => x.GroupId == groupId && x.Status == MembershipStatus.Approved)
            .Select(x => x.MemberId)
            .Distinct()
            .ToArrayAsync(cancellationToken);
    }
}
