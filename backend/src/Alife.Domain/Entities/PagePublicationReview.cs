using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class PagePublicationReview
{
	public Guid Id { get; set; }
	public Guid PageId { get; set; }
	public PagePublicationReviewStatus Status { get; set; }
	public string? PrimaryMenuNameJson { get; set; }
	public string? AccessNameJson { get; set; }
	public string? CardImageUrl { get; set; }
	public string? CardTextJson { get; set; }
	public string? ReturnReason { get; set; }
	public Guid? ReviewedByMemberId { get; set; }
	public DateTime? ReviewedUtc { get; set; }
	public DateTime CreatedUtc { get; set; }
	public DateTime UpdatedUtc { get; set; }

	public Page Page { get; set; } = null!;
	public Member? ReviewedByMember { get; set; }
}
