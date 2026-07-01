namespace Alife.Application.FileAssets.Services;

public interface IFileStorageProviderResolver
{
    Task<FileStorageProviderOptions> GetDefaultAsync(CancellationToken cancellationToken);

    Task<FileStorageProviderOptions> GetByCodeAsync(string? code, CancellationToken cancellationToken);
}
