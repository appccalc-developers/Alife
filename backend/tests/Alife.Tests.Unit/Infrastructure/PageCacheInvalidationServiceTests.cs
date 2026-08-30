using Alife.Application.Common.Interfaces;
using Alife.Application.Pages.Services;
using Alife.Infrastructure.ReadServices;
using Microsoft.Extensions.Caching.Hybrid;
using NSubstitute;

namespace Alife.Tests.Unit.Infrastructure;

public class PageCacheInvalidationServiceTests
{
    [Fact]
    public async Task RemovePublicAsync_EvictsEverySharedPublicPagesCacheLayer()
    {
        var hybridCache = Substitute.For<HybridCache>();
        var kvCache = Substitute.For<ICloudflareKvCacheService>();
        var speedLayerCache = Substitute.For<ICloudflareSpeedLayerCacheService>();
        var service = new PageCacheInvalidationService(hybridCache, kvCache, speedLayerCache);

        await service.RemovePublicAsync();

        await hybridCache.Received(1).RemoveAsync(
            PageCacheKeys.Public(),
            Arg.Any<CancellationToken>());
        await kvCache.Received(1).RemoveApiCacheAsync(
            "/api/pages/public",
            Arg.Any<CancellationToken>());
        await speedLayerCache.Received(1).PurgeApiPathsAsync(
            Arg.Is<IReadOnlyCollection<string>>(paths =>
                paths.Count == 1 && paths.Contains("/api/pages/public")),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RemovePublishedDetailAsync_EvictsPublishedAndLegacyProjectionPaths()
    {
        var hybridCache = Substitute.For<HybridCache>();
        var kvCache = Substitute.For<ICloudflareKvCacheService>();
        var speedLayerCache = Substitute.For<ICloudflareSpeedLayerCacheService>();
        var service = new PageCacheInvalidationService(hybridCache, kvCache, speedLayerCache);
        var pageId = Guid.NewGuid();

        await service.RemovePublishedDetailAsync(pageId);

        await hybridCache.Received(1).RemoveAsync(
            PageCacheKeys.PublishedDetail(pageId),
            Arg.Any<CancellationToken>());
        await kvCache.Received(1).RemoveApiCacheAsync(
            $"/api/pages/public/{pageId}",
            Arg.Any<CancellationToken>());
        await kvCache.Received(1).RemoveApiCacheAsync(
            $"/api/pages/{pageId}",
            Arg.Any<CancellationToken>());
        await speedLayerCache.Received(1).PurgeApiPathsAsync(
            Arg.Is<IReadOnlyCollection<string>>(paths =>
                paths.Count == 2 &&
                paths.Contains($"/api/pages/public/{pageId}") &&
                paths.Contains($"/api/pages/{pageId}")),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RemoveGroupPagesAsync_DoesNotEvictUnchangedPublishedProjection()
    {
        var hybridCache = Substitute.For<HybridCache>();
        var kvCache = Substitute.For<ICloudflareKvCacheService>();
        var speedLayerCache = Substitute.For<ICloudflareSpeedLayerCacheService>();
        var service = new PageCacheInvalidationService(hybridCache, kvCache, speedLayerCache);
        var groupId = Guid.NewGuid();

        await service.RemoveGroupPagesAsync(groupId);

        await hybridCache.Received(1).RemoveAsync(PageCacheKeys.GroupPages(groupId), Arg.Any<CancellationToken>());
        await kvCache.Received(1).RemoveApiCacheAsync($"/api/groups/{groupId}/pages", Arg.Any<CancellationToken>());
        await hybridCache.DidNotReceive().RemoveAsync(PageCacheKeys.Public(), Arg.Any<CancellationToken>());
        await speedLayerCache.DidNotReceive().PurgeApiPathsAsync(Arg.Any<IReadOnlyCollection<string>>(), Arg.Any<CancellationToken>());
    }
}
