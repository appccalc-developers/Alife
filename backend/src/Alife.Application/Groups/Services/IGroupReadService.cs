using Alife.Application.Groups.Dtos;

namespace Alife.Application.Groups.Services;

public interface IGroupReadService
{
    Task<GroupDto?> GetChurchAsync(CancellationToken cancellationToken);
    Task<GroupDto?> GetByIdAsync(Guid groupId, CancellationToken cancellationToken);
    Task<IReadOnlyList<GroupSummaryDto>> GetVisibleGroupsAsync(Guid? memberId, CancellationToken cancellationToken);
    Task<IReadOnlyList<GroupSummaryDto>> GetSubgroupsAsync(Guid groupId, CancellationToken cancellationToken);
    Task<IReadOnlyList<GroupMembershipDto>> GetMembershipsAsync(Guid groupId, bool includeChurchLineCandidates, CancellationToken cancellationToken);
}
