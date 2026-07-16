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
}
