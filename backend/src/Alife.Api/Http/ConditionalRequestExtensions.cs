using System.Globalization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Http;

public static class ConditionalRequestExtensions
{
    private const int CacheTtlSeconds = 60;

    extension(ControllerBase controller)
    {
        public bool IsNotModified(DateTime? updatedUtc)
        {
            var etag = CreateEtag(updatedUtc);
            controller.Response.Headers.ETag = etag;
            controller.Response.Headers.CacheControl = $"public, max-age={CacheTtlSeconds}";
            AppendVary(controller.Response.Headers, "Accept-Encoding");

            return MatchesIfNoneMatch(controller.Request.Headers.IfNoneMatch, etag);
        }

        public void ApplySyncCacheHeaders(DateTime? updatedUtc)
        {
            controller.Response.Headers.ETag = CreateEtag(updatedUtc);
            controller.Response.Headers.CacheControl = $"public, max-age={CacheTtlSeconds}";
            AppendVary(controller.Response.Headers, "Accept-Encoding");
        }
    }

    private static string CreateEtag(DateTime? updatedUtc)
        => $"\"{(updatedUtc?.Ticks ?? 0L).ToString("X", CultureInfo.InvariantCulture)}\"";

    private static bool MatchesIfNoneMatch(string? ifNoneMatch, string etag)
    {
        if (string.IsNullOrWhiteSpace(ifNoneMatch))
        {
            return false;
        }

        return ifNoneMatch
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Any(value => string.Equals(value, etag, StringComparison.Ordinal) ||
                          string.Equals(value, $"W/{etag}", StringComparison.Ordinal));
    }

    private static void AppendVary(IHeaderDictionary headers, string value)
    {
        var vary = headers.Vary.ToString();
        if (string.IsNullOrWhiteSpace(vary))
        {
            headers.Vary = value;
            return;
        }

        if (!vary.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Any(x => string.Equals(x, value, StringComparison.OrdinalIgnoreCase)))
        {
            headers.Vary = $"{vary}, {value}";
        }
    }
}
