using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.FileAssets.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.FileAssets.Queries.GetFileAssetOpenUrl;

public sealed class GetFileAssetOpenUrlQueryHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IFileAssetAccessUrlSigner fileAssetAccessUrlSigner)
    : IRequestHandler<GetFileAssetOpenUrlQuery, AppResult<string>>
{
    public async Task<AppResult<string>> Handle(
        GetFileAssetOpenUrlQuery request,
        CancellationToken cancellationToken)
    {
        var fileAsset = await dbContext.FileAssets
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.FileAssetId && !x.IsDeleted, cancellationToken);

        if (fileAsset is null)
        {
            return AppResult<string>.NotFound("File not found.");
        }

        // The dedicated endpoint rechecks current church membership before signing.
        if (fileAsset.Purpose == FileAssetPurpose.SundayBulletin)
            return AppResult<string>.Success($"/api/church-life/bulletins/{fileAsset.StoredFileName.Replace(".pdf", "")}/open");

        if (fileAsset.Visibility != FileAssetVisibility.MemberPrivate && string.IsNullOrWhiteSpace(fileAsset.PublicUrl))
        {
            return AppResult<string>.NotFound("File URL not found.");
        }

        var canOpen = await CanOpenAsync(
            fileAsset.Visibility,
            fileAsset.GroupId,
            fileAsset.OwnerMemberId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canOpen)
        {
            return AppResult<string>.Forbidden("You do not have access to this file.");
        }

        if (fileAsset.Visibility == FileAssetVisibility.MemberPrivate)
        {
            try
            {
                var url = await fileAssetAccessUrlSigner.CreatePrivateReadUrlAsync(
                    fileAsset.StorageProvider,
                    fileAsset.ObjectKey,
                    TimeSpan.FromMinutes(5),
                    cancellationToken);
                return AppResult<string>.Success(url);
            }
            catch (InvalidOperationException ex)
            {
                return AppResult<string>.Conflict(ex.Message);
            }
        }

        return AppResult<string>.Success(fileAsset.PublicUrl!);
    }

    private async Task<bool> CanOpenAsync(
        FileAssetVisibility visibility,
        Guid? groupId,
        Guid? ownerMemberId,
        Guid currentMemberId,
        CancellationToken cancellationToken)
    {
        if (visibility == FileAssetVisibility.Public)
        {
            return true;
        }

        var isAdmin = await groupAuthorizationService.IsAdminAsync(currentMemberId, cancellationToken);
        if (isAdmin)
        {
            return true;
        }

        if (visibility == FileAssetVisibility.MemberPrivate)
        {
            if (ownerMemberId == currentMemberId)
            {
                return true;
            }

            return groupId.HasValue &&
                   await groupAuthorizationService.IsLeaderOrCoLeaderAsync(groupId.Value, currentMemberId, cancellationToken);
        }

        return groupId.HasValue &&
               await groupAuthorizationService.IsApprovedMemberAsync(groupId.Value, currentMemberId, cancellationToken);
    }
}
