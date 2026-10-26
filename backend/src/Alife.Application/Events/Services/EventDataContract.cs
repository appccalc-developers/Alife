using System.Text.Json;
using System.Globalization;

namespace Alife.Application.Events.Services;

public static class EventDataContract
{
    private static readonly IReadOnlySet<string> AllowedFields = new HashSet<string>(
        [
            "id", "organizerId", "organizerDisplayName", "visibility", "personResponsible",
            "purpose", "title", "description", "locationName", "startDate", "endDate",
            "registrationDeadline", "maxCapacity", "registrationMode", "registrationRulesVersion",
            "capacityUnit", "hardConstraints", "baseFeePerAdult", "baseFeePerChild", "currency",
            "posterImageUrl", "galleryUrls", "timeZone", "requiresRam"
        ], StringComparer.Ordinal);

    private static readonly IReadOnlySet<string> BilingualFields = new HashSet<string>(
        ["purpose", "title", "description", "locationName"], StringComparer.Ordinal);

    private static readonly IReadOnlySet<string> StringFields = new HashSet<string>(
        [
            "id", "organizerId", "organizerDisplayName", "personResponsible", "startDate", "endDate",
            "registrationDeadline", "capacityUnit", "currency", "posterImageUrl", "timeZone"
        ], StringComparer.Ordinal);

    public static string? Validate(
        string json,
        string? titleEn = null,
        string? titleZh = null,
        DateTime? startDate = null,
        DateTime? endDate = null)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
                return "EventDataJson must be a JSON object.";

            var names = new HashSet<string>(StringComparer.Ordinal);
            foreach (var property in document.RootElement.EnumerateObject())
            {
                if (!names.Add(property.Name))
                    return $"EventDataJson contains a duplicate field: {property.Name}.";
                if (property.Name is "optionalActivities" or "legacySummary")
                    return $"EventDataJson field '{property.Name}' was retired in Event 2.0.";
                if (!AllowedFields.Contains(property.Name))
                    return $"EventDataJson contains an unsupported field: {property.Name}.";
                if (BilingualFields.Contains(property.Name) && !IsBilingual(property.Value))
                    return $"EventDataJson field '{property.Name}' must contain string en and zh values.";
                if (StringFields.Contains(property.Name) &&
                    property.Value.ValueKind is not (JsonValueKind.String or JsonValueKind.Null))
                    return $"EventDataJson field '{property.Name}' must be a string or null.";
            }

