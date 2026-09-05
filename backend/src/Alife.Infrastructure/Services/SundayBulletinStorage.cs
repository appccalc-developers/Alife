using System.Net.Http.Headers;
using Alife.Application.ChurchLife;
using Alife.Application.FileAssets.Services;
using Microsoft.Extensions.Configuration;

namespace Alife.Infrastructure.Services;

public sealed class SundayBulletinStorage(HttpClient client, IConfiguration configuration) : ISundayBulletinStorage
{
    public async Task UploadAsync(FileStorageProviderOptions provider, string key, byte[] pdf, CancellationToken token)
    {
        var secret = configuration["FileAssets:ImageApiAdminSecret"];
        if (string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(provider.UploadApiBaseUrl))
            throw new InvalidOperationException("Bulletin storage is not configured.");
        using var request = new HttpRequestMessage(HttpMethod.Put,
            $"{provider.UploadApiBaseUrl.TrimEnd('/')}/api/admin/sunday-bulletins/{key}");
        request.Headers.Add("x-alife-file-admin-secret", secret);
        request.Content = new ByteArrayContent(pdf);
        request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        using var response = await client.SendAsync(request, token);
        response.EnsureSuccessStatusCode();
    }
}
