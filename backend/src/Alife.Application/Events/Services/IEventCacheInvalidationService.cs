namespace Alife.Application.Events.Services;

public interface IEventCacheInvalidationService
{
    Task RemoveGroupEventsAsync(Guid groupId, CancellationToken cancellationToken = default);
    Task RemoveEventEnrollmentsAsync(Guid eventId, CancellationToken cancellationToken = default);
    Task RemoveEventReviewsAsync(Guid eventId, CancellationToken cancellationToken = default);
}
