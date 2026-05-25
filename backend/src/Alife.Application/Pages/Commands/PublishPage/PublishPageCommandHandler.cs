using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
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
    IPageCacheInvalidationService pageCacheInvalidationService)
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

        return AppResult<PageActionResultDto>.Success(new PageActionResultDto(true));
    }

    private async Task InvalidatePageAsync(Domain.Entities.Page page, CancellationToken cancellationToken)
    {
        await pageCacheInvalidationService.RemoveDetailAsync(page.Id, cancellationToken);

        if (page.Scope == PageScope.Global)
        {
            await pageCacheInvalidationService.RemoveGlobalAsync(cancellationToken);
            return;
        }

        if (page.OwnerGroupId.HasValue)
        {
            await pageCacheInvalidationService.RemoveGroupPagesAsync(page.OwnerGroupId.Value, cancellationToken);
        }
    }
}
