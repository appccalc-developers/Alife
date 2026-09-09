using System.Globalization;
using System.Text.RegularExpressions;
using Alife.Domain.Entities;

namespace Alife.Application.Sermons.Services;

public static partial class SermonMetadata
{
    public const int CurrentVersion = 1;
    public sealed record Parsed(string Title, string SpeakerName, DateTime? PreachedAtUtc);

    public static Parsed Parse(string sourceTitle, DateTime? publishedAtUtc)
    {
        var title = sourceTitle.Trim();
        DateOnly? date = null;
        var prefix = DatePrefix().Match(title);
        if (prefix.Success)
        {
            var candidate = $"{prefix.Groups[1].Value}-{int.Parse(prefix.Groups[2].Value):D2}-{int.Parse(prefix.Groups[3].Value):D2}";
            if (DateOnly.TryParseExact(candidate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed)) date = parsed;
            title = title[prefix.Length..];
        }
        if (date is null && publishedAtUtc.HasValue)
        {
            var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(publishedAtUtc.Value, DateTimeKind.Utc),
                TimeZoneInfo.FindSystemTimeZoneById("Pacific/Auckland"));
            var publicationDate = DateOnly.FromDateTime(local);
            date = publicationDate.AddDays(-((int)publicationDate.DayOfWeek == 0 ? 7 : (int)publicationDate.DayOfWeek));
        }
        var speaker = SpeakerSuffix().Match(title);
        var speakerName = speaker.Success ? Trim(speaker.Groups[1].Value.Split('|', '｜')[0]) : string.Empty;
        if (speaker.Success) title = title[..speaker.Index];
        title = Trim(title);
        title = ServicePrefix().Replace(title, string.Empty);
        title = BroadcastPrefix().Replace(Trim(title), string.Empty);
        // Store the calendar date at midnight UTC; clients render it as a date, not an event timestamp.
        var topic = Trim(title);
        if (topic.Length == 0) topic = sourceTitle.Contains("主日", StringComparison.Ordinal) ? "主日证道" : "Sunday Sermon";
        return new Parsed(topic, speakerName, date?.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
    }

    public static bool NormalizeExisting(Sermon sermon)
    {
        if (sermon.MetadataVersion >= CurrentVersion) return false;
        sermon.SourceTitle ??= sermon.Title;
        sermon.PublishedAtUtc ??= sermon.PreachedAtUtc;
        Apply(sermon, sermon.SourceTitle, sermon.PublishedAtUtc);
        return true;
    }

    public static void Apply(Sermon sermon, string sourceTitle, DateTime? publishedAtUtc)
    {
        var parsed = Parse(sourceTitle, publishedAtUtc);
        sermon.SourceTitle = sourceTitle;
        sermon.PublishedAtUtc = publishedAtUtc;
        sermon.Title = parsed.Title;
        sermon.SpeakerName = parsed.SpeakerName;
        sermon.PreachedAtUtc = parsed.PreachedAtUtc;
        sermon.MetadataVersion = CurrentVersion;
    }

    private static string Trim(string value) => value.Trim().Trim(':', '：', '|', '｜', '-', '–', '—', '·').Trim();

    [GeneratedRegex(@"^(\d{4})(?:\s*[-/._年]\s*|\s+)(\d{1,2})(?:\s*[-/._月]\s*|\s+)(\d{1,2})(?:日)?(?=\D|$)")]
    private static partial Regex DatePrefix();
    [GeneratedRegex(@"(?:讲员|講員|讲者|講者|Speaker)\s*[:：]?\s*(.+)$", RegexOptions.IgnoreCase)]
    private static partial Regex SpeakerSuffix();
    [GeneratedRegex(@"^(?:主日(?:证道|證道|正道|圣道|聖道|庆典|慶典|崇拜)|Sunday\s+(?:Sermon|Service))\s*", RegexOptions.IgnoreCase)]
    private static partial Regex ServicePrefix();
    [GeneratedRegex(@"^(?:直播|Live)\s*[:：]?\s*", RegexOptions.IgnoreCase)]
    private static partial Regex BroadcastPrefix();
}
