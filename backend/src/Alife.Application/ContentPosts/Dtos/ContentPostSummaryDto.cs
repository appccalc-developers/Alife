using Alife.Domain.Enums;

namespace Alife.Application.ContentPosts.Dtos;

public sealed record ContentPostSummaryDto(
    Guid Id,
    Guid OwnerGroupId,
    IReadOnlyDictionary<string, string> Title,
    IReadOnlyDictionary<string, string> Summary,
    ContentPostCategory Category,
    string Slug,
    string? CoverImageUrl,
    string? Byline,
    DateTime PublishedUtc,
    DateTime UpdatedUtc);
