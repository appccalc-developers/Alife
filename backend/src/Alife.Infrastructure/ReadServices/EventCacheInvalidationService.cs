using Alife.Application.Common.Interfaces;
using Alife.Application.Events.Services;
using Microsoft.Extensions.Caching.Hybrid;

namespace Alife.Infrastructure.ReadServices;

public sealed class EventCacheInvalidationService(
    HybridCache hybridCache,
    ICloudflareKvCacheService cloudflareKvCacheService) : IEventCacheInvalidationService
{
    public Task RemoveGroupEventsAsync(Guid groupId, CancellationToken cancellationToken = default)
        => Task.WhenAll(
            hybridCache.RemoveAsync(EventCacheKeys.GroupEvents(groupId), cancellationToken).AsTask(),
            hybridCache.RemoveAsync(EventCacheKeys.PublicUpcomingEvents(), cancellationToken).AsTask(),
            cloudflareKvCacheService.RemoveApiCacheAsync($"/api/groups/{groupId}/events", cancellationToken),
            cloudflareKvCacheService.RemoveApiCacheAsync("/api/events/public/upcoming", cancellationToken));

    public Task RemoveEventEnrollmentsAsync(Guid eventId, CancellationToken cancellationToken = default)
        => cloudflareKvCacheService.RemoveApiCacheAsync($"/api/events/{eventId}/enrollments", cancellationToken);

    public Task RemoveEventReviewsAsync(Guid eventId, CancellationToken cancellationToken = default)
        => cloudflareKvCacheService.RemoveApiCacheAsync($"/api/events/{eventId}/reviews", cancellationToken);
}
