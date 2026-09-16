using Alife.Application.Common.Interfaces;

namespace Alife.Application.Events.Services;

internal static class EventVenueScope
{
    public static async Task<Guid[]> ReservableManagingGroupIdsAsync(
        IAlifeDbContext db,
        Guid owningGroupId,
        CancellationToken ct)
    {
        var churchRootId = await EventCompositionPersistence.FindChurchRootIdAsync(db, owningGroupId, ct);
        return churchRootId.HasValue && churchRootId.Value != owningGroupId
            ? [owningGroupId, churchRootId.Value]
            : [owningGroupId];
    }

    public static async Task<bool> CanReserveAsync(
        IAlifeDbContext db,
        Guid owningGroupId,
        Guid managingGroupId,
        CancellationToken ct)
        => (await ReservableManagingGroupIdsAsync(db, owningGroupId, ct)).Contains(managingGroupId);
}
