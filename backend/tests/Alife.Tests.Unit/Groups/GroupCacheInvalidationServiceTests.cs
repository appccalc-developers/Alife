using Alife.Application.Common.Interfaces;
using Alife.Infrastructure.ReadServices;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;

namespace Alife.Tests.Unit.Groups;

public class GroupCacheInvalidationServiceTests
{
    [Fact]
    public async Task RemoveMembershipsAsync_PurgesSpeedLayerMemberPaths()
    {
        var serviceCollection = new ServiceCollection();
        serviceCollection.AddHybridCache();
        await using var services = serviceCollection.BuildServiceProvider();
        var hybridCache = services.GetRequiredService<HybridCache>();
        var kvCache = Substitute.For<ICloudflareKvCacheService>();
        var speedLayerCache = Substitute.For<ICloudflareSpeedLayerCacheService>();
        var service = new GroupCacheInvalidationService(hybridCache, kvCache, speedLayerCache);
        var groupId = Guid.NewGuid();

        await service.RemoveMembershipsAsync(groupId);

        await speedLayerCache.Received(1).PurgeApiPathsAsync(
            Arg.Is<IReadOnlyCollection<string>>(paths =>
                paths.Count == 2 &&
                paths.Contains($"/api/groups/{groupId}/memberships") &&
                paths.Contains($"/api/groups/{groupId}/members")),
            Arg.Any<CancellationToken>());
    }
}
