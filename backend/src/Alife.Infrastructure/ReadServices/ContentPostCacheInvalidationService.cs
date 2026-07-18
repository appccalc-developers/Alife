using Alife.Application.Common.Interfaces;
using Alife.Application.ContentPosts.Services;
using Microsoft.Extensions.Caching.Hybrid;

namespace Alife.Infrastructure.ReadServices;

public sealed class ContentPostCacheInvalidationService(
    HybridCache hybridCache,
    ICloudflareKvCacheService cloudflareKvCacheService,
    ICloudflareSpeedLayerCacheService cloudflareSpeedLayerCacheService) : IContentPostCacheInvalidationService
{
    public Task RemovePublicIndexAsync(Guid groupId, CancellationToken cancellationToken = default)
    {
        var path = $"/api/public/groups/{groupId}/posts";
        return Task.WhenAll(
            hybridCache.RemoveAsync(ContentPostCacheKeys.PublicIndex(groupId), cancellationToken).AsTask(),
            cloudflareKvCacheService.RemoveApiCacheAsync(path, cancellationToken),
            cloudflareSpeedLayerCacheService.PurgeApiPathsAsync([path], cancellationToken));
    }

    public Task RemovePublicDetailAsync(
        Guid groupId,
        string slug,
        CancellationToken cancellationToken = default)
    {
        var normalizedSlug = slug.Trim().ToLowerInvariant();
        var path = $"/api/public/groups/{groupId}/posts/{normalizedSlug}";
        return Task.WhenAll(
            hybridCache.RemoveAsync(
                ContentPostCacheKeys.PublicDetail(groupId, normalizedSlug),
                cancellationToken).AsTask(),
            cloudflareKvCacheService.RemoveApiCacheAsync(path, cancellationToken),
            cloudflareSpeedLayerCacheService.PurgeApiPathsAsync([path], cancellationToken));
    }

    public Task RemovePublicBatchAsync(
        Guid groupId,
        IReadOnlyCollection<string> slugs,
        CancellationToken cancellationToken = default)
    {
        var normalizedSlugs = slugs
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x.Trim().ToLowerInvariant())
            .Distinct(StringComparer.Ordinal)
            .ToArray();
        var indexPath = $"/api/public/groups/{groupId}/posts";
        var paths = new[] { indexPath }
            .Concat(normalizedSlugs.Select(slug => $"{indexPath}/{slug}"))
            .ToArray();
        var tasks = new List<Task>
        {
            hybridCache.RemoveAsync(
                ContentPostCacheKeys.PublicIndex(groupId),
                cancellationToken).AsTask(),
            cloudflareKvCacheService.RemoveApiCachesAsync(paths, cancellationToken),
            cloudflareSpeedLayerCacheService.PurgeApiPathsAsync(paths, cancellationToken)
        };

        foreach (var slug in normalizedSlugs)
        {
            tasks.Add(hybridCache.RemoveAsync(
                ContentPostCacheKeys.PublicDetail(groupId, slug),
                cancellationToken).AsTask());
        }

        return Task.WhenAll(tasks);
    }
}
