namespace Alife.Application.Common.Sync;

public interface ISyncVersionService
{
    Task TouchAsync(string key, long unixTimeMilliseconds, CancellationToken cancellationToken = default);

    Task<SyncVersionSnapshot> GetBulkAsync(IReadOnlyCollection<string> keys, CancellationToken cancellationToken = default);
}
