using Alife.Application.Common.Interfaces;
using Alife.Application.FileAssets.Services;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Api;

public interface IEventFileAssetLinkProbe
{
    Task<bool> IsExistingEventAssetAsync(
        string? storageProvider,
        string? bucketName,
        string? objectKey,
        CancellationToken cancellationToken);
}

public sealed class EventFileAssetLinkProbe(
    IAlifeDbContext db,
    IFileStorageProviderResolver providers) : IEventFileAssetLinkProbe
{
    public async Task<bool> IsExistingEventAssetAsync(
        string? storageProvider,
        string? bucketName,
        string? objectKey,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(objectKey)) return false;

        // Use the same identity normalization as RegisterFileAssetCommandHandler. Its
        // upsert can otherwise change an existing Event asset to a non-Event purpose.
        var provider = await providers.GetByCodeAsync(storageProvider, cancellationToken);
        var normalizedBucket = string.IsNullOrWhiteSpace(bucketName) ? provider.BucketName : bucketName.Trim();
        var normalizedKey = objectKey.Trim().Replace('\\', '/').TrimStart('/');
        var existing = await db.FileAssets.IgnoreQueryFilters().AsNoTracking()
            .Where(asset => asset.StorageProvider == provider.Code &&
                asset.BucketName == normalizedBucket && asset.ObjectKey == normalizedKey)
            .Select(asset => new { asset.Purpose, asset.RelatedEntityType })
            .FirstOrDefaultAsync(cancellationToken);

        return existing is not null &&
            (existing.Purpose is FileAssetPurpose.EventPoster or FileAssetPurpose.EventGallery or
                FileAssetPurpose.EnrollmentPaymentProof or FileAssetPurpose.ReviewPhoto or
                FileAssetPurpose.EventRegistrationMaterial ||
             existing.RelatedEntityType is { } relatedType &&
             (relatedType.Equals("event", StringComparison.OrdinalIgnoreCase) ||
              relatedType.Equals("enrollment", StringComparison.OrdinalIgnoreCase) ||
              relatedType.Equals("review", StringComparison.OrdinalIgnoreCase) ||
              relatedType.Equals("eventRegistrationParticipant", StringComparison.OrdinalIgnoreCase)));
    }
}
