namespace Alife.Application.Common;

public static class SupportedPhoneNumber
{
    private static readonly IReadOnlyDictionary<string, (int Min, int Max)> RegionLengths =
        new Dictionary<string, (int Min, int Max)>
        {
            ["+64"] = (8, 10),
            ["+86"] = (10, 12),
            ["+886"] = (8, 9),
            ["+852"] = (8, 8),
            ["+853"] = (8, 8),
            ["+61"] = (9, 9)
        };

    public static bool IsValid(string value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 16)
        {
            return false;
        }

        var region = RegionLengths
            .OrderByDescending(entry => entry.Key.Length)
            .FirstOrDefault(entry => value.StartsWith(entry.Key, StringComparison.Ordinal));
        if (region.Key is null)
        {
            return false;
        }

        var nationalNumber = value[region.Key.Length..];
        return nationalNumber.Length >= region.Value.Min &&
               nationalNumber.Length <= region.Value.Max &&
               nationalNumber.All(char.IsDigit);
    }

    public static string[] GetE164Candidates(string value)
    {
        var trimmed = value.Trim();
        if (trimmed.Length == 0 || trimmed.Any(character =>
                !char.IsDigit(character) &&
                !char.IsWhiteSpace(character) &&
                character is not '+' and not '-' and not '(' and not ')'))
        {
            return [];
        }

        var plusCount = trimmed.Count(character => character == '+');
        if (plusCount > 1 || (plusCount == 1 && trimmed[0] != '+'))
        {
            return [];
        }

        var digits = string.Concat(trimmed.Where(char.IsDigit));
        if (digits.Length == 0)
        {
            return [];
        }

        if (plusCount == 1)
        {
            var internationalCandidate = $"+{digits}";
            return IsValid(internationalCandidate) ? [internationalCandidate] : [];
        }

        var nationalNumber = digits.StartsWith('0') ? digits[1..] : digits;
        return RegionLengths.Keys
            .Select(region => $"{region}{nationalNumber}")
            .Where(IsValid)
            .Distinct(StringComparer.Ordinal)
            .ToArray();
    }
}
