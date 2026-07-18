using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Pages.Services;
using MediatR;

namespace Alife.Application.Admin.Commands.RefreshPublicPagesCache;

public sealed class RefreshPublicPagesCacheCommandHandler(
    IAlifeDbContext dbContext,
    IPageCacheInvalidationService pageCacheInvalidationService)
    : IRequestHandler<RefreshPublicPagesCacheCommand, AppResult<AdminActionResultDto>>
{
    public async Task<AppResult<AdminActionResultDto>> Handle(
        RefreshPublicPagesCacheCommand request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.CanReviewPagesAsync(
                dbContext,
                request.CurrentMemberId,
                cancellationToken))
        {
            return AppResult<AdminActionResultDto>.Forbidden("Page reviewer access is required.");
        }

        await pageCacheInvalidationService.RemovePublicAsync(cancellationToken);
        return AppResult<AdminActionResultDto>.Success(new AdminActionResultDto(true));
    }
}
