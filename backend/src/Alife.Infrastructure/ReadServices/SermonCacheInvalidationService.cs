using Alife.Application.Common.Interfaces;
using Alife.Application.Sermons.Services;
using Microsoft.Extensions.Caching.Hybrid;

namespace Alife.Infrastructure.ReadServices;

public sealed class SermonCacheInvalidationService(
    HybridCache hybridCache,
    ICloudflareKvCacheService cloudflareKvCacheService) : ISermonCacheInvalidationService
{
    public Task RemoveAllAsync(CancellationToken cancellationToken = default)
        => Task.WhenAll(
            hybridCache.RemoveAsync(SermonCacheKeys.All(), cancellationToken).AsTask(),
            cloudflareKvCacheService.RemoveApiCacheAsync("/api/sermons", cancellationToken));
}
