using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.FileAssets.Dtos;
using Alife.Application.FileAssets.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.FileAssets.Commands.RegisterFileAsset;

public sealed class RegisterFileAssetCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IFileStorageProviderResolver providerResolver)
    : IRequestHandler<RegisterFileAssetCommand, AppResult<FileAssetDto>>
{
    private static readonly HashSet<string> AllowedRelatedEntityTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "event",
        "enrollment",
        "review",
        "page",
        "section",
        "group",
        "member"
    };

    public async Task<AppResult<FileAssetDto>> Handle(
        RegisterFileAssetCommand request,
        CancellationToken cancellationToken)
    {
        var validation = ValidateRequest(request);
        if (validation is not null)
        {
            return AppResult<FileAssetDto>.Validation(validation);
        }

        var ownerMemberId = request.OwnerMemberId ?? request.CurrentMemberId;
        var canRegister = await CanRegisterAsync(request, ownerMemberId, cancellationToken);
        if (!canRegister.IsSuccess)
        {
            return canRegister;
        }

        var provider = await providerResolver.GetByCodeAsync(request.StorageProvider, cancellationToken);
        var normalizedObjectKey = NormalizeObjectKey(request.ObjectKey);
        var normalizedBucketName = NormalizeBucketName(request.BucketName, provider);
        var now = DateTime.UtcNow;
        var existing = await dbContext.FileAssets
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(
                x => x.StorageProvider == provider.Code &&
                     x.BucketName == normalizedBucketName &&
                     x.ObjectKey == normalizedObjectKey,
                cancellationToken);

        if (existing is not null)
        {
            if (existing.IsDeleted)
            {
                existing.IsDeleted = false;
                existing.DeletedUtc = null;
                existing.CreatedUtc = now;
            }

            ApplyMetadata(existing, request, provider, ownerMemberId, normalizedObjectKey, normalizedBucketName, now);
            await dbContext.SaveChangesAsync(cancellationToken);
            return AppResult<FileAssetDto>.Success(ToDto(existing));
        }

        var fileAsset = new FileAsset
        {
            Id = Guid.NewGuid(),
            CreatedUtc = now,
            UpdatedUtc = now
        };

        ApplyMetadata(fileAsset, request, provider, ownerMemberId, normalizedObjectKey, normalizedBucketName, now);
        dbContext.FileAssets.Add(fileAsset);
        await dbContext.SaveChangesAsync(cancellationToken);

        return AppResult<FileAssetDto>.Success(ToDto(fileAsset));
    }

    private static string? ValidateRequest(RegisterFileAssetCommand request)
    {
        if (string.IsNullOrWhiteSpace(request.StorageProvider))
        {
            return "Storage provider is required.";
        }

        if (request.StorageProvider.Length > 80)
        {
            return "Storage provider is too long.";
        }

        if (string.IsNullOrWhiteSpace(request.ObjectKey))
        {
            return "Object key is required.";
        }

        var objectKey = NormalizeObjectKey(request.ObjectKey);
        if (objectKey.Length > 1024 ||
            objectKey.Contains("..", StringComparison.Ordinal) ||
            objectKey.StartsWith("/", StringComparison.Ordinal))
        {
            return "Object key is invalid.";
        }

        if (string.IsNullOrWhiteSpace(request.ContentType))
        {
            return "Content type is required.";
        }

        if (request.SizeBytes < 0)
        {
            return "Size must be zero or greater.";
        }

        if (request.GroupId is null &&
            (request.Visibility == FileAssetVisibility.GroupVisible ||
             request.Purpose is FileAssetPurpose.EventPoster or FileAssetPurpose.EnrollmentPaymentProof or FileAssetPurpose.ReviewPhoto))
        {
            return "Group id is required for this file.";
        }

        if (request.Visibility == FileAssetVisibility.MemberPrivate && request.OwnerMemberId == Guid.Empty)
        {
            return "Owner member id is invalid.";
        }

        if (request.Visibility == FileAssetVisibility.MemberPrivate && !IsPrivateObjectKey(objectKey))
        {
            return "Member private files must use a private object key.";
        }

        if (!string.IsNullOrWhiteSpace(request.RelatedEntityType) &&
            !AllowedRelatedEntityTypes.Contains(request.RelatedEntityType.Trim()))
        {
            return "Related entity type is invalid.";
        }

        return null;
    }

    private async Task<AppResult<FileAssetDto>> CanRegisterAsync(
        RegisterFileAssetCommand request,
        Guid ownerMemberId,
        CancellationToken cancellationToken)
    {
        if (request.OwnerMemberId.HasValue && ownerMemberId != request.CurrentMemberId)
        {
            var isAdmin = await groupAuthorizationService.IsAdminAsync(request.CurrentMemberId, cancellationToken);
            if (!isAdmin)
            {
                return AppResult<FileAssetDto>.Forbidden("You cannot register files for another member.");
            }
        }

        if (request.GroupId is null)
        {
            var isRegistered = await groupAuthorizationService.IsRegisteredMemberAsync(request.CurrentMemberId, cancellationToken);
            return isRegistered
                ? AppResult<FileAssetDto>.Success(null!)
                : AppResult<FileAssetDto>.Forbidden("You must be registered to upload files.");
        }

        var groupExists = await dbContext.Groups
            .AsNoTracking()
            .AnyAsync(x => x.Id == request.GroupId.Value, cancellationToken);

        if (!groupExists)
        {
            return AppResult<FileAssetDto>.NotFound("Group not found.");
        }

        if (request.Purpose == FileAssetPurpose.EventPoster)
        {
            var canManage = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                request.GroupId.Value,
                request.CurrentMemberId,
                cancellationToken);

            if (!canManage)
            {
                return AppResult<FileAssetDto>.Forbidden("Only group leaders and co-leaders can register event poster files.");
            }

            if (request.RelatedEntityId.HasValue)
            {
                var eventMatchesGroup = await dbContext.GroupEvents
                    .AsNoTracking()
                    .AnyAsync(
                        x => x.Id == request.RelatedEntityId.Value &&
                             x.GroupId == request.GroupId.Value,
                        cancellationToken);

                if (!eventMatchesGroup)
                {
                    return AppResult<FileAssetDto>.NotFound("Related event not found.");
                }
            }

            return AppResult<FileAssetDto>.Success(null!);
        }

        var isApprovedMember = await groupAuthorizationService.IsApprovedMemberAsync(
            request.GroupId.Value,
            request.CurrentMemberId,
            cancellationToken);

        if (!isApprovedMember)
        {
            return AppResult<FileAssetDto>.Forbidden("You must be an approved group member to register this file.");
        }

        return AppResult<FileAssetDto>.Success(null!);
    }

    private static void ApplyMetadata(
        FileAsset fileAsset,
        RegisterFileAssetCommand request,
        FileStorageProviderOptions provider,
        Guid ownerMemberId,
        string normalizedObjectKey,
        string normalizedBucketName,
        DateTime now)
    {
        var storedFileName = TrimOrEmpty(request.StoredFileName);
        if (string.IsNullOrWhiteSpace(storedFileName))
        {
            storedFileName = normalizedObjectKey.Split('/').LastOrDefault() ?? normalizedObjectKey;
        }

        fileAsset.StorageProvider = provider.Code;
        fileAsset.StorageProviderId = provider.Id;
        fileAsset.BucketName = normalizedBucketName;
        fileAsset.ObjectKey = normalizedObjectKey;
        fileAsset.PublicUrl = request.Visibility == FileAssetVisibility.MemberPrivate ? null : TrimToNull(request.PublicUrl);
        fileAsset.OriginalFileName = TrimOrEmpty(request.OriginalFileName);
        fileAsset.StoredFileName = storedFileName;
        fileAsset.ContentType = request.ContentType.Trim();
        fileAsset.SizeBytes = request.SizeBytes;
        fileAsset.ETag = TrimToNull(request.ETag);
        fileAsset.Visibility = request.Visibility;
        fileAsset.Purpose = request.Purpose;
        fileAsset.GroupId = request.GroupId;
        fileAsset.OwnerMemberId = ownerMemberId;
        fileAsset.RelatedEntityType = TrimToNull(request.RelatedEntityType)?.ToLowerInvariant();
        fileAsset.RelatedEntityId = request.RelatedEntityId;
        fileAsset.UploadedUtc = request.UploadedUtc ?? now;
        fileAsset.UpdatedUtc = now;
    }

    private static string NormalizeObjectKey(string value)
        => value.Trim().Replace('\\', '/').TrimStart('/');

    private static string NormalizeBucketName(string? value, FileStorageProviderOptions provider)
        => string.IsNullOrWhiteSpace(value) ? provider.BucketName : TrimOrEmpty(value);

    private static bool IsPrivateObjectKey(string value)
        => value.StartsWith("private/", StringComparison.OrdinalIgnoreCase) ||
           value.Contains("/enrollments/", StringComparison.OrdinalIgnoreCase);

    private static string TrimOrEmpty(string? value)
        => value?.Trim() ?? string.Empty;

    private static string? TrimToNull(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    private static FileAssetDto ToDto(FileAsset fileAsset) =>
        new(
            fileAsset.Id,
            fileAsset.StorageProvider,
            fileAsset.BucketName,
            fileAsset.ObjectKey,
            fileAsset.Visibility == FileAssetVisibility.MemberPrivate ? null : fileAsset.PublicUrl,
            $"/api/file-assets/{fileAsset.Id}/open",
            fileAsset.OriginalFileName,
            fileAsset.StoredFileName,
            fileAsset.ContentType,
            fileAsset.SizeBytes,
            fileAsset.ETag,
            fileAsset.Visibility,
            fileAsset.Purpose,
            fileAsset.GroupId,
            fileAsset.OwnerMemberId,
            fileAsset.RelatedEntityType,
            fileAsset.RelatedEntityId,
            fileAsset.UploadedUtc,
            fileAsset.CreatedUtc,
            fileAsset.UpdatedUtc);
}
