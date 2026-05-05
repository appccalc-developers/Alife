namespace Alife.Application.Common.Sync;

public interface IPushSubscriptionStore
{
    Task UpsertAsync(Guid memberId, PushSubscriptionDto subscription, CancellationToken cancellationToken = default);

    Task DeleteAsync(Guid memberId, string endpoint, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<StoredPushSubscription>> GetForMembersAsync(
        IReadOnlyCollection<Guid> memberIds,
        CancellationToken cancellationToken = default);
}

public sealed record StoredPushSubscription(Guid MemberId, PushSubscriptionDto Subscription);

