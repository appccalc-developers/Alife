namespace Alife.Application.Sermons.Services;

public interface ISermonCacheInvalidationService
{
    Task RemoveAllAsync(CancellationToken cancellationToken = default);
}
