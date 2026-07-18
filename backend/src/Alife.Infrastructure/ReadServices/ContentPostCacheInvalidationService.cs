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
}
