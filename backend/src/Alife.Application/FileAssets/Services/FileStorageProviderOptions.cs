using Alife.Domain.Enums;

namespace Alife.Application.FileAssets.Services;

public sealed record FileStorageProviderOptions(
    Guid? Id,
    string Code,
    FileStorageProviderKind Kind,
    string BucketName,
    string? PublicBaseUrl,
    string? PrivateBaseUrl,
    string? UploadApiBaseUrl,
    string PublicPathPrefix,
    string PrivatePathPrefix,
    bool SupportsPublicUrl,
    bool SupportsSignedRead,
    bool SupportsServerSideMove);
