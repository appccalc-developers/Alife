using Alife.Application.Pages.Services;
using Microsoft.Extensions.Caching.Hybrid;

namespace Alife.Infrastructure.ReadServices;

public sealed class PageCacheInvalidationService(HybridCache hybridCache) : IPageCacheInvalidationService
{
    public Task RemoveGlobalAsync(CancellationToken cancellationToken = default)
        => hybridCache.RemoveAsync(PageCacheKeys.Global(), cancellationToken).AsTask();

    public Task RemoveDetailAsync(Guid pageId, CancellationToken cancellationToken = default)
        => hybridCache.RemoveAsync(PageCacheKeys.Detail(pageId), cancellationToken).AsTask();

    public Task RemoveGroupPagesAsync(Guid groupId, CancellationToken cancellationToken = default)
        => hybridCache.RemoveAsync(PageCacheKeys.GroupPages(groupId), cancellationToken).AsTask();
}
