using Alife.Domain.Enums;

namespace Alife.Application.Common.Interfaces;

public interface ICloudflareKvCacheService
{
    Task PutApprovedMembershipAsync(
        Guid groupId,
        Guid memberId,
        MembershipRole role,
        DateTime updatedUtc,
        CancellationToken cancellationToken = default);

    Task RemoveMembershipAsync(
        Guid groupId,
        Guid memberId,
        CancellationToken cancellationToken = default);

    Task RemoveMemberProfileAsync(
        Guid memberId,
        CancellationToken cancellationToken = default);

    Task RemoveApiCacheAsync(
        string path,
        CancellationToken cancellationToken = default);

    Task RemoveApiCachesAsync(
        IReadOnlyCollection<string> paths,
        CancellationToken cancellationToken = default);

    Task RemoveApiCacheKeyAsync(
        string key,
        CancellationToken cancellationToken = default);
}
