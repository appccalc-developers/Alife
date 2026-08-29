namespace Alife.Application.IdentityAccess;

public static class IdentityPathPolicy
{
    public static string NormalizeReturnPath(string? value)
    {
        var candidate = value?.Trim() ?? string.Empty;
        if (candidate.Length == 0 || candidate.Length > 1000 ||
            !candidate.StartsWith('/') || candidate.StartsWith("//", StringComparison.Ordinal) ||
            candidate.Contains('\\') || candidate.Any(char.IsControl) ||
            Uri.TryCreate(candidate, UriKind.Absolute, out _))
        {
            return string.Empty;
        }

        var path = candidate.Split('?', '#')[0];
        if (path.Equals("/onboarding", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/onboarding/", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/activate/", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/join/", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/application/", StringComparison.OrdinalIgnoreCase) ||
            path.Equals("/internal/alpha-login", StringComparison.OrdinalIgnoreCase))
        {
            return string.Empty;
        }

        return candidate;
    }
}
