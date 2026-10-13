using Alife.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed partial class EventActivityOperationsService
{
    public const string ChildProjectExecutionBlocked = "event.execute.childProjectConsentRequired";

    /// <summary>Current operational consent is checked at execution, independently of frozen Package sources.</summary>
    public static async Task<IReadOnlyList<string>> ExecutionBlockersAsync(IAlifeDbContext db, Guid eventId, Guid? occurrenceId, CancellationToken ct)
    {
        var e = await db.GroupEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return [];
        var children = await db.EventActivityParticipations.AsNoTracking()
            .Include(p => p.Offer).ThenInclude(o => o.Policy)
            .Include(p => p.Participant).ThenInclude(p => p.Application)
            .Where(p => p.Offer.EventId == eventId && p.Participant.IsChild && p.SeatStatus == "confirmed" &&
                (!occurrenceId.HasValue || p.Offer.OccurrenceId == occurrenceId))
            .ToArrayAsync(ct);
        foreach (var row in children)
        {
            if (row.Participant.SeatStatus != "confirmed" || row.ProcedureStatus != "complete" ||
                row.PolicyVersionId != row.Offer.PolicyVersionId ||
                !await ChildProjectAllowed(db, e, row.Participant, row.Offer, ct) || !await HasConsent(db, row, ct))
                return [ChildProjectExecutionBlocked];
        }
        return [];
    }
}
