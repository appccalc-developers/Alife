namespace Alife.Application.Groups.Services;

public interface IGroupCacheInvalidationService
{
    Task RemoveGroupAsync(Guid groupId, CancellationToken cancellationToken = default);
    Task RemoveChurchAsync(CancellationToken cancellationToken = default);
    Task RemoveSubgroupsAsync(Guid groupId, CancellationToken cancellationToken = default);
    Task RemoveMembershipsAsync(Guid groupId, CancellationToken cancellationToken = default);
}
