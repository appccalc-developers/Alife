using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class PagePublicationReview
{
	public Guid Id { get; set; }
	public Guid PageId { get; set; }
	public PagePublicationReviewStatus Status { get; set; }
	public Guid? PrimaryMenuId { get; set; }
	public string? PrimaryMenuNameJson { get; set; }
	public int MenuSortOrder { get; set; }
	public string? AccessNameJson { get; set; }
	public string? CardImageUrl { get; set; }
	public string? CardTextJson { get; set; }
	public string? ReturnReason { get; set; }
	public string? SubmittedSnapshotJson { get; set; }
	public Guid? SubmittedByMemberId { get; set; }
	public DateTime? SubmittedUtc { get; set; }
	public string? PublishedSnapshotJson { get; set; }
	public Guid? PublishedByMemberId { get; set; }
	public DateTime? PublishedUtc { get; set; }
	public Guid? ReviewedByMemberId { get; set; }
	public DateTime? ReviewedUtc { get; set; }
	public DateTime CreatedUtc { get; set; }
	public DateTime UpdatedUtc { get; set; }

	public Page Page { get; set; } = null!;
	public PagePrimaryMenu? PrimaryMenu { get; set; }
	public Member? SubmittedByMember { get; set; }
	public Member? PublishedByMember { get; set; }
	public Member? ReviewedByMember { get; set; }
}
