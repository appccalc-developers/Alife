using Alife.Domain.Entities;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Alife.Application.Pages.Services;

public static partial class PagePublicationReviewDefaults
{
    private const int MaxCardImageUrlLength = 1200;
    private const int MaxAccessNameLength = 120;

    private static readonly string[] PreferredImagePropertyNames =
    [
        "posterImageUrl",
        "posterImage",
        "imageOverrideUrl",
        "imageUrl",
        "backgroundImageUrl",
        "backgroundImage",
        "coverImageUrl",
        "coverImage",
        "thumbnailUrl",
        "thumbnail",
        "photoUrl",
        "photo"
    ];

    public static IReadOnlyDictionary<string, string> CreateAccessName(
        IReadOnlyDictionary<string, string> ownerGroupName,
        IReadOnlyDictionary<string, string> pageTitle)
    {
        var groupEn = ReadTextValue(ownerGroupName, "en") ?? ReadTextValue(ownerGroupName, "zh") ?? "Group";
        var groupZh = ReadTextValue(ownerGroupName, "zh") ?? ReadTextValue(ownerGroupName, "en") ?? "小组";
        var titleEn = ReadTextValue(pageTitle, "en") ?? ReadTextValue(pageTitle, "zh") ?? "Untitled page";
        var titleZh = ReadTextValue(pageTitle, "zh") ?? ReadTextValue(pageTitle, "en") ?? "未命名页面";

        return new Dictionary<string, string>
        {
            ["en"] = Limit($"{groupEn}-{titleEn}", MaxAccessNameLength),
            ["zh"] = Limit($"{groupZh}-{titleZh}", MaxAccessNameLength)
        };
    }

    public static string? ExtractFirstSectionImage(IEnumerable<Section> sections)
    {
        foreach (var section in sections.OrderBy(x => x.Order).ThenBy(x => x.Id))
        {
            var contentImage = ExtractFromContentJson(section.ContentJson);
            if (contentImage is not null)
            {
                return contentImage;
            }

            var linkImage = section.Links
                .OrderBy(x => x.SortOrder)
                .ThenBy(x => x.Id)
                .Select(x => NormalizeImageUrl(x.ImageUrl))
                .FirstOrDefault(x => x is not null);
            if (linkImage is not null)
            {
                return linkImage;
            }
        }

        return null;
    }

