using System.Text.RegularExpressions;

namespace Alife.Application.ContentPosts;

internal static partial class ContentPostRules
{
    private const int MaxTitleLength = 300;
    private const int MaxSummaryLength = 2000;
    private const int MaxBodyLength = 500_000;

    public static string? ValidateLocalizedContent(
        IReadOnlyDictionary<string, string> title,
        IReadOnlyDictionary<string, string> summary,
        IReadOnlyDictionary<string, string> body)
    {
        if (!ContentPostMapper.HasLocalizedValue(title))
        {
            return "An English or Chinese title is required.";
        }
        if (!ContentPostMapper.HasLocalizedValue(summary))
        {
            return "An English or Chinese summary is required.";
        }
        if (!ContentPostMapper.HasLocalizedValue(body))
        {
            return "An English or Chinese body is required.";
        }
        if (title.Values.Any(x => x.Length > MaxTitleLength))
        {
            return $"Each localized title must be {MaxTitleLength} characters or fewer.";
        }
        if (summary.Values.Any(x => x.Length > MaxSummaryLength))
        {
            return $"Each localized summary must be {MaxSummaryLength} characters or fewer.";
        }
        if (body.Values.Any(x => x.Length > MaxBodyLength))
        {
            return $"Each localized body must be {MaxBodyLength} characters or fewer.";
        }

        return null;
    }

    public static string NormalizeSlug(string? value, Guid postId)
    {
        var normalized = SlugSeparatorsRegex().Replace(value?.Trim().ToLowerInvariant() ?? string.Empty, "-");
        normalized = InvalidSlugCharactersRegex().Replace(normalized, string.Empty);
        normalized = RepeatedHyphenRegex().Replace(normalized, "-").Trim('-');
        if (normalized.Length > 180)
        {
            normalized = normalized[..180].TrimEnd('-');
        }

        return string.IsNullOrWhiteSpace(normalized)
            ? ($"post-{postId:N}")[..17]
            : normalized;
    }

    public static bool IsValidSlug(string value) =>
        value.Length is > 0 and <= 180 && ValidSlugRegex().IsMatch(value);

    public static string? ValidateOptionalHash(string? value, string fieldName)
    {
        var normalized = NormalizeOptional(value);
        return normalized is not null && !Sha256Regex().IsMatch(normalized)
            ? $"{fieldName} must be a 64-character hexadecimal SHA-256 value."
            : null;
    }

    public static string? NormalizeHash(string? value) => NormalizeOptional(value)?.ToLowerInvariant();

    public static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    [GeneratedRegex(@"[\s_]+", RegexOptions.CultureInvariant)]
    private static partial Regex SlugSeparatorsRegex();

    [GeneratedRegex(@"[^a-z0-9-]", RegexOptions.CultureInvariant)]
    private static partial Regex InvalidSlugCharactersRegex();

    [GeneratedRegex(@"-+", RegexOptions.CultureInvariant)]
    private static partial Regex RepeatedHyphenRegex();

    [GeneratedRegex(@"^[a-fA-F0-9]{64}$", RegexOptions.CultureInvariant)]
    private static partial Regex Sha256Regex();

    [GeneratedRegex(@"^[a-z0-9]+(?:-[a-z0-9]+)*$", RegexOptions.CultureInvariant)]
    private static partial Regex ValidSlugRegex();
}
