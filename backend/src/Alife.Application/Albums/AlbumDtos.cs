using Alife.Domain.Enums;

namespace Alife.Application.Albums;

public sealed record AlbumSummaryDto(
    Guid Id,
    Guid GroupId,
    Guid? ParentAlbumId,
    IReadOnlyDictionary<string, string> Name,
    IReadOnlyDictionary<string, string>? Description,
    AlbumVisibility Visibility,
    int SortOrder,
    string? CoverUrl,
    int PhotoCount,
    int ChildCount);

public sealed record AlbumPhotoDto(
    Guid Id,
    Guid FileAssetId,
    IReadOnlyDictionary<string, string>? Caption,
    int SortOrder,
    string Url,
    string ObjectKey,
    string OriginalFileName,
    int Width,
    int Height);

public sealed record AlbumDetailDto(
    AlbumSummaryDto Album,
    IReadOnlyList<AlbumSummaryDto> Breadcrumbs,
    IReadOnlyList<AlbumSummaryDto> Children,
    IReadOnlyList<AlbumPhotoDto> Photos,
    bool CanManage);

public sealed record CreateAlbumInput(
    Guid GroupId,
    Guid? ParentAlbumId,
    IReadOnlyDictionary<string, string> Name,
    IReadOnlyDictionary<string, string>? Description,
    AlbumVisibility Visibility);
