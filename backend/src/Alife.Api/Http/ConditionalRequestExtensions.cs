using Microsoft.AspNetCore.Mvc;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Alife.Api.Http;

public static class ConditionalRequestExtensions
{
    private const int CacheTtlSeconds = 24*60*60;

    extension(ControllerBase controller)
    {
        public void ApplyPublicCacheHeaders()
        {
            // Browsers must revalidate public API data. Shared caches may keep
            // it for the full TTL and are actively invalidated after writes.
            controller.Response.Headers.CacheControl =
                $"public, max-age=0, s-maxage={CacheTtlSeconds}, must-revalidate";
            AppendVary(controller.Response.Headers, "Accept-Encoding");
        }

        public void ApplyPrivateNoCacheHeaders()
        {
            controller.Response.Headers.CacheControl = "private, no-cache";
            AppendVary(controller.Response.Headers, "Accept-Encoding");
            AppendVary(controller.Response.Headers, "Cookie");
            AppendVary(controller.Response.Headers, "Authorization");
        }

        public bool ApplyPrivateConditionalCacheHeaders<T>(T value)
        {
            controller.ApplyPrivateNoCacheHeaders();

            var payload = JsonSerializer.Serialize(value);
            var hash = SHA256.HashData(Encoding.UTF8.GetBytes(payload));
            var etag = $"W/\"{Convert.ToHexString(hash.AsSpan(0, 8)).ToLowerInvariant()}\"";
            controller.Response.Headers.ETag = etag;

            return MatchesIfNoneMatch(controller.Request.Headers.IfNoneMatch, etag);
        }

        public void ApplyNoStoreHeaders()
        {
            controller.Response.Headers.CacheControl = "no-store";
            controller.Response.Headers.Pragma = "no-cache";
        }
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

    private static bool MatchesIfNoneMatch(string? headerValue, string etag)
    {
        if (string.IsNullOrWhiteSpace(headerValue))
        {
            return false;
        }

        return headerValue
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Any(candidate => candidate == "*" || string.Equals(candidate, etag, StringComparison.Ordinal));
    }
}
