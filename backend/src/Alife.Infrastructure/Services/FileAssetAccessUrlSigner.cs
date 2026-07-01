using System.Security.Cryptography;
using System.Text;
using Alife.Application.FileAssets.Services;
using Microsoft.Extensions.Configuration;

namespace Alife.Infrastructure.Services;

public sealed class FileAssetAccessUrlSigner(
    IConfiguration configuration,
    IFileStorageProviderResolver providerResolver) : IFileAssetAccessUrlSigner
{
    private const int DefaultLifetimeMinutes = 5;

    public async Task<string> CreatePrivateReadUrlAsync(
        string storageProvider,
        string objectKey,
        TimeSpan lifetime,
        CancellationToken cancellationToken)
    {
        var secret = configuration["FileAssets:PrivateFileSigningSecret"];
        if (string.IsNullOrWhiteSpace(secret))
        {
            throw new InvalidOperationException("Private file signing secret is not configured.");
        }

        var provider = await providerResolver.GetByCodeAsync(storageProvider, cancellationToken);
        if (!provider.SupportsSignedRead)
        {
            throw new InvalidOperationException("File storage provider does not support signed private reads.");
        }

        var baseUrl = (provider.PrivateBaseUrl ?? configuration["FileAssets:PrivateFileBaseUrl"] ?? "http://localhost:8787").TrimEnd('/');
        var maxLifetime = TimeSpan.FromMinutes(
            int.TryParse(configuration["FileAssets:PrivateFileMaxLifetimeMinutes"], out var configuredMinutes) && configuredMinutes > 0
                ? configuredMinutes
                : DefaultLifetimeMinutes);
        var effectiveLifetime = lifetime <= TimeSpan.Zero || lifetime > maxLifetime ? maxLifetime : lifetime;
        var expiresUnixSeconds = DateTimeOffset.UtcNow.Add(effectiveLifetime).ToUnixTimeSeconds();
        var normalizedKey = NormalizeObjectKey(objectKey);
        var signature = Sign(secret, normalizedKey, expiresUnixSeconds);
        var encodedKey = string.Join("/", normalizedKey.Split('/').Select(Uri.EscapeDataString));

        return $"{baseUrl}/api/private-files/{encodedKey}?exp={expiresUnixSeconds}&sig={signature}";
    }

    private static string NormalizeObjectKey(string value)
        => value.Trim().Replace('\\', '/').TrimStart('/');

    private static string Sign(string secret, string objectKey, long expiresUnixSeconds)
    {
        var payload = $"{objectKey}\n{expiresUnixSeconds}";
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        return Base64UrlEncode(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload)));
    }

    private static string Base64UrlEncode(byte[] value)
        => Convert.ToBase64String(value)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
}
