using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Events.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

// A section confirmation reviews a saved plan. Later operational writes invalidate
// its current display without rewriting the immutable accepted snapshot.
public static class EventArrangementConfirmationPolicy
{
    public const string ChangeAction = "event.arrangements.changed";
    public static string? GroupForModule(string? module) => module switch
    {
        "TEAM.WORK" or "PEOPLE.REGISTRATION" or "SERVICE.ROSTER" => "people",
        "SAFETY.RAM" or "SAFEGUARDING.CHILD" => "safety",
        "PROGRAM.PRODUCTION" or "PLACE.RESOURCE" or "FESTIVAL.OPERATIONS" => "programme",
        "MOVE.STAY" => "travel", "FOOD.HOSPITALITY" => "food", "MONEY.FINANCE" => "money", "COMMS.FOLLOWUP" => "followup",
        _ => null
    };
    public static async Task<EventPlanSnapshotDto> RefreshAsync(IAlifeDbContext db, EventPlanSnapshotDto snapshot, CancellationToken ct)
    {
        if (snapshot.Plan.ArrangementConfirmations is null) return snapshot;
        var accepted = snapshot.AcceptedUtc ?? DateTime.MinValue;
        var changes = await db.AuditLogs.AsNoTracking().Where(x => x.EventId == snapshot.EventId &&
            x.Action == ChangeAction && x.OccurredUtc > accepted).Select(x => x.AfterJson).ToListAsync(ct);
        var confirmations = snapshot.Plan.ArrangementConfirmations.ToDictionary(x => x.Key, x => x.Value);
        foreach (var change in changes)
        {
            using var document = JsonDocument.Parse(change ?? "{}");
            var section = document.RootElement.TryGetProperty("section", out var value) ? value.GetString() : null;
            foreach (var key in confirmations.Keys.ToArray())
                if (section is null || section == key) confirmations[key] = false;
        }
        return snapshot with { Plan = snapshot.Plan with { ArrangementConfirmations = confirmations } };
    }
}
