using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class FileStorageProvider
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public FileStorageProviderKind Kind { get; set; }
    public string DisplayNameJson { get; set; } = "{}";
    public bool IsActive { get; set; }
    public bool IsDefault { get; set; }

    public string BucketName { get; set; } = string.Empty;
    public string? Region { get; set; }
    public string? Endpoint { get; set; }
    public string? PublicBaseUrl { get; set; }
    public string? PrivateBaseUrl { get; set; }
    public string? UploadApiBaseUrl { get; set; }
    public string PublicPathPrefix { get; set; } = string.Empty;
    public string PrivatePathPrefix { get; set; } = "private";

    public bool SupportsPublicUrl { get; set; }
    public bool SupportsSignedRead { get; set; }
    public bool SupportsServerSideMove { get; set; }

    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
}
