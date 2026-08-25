using Alife.Application.Admin;
using Alife.Application.Common.Interfaces;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Venues;

internal static class VenueAuthorization
{
    public static Task<bool> CanManageCatalogAsync(
        IAlifeDbContext db,
        Guid memberId,
        CancellationToken cancellationToken) =>
        AdminPlatformRoleHelpers.HasPermissionAsync(
            db,
            memberId,
            AdminPermissionCatalog.ManageVenueCatalog,
            cancellationToken);

    public static Task<bool> CanReviewBookingsAsync(
        IAlifeDbContext db,
        Guid memberId,
        CancellationToken cancellationToken) =>
        AdminPlatformRoleHelpers.HasPermissionAsync(
            db,
            memberId,
            AdminPermissionCatalog.ReviewVenueBookings,
            cancellationToken);

    public static async Task<Group?> FindChurchAsync(
        IAlifeDbContext db,
        Guid groupId,
        CancellationToken cancellationToken)
    {
        var current = await db.Groups.AsNoTracking().FirstOrDefaultAsync(x => x.Id == groupId, cancellationToken);
        while (current is not null && !current.IsChurch && current.ParentGroupId.HasValue)
        {
            current = await db.Groups.AsNoTracking().FirstOrDefaultAsync(x => x.Id == current.ParentGroupId.Value, cancellationToken);
        }

        return current?.IsChurch == true ? current : null;
    }

    public static Task<bool> CanManageEventAsync(
        IGroupAuthorizationService authorization,
        GroupEvent groupEvent,
        Guid memberId,
        CancellationToken cancellationToken) =>
        authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, memberId, cancellationToken);

    public static bool HasLocalizedValue(string en, string zh) =>
        !string.IsNullOrWhiteSpace(en) || !string.IsNullOrWhiteSpace(zh);
}
