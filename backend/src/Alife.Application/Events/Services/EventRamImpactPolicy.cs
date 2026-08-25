using System.Text.Json;
using System.Text.Json.Nodes;
using Alife.Domain.Entities;

namespace Alife.Application.Events.Services;

public static class EventRamImpactPolicy
{
    private static readonly string[] RelevantEventFields =
    [
        "description",
        "locationName",
        "maxCapacity",
        "capacityUnit",
        "registrationDeadline",
        "hardConstraints",
        "optionalActivities",
        "requiresRoster",
        "rosterRoles",
        "timeZoneId",
        "visibility"
    ];

    public static bool HasMaterialChange(
        GroupEvent current,
        string nextTitleEn,
        string nextTitleZh,
        DateTime nextStartUtc,
        DateTime nextEndUtc,
        string nextEventDataJson,
        string? nextRamDataJson)
    {
        if (!string.Equals(current.TitleEn, nextTitleEn, StringComparison.Ordinal)
            || !string.Equals(current.TitleZh, nextTitleZh, StringComparison.Ordinal)
            || current.StartDate != nextStartUtc
            || current.EndDate != nextEndUtc)
        {
            return true;
        }

        if (!RelevantEventFactsEqual(current.EventDataJson, nextEventDataJson))
            return true;

        return nextRamDataJson is not null
            && current.RamAssessment is not null
            && !JsonEquivalent(current.RamAssessment.RamDataJson, nextRamDataJson);
    }

    private static bool RelevantEventFactsEqual(string currentJson, string nextJson)
    {
        try
        {
            var current = JsonNode.Parse(currentJson) as JsonObject ?? new JsonObject();
            var next = JsonNode.Parse(nextJson) as JsonObject ?? new JsonObject();
            foreach (var field in RelevantEventFields)
            {
                if (!JsonNode.DeepEquals(current[field], next[field])) return false;
            }
            return true;
        }
        catch (JsonException)
        {
            return string.Equals(currentJson, nextJson, StringComparison.Ordinal);
        }
    }

    private static bool JsonEquivalent(string currentJson, string nextJson)
    {
        try
        {
            return JsonNode.DeepEquals(JsonNode.Parse(currentJson), JsonNode.Parse(nextJson));
        }
        catch (JsonException)
        {
            return string.Equals(currentJson, nextJson, StringComparison.Ordinal);
        }
    }
}
