namespace Alife.Application.ContentPosts.Services;

public interface IContentPostCacheInvalidationService
{
    Task RemovePublicIndexAsync(Guid groupId, CancellationToken cancellationToken = default);

    Task RemovePublicDetailAsync(
        Guid groupId,
        string slug,
        CancellationToken cancellationToken = default);

    Task RemovePublicBatchAsync(
        Guid groupId,
        IReadOnlyCollection<string> slugs,
        CancellationToken cancellationToken = default);
}
