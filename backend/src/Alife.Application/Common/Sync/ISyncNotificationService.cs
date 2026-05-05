namespace Alife.Application.Common.Sync;

public interface ISyncNotificationService
{
    Task PublishAsync(SyncEntityChange change, CancellationToken cancellationToken = default);
}

