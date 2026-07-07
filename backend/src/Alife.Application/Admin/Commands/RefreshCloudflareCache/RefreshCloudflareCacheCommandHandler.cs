using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Application.Pages.Services;
using Alife.Application.Sermons.Services;
using MediatR;

namespace Alife.Application.Admin.Commands.RefreshCloudflareCache;

public sealed class RefreshCloudflareCacheCommandHandler(
    IAlifeDbContext dbContext,
    IGroupReadService groupReadService,
    IGroupCacheInvalidationService groupCacheInvalidationService,
    IPageCacheInvalidationService pageCacheInvalidationService,
    IEventCacheInvalidationService eventCacheInvalidationService,
    ISermonCacheInvalidationService sermonCacheInvalidationService)
    : IRequestHandler<RefreshCloudflareCacheCommand, AppResult<AdminActionResultDto>>
{
    public async Task<AppResult<AdminActionResultDto>> Handle(
        RefreshCloudflareCacheCommand request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.HasPermissionAsync(
                dbContext,
                request.CurrentMemberId,
                AdminPermissionCatalog.RefreshCloudflareCache,
                cancellationToken))
        {
            return AppResult<AdminActionResultDto>.Forbidden("You do not have permission to refresh Cloudflare cache.");
        }

        var group = await groupReadService.GetByIdAsync(request.GroupId, cancellationToken);
        if (group is null)
        {
            return AppResult<AdminActionResultDto>.NotFound("Group was not found.");
        }

        if (!group.IsChurch)
        {
            return AppResult<AdminActionResultDto>.Validation("Cloudflare cache refresh is only available for the church group.");
        }

        await Task.WhenAll(
            groupCacheInvalidationService.RemoveChurchAsync(cancellationToken),
            groupCacheInvalidationService.RemoveGroupAsync(request.GroupId, cancellationToken),
            groupCacheInvalidationService.RemoveSubgroupsAsync(request.GroupId, cancellationToken),
            groupCacheInvalidationService.RemoveMembershipsAsync(request.GroupId, cancellationToken),
            pageCacheInvalidationService.RemovePublicAsync(cancellationToken),
            pageCacheInvalidationService.RemoveGroupPagesAsync(request.GroupId, cancellationToken),
            eventCacheInvalidationService.RemoveGroupEventsAsync(request.GroupId, cancellationToken),
            sermonCacheInvalidationService.RemoveAllAsync(cancellationToken));

        return AppResult<AdminActionResultDto>.Success(new AdminActionResultDto(true));
    }
}
