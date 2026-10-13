using Alife.Application.Common.Interfaces;
using Alife.Application.Events.Services;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.Configuration;

namespace Alife.Infrastructure.ReadServices;

public sealed class EventCacheInvalidationService(
    HybridCache hybridCache,
    ICloudflareKvCacheService cloudflareKvCacheService,
    IConfiguration? configuration = null) : IEventCacheInvalidationService
{
    private readonly string? eventDataEpoch = configuration?["EVENT_DATA_EPOCH"];
    private readonly bool requireEventDataEpoch = string.Equals(
        configuration?["EVENT_RUNTIME_ENVIRONMENT"]?.Trim(),
        "production",
        StringComparison.OrdinalIgnoreCase);

    public Task RemoveGroupEventsAsync(Guid groupId, CancellationToken cancellationToken = default)
        => Task.WhenAll(
            hybridCache.RemoveAsync(EventCacheKeys.GroupEvents(groupId, eventDataEpoch, requireEventDataEpoch), cancellationToken).AsTask(),
            hybridCache.RemoveAsync(EventCacheKeys.PublicUpcomingEvents(eventDataEpoch, requireEventDataEpoch), cancellationToken).AsTask(),
            cloudflareKvCacheService.RemoveApiCacheAsync($"/api/groups/{groupId}/events", cancellationToken),
            cloudflareKvCacheService.RemoveApiCacheAsync("/api/events/public/upcoming", cancellationToken));

    public Task RemoveEventReviewsAsync(Guid eventId, CancellationToken cancellationToken = default)
        => cloudflareKvCacheService.RemoveApiCacheAsync($"/api/events/{eventId}/reviews", cancellationToken);
}
