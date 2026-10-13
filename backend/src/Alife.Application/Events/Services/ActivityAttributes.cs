using Alife.Application.Events.Dtos;

namespace Alife.Application.Events.Services;

/// <summary>Composable activity facts; generic checks are implicit, never a selected attribute.</summary>
public static class ActivityAttributes
{
    public static readonly string[] Codes = ["hiking", "water", "sport", "transport", "camp", "meal", "outdoor"];
    public static string[] Read(PlannedActivity activity) => activity.Attributes;
    public static string[] Read(RamActivity activity) => activity.Attributes;
    public static bool Valid(string[]? attributes) => attributes is not null && attributes.Length <= Codes.Length &&
        attributes.Distinct().Count() == attributes.Length && attributes.All(Codes.Contains);
    public static string FactsJson(ActivityPlanData data) => RamEvaluator.Serialize(data with
    {
        Activities = data.Activities.Select(a => a with
        {
            Attributes = a.Attributes.Order(StringComparer.Ordinal).ToArray(),
            Answers = a.Answers?.OrderBy(answer => answer.Key, StringComparer.Ordinal)
                .ToDictionary(answer => answer.Key, answer => answer.Value, StringComparer.Ordinal)
        }).ToArray()
    });
}
