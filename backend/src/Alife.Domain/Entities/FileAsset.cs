using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class FileAsset
{
    public Guid Id { get; set; }

    public string StorageProvider { get; set; } = "cloudflare-r2";
    public Guid? StorageProviderId { get; set; }
    public string BucketName { get; set; } = string.Empty;
    public string ObjectKey { get; set; } = string.Empty;
    public string? PublicUrl { get; set; }

    public string OriginalFileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string? ETag { get; set; }

    public FileAssetVisibility Visibility { get; set; }
    public FileAssetPurpose Purpose { get; set; }

    public Guid? GroupId { get; set; }
    public Guid? OwnerMemberId { get; set; }
    public string? RelatedEntityType { get; set; }
    public Guid? RelatedEntityId { get; set; }

    public DateTime UploadedUtc { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedUtc { get; set; }

    public Group? Group { get; set; }
    public Member? OwnerMember { get; set; }
    public FileStorageProvider? StorageProviderProfile { get; set; }
}
