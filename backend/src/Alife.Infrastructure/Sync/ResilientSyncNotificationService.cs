using Alife.Application.Common.Sync;
using Microsoft.Extensions.Logging;

namespace Alife.Infrastructure.Sync;

public sealed class ResilientSyncNotificationService(
    ISyncVersionService versionService,
    WebPushNotificationService pushNotificationService,
    ILogger<ResilientSyncNotificationService> logger)
    : ISyncNotificationService
{
    public async Task PublishAsync(SyncEntityChange change, CancellationToken cancellationToken = default)
    {
        var version = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        foreach (var key in change.VersionKeys.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            try
            {
                await versionService.TouchAsync(key, version, cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to touch sync version key {Key}.", key);
            }
        }

        try
        {
            await pushNotificationService.SendSilentUpdateAsync(change, version, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to dispatch sync push for {EntityType}:{EntityId}.", change.EntityType, change.EntityId);
        }
    }
}
