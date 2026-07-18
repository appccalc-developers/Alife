using Alife.Domain.Enums;

namespace Alife.Application.ContentPosts.Dtos;

public sealed record ManagedContentPostDto(
    Guid Id,
    Guid OwnerGroupId,
    Guid CreatedByMemberId,
    IReadOnlyDictionary<string, string> Title,
    IReadOnlyDictionary<string, string> Summary,
    IReadOnlyDictionary<string, string> Body,
    ContentPostCategory Category,
    ContentPostStatus Status,
    ContentPostVisibility Visibility,
    string Slug,
    string? CoverImageUrl,
    string? Byline,
    DateTime? PublishedUtc,
    string? SourceUrl,
    string? SourceKey,
    string? SourceChecksum,
    DateTime CreatedUtc,
    DateTime UpdatedUtc);
