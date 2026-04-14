namespace Alife.Application.Pages.Services;

public interface IPageCacheInvalidationService
{
    Task RemoveGlobalAsync(string lang, CancellationToken cancellationToken = default);
    Task RemoveBySlugAsync(string slug, string lang, CancellationToken cancellationToken = default);
    Task RemoveGroupPagesAsync(Guid groupId, string lang, CancellationToken cancellationToken = default);
}
