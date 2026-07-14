using Alife.Application.Common.Interfaces;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Announcements;

internal static class AnnouncementAuthorization
{
    public static async Task<Group?> FindChurchAsync(IAlifeDbContext db, Group group, CancellationToken cancellationToken)
    {
        var current = group;
        while (!current.IsChurch && current.ParentGroupId.HasValue)
        {
            var parent = await db.Groups.AsNoTracking().FirstOrDefaultAsync(x => x.Id == current.ParentGroupId.Value, cancellationToken);
            if (parent is null) break;
            current = parent;
        }

        return current.IsChurch ? current : null;
    }

    public static async Task<HashSet<Guid>> GetChurchGroupIdsAsync(IAlifeDbContext db, Guid churchId, CancellationToken cancellationToken)
    {
        var groups = await db.Groups.AsNoTracking().Select(x => new { x.Id, x.ParentGroupId }).ToListAsync(cancellationToken);
        var result = new HashSet<Guid> { churchId };
        var changed = true;
        while (changed)
        {
            changed = false;
            foreach (var group in groups.Where(x => x.ParentGroupId.HasValue && result.Contains(x.ParentGroupId.Value)))
            {
                changed |= result.Add(group.Id);
            }
        }

        return result;
    }

    public static bool HasLocalizedValue(IReadOnlyDictionary<string, string> value) =>
        value.Any(x => (x.Key.Equals("en", StringComparison.OrdinalIgnoreCase) || x.Key.Equals("zh", StringComparison.OrdinalIgnoreCase)) && !string.IsNullOrWhiteSpace(x.Value));

    public static string? ValidateSchedule(DateTime publishUtc, DateTime? expireUtc) =>
        expireUtc.HasValue && expireUtc.Value <= publishUtc ? "Expiry must be later than publish time." : null;

    public static string? ValidateAudience(Group group, AnnouncementAudience audience) =>
        !group.IsChurch && audience != AnnouncementAudience.SpecificGroup
            ? "Group announcements must target the specific group. Church-wide audiences can only be managed from the church."
            : null;
}
