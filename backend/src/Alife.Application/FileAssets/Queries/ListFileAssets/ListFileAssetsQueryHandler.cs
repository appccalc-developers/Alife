using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.FileAssets.Dtos;
using Alife.Application.Groups.Services;
using Alife.Application.Admin;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.FileAssets.Queries.ListFileAssets;

public sealed class ListFileAssetsQueryHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<ListFileAssetsQuery, AppResult<PagedResult<FileAssetDto>>>
{
    public async Task<AppResult<PagedResult<FileAssetDto>>> Handle(
        ListFileAssetsQuery request,
        CancellationToken cancellationToken)
    {
        var page = Math.Max(request.Page, 1);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        if (request.GroupId.HasValue)
        {
            var canManageGroup = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                request.GroupId.Value,
                request.CurrentMemberId,
                cancellationToken);

            if (!canManageGroup)
            {
                return AppResult<PagedResult<FileAssetDto>>.Forbidden("Only group leaders and co-leaders can view group files.");
            }
        }
        else
        {
            var canViewPlatformFiles = await AdminPlatformRoleHelpers.HasPermissionAsync(
                dbContext,
                request.CurrentMemberId,
                AdminPermissionCatalog.ViewFiles,
                cancellationToken);
            if (!canViewPlatformFiles)
            {
                return AppResult<PagedResult<FileAssetDto>>.Forbidden("File management permission is required.");
            }
        }

        var relatedEntityType = request.RelatedEntityType?.Trim().ToLowerInvariant();
        var query = dbContext.FileAssets
            .AsNoTracking()
            .Where(x => !x.IsDeleted);

        if (request.GroupId.HasValue)
        {
            query = query.Where(x => x.GroupId == request.GroupId.Value);
        }
        else if (request.UnassignedOnly)
        {
            query = query.Where(x => x.GroupId == null);
        }

        if (request.Visibility.HasValue)
        {
            query = query.Where(x => x.Visibility == request.Visibility.Value);
        }

        if (request.Purpose.HasValue)
        {
            query = query.Where(x => x.Purpose == request.Purpose.Value);
        }

        if (!string.IsNullOrWhiteSpace(relatedEntityType))
        {
            query = query.Where(x => x.RelatedEntityType == relatedEntityType);
        }

        if (request.RelatedEntityId.HasValue)
        {
            query = query.Where(x => x.RelatedEntityId == request.RelatedEntityId.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var fileAssets = await ApplySort(query, request.SortBy, request.SortDirection)
            .ThenByDescending(x => x.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);
        var files = fileAssets.Select(ToDto).ToList();

        return AppResult<PagedResult<FileAssetDto>>.Success(new PagedResult<FileAssetDto>(files, page, pageSize, totalCount));
    }

    private static FileAssetDto ToDto(Domain.Entities.FileAsset fileAsset)
        => new(
            fileAsset.Id,
            fileAsset.StorageProvider,
            fileAsset.BucketName,
            fileAsset.ObjectKey,
            fileAsset.Visibility == Domain.Enums.FileAssetVisibility.MemberPrivate ? null : fileAsset.PublicUrl,
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

    private static IOrderedQueryable<Domain.Entities.FileAsset> ApplySort(
        IQueryable<Domain.Entities.FileAsset> query,
        FileAssetSortBy sortBy,
        SortDirection sortDirection)
    {
        var ascending = sortDirection == SortDirection.Asc;
        return sortBy switch
        {
            FileAssetSortBy.CreatedUtc => ascending
                ? query.OrderBy(x => x.CreatedUtc)
                : query.OrderByDescending(x => x.CreatedUtc),
            FileAssetSortBy.SizeBytes => ascending
                ? query.OrderBy(x => x.SizeBytes)
                : query.OrderByDescending(x => x.SizeBytes),
            FileAssetSortBy.OriginalFileName => ascending
                ? query.OrderBy(x => x.OriginalFileName)
                : query.OrderByDescending(x => x.OriginalFileName),
            FileAssetSortBy.Purpose => ascending
                ? query.OrderBy(x => x.Purpose)
                : query.OrderByDescending(x => x.Purpose),
            FileAssetSortBy.Visibility => ascending
                ? query.OrderBy(x => x.Visibility)
                : query.OrderByDescending(x => x.Visibility),
            _ => ascending
                ? query.OrderBy(x => x.UploadedUtc)
                : query.OrderByDescending(x => x.UploadedUtc)
        };
    }
}
