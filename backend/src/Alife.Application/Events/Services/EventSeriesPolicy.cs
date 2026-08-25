using System.Text.Json;
using Alife.Domain.Entities;

namespace Alife.Application.Events.Services;

public static class EventSeriesPolicy
{
    private static readonly HashSet<string> AllowedModules =
        new(["venue", "registration", "finance", "ram", "roster", "programme"], StringComparer.Ordinal);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static string? ValidationError(
        string nameEn,
        string nameZh,
        string descriptionEn,
        string descriptionZh,
        string timeZoneId,
        DateOnly anchorLocalDate,
        int startTimeMinutes,
        int durationMinutes,
        int intervalWeeks,
        int generationHorizonWeeks,
        int lowHorizonWeeks,
        string visibility,
        IReadOnlyList<string> modules)
    {
        if (string.IsNullOrWhiteSpace(nameEn) && string.IsNullOrWhiteSpace(nameZh))
            return "A series name is required in at least one language.";
        if (nameEn.Length > 300 || nameZh.Length > 300)
            return "Series names cannot exceed 300 characters per language.";
        if (descriptionEn.Length > 2000 || descriptionZh.Length > 2000)
            return "Series descriptions cannot exceed 2,000 characters per language.";
        if (anchorLocalDate == default)
            return "The first occurrence date is required.";
        if (startTimeMinutes is < 0 or >= 1440)
            return "The local start time is invalid.";
        if (durationMinutes is < 15 or > 4320)
            return "Series duration must be between 15 minutes and 3 days.";
        if (intervalWeeks is < 1 or > 12)
            return "Series interval must be between 1 and 12 weeks.";
        if (generationHorizonWeeks is < 1 or > 52)
            return "Generation horizon must be between 1 and 52 weeks.";
        if (lowHorizonWeeks is < 1 or > 26 || lowHorizonWeeks > generationHorizonWeeks)
            return "Low-horizon warning must be within the generation horizon.";
        if (!TryResolveTimeZone(timeZoneId, out _))
            return "The selected time zone is not supported.";
        if (visibility is not EventVisibilityPolicy.GroupVisible and not EventVisibilityPolicy.ChurchVisible and not EventVisibilityPolicy.Public)
            return "Series visibility is not supported.";
        if (modules.Any(module => !AllowedModules.Contains(module)))
            return "The series contains an unsupported default module.";
        return null;
    }

    public static IReadOnlyList<string> NormalizeModules(IEnumerable<string>? modules)
        => (modules ?? []).Where(AllowedModules.Contains).Distinct(StringComparer.Ordinal).OrderBy(x => x).ToArray();

    public static string SerializeModules(IEnumerable<string>? modules)
        => JsonSerializer.Serialize(NormalizeModules(modules), JsonOptions);

    public static IReadOnlyList<string> ReadModules(string json)
    {
        try { return NormalizeModules(JsonSerializer.Deserialize<string[]>(json, JsonOptions)); }
        catch (JsonException) { return []; }
    }

    public static IReadOnlyList<DateOnly> OccurrenceDates(EventSeries series, DateOnly fromLocalDate, int horizonWeeks)
    {
        var throughExclusive = fromLocalDate.AddDays(Math.Clamp(horizonWeeks, 1, 52) * 7);
        var stepDays = series.IntervalWeeks * 7;
        var candidate = series.AnchorLocalDate;
        if (candidate < fromLocalDate)
        {
            var elapsedDays = fromLocalDate.DayNumber - candidate.DayNumber;
            var jumps = (elapsedDays + stepDays - 1) / stepDays;
            candidate = candidate.AddDays(jumps * stepDays);
        }
        var result = new List<DateOnly>();
        while (candidate < throughExclusive)
        {
            result.Add(candidate);
            candidate = candidate.AddDays(stepDays);
        }
        return result;
    }

    public static bool TryCreateUtcRange(EventSeries series, DateOnly occurrenceDate, out DateTime startUtc, out DateTime endUtc)
    {
        startUtc = default;
        endUtc = default;
        if (!TryResolveTimeZone(series.TimeZoneId, out var timeZone)) return false;
        var localStart = DateTime.SpecifyKind(
            occurrenceDate.ToDateTime(TimeOnly.MinValue).AddMinutes(series.StartTimeMinutes),
            DateTimeKind.Unspecified);
        if (timeZone.IsInvalidTime(localStart)) return false;
        startUtc = TimeZoneInfo.ConvertTimeToUtc(localStart, timeZone);
        endUtc = startUtc.AddMinutes(series.DurationMinutes);
        return true;
    }

    public static DateOnly LocalToday(EventSeries series, DateTime utcNow)
    {
        if (!TryResolveTimeZone(series.TimeZoneId, out var timeZone)) return DateOnly.FromDateTime(utcNow);
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc), timeZone));
    }

    public static string CreateEventDataJson(EventSeries series, DateOnly occurrenceDate)
        => JsonSerializer.Serialize(new
        {
            description = new { en = series.DescriptionEn, zh = series.DescriptionZh },
            visibility = series.Visibility,
            publicationStatus = "draft",
            publicationConfirmed = false,
            enabledModules = ReadModules(series.DefaultModulesJson),
            timeZoneId = series.TimeZoneId,
            eventSeriesId = series.Id,
            seriesOccurrenceDate = occurrenceDate.ToString("yyyy-MM-dd")
        }, JsonOptions);

    public static bool TryResolveTimeZone(string timeZoneId, out TimeZoneInfo timeZone)
    {
        try
        {
            timeZone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId.Trim());
            return true;
        }
        catch (TimeZoneNotFoundException) { }
        catch (InvalidTimeZoneException) { }
        timeZone = TimeZoneInfo.Utc;
        return false;
    }
}
