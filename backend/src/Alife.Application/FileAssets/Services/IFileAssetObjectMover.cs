namespace Alife.Application.FileAssets.Services;

public sealed record MoveFileAssetObjectResult(
    bool Ok,
    bool SourceExists,
    bool TargetExists,
    string? Message);

public interface IFileAssetObjectMover
{
    Task<MoveFileAssetObjectResult> MoveAsync(
        string sourceKey,
        string targetKey,
        bool dryRun,
        CancellationToken cancellationToken);
}
