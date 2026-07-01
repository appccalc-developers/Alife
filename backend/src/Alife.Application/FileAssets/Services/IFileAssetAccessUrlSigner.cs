namespace Alife.Application.FileAssets.Services;

public interface IFileAssetAccessUrlSigner
{
    Task<string> CreatePrivateReadUrlAsync(string storageProvider, string objectKey, TimeSpan lifetime, CancellationToken cancellationToken);
}
