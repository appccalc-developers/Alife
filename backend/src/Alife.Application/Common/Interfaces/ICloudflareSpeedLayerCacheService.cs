namespace Alife.Application.Common.Interfaces;

public interface ICloudflareSpeedLayerCacheService
{
    Task PurgeApiPathsAsync(
        IReadOnlyCollection<string> paths,
        CancellationToken cancellationToken = default);
}
