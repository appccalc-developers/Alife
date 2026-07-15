using System.Text.Json;

namespace Alife.Application.Admin;

internal static class PagePrimaryMenuText
{
    public static IReadOnlyDictionary<string, string>? Normalize(IReadOnlyDictionary<string, string>? value)
    {
        var en = ReadValue(value, "en");
        var zh = ReadValue(value, "zh");
        if (en is null || zh is null)
        {
            return null;
        }

        return new Dictionary<string, string>
        {
            ["en"] = en.Length <= 120 ? en : en[..120],
            ["zh"] = zh.Length <= 120 ? zh : zh[..120]
        };
    }

    public static IReadOnlyDictionary<string, string> Read(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return new Dictionary<string, string>();
        }

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(value) ?? new Dictionary<string, string>();
        }
        catch
        {
            return new Dictionary<string, string> { ["en"] = value };
        }
    }

    public static string Write(IReadOnlyDictionary<string, string> value)
        => JsonSerializer.Serialize(value);

    private static string? ReadValue(IReadOnlyDictionary<string, string>? value, string key)
        => value is not null &&
           value.TryGetValue(key, out var text) &&
           !string.IsNullOrWhiteSpace(text)
            ? text.Trim()
            : null;
}
