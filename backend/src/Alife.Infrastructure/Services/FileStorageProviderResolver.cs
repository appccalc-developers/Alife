using Alife.Application.Common.Interfaces;
using Alife.Application.FileAssets.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Alife.Infrastructure.Services;

public sealed class FileStorageProviderResolver(
    IAlifeDbContext dbContext,
    IConfiguration configuration) : IFileStorageProviderResolver
{
    private const string DefaultProviderCode = "local-dev";
    private const string DefaultImageBaseUrl = "http://localhost:8787";

    public async Task<FileStorageProviderOptions> GetDefaultAsync(CancellationToken cancellationToken)
    {
        var provider = await dbContext.FileStorageProviders
            .AsNoTracking()
            .Where(x => x.IsActive)
            .OrderByDescending(x => x.IsDefault)
            .ThenBy(x => x.Code)
            .FirstOrDefaultAsync(cancellationToken);

        return provider is null ? Fallback(DefaultProviderCode) : ToOptions(provider);
    }

    public async Task<FileStorageProviderOptions> GetByCodeAsync(string? code, CancellationToken cancellationToken)
    {
        var configuredDefaultCode = configuration["FileAssets:ProviderCode"] ?? DefaultProviderCode;
        var normalizedCode = string.IsNullOrWhiteSpace(code)
            ? configuredDefaultCode
            : code.Trim();
        var provider = await dbContext.FileStorageProviders
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Code == normalizedCode && x.IsActive, cancellationToken);

        if (provider is not null)
        {
            return ToOptions(provider);
        }

        if (!normalizedCode.Equals(configuredDefaultCode, StringComparison.OrdinalIgnoreCase))
        {
            return await GetDefaultAsync(cancellationToken);
        }

        return Fallback(normalizedCode);
    }

    private FileStorageProviderOptions Fallback(string code)
    {
        var isCloudflareR2 = code.Equals("cloudflare-r2", StringComparison.OrdinalIgnoreCase);
        var imageBaseUrl = (configuration["FileAssets:ImageApiBaseUrl"] ?? (isCloudflareR2 ? "https://images.ccalc.live" : DefaultImageBaseUrl)).TrimEnd('/');
        var privateBaseUrl = (configuration["FileAssets:PrivateFileBaseUrl"] ?? imageBaseUrl).TrimEnd('/');

        return new FileStorageProviderOptions(
            null,
            code,
            isCloudflareR2 ? FileStorageProviderKind.CloudflareR2 : FileStorageProviderKind.LocalDev,
            configuration["FileAssets:BucketName"] ?? (isCloudflareR2 ? "ccalc" : "local-dev"),
            imageBaseUrl,
            privateBaseUrl,
            imageBaseUrl,
            string.Empty,
            "private",
            true,
            true,
            isCloudflareR2);
    }

    private static FileStorageProviderOptions ToOptions(FileStorageProvider provider)
        => new(
            provider.Id,
            provider.Code,
            provider.Kind,
            provider.BucketName,
            TrimEnd(provider.PublicBaseUrl),
            TrimEnd(provider.PrivateBaseUrl),
            TrimEnd(provider.UploadApiBaseUrl),
            provider.PublicPathPrefix.Trim('/'),
            provider.PrivatePathPrefix.Trim('/'),
            provider.SupportsPublicUrl,
            provider.SupportsSignedRead,
            provider.SupportsServerSideMove);

    private static string? TrimEnd(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim().TrimEnd('/');
}
