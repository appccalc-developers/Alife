using Alife.Application.Common.Models;
using Alife.Application.FileAssets.Dtos;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.FileAssets.Commands.RegisterFileAsset;

public sealed record RegisterFileAssetCommand(
    Guid CurrentMemberId,
    string StorageProvider,
    string? BucketName,
    string ObjectKey,
    string? PublicUrl,
    string? OriginalFileName,
    string? StoredFileName,
    string ContentType,
    long SizeBytes,
    string? ETag,
    DateTime? UploadedUtc,
    FileAssetVisibility Visibility,
    FileAssetPurpose Purpose,
    Guid? GroupId,
    Guid? OwnerMemberId,
    string? RelatedEntityType,
    Guid? RelatedEntityId) : IRequest<AppResult<FileAssetDto>>;
