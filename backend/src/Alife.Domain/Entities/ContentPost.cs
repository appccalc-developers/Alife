using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class ContentPost
{
    public Guid Id { get; set; }
    public Guid OwnerGroupId { get; set; }
    public Guid CreatedByMemberId { get; set; }
    public string TitleJson { get; set; } = "{}";
    public string SummaryJson { get; set; } = "{}";
    public string BodyJson { get; set; } = "{}";
    public ContentPostCategory Category { get; set; }
    public ContentPostStatus Status { get; set; }
    public ContentPostVisibility Visibility { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string? CoverImageUrl { get; set; }
    public string? Byline { get; set; }
    public DateTime? PublishedUtc { get; set; }
    public string? SourceUrl { get; set; }
    public string? SourceKey { get; set; }
    public string? SourceChecksum { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
    public bool IsDeleted { get; set; }

    public Group OwnerGroup { get; set; } = null!;
    public Member CreatedByMember { get; set; } = null!;
}
