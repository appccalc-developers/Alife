using Alife.Application.Events.Services;
using Microsoft.Extensions.Caching.Hybrid;

namespace Alife.Infrastructure.ReadServices;

public sealed class EventCacheInvalidationService(HybridCache hybridCache) : IEventCacheInvalidationService
{
    public Task RemoveGroupEventsAsync(Guid groupId, CancellationToken cancellationToken = default)
        => hybridCache.RemoveAsync(EventCacheKeys.GroupEvents(groupId), cancellationToken).AsTask();
}
