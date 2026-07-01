using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Alife.Application.FileAssets.Services;
using Microsoft.Extensions.Configuration;

namespace Alife.Infrastructure.Services;

public sealed class FileAssetObjectMover(
    HttpClient httpClient,
    IConfiguration configuration,
    IFileStorageProviderResolver providerResolver) : IFileAssetObjectMover
{
    public async Task<MoveFileAssetObjectResult> MoveAsync(
        string sourceKey,
        string targetKey,
        bool dryRun,
        CancellationToken cancellationToken)
    {
        var secret = configuration["FileAssets:ImageApiAdminSecret"];
        if (string.IsNullOrWhiteSpace(secret))
        {
            return new MoveFileAssetObjectResult(false, false, false, "Image API admin secret is not configured.");
        }

        var provider = await providerResolver.GetDefaultAsync(cancellationToken);
        if (!provider.SupportsServerSideMove)
        {
            return new MoveFileAssetObjectResult(false, false, false, "File storage provider does not support server-side move.");
        }

        var baseUrl = provider.UploadApiBaseUrl ?? configuration["FileAssets:ImageApiBaseUrl"] ?? "http://localhost:8787";
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl.TrimEnd('/')}/api/admin/private-files/move")
        {
            Content = JsonContent.Create(new MoveRequest(sourceKey, targetKey, dryRun))
        };
        request.Headers.Add("x-alife-file-admin-secret", secret);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var result = await response.Content.ReadFromJsonAsync<MoveFileAssetObjectResult>(cancellationToken);
        if (result is not null)
        {
            return response.IsSuccessStatusCode
                ? result
                : result with { Ok = false };
        }

        return new MoveFileAssetObjectResult(
            response.IsSuccessStatusCode,
            false,
            false,
            $"Image API returned HTTP {(int)response.StatusCode}.");
    }

    private sealed record MoveRequest(
        [property: JsonPropertyName("sourceKey")] string SourceKey,
        [property: JsonPropertyName("targetKey")] string TargetKey,
        [property: JsonPropertyName("dryRun")] bool DryRun);
}
