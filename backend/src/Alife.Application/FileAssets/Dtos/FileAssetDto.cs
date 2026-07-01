using Alife.Domain.Enums;

namespace Alife.Application.FileAssets.Dtos;

public sealed record FileAssetDto(
    Guid Id,
    string StorageProvider,
    string BucketName,
    string ObjectKey,
    string? PublicUrl,
    string? AccessUrl,
    string OriginalFileName,
    string StoredFileName,
    string ContentType,
    long SizeBytes,
    string? ETag,
    FileAssetVisibility Visibility,
    FileAssetPurpose Purpose,
    Guid? GroupId,
    Guid? OwnerMemberId,
    string? RelatedEntityType,
    Guid? RelatedEntityId,
    DateTime UploadedUtc,
    DateTime CreatedUtc,
    DateTime UpdatedUtc);
