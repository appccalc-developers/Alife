using System.Security.Cryptography;
using System.Text;

namespace Alife.Application.Events.Services;

public static class EventResetTargetIdentity
{
    private const string HashVersion = "event-reset-target/v1";
    private const string AzureSqlSuffix = ".database.windows.net";

    public static string CalculateHash(string server, string database)
    {
        var canonicalServer = NormalizeServer(server);
        var canonicalDatabase = NormalizeDatabase(database);
        var value = $"{HashVersion}\n{canonicalServer}\n{canonicalDatabase}";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
    }

    public static bool MatchesServer(string left, string right) =>
        string.Equals(NormalizeServer(left), NormalizeServer(right), StringComparison.Ordinal);

    public static bool MatchesAzureResourceServer(string endpoint, string resourceServer)
        => string.Equals(NormalizeServer(endpoint), NormalizeServer(resourceServer), StringComparison.Ordinal);

    public static bool MatchesDatabase(string left, string right) =>
        string.Equals(NormalizeDatabase(left), NormalizeDatabase(right), StringComparison.Ordinal);

    private static string NormalizeServer(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidOperationException("The Event reset SQL server identity is missing.");

        var normalized = value.Trim();
        if (normalized.StartsWith("tcp:", StringComparison.OrdinalIgnoreCase))
            normalized = normalized[4..];
        var port = normalized.IndexOf(',');
        if (port >= 0)
            normalized = normalized[..port];
        normalized = normalized.Trim().TrimEnd('.').ToLowerInvariant();
        if (normalized.EndsWith(AzureSqlSuffix, StringComparison.Ordinal))
            normalized = normalized[..^AzureSqlSuffix.Length];
        if (normalized.Length == 0)
            throw new InvalidOperationException("The Event reset SQL server identity is missing.");
        return normalized;
    }

    private static string NormalizeDatabase(string value)
    {
        var normalized = value?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(normalized))
            throw new InvalidOperationException("The Event reset SQL database identity is missing.");
        return normalized;
    }
}