    private static string? ExtractFromContentJson(string? contentJson)
    {
        if (string.IsNullOrWhiteSpace(contentJson))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(contentJson);
            return document.RootElement.ValueKind == JsonValueKind.Object
                ? ExtractFromObject(document.RootElement)
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? ExtractFromObject(JsonElement value)
    {
        foreach (var propertyName in PreferredImagePropertyNames)
        {
            if (TryGetPropertyIgnoreCase(value, propertyName, out var property) &&
                property.ValueKind == JsonValueKind.String)
            {
                var imageUrl = NormalizeImageUrl(property.GetString());
                if (imageUrl is not null)
                {
                    return imageUrl;
                }
            }
        }

        if (TryGetPropertyIgnoreCase(value, "media", out var media) &&
            media.ValueKind == JsonValueKind.Object &&
            IsImageMedia(media) &&
            TryGetPropertyIgnoreCase(media, "url", out var mediaUrl) &&
            mediaUrl.ValueKind == JsonValueKind.String)
        {
            var imageUrl = NormalizeImageUrl(mediaUrl.GetString());
            if (imageUrl is not null)
            {
                return imageUrl;
            }
        }

        foreach (var property in value.EnumerateObject())
        {
            if (property.Value.ValueKind == JsonValueKind.String)
            {
                if (LooksLikeImageProperty(property.Name))
                {
                    var imageUrl = NormalizeImageUrl(property.Value.GetString());
                    if (imageUrl is not null)
                    {
                        return imageUrl;
                    }
                }

                var htmlImageUrl = ExtractHtmlImage(property.Value.GetString());
                if (htmlImageUrl is not null)
                {
                    return htmlImageUrl;
                }
            }

            var nestedImage = property.Value.ValueKind switch
            {
                JsonValueKind.Object => ExtractFromObject(property.Value),
                JsonValueKind.Array => ExtractFromArray(property.Value),
                _ => null
            };
            if (nestedImage is not null)
            {
                return nestedImage;
            }
        }

        return null;
    }

    private static string? ExtractFromArray(JsonElement value)
    {
        foreach (var item in value.EnumerateArray())
        {
            var imageUrl = item.ValueKind switch
            {
                JsonValueKind.Object => ExtractFromObject(item),
                JsonValueKind.Array => ExtractFromArray(item),
                JsonValueKind.String => ExtractHtmlImage(item.GetString()),
                _ => null
            };
            if (imageUrl is not null)
            {
                return imageUrl;
            }
        }

        return null;
    }

    private static bool IsImageMedia(JsonElement media)
    {
        if (!TryGetPropertyIgnoreCase(media, "type", out var type) || type.ValueKind != JsonValueKind.String)
        {
            return true;
        }

        return string.Equals(type.GetString(), "image", StringComparison.OrdinalIgnoreCase);
    }

    private static bool TryGetPropertyIgnoreCase(JsonElement value, string propertyName, out JsonElement propertyValue)
    {
        foreach (var property in value.EnumerateObject())
        {
            if (string.Equals(property.Name, propertyName, StringComparison.OrdinalIgnoreCase))
            {
                propertyValue = property.Value;
                return true;
            }
        }

        propertyValue = default;
        return false;
    }

    private static bool LooksLikeImageProperty(string propertyName)
    {
        var normalized = propertyName.Replace("_", string.Empty).Replace("-", string.Empty).ToLowerInvariant();
        return !normalized.Contains("alt", StringComparison.Ordinal) &&
               !normalized.Contains("label", StringComparison.Ordinal) &&
               !normalized.Contains("title", StringComparison.Ordinal) &&
               (normalized.Contains("image", StringComparison.Ordinal) ||
                normalized.Contains("photo", StringComparison.Ordinal) ||
                normalized.Contains("poster", StringComparison.Ordinal) ||
                normalized.Contains("thumbnail", StringComparison.Ordinal) ||
                normalized.Contains("cover", StringComparison.Ordinal));
    }

    private static string? ExtractHtmlImage(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || !value.Contains("<img", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var match = HtmlImageSourceRegex().Match(value);
        if (!match.Success)
        {
            return null;
        }

        var source = match.Groups["double"].Success
            ? match.Groups["double"].Value
            : match.Groups["single"].Success
                ? match.Groups["single"].Value
                : match.Groups["bare"].Value;
        return NormalizeImageUrl(source);
    }

    private static string? NormalizeImageUrl(string? value)
    {
        var imageUrl = value?.Trim();
        if (string.IsNullOrWhiteSpace(imageUrl) || IsVideoUrl(imageUrl))
        {
            return null;
        }

        return Limit(imageUrl, MaxCardImageUrlLength);
    }

    private static bool IsVideoUrl(string value)
    {
        if (value.StartsWith("data:video/", StringComparison.OrdinalIgnoreCase) ||
            value.StartsWith("blob:", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var path = value.Split('?', '#')[0];
        return path.EndsWith(".mp4", StringComparison.OrdinalIgnoreCase) ||
               path.EndsWith(".webm", StringComparison.OrdinalIgnoreCase) ||
               path.EndsWith(".ogg", StringComparison.OrdinalIgnoreCase) ||
               path.EndsWith(".mov", StringComparison.OrdinalIgnoreCase) ||
               path.EndsWith(".m4v", StringComparison.OrdinalIgnoreCase);
    }

    private static string? ReadTextValue(IReadOnlyDictionary<string, string>? value, string key)
        => value is not null &&
           value.TryGetValue(key, out var text) &&
           !string.IsNullOrWhiteSpace(text)
            ? text.Trim()
            : null;

    private static string Limit(string value, int maxLength)
        => value.Length <= maxLength ? value : value[..maxLength];

    [GeneratedRegex("<img\\b[^>]*\\bsrc\\s*=\\s*(?:\"(?<double>[^\"]+)\"|'(?<single>[^']+)'|(?<bare>[^\\s>]+))", RegexOptions.IgnoreCase)]
    private static partial Regex HtmlImageSourceRegex();
}
