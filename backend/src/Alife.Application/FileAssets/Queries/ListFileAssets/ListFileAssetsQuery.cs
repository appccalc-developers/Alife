using Alife.Application.Common.Models;
using Alife.Application.FileAssets.Dtos;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.FileAssets.Queries.ListFileAssets;

public enum FileAssetSortBy
{
    UploadedUtc,
    CreatedUtc,
    SizeBytes,
    OriginalFileName,
    Purpose,
    Visibility
}

public enum SortDirection
{
    Desc,
    Asc
}

public sealed record ListFileAssetsQuery(
    Guid CurrentMemberId,
    Guid? GroupId,
    FileAssetVisibility? Visibility,
    FileAssetPurpose? Purpose,
    string? RelatedEntityType,
    Guid? RelatedEntityId,
    bool UnassignedOnly,
    int Page,
    int PageSize,
    FileAssetSortBy SortBy,
    SortDirection SortDirection) : IRequest<AppResult<PagedResult<FileAssetDto>>>;
