using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Alife.Infrastructure.Integrations;

public sealed class CloudflareSpeedLayerCacheService(
    HttpClient httpClient,
    IConfiguration configuration,
    ILogger<CloudflareSpeedLayerCacheService> logger) : ICloudflareSpeedLayerCacheService
{
    private const string SermonsPath = "/api/sermons";
    private const string SermonsCacheTag = "alife-sermons";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task PurgeApiPathsAsync(
        IReadOnlyCollection<string> paths,
        CancellationToken cancellationToken = default)
    {
        if (paths.Count == 0)
        {
            return;
        }

        var distinctPaths = paths
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Distinct(StringComparer.Ordinal)
            .ToArray();
        if (distinctPaths.Length == 0)
        {
            return;
        }

        var options = ReadOptions();
        var tasks = new List<Task>(2);
        if (options.IsWorkerSyncConfigured)
        {
            tasks.Add(PurgeWorkerCacheAsync(options, distinctPaths, cancellationToken));
        }
        else
        {
            logger.LogWarning(
                "Cloudflare speed-layer local cache purge skipped because configuration is missing. SyncWorkerBaseUrl set: {HasBaseUrl}; SyncApiToken set: {HasToken}",
                !string.IsNullOrWhiteSpace(options.SyncWorkerBaseUrl),
                !string.IsNullOrWhiteSpace(options.SyncApiToken));
        }

        var cacheTags = GetGlobalPurgeTags(distinctPaths);
        if (cacheTags.Length > 0)
        {
            if (options.IsGlobalPurgeConfigured)
            {
                tasks.Add(PurgeGlobalCacheTagsAsync(options, cacheTags, cancellationToken));
            }
            else
            {
                logger.LogWarning(
                    "Cloudflare global cache-tag purge skipped because configuration is missing. ZoneId set: {HasZoneId}; ApiToken set: {HasApiToken}",
                    !string.IsNullOrWhiteSpace(options.ZoneId),
                    !string.IsNullOrWhiteSpace(options.ApiToken));
            }
        }

        await Task.WhenAll(tasks);
    }

    private async Task PurgeWorkerCacheAsync(
        CloudflareSpeedLayerOptions options,
        IReadOnlyCollection<string> paths,
        CancellationToken cancellationToken)
    {
        if (!TryCreateWorkerEndpoint(options.SyncWorkerBaseUrl, out var endpoint))
        {
            logger.LogWarning("Cloudflare speed-layer local cache purge skipped because SyncWorkerBaseUrl is invalid.");
            return;
        }

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
            {
                Content = JsonContent.Create(new { paths }, options: JsonOptions)
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.SyncApiToken);

            using var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "Cloudflare speed-layer cache purge returned {StatusCode}.",
                    (int)response.StatusCode);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Cloudflare speed-layer cache purge failed.");
        }
    }

    private async Task PurgeGlobalCacheTagsAsync(
        CloudflareSpeedLayerOptions options,
        IReadOnlyCollection<string> cacheTags,
        CancellationToken cancellationToken)
    {
        try
        {
            var endpoint = new Uri(
                $"https://api.cloudflare.com/client/v4/zones/{Uri.EscapeDataString(options.ZoneId!)}/purge_cache");
            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
            {
                Content = JsonContent.Create(new { tags = cacheTags }, options: JsonOptions)
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.ApiToken);

            using var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "Cloudflare global cache-tag purge returned {StatusCode}.",
                    (int)response.StatusCode);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Cloudflare global cache-tag purge failed.");
        }
    }

    private CloudflareSpeedLayerOptions ReadOptions()
        => new(
            configuration["Cloudflare:SyncWorkerBaseUrl"],
            configuration["Cloudflare:SyncApiToken"],
            configuration["Cloudflare:ZoneId"],
            configuration["Cloudflare:ApiToken"]);

    private static string[] GetGlobalPurgeTags(IEnumerable<string> paths)
        => paths.Contains(SermonsPath, StringComparer.Ordinal)
            ? [SermonsCacheTag]
            : [];

    private static bool TryCreateWorkerEndpoint(string? baseUrl, out Uri endpoint)
    {
        endpoint = null!;
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            return false;
        }

        var created = Uri.TryCreate(
            $"{baseUrl.TrimEnd('/')}/api/internal/cache/invalidate",
            UriKind.Absolute,
            out var createdEndpoint);
        endpoint = createdEndpoint!;
        return created;
    }

    private sealed record CloudflareSpeedLayerOptions(
        string? SyncWorkerBaseUrl,
        string? SyncApiToken,
        string? ZoneId,
        string? ApiToken)
    {
        public bool IsWorkerSyncConfigured =>
            !string.IsNullOrWhiteSpace(SyncWorkerBaseUrl) &&
            !string.IsNullOrWhiteSpace(SyncApiToken);

        public bool IsGlobalPurgeConfigured =>
            !string.IsNullOrWhiteSpace(ZoneId) &&
            !string.IsNullOrWhiteSpace(ApiToken);
    }
}
