using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Albums;

public sealed class AlbumService(IAlifeDbContext db, IGroupAuthorizationService authorization) : IAlbumService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<AppResult<IReadOnlyList<AlbumSummaryDto>>> ListAsync(Guid groupId, Guid? currentMemberId, bool includeAll, CancellationToken cancellationToken)
    {
        if (!await db.Groups.AsNoTracking().AnyAsync(x => x.Id == groupId, cancellationToken))
            return AppResult<IReadOnlyList<AlbumSummaryDto>>.NotFound("Group not found.");

        var canReadGroup = currentMemberId.HasValue &&
            await authorization.IsApprovedMemberAsync(groupId, currentMemberId.Value, cancellationToken);
        var query = db.Albums.AsNoTracking().Where(x => x.GroupId == groupId);
        if (!canReadGroup) query = query.Where(x => x.Visibility == AlbumVisibility.Public);
        if (!includeAll) query = query.Where(x => x.ParentAlbumId == null);
        var albums = await query.OrderBy(x => x.SortOrder).ThenBy(x => x.CreatedUtc).ToListAsync(cancellationToken);
        return AppResult<IReadOnlyList<AlbumSummaryDto>>.Success(await MapSummariesAsync(albums, cancellationToken, !canReadGroup));
    }

    public async Task<IReadOnlyList<AlbumSummaryDto>> ListChurchLifeAsync(
        IReadOnlyCollection<Guid> groupIds,
        IReadOnlyCollection<Guid> approvedGroupIds,
        CancellationToken cancellationToken)
    {
        if (groupIds.Count == 0)
        {
            return [];
        }

        var scopeIds = groupIds.ToList();
        var memberGroupIds = approvedGroupIds.ToList();
        var albums = await db.Albums
            .AsNoTracking()
            .Where(x =>
                scopeIds.Contains(x.GroupId) &&
                x.ParentAlbumId == null &&
                (x.Visibility == AlbumVisibility.Public || memberGroupIds.Contains(x.GroupId)))
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.CreatedUtc)
            .ToListAsync(cancellationToken);

        return await MapSummariesAsync(
            albums,
            cancellationToken,
            approvedGroupIds: memberGroupIds.ToHashSet());
    }

    public async Task<AppResult<AlbumDetailDto>> GetAsync(Guid albumId, Guid? currentMemberId, CancellationToken cancellationToken)
    {
        var album = await db.Albums.AsNoTracking().FirstOrDefaultAsync(x => x.Id == albumId, cancellationToken);
        if (album is null) return AppResult<AlbumDetailDto>.NotFound("Album not found.");
        if (!await CanReadAsync(album, currentMemberId, cancellationToken))
            return AppResult<AlbumDetailDto>.Forbidden("This album is only available to approved group members.");
        return AppResult<AlbumDetailDto>.Success(await BuildDetailAsync(album, currentMemberId, cancellationToken));
    }

    public async Task<AppResult<AlbumDetailDto>> CreateAsync(CreateAlbumInput input, Guid currentMemberId, CancellationToken cancellationToken)
    {
        if (!await db.Groups.AsNoTracking().AnyAsync(x => x.Id == input.GroupId, cancellationToken))
            return AppResult<AlbumDetailDto>.NotFound("Group not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(input.GroupId, currentMemberId, cancellationToken))
            return AppResult<AlbumDetailDto>.Forbidden("Only group leaders and co-leaders can create albums.");

        var name = Normalize(input.Name);
        if (name.Count == 0) return AppResult<AlbumDetailDto>.Validation("An English or Chinese album name is required.");
        Album? parent = null;
        if (input.ParentAlbumId.HasValue)
        {
            parent = await db.Albums.FirstOrDefaultAsync(x => x.Id == input.ParentAlbumId.Value, cancellationToken);
            if (parent is null) return AppResult<AlbumDetailDto>.NotFound("Parent album not found.");
            if (parent.GroupId != input.GroupId) return AppResult<AlbumDetailDto>.Validation("Parent album belongs to another group.");
            if (parent.Visibility == AlbumVisibility.GroupVisible && input.Visibility == AlbumVisibility.Public)
                return AppResult<AlbumDetailDto>.Validation("A public album cannot be nested inside a member-only album.");
        }

        var maxSort = await db.Albums.Where(x => x.GroupId == input.GroupId && x.ParentAlbumId == input.ParentAlbumId)
            .Select(x => (int?)x.SortOrder).MaxAsync(cancellationToken) ?? -1;
        var now = DateTime.UtcNow;
        var album = new Album
        {
            Id = Guid.NewGuid(), GroupId = input.GroupId, ParentAlbumId = input.ParentAlbumId,
            NameJson = Write(name), DescriptionJson = WriteOptional(input.Description), Visibility = input.Visibility,
            SortOrder = maxSort + 1, CreatedByMemberId = currentMemberId, CreatedUtc = now, UpdatedUtc = now
        };
        db.Albums.Add(album);
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<AlbumDetailDto>.Success(await BuildDetailAsync(album, currentMemberId, cancellationToken));
    }

    public async Task<AppResult<AlbumDetailDto>> UpdateAsync(Guid albumId, UpdateAlbumInput input, Guid currentMemberId, CancellationToken cancellationToken)
    {
        var album = await db.Albums.FirstOrDefaultAsync(x => x.Id == albumId, cancellationToken);
        if (album is null) return AppResult<AlbumDetailDto>.NotFound("Album not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(album.GroupId, currentMemberId, cancellationToken))
            return AppResult<AlbumDetailDto>.Forbidden("Only group leaders and co-leaders can update albums.");

        var name = Normalize(input.Name);
        if (name.Count == 0) return AppResult<AlbumDetailDto>.Validation("An English or Chinese album name is required.");

        if (input.Visibility == AlbumVisibility.Public)
        {
            if (album.ParentAlbumId.HasValue)
            {
                var parentVisibility = await db.Albums.AsNoTracking()
                    .Where(x => x.Id == album.ParentAlbumId.Value)
                    .Select(x => (AlbumVisibility?)x.Visibility)
                    .FirstOrDefaultAsync(cancellationToken);
                if (parentVisibility == AlbumVisibility.GroupVisible)
                    return AppResult<AlbumDetailDto>.Validation("A public album cannot be nested inside a member-only album.");
            }

            var hasPrivatePhoto = await db.AlbumPhotos.AsNoTracking()
                .Where(x => x.AlbumId == albumId)
                .AnyAsync(x => x.FileAsset.Visibility != FileAssetVisibility.Public, cancellationToken);
            if (hasPrivatePhoto)
                return AppResult<AlbumDetailDto>.Validation("A public album requires public file assets for every photo.");
        }
        else
        {
            var hasPublicChild = await db.Albums.AsNoTracking()
                .AnyAsync(x => x.ParentAlbumId == albumId && x.Visibility == AlbumVisibility.Public, cancellationToken);
            if (hasPublicChild)
                return AppResult<AlbumDetailDto>.Validation("A member-only album cannot contain a public child album.");
        }

        album.NameJson = Write(name);
        album.DescriptionJson = WriteOptional(input.Description);
        album.Visibility = input.Visibility;
        album.UpdatedUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<AlbumDetailDto>.Success(await BuildDetailAsync(album, currentMemberId, cancellationToken));
    }

    public async Task<AppResult<AlbumDetailDto>> AddPhotoAsync(Guid albumId, Guid fileAssetId, IReadOnlyDictionary<string, string>? caption, Guid currentMemberId, CancellationToken cancellationToken)
    {
        var album = await db.Albums.FirstOrDefaultAsync(x => x.Id == albumId, cancellationToken);
        if (album is null) return AppResult<AlbumDetailDto>.NotFound("Album not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(album.GroupId, currentMemberId, cancellationToken))
            return AppResult<AlbumDetailDto>.Forbidden("Only group leaders and co-leaders can manage album photos.");
        var asset = await db.FileAssets.FirstOrDefaultAsync(x => x.Id == fileAssetId, cancellationToken);
        if (asset is null) return AppResult<AlbumDetailDto>.NotFound("File asset not found.");
        if (asset.GroupId != album.GroupId || !asset.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return AppResult<AlbumDetailDto>.Validation("The file must be an image owned by this group.");
        if (album.Visibility == AlbumVisibility.Public && asset.Visibility != FileAssetVisibility.Public)
            return AppResult<AlbumDetailDto>.Validation("A public album requires a public file asset.");
        if (await db.AlbumPhotos.AnyAsync(x => x.AlbumId == albumId && x.FileAssetId == fileAssetId, cancellationToken))
            return AppResult<AlbumDetailDto>.Conflict("This image is already in the album.");

        var maxSort = await db.AlbumPhotos.Where(x => x.AlbumId == albumId).Select(x => (int?)x.SortOrder).MaxAsync(cancellationToken) ?? -1;
        db.AlbumPhotos.Add(new AlbumPhoto
        {
            Id = Guid.NewGuid(), AlbumId = albumId, FileAssetId = fileAssetId,
            CaptionJson = WriteOptional(caption), SortOrder = maxSort + 1, CreatedUtc = DateTime.UtcNow
        });
        album.UpdatedUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<AlbumDetailDto>.Success(await BuildDetailAsync(album, currentMemberId, cancellationToken));
    }

    public async Task<AppResult<AlbumDetailDto>> RemovePhotoAsync(Guid albumId, Guid photoId, Guid currentMemberId, CancellationToken cancellationToken)
    {
        var album = await db.Albums.FirstOrDefaultAsync(x => x.Id == albumId, cancellationToken);
        if (album is null) return AppResult<AlbumDetailDto>.NotFound("Album not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(album.GroupId, currentMemberId, cancellationToken))
            return AppResult<AlbumDetailDto>.Forbidden("Only group leaders and co-leaders can manage album photos.");
        var photo = await db.AlbumPhotos.Include(x => x.FileAsset).FirstOrDefaultAsync(x => x.Id == photoId && x.AlbumId == albumId, cancellationToken);
        if (photo is null) return AppResult<AlbumDetailDto>.NotFound("Album photo not found.");
        db.AlbumPhotos.Remove(photo);
        photo.FileAsset.IsDeleted = true;
        photo.FileAsset.DeletedUtc = DateTime.UtcNow;
        photo.FileAsset.UpdatedUtc = DateTime.UtcNow;
        album.UpdatedUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<AlbumDetailDto>.Success(await BuildDetailAsync(album, currentMemberId, cancellationToken));
    }

    public async Task<AppResult<AlbumDetailDto>> ReorderPhotosAsync(Guid albumId, IReadOnlyList<Guid> photoIds, Guid currentMemberId, CancellationToken cancellationToken)
    {
        var album = await db.Albums.FirstOrDefaultAsync(x => x.Id == albumId, cancellationToken);
        if (album is null) return AppResult<AlbumDetailDto>.NotFound("Album not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(album.GroupId, currentMemberId, cancellationToken))
            return AppResult<AlbumDetailDto>.Forbidden("Only group leaders and co-leaders can manage album photos.");
        var photos = await db.AlbumPhotos.Where(x => x.AlbumId == albumId).ToListAsync(cancellationToken);
        if (photoIds.Count != photos.Count || photoIds.Distinct().Count() != photos.Count || photos.Any(x => !photoIds.Contains(x.Id)))
            return AppResult<AlbumDetailDto>.Validation("Photo order must contain every album photo exactly once.");
        var positions = photoIds.Select((id, index) => (id, index)).ToDictionary(x => x.id, x => x.index);
        foreach (var photo in photos) photo.SortOrder = positions[photo.Id];
        album.UpdatedUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<AlbumDetailDto>.Success(await BuildDetailAsync(album, currentMemberId, cancellationToken));
    }

    private async Task<bool> CanReadAsync(Album album, Guid? memberId, CancellationToken cancellationToken) =>
        album.Visibility == AlbumVisibility.Public || (memberId.HasValue && await authorization.IsApprovedMemberAsync(album.GroupId, memberId.Value, cancellationToken));

    private async Task<AlbumDetailDto> BuildDetailAsync(Album album, Guid? memberId, CancellationToken cancellationToken)
    {
        var canManage = memberId.HasValue && await authorization.IsLeaderOrCoLeaderAsync(album.GroupId, memberId.Value, cancellationToken);
        var canReadGroup = memberId.HasValue && await authorization.IsApprovedMemberAsync(album.GroupId, memberId.Value, cancellationToken);
        var children = await db.Albums.AsNoTracking().Where(x => x.ParentAlbumId == album.Id).OrderBy(x => x.SortOrder).ToListAsync(cancellationToken);
        if (!canReadGroup) children = children.Where(x => x.Visibility == AlbumVisibility.Public).ToList();
        var photos = await db.AlbumPhotos.AsNoTracking().Where(x => x.AlbumId == album.Id)
            .Include(x => x.FileAsset).OrderBy(x => x.SortOrder).ToListAsync(cancellationToken);
        var breadcrumbs = new List<Album>();
        var cursor = album;
        while (cursor.ParentAlbumId.HasValue)
        {
            var parent = await db.Albums.AsNoTracking().FirstOrDefaultAsync(x => x.Id == cursor.ParentAlbumId.Value, cancellationToken);
            if (parent is null) break;
            breadcrumbs.Add(parent); cursor = parent;
        }
        breadcrumbs.Reverse(); breadcrumbs.Add(album);
        return new AlbumDetailDto(
            (await MapSummariesAsync([album], cancellationToken, !canReadGroup))[0],
            await MapSummariesAsync(breadcrumbs, cancellationToken, !canReadGroup),
            await MapSummariesAsync(children, cancellationToken, !canReadGroup),
            photos.Select(x => new AlbumPhotoDto(x.Id, x.FileAssetId, ReadOptional(x.CaptionJson), x.SortOrder,
                album.Visibility == AlbumVisibility.Public ? x.FileAsset.PublicUrl ?? $"/api/file-assets/{x.FileAssetId}/open" : $"/api/file-assets/{x.FileAssetId}/open",
                x.FileAsset.ObjectKey, x.FileAsset.OriginalFileName, 0, 0)).ToList(),
            canManage);
    }

    private async Task<IReadOnlyList<AlbumSummaryDto>> MapSummariesAsync(
        IReadOnlyList<Album> albums,
        CancellationToken cancellationToken,
        bool publicOnly = false,
        IReadOnlySet<Guid>? approvedGroupIds = null)
    {
        if (albums.Count == 0) return [];
        var ids = albums.Select(x => x.Id).ToList();
        var photoCounts = await db.AlbumPhotos.AsNoTracking().Where(x => ids.Contains(x.AlbumId)).GroupBy(x => x.AlbumId)
            .Select(x => new { Id = x.Key, Count = x.Count() }).ToDictionaryAsync(x => x.Id, x => x.Count, cancellationToken);
        var children = await db.Albums.AsNoTracking()
            .Where(x => x.ParentAlbumId.HasValue && ids.Contains(x.ParentAlbumId.Value))
            .Select(x => new { ParentId = x.ParentAlbumId!.Value, x.GroupId, x.Visibility })
            .ToListAsync(cancellationToken);
        var childCounts = children
            .Where(x =>
                (!publicOnly && approvedGroupIds is null) ||
                x.Visibility == AlbumVisibility.Public ||
                (approvedGroupIds?.Contains(x.GroupId) ?? false))
            .GroupBy(x => x.ParentId)
            .ToDictionary(x => x.Key, x => x.Count());
        var covers = await db.AlbumPhotos.AsNoTracking().Where(x => ids.Contains(x.AlbumId)).Include(x => x.FileAsset)
            .OrderBy(x => x.SortOrder).ToListAsync(cancellationToken);
        return albums.Select(x =>
        {
            var cover = covers.FirstOrDefault(p => p.AlbumId == x.Id)?.FileAsset;
            var coverUrl = cover is null ? null : x.Visibility == AlbumVisibility.Public ? cover.PublicUrl : $"/api/file-assets/{cover.Id}/open";
            return new AlbumSummaryDto(x.Id, x.GroupId, x.ParentAlbumId, Read(x.NameJson), ReadOptional(x.DescriptionJson), x.Visibility, x.SortOrder,
                coverUrl, photoCounts.GetValueOrDefault(x.Id), childCounts.GetValueOrDefault(x.Id));
        }).ToList();
    }

    private static Dictionary<string, string> Normalize(IReadOnlyDictionary<string, string>? value) =>
        value?.Where(x => !string.IsNullOrWhiteSpace(x.Key) && !string.IsNullOrWhiteSpace(x.Value)).ToDictionary(x => x.Key.Trim().ToLowerInvariant(), x => x.Value.Trim()) ?? [];
    private static string Write(IReadOnlyDictionary<string, string> value) => JsonSerializer.Serialize(Normalize(value), JsonOptions);
    private static string? WriteOptional(IReadOnlyDictionary<string, string>? value) => Normalize(value).Count == 0 ? null : Write(value!);
    private static IReadOnlyDictionary<string, string> Read(string? value) { try { return JsonSerializer.Deserialize<Dictionary<string, string>>(value ?? "{}", JsonOptions) ?? []; } catch { return new Dictionary<string, string>(); } }
    private static IReadOnlyDictionary<string, string>? ReadOptional(string? value) => string.IsNullOrWhiteSpace(value) ? null : Read(value);
}
