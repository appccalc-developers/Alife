using Alife.Application.Pages.Services;
using Microsoft.Extensions.Caching.Hybrid;

namespace Alife.Infrastructure.ReadServices;

public sealed class PageCacheInvalidationService(HybridCache hybridCache) : IPageCacheInvalidationService
{
    public Task RemoveGlobalAsync(string lang, CancellationToken cancellationToken = default)
        => hybridCache.RemoveAsync(PageCacheKeys.Global(lang), cancellationToken).AsTask();

    public Task RemoveBySlugAsync(string slug, string lang, CancellationToken cancellationToken = default)
        => hybridCache.RemoveAsync(PageCacheKeys.BySlug(slug, lang), cancellationToken).AsTask();

    public Task RemoveGroupPagesAsync(Guid groupId, string lang, CancellationToken cancellationToken = default)
        => hybridCache.RemoveAsync(PageCacheKeys.GroupPages(groupId, lang), cancellationToken).AsTask();
}
