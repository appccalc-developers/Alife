using Alife.Application.FileAssets.Services;

namespace Alife.Application.Albums;

public sealed record AlbumPhotoContent(byte[] Bytes, string ContentType);
public sealed record AlbumPhotoDownload(Stream Stream, string ContentType);

public interface IAlbumPhotoStorage
{
    Task UploadAsync(FileStorageProviderOptions provider, string key, AlbumPhotoContent content, CancellationToken ct);
    Task<AlbumPhotoDownload> ReadAsync(FileStorageProviderOptions provider, string key, CancellationToken ct);
    Task DeleteAsync(FileStorageProviderOptions provider, string key, CancellationToken ct);
}
