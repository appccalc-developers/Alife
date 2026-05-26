using System.Globalization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Http;

public static class ConditionalRequestExtensions
{
    private const int CacheTtlSeconds = 24*60*60;

    extension(ControllerBase controller)
    {
        public bool IsPublicNotModified(DateTime? updatedUtc)
        {
            controller.ApplyPublicSyncCacheHeaders(updatedUtc);

            return MatchesIfNoneMatch(controller.Request.Headers.IfNoneMatch, CreateEtag(updatedUtc));
        }

        public bool IsPrivateNotModified(DateTime? updatedUtc)
        {
            controller.ApplyPrivateSyncCacheHeaders(updatedUtc);

            return MatchesIfNoneMatch(controller.Request.Headers.IfNoneMatch, CreateEtag(updatedUtc));
        }

        public void ApplyPublicSyncCacheHeaders(DateTime? updatedUtc)
        {
            controller.Response.Headers.ETag = CreateEtag(updatedUtc);
            controller.Response.Headers.CacheControl = $"public, max-age={CacheTtlSeconds}";
            AppendVary(controller.Response.Headers, "Accept-Encoding");
        }

        public void ApplyPrivateSyncCacheHeaders(DateTime? updatedUtc)
        {
            controller.Response.Headers.ETag = CreateEtag(updatedUtc);
            controller.Response.Headers.CacheControl = "private, no-cache";
            AppendVary(controller.Response.Headers, "Accept-Encoding");
            AppendVary(controller.Response.Headers, "Cookie");
            AppendVary(controller.Response.Headers, "Authorization");
        }

        public void ApplyNoStoreHeaders()
        {
            controller.Response.Headers.CacheControl = "no-store";
            controller.Response.Headers.Pragma = "no-cache";
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
