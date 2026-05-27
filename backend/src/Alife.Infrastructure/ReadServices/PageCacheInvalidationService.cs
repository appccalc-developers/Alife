using Alife.Application.Common.Interfaces;
using Alife.Application.Pages.Services;
using Microsoft.Extensions.Caching.Hybrid;

namespace Alife.Infrastructure.ReadServices;

public sealed class PageCacheInvalidationService(
    HybridCache hybridCache,
    ICloudflareKvCacheService cloudflareKvCacheService) : IPageCacheInvalidationService
{
    public Task RemoveGlobalAsync(CancellationToken cancellationToken = default)
        => hybridCache.RemoveAsync(PageCacheKeys.Global(), cancellationToken).AsTask();

    public Task RemoveDetailAsync(Guid pageId, CancellationToken cancellationToken = default)
        => Task.WhenAll(
            hybridCache.RemoveAsync(PageCacheKeys.Detail(pageId), cancellationToken).AsTask(),
            cloudflareKvCacheService.RemoveApiCacheAsync($"/api/pages/{pageId}", cancellationToken),
            cloudflareKvCacheService.RemoveApiCacheKeyAsync($"map:page:{pageId}:group", cancellationToken),
            cloudflareKvCacheService.RemoveApiCacheKeyAsync($"map:page:{pageId}:meta", cancellationToken));

    public Task RemoveGroupPagesAsync(Guid groupId, CancellationToken cancellationToken = default)
        => Task.WhenAll(
            hybridCache.RemoveAsync(PageCacheKeys.GroupPages(groupId), cancellationToken).AsTask(),
            cloudflareKvCacheService.RemoveApiCacheAsync($"/api/groups/{groupId}/pages", cancellationToken));
}
