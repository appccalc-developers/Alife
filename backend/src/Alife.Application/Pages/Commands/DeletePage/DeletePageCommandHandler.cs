using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
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
    IPageCacheInvalidationService pageCacheInvalidationService)
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
                             page.Visibility == PageVisibility.Draft;
        var canDelete = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            page.OwnerGroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!isCreatorDraft && !canDelete)
        {
            return AppResult<PageActionResultDto>.Forbidden("You do not have permission to delete this page.");
        }

        page.IsDeleted = true;
        page.UpdatedUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        await pageCacheInvalidationService.RemoveDetailAsync(page.Id, cancellationToken);
        await pageCacheInvalidationService.RemoveGroupPagesAsync(page.OwnerGroupId, cancellationToken);

        return AppResult<PageActionResultDto>.Success(new PageActionResultDto(true));
    }
}
