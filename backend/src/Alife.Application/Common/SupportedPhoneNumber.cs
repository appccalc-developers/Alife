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
}
