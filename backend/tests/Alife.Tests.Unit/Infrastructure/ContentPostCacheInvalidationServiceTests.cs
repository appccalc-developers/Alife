using Alife.Application.Common.Interfaces;
using Alife.Application.ContentPosts.Services;
using Alife.Infrastructure.ReadServices;
using Microsoft.Extensions.Caching.Hybrid;
using NSubstitute;

namespace Alife.Tests.Unit.Infrastructure;

public sealed class ContentPostCacheInvalidationServiceTests
{
    [Fact]
    public async Task RemovePublicBatchAsync_EvictsIndexAndDistinctDetailsWithOneEdgePurge()
    {
        var hybridCache = Substitute.For<HybridCache>();
        var kvCache = Substitute.For<ICloudflareKvCacheService>();
        var speedLayerCache = Substitute.For<ICloudflareSpeedLayerCacheService>();
        var service = new ContentPostCacheInvalidationService(
            hybridCache,
            kvCache,
            speedLayerCache);
        var groupId = Guid.NewGuid();
        var indexPath = $"/api/public/groups/{groupId}/posts";

        await service.RemovePublicBatchAsync(
            groupId,
            ["first-post", "SECOND-POST", "first-post"]);

        await hybridCache.Received(1).RemoveAsync(
            ContentPostCacheKeys.PublicIndex(groupId),
            Arg.Any<CancellationToken>());
        await hybridCache.Received(1).RemoveAsync(
            ContentPostCacheKeys.PublicDetail(groupId, "first-post"),
            Arg.Any<CancellationToken>());
        await hybridCache.Received(1).RemoveAsync(
            ContentPostCacheKeys.PublicDetail(groupId, "second-post"),
            Arg.Any<CancellationToken>());
        await kvCache.Received(1).RemoveApiCachesAsync(
            Arg.Is<IReadOnlyCollection<string>>(paths =>
                paths.Count == 3 &&
                paths.Contains(indexPath) &&
                paths.Contains($"{indexPath}/first-post") &&
                paths.Contains($"{indexPath}/second-post")),
            Arg.Any<CancellationToken>());
        await speedLayerCache.Received(1).PurgeApiPathsAsync(
            Arg.Is<IReadOnlyCollection<string>>(paths =>
                paths.Count == 3 &&
                paths.Contains(indexPath) &&
                paths.Contains($"{indexPath}/first-post") &&
                paths.Contains($"{indexPath}/second-post")),
            Arg.Any<CancellationToken>());
    }
}
