namespace Alife.Domain.Entities;

public class ContactInquiry
{
	public Guid Id { get; set; }
	public Guid ContactProfileId { get; set; }
	public Guid OwnerGroupId { get; set; }
	public Guid? SubmittedByMemberId { get; set; }
	public string DisplayName { get; set; } = string.Empty;
	public string? Email { get; set; }
	public string? Phone { get; set; }
	public string Message { get; set; } = string.Empty;
	public string? PreferredLanguage { get; set; }
	public string? SourcePage { get; set; }
	public string? IpAddress { get; set; }
	public string? UserAgent { get; set; }
	public DateTime SubmittedUtc { get; set; }
	public DateTime CreatedUtc { get; set; }
	public DateTime UpdatedUtc { get; set; }

	public ContactProfile ContactProfile { get; set; } = null!;
	public Group OwnerGroup { get; set; } = null!;
	public Member? SubmittedByMember { get; set; }
}
