using System.Net.Http.Json;
using Alife.Application.Common.Sync;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Alife.Infrastructure.Sync;

public sealed class CloudflareSyncVersionService(
    HttpClient httpClient,
    IConfiguration configuration,
    ILogger<CloudflareSyncVersionService> logger)
    : ISyncVersionService
{
    private readonly string _baseUrl = (configuration["Cloudflare:SyncWorkerBaseUrl"] ?? "").TrimEnd('/');
    private readonly string _apiToken = configuration["Cloudflare:SyncApiToken"] ?? "";

    public async Task TouchAsync(string key, long unixTimeMilliseconds, CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            logger.LogDebug("Cloudflare sync worker is not configured; skipped version touch for {Key}.", key);
            return;
        }

        using var request = new HttpRequestMessage(HttpMethod.Put, $"{_baseUrl}/kv/{Uri.EscapeDataString(key)}")
        {
            Content = JsonContent.Create(new { version = unixTimeMilliseconds })
        };
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _apiToken);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    public async Task<SyncVersionSnapshot> GetBulkAsync(IReadOnlyCollection<string> keys, CancellationToken cancellationToken = default)
    {
        if (!IsConfigured || keys.Count == 0)
        {
            return new SyncVersionSnapshot(new Dictionary<string, long>());
        }

        var query = string.Join(",", keys.Select(Uri.EscapeDataString));
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{_baseUrl}/kv/bulk?keys={query}");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _apiToken);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        var payload = await response.Content.ReadFromJsonAsync<BulkResponse>(cancellationToken: cancellationToken);
        return new SyncVersionSnapshot(payload?.Versions ?? new Dictionary<string, long>());
    }

    private bool IsConfigured => !string.IsNullOrWhiteSpace(_baseUrl) && !string.IsNullOrWhiteSpace(_apiToken);

    private sealed record BulkResponse(Dictionary<string, long> Versions);
}

