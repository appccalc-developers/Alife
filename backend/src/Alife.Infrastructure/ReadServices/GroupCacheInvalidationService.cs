using Alife.Application.Common.Interfaces;
using Alife.Application.Groups.Services;
using Microsoft.Extensions.Caching.Hybrid;

namespace Alife.Infrastructure.ReadServices;

public sealed class GroupCacheInvalidationService(
    HybridCache hybridCache,
    ICloudflareKvCacheService cloudflareKvCacheService) : IGroupCacheInvalidationService
{
    public Task RemoveGroupAsync(Guid groupId, CancellationToken cancellationToken = default)
        => Task.WhenAll(
            hybridCache.RemoveAsync(GroupCacheKeys.ById(groupId), cancellationToken).AsTask(),
            cloudflareKvCacheService.RemoveApiCacheAsync($"/api/groups/{groupId}", cancellationToken));

    public Task RemoveChurchAsync(CancellationToken cancellationToken = default)
        => hybridCache.RemoveAsync(GroupCacheKeys.Church(), cancellationToken).AsTask();

    public Task RemoveSubgroupsAsync(Guid groupId, CancellationToken cancellationToken = default)
        => Task.WhenAll(
            hybridCache.RemoveAsync(GroupCacheKeys.Subgroups(groupId), cancellationToken).AsTask(),
            cloudflareKvCacheService.RemoveApiCacheAsync($"/api/groups/{groupId}/subgroups", cancellationToken));

    public Task RemoveMembershipsAsync(Guid groupId, CancellationToken cancellationToken = default)
        => Task.WhenAll(
            hybridCache.RemoveAsync(GroupCacheKeys.Memberships(groupId), cancellationToken).AsTask(),
            cloudflareKvCacheService.RemoveApiCacheAsync($"/api/groups/{groupId}/memberships", cancellationToken),
            cloudflareKvCacheService.RemoveApiCacheAsync($"/api/groups/{groupId}/pages", cancellationToken),
            cloudflareKvCacheService.RemoveApiCacheAsync($"/api/groups/{groupId}/events", cancellationToken),
            cloudflareKvCacheService.RemoveApiCacheAsync($"/api/groups/{groupId}", cancellationToken));
}
