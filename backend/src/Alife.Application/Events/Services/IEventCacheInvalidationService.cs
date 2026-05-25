namespace Alife.Application.Events.Services;

public interface IEventCacheInvalidationService
{
    Task RemoveGroupEventsAsync(Guid groupId, CancellationToken cancellationToken = default);
}
