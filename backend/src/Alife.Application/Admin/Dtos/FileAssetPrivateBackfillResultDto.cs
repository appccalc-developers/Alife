namespace Alife.Application.Admin.Dtos;

public sealed record FileAssetPrivateBackfillResultDto(
    bool DryRun,
    int Scanned,
    int Moved,
    int MetadataUpdated,
    int Failed,
    IReadOnlyList<FileAssetPrivateBackfillItemDto> Items);

public sealed record FileAssetPrivateBackfillItemDto(
    Guid FileAssetId,
    string SourceObjectKey,
    string TargetObjectKey,
    bool PublicUrlWillBeCleared,
    bool ObjectMoved,
    bool MetadataUpdated,
    string? Error);
