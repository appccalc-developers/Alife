using Alife.Domain.Enums;

namespace Alife.Application.ContentPosts.Dtos;

public sealed record ContentPostDetailDto(
    Guid Id,
    Guid OwnerGroupId,
    IReadOnlyDictionary<string, string> Title,
    IReadOnlyDictionary<string, string> Summary,
    IReadOnlyDictionary<string, string> Body,
    ContentPostCategory Category,
    string Slug,
    string? CoverImageUrl,
    string? Byline,
    string? SourceUrl,
    DateTime PublishedUtc,
    DateTime UpdatedUtc);