            var root = document.RootElement;
            if (titleEn is not null || titleZh is not null)
            {
                if (!root.TryGetProperty("title", out var title) || !TryReadBilingual(title, out var jsonTitleEn, out var jsonTitleZh))
                    return "EventDataJson title is required and must contain exactly string en and zh values.";
                var canonicalEn = string.IsNullOrWhiteSpace(jsonTitleEn) ? jsonTitleZh : jsonTitleEn;
                var canonicalZh = string.IsNullOrWhiteSpace(jsonTitleZh) ? jsonTitleEn : jsonTitleZh;
                if (!string.Equals(canonicalEn, titleEn, StringComparison.Ordinal) ||
                    !string.Equals(canonicalZh, titleZh, StringComparison.Ordinal))
                    return "EventDataJson title must match the Event title fields.";
            }
            if (startDate.HasValue && !MatchesDateTime(root, "startDate", startDate.Value))
                return "EventDataJson startDate must match the Event startDate.";
            if (endDate.HasValue && !MatchesDateTime(root, "endDate", endDate.Value))
                return "EventDataJson endDate must match the Event endDate.";
            if (root.TryGetProperty("registrationMode", out var registrationMode) &&
                (registrationMode.ValueKind != JsonValueKind.String ||
                 registrationMode.GetString() is not ("none" or "required")))
                return "EventDataJson registrationMode must be none or required.";
            if (root.TryGetProperty("maxCapacity", out var capacity) &&
                (capacity.ValueKind != JsonValueKind.Number || !capacity.TryGetInt32(out var count) || count < 0))
                return "EventDataJson maxCapacity must be a non-negative integer.";
            if (root.TryGetProperty("registrationRulesVersion", out var rulesVersion) &&
                (rulesVersion.ValueKind != JsonValueKind.Number || !rulesVersion.TryGetInt32(out var version) || version < 1))
                return "EventDataJson registrationRulesVersion must be a positive integer.";
            if (root.TryGetProperty("capacityUnit", out var capacityUnit) &&
                (capacityUnit.ValueKind != JsonValueKind.String || capacityUnit.GetString() is not ("Families" or "People")))
                return "EventDataJson capacityUnit must be Families or People.";
            if (root.TryGetProperty("hardConstraints", out var constraints) && !ValidConstraints(constraints))
                return "EventDataJson hardConstraints must contain only current Event rule objects.";
            if (root.TryGetProperty("galleryUrls", out var gallery) &&
                (gallery.ValueKind != JsonValueKind.Array || gallery.EnumerateArray().Any(x => x.ValueKind != JsonValueKind.String)))
                return "EventDataJson galleryUrls must be an array of strings.";
            if (root.TryGetProperty("requiresRam", out var requiresRam) &&
                requiresRam.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
                return "EventDataJson requiresRam must be a boolean.";
            foreach (var field in new[] { "baseFeePerAdult", "baseFeePerChild" })
                if (root.TryGetProperty(field, out var fee) &&
                    fee.ValueKind is not (JsonValueKind.Number or JsonValueKind.Null))
                    return $"EventDataJson field '{field}' must be a number or null.";
            return null;
        }
        catch (JsonException)
        {
            return "EventDataJson must be a valid JSON object.";
        }
    }

    private static bool IsBilingual(JsonElement value) => TryReadBilingual(value, out _, out _);

    private static bool TryReadBilingual(JsonElement value, out string en, out string zh)
    {
        en = string.Empty;
        zh = string.Empty;
        if (value.ValueKind != JsonValueKind.Object) return false;
        var properties = value.EnumerateObject().ToArray();
        if (properties.Length != 2 || properties.Select(x => x.Name).Distinct(StringComparer.Ordinal).Count() != 2 ||
            properties.Any(x => x.Name is not ("en" or "zh")) ||
            !value.TryGetProperty("en", out var enValue) || enValue.ValueKind != JsonValueKind.String ||
            !value.TryGetProperty("zh", out var zhValue) || zhValue.ValueKind != JsonValueKind.String)
            return false;
        en = enValue.GetString()!;
        zh = zhValue.GetString()!;
        return true;
    }

    private static bool ValidConstraints(JsonElement value)
    {
        if (value.ValueKind != JsonValueKind.Array) return false;
        foreach (var item in value.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object) return false;
            var properties = item.EnumerateObject().ToArray();
            if (properties.Length != 3 || properties.Select(x => x.Name).Distinct(StringComparer.Ordinal).Count() != 3 ||
                properties.Any(x => x.Name is not ("ruleKey" or "displayMessage" or "isMandatory")) ||
                !item.TryGetProperty("ruleKey", out var key) || key.ValueKind != JsonValueKind.String ||
                !item.TryGetProperty("displayMessage", out var message) || !IsBilingual(message) ||
                !item.TryGetProperty("isMandatory", out var mandatory) || mandatory.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
                return false;
        }
        return true;
    }

    private static bool MatchesDateTime(JsonElement root, string field, DateTime expected)
    {
        if (!root.TryGetProperty(field, out var value) || value.ValueKind != JsonValueKind.String ||
            !DateTimeOffset.TryParse(value.GetString(), CultureInfo.InvariantCulture,
                DateTimeStyles.AllowWhiteSpaces | DateTimeStyles.AssumeUniversal, out var parsed))
            return false;
        var expectedUtc = expected.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(expected, DateTimeKind.Utc)
            : expected.ToUniversalTime();
        return parsed.UtcDateTime == expectedUtc;
    }
}
