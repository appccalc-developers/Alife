namespace Alife.Domain.Enums;

public enum FileStorageProviderKind
{
    CloudflareR2 = 1,
    AzureBlob = 2,
    S3Compatible = 3,
    LocalDev = 4
}
