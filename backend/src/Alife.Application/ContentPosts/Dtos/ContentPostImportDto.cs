using Alife.Domain.Enums;

namespace Alife.Application.ContentPosts.Dtos;

public sealed record ContentPostImportItemDto(
    string SourceUrl,
    IReadOnlyDictionary<string, string> Title,
    IReadOnlyDictionary<string, string> Summary,
    IReadOnlyDictionary<string, string> Body,
    ContentPostCategory Category,
    string? Slug,
    string? CoverImageUrl,
    string? Byline,
    DateTime? PublishedUtc,
    IReadOnlyList<string>? SourceWarnings);

public enum ContentPostImportDisposition
{
    Create = 0,
    Update = 1,
    Unchanged = 2,
    Duplicate = 3,
    Conflict = 4,
    Invalid = 5,
    ChangedSkipped = 6
}

public sealed record ContentPostImportItemReportDto(
    int Index,
    string SourceUrl,
    string? CanonicalSourceUrl,
    string? SourceKey,
    string? SourceChecksum,
    string? Slug,
    Guid? ContentPostId,
    ContentPostImportDisposition Disposition,
    bool Applied,
    string ReasonCode,
    IReadOnlyDictionary<string, string> Message,
    IReadOnlyList<string> Warnings);

public sealed record ContentPostImportReportDto(
    Guid BatchId,
    bool DryRun,
    bool Publish,
    bool UpdateChanged,
    int RequestedCount,
    int CreateCount,
    int UpdateCount,
    int UnchangedCount,
    int DuplicateCount,
    int ConflictCount,
    int InvalidCount,
    int ChangedSkippedCount,
    int WarningItemCount,
    DateTime StartedUtc,
    DateTime CompletedUtc,
    IReadOnlyList<ContentPostImportItemReportDto> Items);
