using Alife.Application.Sermons.Services;
using Microsoft.Extensions.Caching.Hybrid;

namespace Alife.Infrastructure.ReadServices;

public sealed class SermonCacheInvalidationService(HybridCache hybridCache) : ISermonCacheInvalidationService
{
    public Task RemoveAllAsync(CancellationToken cancellationToken = default)
        => hybridCache.RemoveAsync(SermonCacheKeys.All(), cancellationToken).AsTask();
}
