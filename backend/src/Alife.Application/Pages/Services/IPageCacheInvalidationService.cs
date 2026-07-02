namespace Alife.Application.Pages.Services;

public interface IPageCacheInvalidationService
{
    Task RemoveGlobalAsync(CancellationToken cancellationToken = default);
    Task RemovePublicAsync(CancellationToken cancellationToken = default);
    Task RemoveDetailAsync(Guid pageId, CancellationToken cancellationToken = default);
    Task RemoveGroupPagesAsync(Guid groupId, CancellationToken cancellationToken = default);
}
