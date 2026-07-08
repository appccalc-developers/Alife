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
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task PurgeApiPathsAsync(
        IReadOnlyCollection<string> paths,
        CancellationToken cancellationToken = default)
    {
        if (paths.Count == 0)
        {
            return;
        }

        var options = ReadOptions();
        if (!options.IsConfigured)
        {
            logger.LogWarning(
                "Cloudflare speed-layer cache sync skipped because configuration is missing. SyncWorkerBaseUrl set: {HasBaseUrl}; SyncApiToken set: {HasToken}",
                !string.IsNullOrWhiteSpace(options.SyncWorkerBaseUrl),
                !string.IsNullOrWhiteSpace(options.SyncApiToken));
            return;
        }

        if (!TryCreateEndpoint(options.SyncWorkerBaseUrl, out var endpoint))
        {
            logger.LogWarning("Cloudflare speed-layer cache sync skipped because SyncWorkerBaseUrl is invalid.");
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

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
            {
                Content = JsonContent.Create(new { paths = distinctPaths }, options: JsonOptions)
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

    private CloudflareSpeedLayerOptions ReadOptions()
        => new(
            configuration["Cloudflare:SyncWorkerBaseUrl"],
            configuration["Cloudflare:SyncApiToken"]);

    private static bool TryCreateEndpoint(string? baseUrl, out Uri endpoint)
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
        string? SyncApiToken)
    {
        public bool IsConfigured =>
            !string.IsNullOrWhiteSpace(SyncWorkerBaseUrl) &&
            !string.IsNullOrWhiteSpace(SyncApiToken);
    }
}
