using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Microsoft.Extensions.Configuration;

namespace Alife.Infrastructure.Integrations;

public sealed class CloudflareRamSyncAi(HttpClient http, IConfiguration configuration) : IRamSyncAi
{
    public async Task<IReadOnlyList<RamSyncRisk>> IdentifyAsync(RamSyncContext context, CancellationToken ct)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(45));
        ct = timeout.Token; // Bound response-body reads as well as receipt of headers.
        var token = configuration["Cloudflare:RamSyncApiToken"];
        if (string.IsNullOrWhiteSpace(token) || !Uri.TryCreate(configuration["Cloudflare:SyncWorkerBaseUrl"], UriKind.Absolute, out var origin) || origin.Scheme != "https")
            throw new HttpRequestException("RAM synchronization is not configured.");
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(origin, "/api/internal/ram/identify"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        request.Content = JsonContent.Create(context, options: RamEvaluator.Json);
        using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        response.EnsureSuccessStatusCode();
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var buffer = new MemoryStream();
        var bytes = new byte[4096]; int count;
        while ((count = await stream.ReadAsync(bytes, ct)) > 0)
        {
            if (buffer.Length + count > 180000) throw new InvalidDataException("RAM result exceeds the size limit.");
            buffer.Write(bytes, 0, count);
        }
        return JsonSerializer.Deserialize<RamSyncRisk[]>(buffer.ToArray(), RamEvaluator.Json) ?? throw new InvalidDataException("Missing risks.");
    }
}
