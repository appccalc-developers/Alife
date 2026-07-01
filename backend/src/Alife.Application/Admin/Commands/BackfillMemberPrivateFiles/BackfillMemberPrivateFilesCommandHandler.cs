using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.FileAssets.Services;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Admin.Commands.BackfillMemberPrivateFiles;

public sealed class BackfillMemberPrivateFilesCommandHandler(
    IAlifeDbContext dbContext,
    IFileAssetObjectMover fileAssetObjectMover)
    : IRequestHandler<BackfillMemberPrivateFilesCommand, AppResult<FileAssetPrivateBackfillResultDto>>
{
    public async Task<AppResult<FileAssetPrivateBackfillResultDto>> Handle(
        BackfillMemberPrivateFilesCommand request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.IsSuperAdminAsync(dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<FileAssetPrivateBackfillResultDto>.Forbidden("Only super admins can backfill private file storage.");
        }

        var maxItems = Math.Clamp(request.MaxItems <= 0 ? 50 : request.MaxItems, 1, 200);
        var fileAssets = await dbContext.FileAssets
            .Where(x =>
                !x.IsDeleted &&
                x.Visibility == FileAssetVisibility.MemberPrivate &&
                (x.PublicUrl != null || !x.ObjectKey.StartsWith("private/")))
            .OrderBy(x => x.CreatedUtc)
            .Take(maxItems)
            .ToListAsync(cancellationToken);

        var items = new List<FileAssetPrivateBackfillItemDto>();
        var moved = 0;
        var metadataUpdated = 0;
        var failed = 0;

        foreach (var fileAsset in fileAssets)
        {
            var sourceKey = NormalizeObjectKey(fileAsset.ObjectKey);
            var targetKey = ToPrivateObjectKey(sourceKey);
            var publicUrlWillBeCleared = !string.IsNullOrWhiteSpace(fileAsset.PublicUrl);

            if (request.DryRun)
            {
                var dryRunMove = await fileAssetObjectMover.MoveAsync(sourceKey, targetKey, dryRun: true, cancellationToken);
                items.Add(new FileAssetPrivateBackfillItemDto(
                    fileAsset.Id,
                    sourceKey,
                    targetKey,
                    publicUrlWillBeCleared,
                    false,
                    false,
                    dryRunMove.Message));
                continue;
            }

            if (!StringComparer.Ordinal.Equals(sourceKey, targetKey))
            {
                var moveResult = await fileAssetObjectMover.MoveAsync(sourceKey, targetKey, dryRun: false, cancellationToken);
                if (!moveResult.Ok)
                {
                    failed += 1;
                    items.Add(new FileAssetPrivateBackfillItemDto(
                        fileAsset.Id,
                        sourceKey,
                        targetKey,
                        publicUrlWillBeCleared,
                        false,
                        false,
                        moveResult.Message ?? "R2 object move failed."));
                    continue;
                }

                moved += 1;
            }

            fileAsset.ObjectKey = targetKey;
            fileAsset.PublicUrl = null;
            fileAsset.UpdatedUtc = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            metadataUpdated += 1;

            items.Add(new FileAssetPrivateBackfillItemDto(
                fileAsset.Id,
                sourceKey,
                targetKey,
                publicUrlWillBeCleared,
                !StringComparer.Ordinal.Equals(sourceKey, targetKey),
                true,
                null));
        }

        return AppResult<FileAssetPrivateBackfillResultDto>.Success(
            new FileAssetPrivateBackfillResultDto(
                request.DryRun,
                fileAssets.Count,
                moved,
                metadataUpdated,
                failed,
                items));
    }

    private static string NormalizeObjectKey(string value)
        => value.Trim().Replace('\\', '/').TrimStart('/');

    private static string ToPrivateObjectKey(string sourceKey)
        => sourceKey.StartsWith("private/", StringComparison.Ordinal)
            ? sourceKey
            : $"private/{sourceKey}";
}
