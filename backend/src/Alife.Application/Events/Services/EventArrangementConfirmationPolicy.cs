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
    public static IReadOnlyDictionary<string, bool>? NormalizeModules(IReadOnlyDictionary<string, bool>? values)
        => values is null ? null : EventCompositionDefinitions.Modules.OrderBy(x => x.Code, StringComparer.Ordinal)
            .ToDictionary(x => x.Code, x => values.TryGetValue(x.Code, out var confirmed) && confirmed);

    public static IReadOnlyDictionary<string, bool>? LegacySummary(IReadOnlyDictionary<string, bool>? values)
        => values is null ? null : EventCompositionDefinitions.Modules.GroupBy(x => GroupForModule(x.Code)!)
            .OrderBy(x => x.Key, StringComparer.Ordinal).ToDictionary(x => x.Key,
                x => x.All(module => values.TryGetValue(module.Code, out var confirmed) && confirmed));

    public static async Task<EventPlanSnapshotDto> RefreshAsync(IAlifeDbContext db, EventPlanSnapshotDto snapshot, CancellationToken ct)
    {
        if (snapshot.Plan.ArrangementConfirmations is null && snapshot.Plan.ModuleConfirmations is null) return snapshot;
        var accepted = snapshot.AcceptedUtc ?? DateTime.MinValue;
        var changes = await db.AuditLogs.AsNoTracking().Where(x => x.EventId == snapshot.EventId &&
            x.Action == ChangeAction && x.OccurredUtc > accepted).Select(x => x.AfterJson).ToListAsync(ct);
        var legacy = snapshot.Plan.ArrangementConfirmations?.ToDictionary(x => x.Key, x => x.Value);
        var modules = NormalizeModules(snapshot.Plan.ModuleConfirmations)?.ToDictionary(x => x.Key, x => x.Value);
        foreach (var change in changes)
        {
            string? section = null, module = null;
            bool invalidatesRam = false;
            try
            {
                using var document = JsonDocument.Parse(change ?? "{}");
                var root = document.RootElement;
                section = root.ValueKind == JsonValueKind.Object && root.TryGetProperty("section", out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
                module = root.ValueKind == JsonValueKind.Object && root.TryGetProperty("moduleCode", out value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
                invalidatesRam = root.ValueKind == JsonValueKind.Object && root.TryGetProperty("invalidatesRam", out value) && value.ValueKind == JsonValueKind.True;
            }
            catch (JsonException) { /* Unknown audit scope fails closed. */ }
            if (legacy is not null)
                foreach (var key in legacy.Keys.ToArray())
                    if (section is null || section == key || (invalidatesRam && key == "safety")) legacy[key] = false;
            if (modules is not null)
                foreach (var key in modules.Keys.ToArray())
                    if (module is not null && EventCompositionDefinitions.ModulesByCode.ContainsKey(module)
                        ? key == module || (invalidatesRam && key == "SAFETY.RAM")
                        : !EventCompositionDefinitions.Modules.Any(x => GroupForModule(x.Code) == section) || GroupForModule(key) == section || (invalidatesRam && key == "SAFETY.RAM")) modules[key] = false;
        }
        return snapshot with { Plan = snapshot.Plan with { ArrangementConfirmations = LegacySummary(modules) ?? legacy, ModuleConfirmations = modules } };
    }
}
