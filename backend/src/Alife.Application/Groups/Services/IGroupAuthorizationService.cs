namespace Alife.Application.Groups.Services;

public interface IGroupAuthorizationService
{
    Task<bool> IsAdminAsync(Guid memberId, CancellationToken cancellationToken);
    Task<bool> CanReviewPagesAsync(Guid memberId, CancellationToken cancellationToken);
    Task<bool> IsApprovedMemberAsync(Guid groupId, Guid memberId, CancellationToken cancellationToken);
    Task<bool> IsLeaderOrCoLeaderAsync(Guid groupId, Guid memberId, CancellationToken cancellationToken);
    Task<bool> IsLeaderAsync(Guid groupId, Guid memberId, CancellationToken cancellationToken);
    Task<bool> IsRegisteredMemberAsync(Guid memberId, CancellationToken cancellationToken);
}
