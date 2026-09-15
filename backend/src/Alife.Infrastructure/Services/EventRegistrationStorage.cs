using System.Net.Http.Headers;
using Alife.Application.Events.Services;
using Alife.Application.FileAssets.Services;
using Microsoft.Extensions.Configuration;
namespace Alife.Infrastructure.Services;
public sealed class EventRegistrationStorage(HttpClient client, IConfiguration configuration) : IEventRegistrationStorage
{
    public async Task<byte[]> DownloadAsync(FileStorageProviderOptions provider, string key, CancellationToken ct)
    {
        var secret = configuration["FileAssets:ImageApiAdminSecret"];
        if (string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(provider.UploadApiBaseUrl)) throw new InvalidOperationException("Private material storage is not configured.");
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{provider.UploadApiBaseUrl.TrimEnd('/')}/api/admin/event-registration/{key}");
        request.Headers.Add("x-alife-file-admin-secret", secret);
        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct); response.EnsureSuccessStatusCode();
        if (response.Content.Headers.ContentLength > EventRegistrationMaterialService.MaxBytes) throw new InvalidOperationException("Material exceeds its size limit.");
        await using var input = await response.Content.ReadAsStreamAsync(ct);
        using var output = new MemoryStream(); var buffer = new byte[81920]; int read;
        while ((read = await input.ReadAsync(buffer, ct)) > 0)
        {
            if (output.Length + read > EventRegistrationMaterialService.MaxBytes) throw new InvalidOperationException("Material exceeds its size limit.");
            output.Write(buffer, 0, read);
        }
        return output.ToArray();
    }
    public async Task UploadAsync(FileStorageProviderOptions provider, string key, byte[] bytes, string type, CancellationToken ct)
    {
        var secret = configuration["FileAssets:ImageApiAdminSecret"];
        if (string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(provider.UploadApiBaseUrl)) throw new InvalidOperationException("Private material storage is not configured.");
        using var request = new HttpRequestMessage(HttpMethod.Put, $"{provider.UploadApiBaseUrl.TrimEnd('/')}/api/admin/event-registration/{key}");
        request.Headers.Add("x-alife-file-admin-secret", secret); request.Content = new ByteArrayContent(bytes); request.Content.Headers.ContentType = new MediaTypeHeaderValue(type);
        using var response = await client.SendAsync(request, ct); response.EnsureSuccessStatusCode();
    }
}
