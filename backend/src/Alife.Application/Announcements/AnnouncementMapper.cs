using System.Text.Json;
using Alife.Application.Announcements.Dtos;
using Alife.Domain.Entities;

namespace Alife.Application.Announcements;

internal static class AnnouncementMapper
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static AnnouncementDto ToDto(Announcement value) => new(
        value.Id,
        value.GroupId,
        ReadLocalized(value.TitleJson),
        ReadLocalized(value.SummaryJson),
        string.IsNullOrWhiteSpace(value.ContentJson) ? null : ReadLocalized(value.ContentJson),
        value.Audience,
        value.Priority,
        value.Status,
        value.PublishUtc,
        value.ExpireUtc,
        value.IsPinned,
        value.CreatedByMemberId,
        value.CreatedUtc,
        value.UpdatedUtc);

    public static string WriteLocalized(IReadOnlyDictionary<string, string> value) =>
        JsonSerializer.Serialize(value, JsonOptions);

    public static Dictionary<string, string> Normalize(IReadOnlyDictionary<string, string>? value) =>
        value?
            .Where(x => !string.IsNullOrWhiteSpace(x.Key) && !string.IsNullOrWhiteSpace(x.Value))
            .ToDictionary(x => x.Key.Trim().ToLowerInvariant(), x => x.Value.Trim()) ?? [];

    private static IReadOnlyDictionary<string, string> ReadLocalized(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new Dictionary<string, string>();
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(json, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return new Dictionary<string, string>();
        }
    }
}
