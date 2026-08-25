using System.Text.Json;
using Alife.Application.Events.Dtos;

namespace Alife.Application.Events.Services;

public static class EventClosureLearningSerializer
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static string Write(IEnumerable<EventClosureLearningDto> learnings) =>
        JsonSerializer.Serialize(learnings, JsonOptions);

    public static EventClosureLearningDto[] Read(string? json)
    {
        try
        {
            return JsonSerializer.Deserialize<EventClosureLearningDto[]>(json ?? "[]", JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    public static EventClosureLearningDto[] Normalize(IEnumerable<EventClosureLearningDto>? learnings) =>
        (learnings ?? [])
            .Where(x => HasText(x.Title) && HasText(x.Detail))
            .Take(20)
            .Select(x => new EventClosureLearningDto(
                x.Id == Guid.Empty ? Guid.NewGuid() : x.Id,
                new WorkflowTextDto(Trim(x.Title.En, 300), Trim(x.Title.Zh, 300)),
                new WorkflowTextDto(Trim(x.Detail.En, 2000), Trim(x.Detail.Zh, 2000)),
                x.ReuseNextTime))
            .ToArray();

    private static bool HasText(WorkflowTextDto text) =>
        !string.IsNullOrWhiteSpace(text.En) || !string.IsNullOrWhiteSpace(text.Zh);

    private static string Trim(string? value, int max)
    {
        var normalized = value?.Trim() ?? string.Empty;
        return normalized[..Math.Min(normalized.Length, max)];
    }
}
