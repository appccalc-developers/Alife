using System.Text.Json;
using Alife.Application.ContentPosts.Dtos;
using Alife.Domain.Entities;

namespace Alife.Application.ContentPosts;

public static class ContentPostMapper
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static ContentPostSummaryDto ToSummaryDto(ContentPost value) => new(
        value.Id,
        value.OwnerGroupId,
        ReadLocalized(value.TitleJson),
        ReadLocalized(value.SummaryJson),
        value.Category,
        value.Slug,
        value.CoverImageUrl,
        value.Byline,
        value.PublishedUtc ?? value.UpdatedUtc,
        value.UpdatedUtc);

    public static ContentPostDetailDto ToDetailDto(ContentPost value) => new(
        value.Id,
        value.OwnerGroupId,
        ReadLocalized(value.TitleJson),
        ReadLocalized(value.SummaryJson),
        ReadLocalized(value.BodyJson),
        value.Category,
        value.Slug,
        value.CoverImageUrl,
        value.Byline,
        value.SourceUrl,
        value.PublishedUtc ?? value.UpdatedUtc,
        value.UpdatedUtc);

    public static ManagedContentPostDto ToManagedDto(ContentPost value) => new(
        value.Id,
        value.OwnerGroupId,
        value.CreatedByMemberId,
        ReadLocalized(value.TitleJson),
        ReadLocalized(value.SummaryJson),
        ReadLocalized(value.BodyJson),
        value.Category,
        value.Status,
        value.Visibility,
        value.Slug,
        value.CoverImageUrl,
        value.Byline,
        value.PublishedUtc,
        value.SourceUrl,
        value.SourceKey,
        value.SourceChecksum,
        value.CreatedUtc,
        value.UpdatedUtc);

    public static Dictionary<string, string> NormalizeLocalized(IReadOnlyDictionary<string, string>? value)
    {
        if (value is null)
        {
            return [];
        }

        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var key in new[] { "en", "zh" })
        {
            var pair = value.FirstOrDefault(x => x.Key.Equals(key, StringComparison.OrdinalIgnoreCase));
            if (!string.IsNullOrWhiteSpace(pair.Value))
            {
                result[key] = pair.Value.Trim();
            }
        }

        return result;
    }

    public static bool HasLocalizedValue(IReadOnlyDictionary<string, string> value) =>
        value.Any(x => !string.IsNullOrWhiteSpace(x.Value));

    public static string WriteLocalized(IReadOnlyDictionary<string, string> value) =>
        JsonSerializer.Serialize(value, JsonOptions);

    public static IReadOnlyDictionary<string, string> ReadLocalized(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new Dictionary<string, string>();
        }

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(json, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return new Dictionary<string, string>();
        }
    }

    public static object ToAuditSnapshot(ContentPost value) => new
    {
        value.Id,
        value.OwnerGroupId,
        value.Category,
        value.Status,
        value.Visibility,
        value.Slug,
        value.PublishedUtc,
        value.SourceUrl,
        value.UpdatedUtc,
        value.IsDeleted
    };
}
