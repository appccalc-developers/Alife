using Alife.Application.Groups.Services;
using Microsoft.Extensions.Caching.Hybrid;

namespace Alife.Infrastructure.ReadServices;

public sealed class GroupCacheInvalidationService(HybridCache hybridCache) : IGroupCacheInvalidationService
{
    public Task RemoveGroupAsync(Guid groupId, CancellationToken cancellationToken = default)
        => hybridCache.RemoveAsync(GroupCacheKeys.ById(groupId), cancellationToken).AsTask();

    public Task RemoveChurchAsync(CancellationToken cancellationToken = default)
        => hybridCache.RemoveAsync(GroupCacheKeys.Church(), cancellationToken).AsTask();

    public Task RemoveSubgroupsAsync(Guid groupId, CancellationToken cancellationToken = default)
        => hybridCache.RemoveAsync(GroupCacheKeys.Subgroups(groupId), cancellationToken).AsTask();

    public Task RemoveMembershipsAsync(Guid groupId, CancellationToken cancellationToken = default)
        => hybridCache.RemoveAsync(GroupCacheKeys.Memberships(groupId), cancellationToken).AsTask();
}
