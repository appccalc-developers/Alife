using System.Security.Cryptography;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.FileAssets.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Alife.Application.Albums;

public sealed class AlbumPhotoService(IAlifeDbContext db, IGroupAuthorizationService authorization,
    IFileStorageProviderResolver providers, IAlbumPhotoStorage storage, ILogger<AlbumPhotoService> logger)
{
    public const int MaxBytes = 20 * 1024 * 1024;
    public static string Url(Guid assetId) => $"/api/album-photos/{assetId}";

    public async Task<AppResult<AlbumPhotoDownload>> ReadByKeyAsync(string key, Guid? actor, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(key) || key.Length > 1024) return AppResult<AlbumPhotoDownload>.NotFound("Photo not found.");
        var id = await db.FileAssets.AsNoTracking().Where(x => x.ObjectKey == key && x.Purpose == FileAssetPurpose.AlbumPhoto && !x.IsDeleted)
            .Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
        return id.HasValue ? await ReadAsync(id.Value, actor, ct) : AppResult<AlbumPhotoDownload>.NotFound("Photo not found.");
    }

    public async Task<AppResult<AlbumPhotoDownload>> ReadAsync(Guid id, Guid? actor, CancellationToken ct)
    {
        var photo = await db.AlbumPhotos.AsNoTracking().Include(x => x.FileAsset)
            .FirstOrDefaultAsync(x => x.FileAssetId == id && !x.FileAsset.IsDeleted, ct);
        if (photo is null) return AppResult<AlbumPhotoDownload>.NotFound("Photo not found.");
        var album = await db.Albums.AsNoTracking().FirstOrDefaultAsync(x => x.Id == photo.AlbumId, ct);
        if (album is null || photo.FileAsset.GroupId != album.GroupId ||
            await db.Groups.IgnoreQueryFilters().AnyAsync(x => x.Id == album.GroupId && x.IsDissolved, ct))
            return AppResult<AlbumPhotoDownload>.NotFound("Photo not found.");
        if (album.Visibility != AlbumVisibility.Public && (!actor.HasValue || !await authorization.IsApprovedMemberAsync(album.GroupId, actor.Value, ct)))
            return AppResult<AlbumPhotoDownload>.Forbidden("Group membership is required.");
        var asset = photo.FileAsset;
        if (album.Visibility == AlbumVisibility.Public && asset.Visibility != FileAssetVisibility.Public)
            return AppResult<AlbumPhotoDownload>.Forbidden("This photo is not public.");
        // Never fetch an arbitrary persisted URL, nor reinterpret an unrelated storage key.
        if (!IsAlbumKey(asset.ObjectKey, album.GroupId, album.Id)) return AppResult<AlbumPhotoDownload>.Conflict("Photo storage requires reconciliation.");
        return AppResult<AlbumPhotoDownload>.Success(await storage.ReadAsync(await providers.GetByCodeAsync(asset.StorageProvider, ct), asset.ObjectKey, ct));
    }

    public async Task<AppResult<Guid>> UploadAsync(Guid albumId, Guid actor, Guid uploadId, AlbumVisibility expectedVisibility,
        string name, AlbumPhotoContent content, CancellationToken ct)
    {
        var album = await db.Albums.FirstOrDefaultAsync(x => x.Id == albumId, ct);
        if (album is null) return AppResult<Guid>.NotFound("Album not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(album.GroupId, actor, ct)) return AppResult<Guid>.Forbidden("Album management permission is required.");
        if (album.Visibility != expectedVisibility) return AppResult<Guid>.Conflict("Album visibility changed. Review the album and confirm again.");
        if (!Enum.IsDefined(expectedVisibility) || uploadId == Guid.Empty || string.IsNullOrWhiteSpace(name) || name.Length > 255 ||
            !AlbumPhotoValidation.IsValid(content.Bytes, content.ContentType)) return AppResult<Guid>.Validation("Choose a valid JPEG, PNG or WebP image up to 20 MB.");
        var digest = Convert.ToHexString(SHA256.HashData(content.Bytes));
        var existing = await db.FileAssets.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == uploadId, ct);
        if (existing is not null)
        {
            if (existing.IsDeleted || existing.RelatedEntityId != albumId || existing.OwnerMemberId != actor || existing.ETag != digest ||
                !await db.AlbumPhotos.AnyAsync(x => x.AlbumId == albumId && x.FileAssetId == uploadId, ct))
                return AppResult<Guid>.Conflict("Upload identifier is already used.");
            return AppResult<Guid>.Success(existing.Id);
        }
        var provider = await providers.GetDefaultAsync(ct);
        var extension = content.ContentType switch { "image/jpeg" => "jpg", "image/png" => "png", _ => "webp" };
        // An attempt owns its unique object, so failure cleanup cannot delete a concurrent successful retry.
        var key = $"private/groups/{album.GroupId}/albums/{albumId}/{Guid.NewGuid():N}.{extension}";
        try
        {
            await storage.UploadAsync(provider, key, content, ct);
            await using var transaction = await db.BeginSerializableTransactionAsync(ct);
            var current = await db.Albums.AsNoTracking().FirstOrDefaultAsync(x => x.Id == albumId, ct);
            if (current is null || current.Visibility != expectedVisibility || !await authorization.IsLeaderOrCoLeaderAsync(album.GroupId, actor, ct))
            {
                await storage.DeleteAsync(provider, key, CancellationToken.None);
                return AppResult<Guid>.Conflict("Album permissions or visibility changed. Review and confirm again.");
            }
            var now = DateTime.UtcNow;
            db.FileAssets.Add(new FileAsset {
                Id = uploadId, StorageProvider = provider.Code, StorageProviderId = provider.Id, BucketName = provider.BucketName,
                ObjectKey = key, PublicUrl = null, OriginalFileName = Path.GetFileName(name), StoredFileName = key.Split('/').Last(),
                ContentType = content.ContentType, SizeBytes = content.Bytes.Length, ETag = digest,
                Visibility = expectedVisibility == AlbumVisibility.Public ? FileAssetVisibility.Public : FileAssetVisibility.GroupVisible,
                Purpose = FileAssetPurpose.AlbumPhoto, GroupId = album.GroupId, OwnerMemberId = actor,
                RelatedEntityType = "album", RelatedEntityId = albumId, UploadedUtc = now, CreatedUtc = now, UpdatedUtc = now,
            });
            var sort = await db.AlbumPhotos.Where(x => x.AlbumId == albumId).Select(x => (int?)x.SortOrder).MaxAsync(ct) ?? -1;
            db.AlbumPhotos.Add(new AlbumPhoto { Id = Guid.NewGuid(), AlbumId = albumId, FileAssetId = uploadId, SortOrder = sort + 1, CreatedUtc = now });
            album.UpdatedUtc = now;
            await db.SaveChangesAsync(ct);
            if (transaction is not null) await transaction.CommitAsync(ct);
            return AppResult<Guid>.Success(uploadId);
        }
        catch
        {
            // A timed-out SaveChanges can have committed. Never delete an object until
            // a fresh database read establishes which attempt owns the saved record.
            FileAsset? committed;
            try { committed = await db.FileAssets.IgnoreQueryFilters().AsNoTracking().FirstOrDefaultAsync(x => x.Id == uploadId, CancellationToken.None); }
            catch
            {
                logger.LogError("Album upload outcome unknown; reconciliation required for object {ObjectKey}", key);
                throw;
            }
            if (committed?.ObjectKey == key) throw;
            try { await storage.DeleteAsync(provider, key, CancellationToken.None); }
            catch { logger.LogError("Album upload cleanup required for object {ObjectKey}", key); }
            throw;
        }
    }

    public static bool IsAlbumKey(string key, Guid group, Guid album)
    {
        var suffix = $"groups/{group}/albums/{album}/";
        var relative = key.StartsWith("private/", StringComparison.Ordinal) ? key[8..] : key;
        return relative.StartsWith(suffix, StringComparison.Ordinal) && relative.Length > suffix.Length &&
            !relative[suffix.Length..].Contains('/') && !relative.Contains("..") && !relative.Contains('\\');
    }
}
