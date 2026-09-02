using System.Text.Json;

namespace Alife.Application.Events.Services;

public sealed record EventOccurrencePackageException(
    string ModuleCode,
    string ChangeCode,
    string Classification,
    Guid RaisedByMemberId,
    DateTime RaisedUtc,
    IReadOnlyList<Guid> BaselinePackageIds,
    Guid ReviewTaskId,
    Guid? ResolvedByPackageId = null,
    DateTime? ResolvedUtc = null)
{
    public bool IsOpen => !ResolvedUtc.HasValue;
}

public static class EventOccurrencePackageExceptionState
{
    private static readonly JsonSerializerOptions JsonOptions = EventCompositionEngine.CreateJsonOptions();

    public static IReadOnlyList<EventOccurrencePackageException> Read(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<EventOccurrencePackageException[]>(json, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            // Unknown legacy exception content cannot silently grant Package inheritance.
            return [new("UNKNOWN", "event.occurrence.exception.unreadable", "unknown", Guid.Empty,
                DateTime.UnixEpoch, [], Guid.Empty, null, null)];
        }
    }

    public static bool HasOpen(string? json, string? moduleCode = null) => Read(json).Any(item =>
        item.IsOpen && (moduleCode is null || string.Equals(item.ModuleCode, moduleCode, StringComparison.Ordinal)));

    public static string Raise(string? json, string moduleCode, string changeCode, string classification,
        Guid actorMemberId, DateTime utcNow, IReadOnlyCollection<Guid> baselinePackageIds,
        Guid reviewTaskId, out bool created)
    {
        var items = Read(json).ToList();
        if (items.Any(item => item.IsOpen && string.Equals(item.ModuleCode, moduleCode, StringComparison.Ordinal)))
        {
            created = false;
            return EventPackageCanonicalizer.Serialize(items);
        }

        items.Add(new(moduleCode, changeCode, classification, actorMemberId, utcNow,
            baselinePackageIds.Order().ToArray(), reviewTaskId));
        created = true;
        return EventPackageCanonicalizer.Serialize(items.OrderBy(item => item.RaisedUtc).ThenBy(item => item.ModuleCode));
    }

    public static string Resolve(string? json, Guid packageId, DateTime utcNow,
        out IReadOnlyList<Guid> reviewTaskIds)
    {
        var items = Read(json).ToArray();
        reviewTaskIds = items.Where(item => item.IsOpen && item.ReviewTaskId != Guid.Empty)
            .Select(item => item.ReviewTaskId).Distinct().ToArray();
        if (!items.Any(item => item.IsOpen)) return json ?? "[]";
        return EventPackageCanonicalizer.Serialize(items.Select(item => item.IsOpen
            ? item with { ResolvedByPackageId = packageId, ResolvedUtc = utcNow }
            : item));
    }
}
